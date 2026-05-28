"""
Money Printer Pro — Video Scoring Service
FastAPI microservice for AI-powered video quality analysis.

Ported from D:\workspace\video_ai\ scoring system.
Uses InsightFace for face detection and OpenCV for video analysis.

Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
import sys
import tempfile
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, asdict

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Optional InsightFace import
try:
    from insightface.app import FaceAnalysis
    HAS_INSIGHTFACE = True
except ImportError:
    HAS_INSIGHTFACE = False
    print("⚠️  InsightFace not installed. Face analysis will use Haar cascades fallback.")

app = FastAPI(
    title="Money Printer Pro — Scoring Service",
    description="AI video quality scoring: face stability, eye engagement, lighting, motion, composition",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Data classes ───

@dataclass
class FaceBox:
    cx: float
    cy: float
    w: float
    h: float
    conf: float

@dataclass
class FrameScore:
    timestamp: float
    face_stability: float
    eye_engagement: float
    lighting_consistency: float
    motion_smoothness: float
    composition: float
    found_face: bool
    final_score: float


# ─── Utility functions (from video_ai/utils/normalizer.py) ───

def clamp01(x):
    return float(max(0.0, min(1.0, x)))

def smooth_1d(arr, w=3):
    if len(arr) < w:
        return arr
    out = []
    half = w // 2
    for i in range(len(arr)):
        lo = max(0, i - half)
        hi = min(len(arr), i + half + 1)
        out.append(float(np.mean(arr[lo:hi])))
    return out

def robust_zcap(arr, z=3.0):
    a = np.array(arr, dtype=np.float64)
    med = np.median(a)
    mad = np.median(np.abs(a - med)) + 1e-9
    return [clamp01(float(x)) if abs(x - med) / mad < z else clamp01(float(med)) for x in a]

def normalize_to_01(arr):
    a = np.array(arr, dtype=np.float64)
    mn, mx = a.min(), a.max()
    if mx - mn < 1e-9:
        return [0.5] * len(arr)
    return [float((x - mn) / (mx - mn)) for x in a]


# ─── Scoring functions (from video_ai/scoring/) ───

def score_lighting_pairs(frames):
    """Score lighting consistency between consecutive frames."""
    results = []
    prev_gray = None
    for ts, frame in frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is None:
            results.append({"score": 0.9, "delta_mean": 0.0, "delta_contrast": 0.0})
            prev_gray = gray
            continue
        delta_mean = abs(float(np.mean(gray)) - float(np.mean(prev_gray))) / 255.0
        delta_contrast = abs(float(np.std(gray)) - float(np.std(prev_gray))) / 128.0
        score = clamp01(1.0 - (delta_mean * 3.0 + delta_contrast * 2.0))
        results.append({"score": score, "delta_mean": delta_mean, "delta_contrast": delta_contrast})
        prev_gray = gray
    return results

def score_motion_pairs(frames):
    """Score motion smoothness using optical flow."""
    results = []
    prev_gray = None
    for ts, frame in frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is None:
            results.append({"score": 0.9, "flow_mean": 0.0, "flow_var": 0.0})
            prev_gray = gray
            continue
        try:
            flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            mag = np.sqrt(flow[..., 0]**2 + flow[..., 1]**2)
            flow_mean = float(np.mean(mag))
            flow_var = float(np.var(mag))
            score = clamp01(1.0 - (flow_mean / 20.0) - (flow_var / 50.0))
        except Exception:
            score, flow_mean, flow_var = 0.5, 0.0, 0.0
        results.append({"score": score, "flow_mean": flow_mean, "flow_var": flow_var})
        prev_gray = gray
    return results

def score_composition_frames(frame_shape, face_boxes):
    """Score composition: rule of thirds + headroom."""
    h, w = frame_shape[:2]
    cx_third = w / 3.0
    cy_third = h / 3.0
    results = []
    for fb in face_boxes:
        if fb is None:
            results.append({"score": 0.3, "thirds_dist_norm": 1.0, "headroom_ok": False})
            continue
        # Distance to nearest third line
        dx = min(abs(fb.cx - cx_third), abs(fb.cx - 2 * cx_third)) / w
        dy = min(abs(fb.cy - cy_third), abs(fb.cy - 2 * cy_third)) / h
        thirds_dist = float(np.sqrt(dx**2 + dy**2))
        # Headroom check
        face_top = fb.cy - fb.h / 2
        headroom = face_top / h
        headroom_ok = 0.05 < headroom < 0.35
        score = clamp01(0.4 + 0.4 * (1.0 - thirds_dist * 3.0) + (0.2 if headroom_ok else 0.0))
        results.append({"score": score, "thirds_dist_norm": thirds_dist, "headroom_ok": headroom_ok})
    return results


# ─── Face detection ───

_face_app = None

def get_face_app():
    global _face_app
    if _face_app is not None:
        return _face_app
    if HAS_INSIGHTFACE:
        _face_app = FaceAnalysis(providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app

def detect_face_insightface(frame):
    app = get_face_app()
    if app is None:
        return None, None
    faces = app.get(frame)
    if not faces:
        return None, None
    best = max(faces, key=lambda f: float(getattr(f, "det_score", 0.0)))
    if float(getattr(best, "det_score", 0.0)) < 0.45:
        return None, None
    bbox = np.array(best.bbox, dtype=np.float32)
    x1, y1, x2, y2 = bbox.tolist()
    fb = FaceBox(cx=(x1+x2)/2, cy=(y1+y2)/2, w=max(1, x2-x1), h=max(1, y2-y1), conf=float(best.det_score))
    kps = getattr(best, "kps", None)
    return fb, kps

def detect_face_haar(frame):
    """Fallback face detection using Haar cascades."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
    if len(faces) == 0:
        return None, None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    fb = FaceBox(cx=x + w/2, cy=y + h/2, w=float(w), h=float(h), conf=0.7)
    return fb, None

def detect_face(frame):
    if HAS_INSIGHTFACE:
        return detect_face_insightface(frame)
    return detect_face_haar(frame)

def score_eye_from_landmarks(kps):
    """Eye engagement from 5-point landmarks (proxy via head pose)."""
    if kps is None:
        return 0.7, 0.0, 0.0
    pts = np.array(kps, dtype=np.float32)
    if len(pts) < 5:
        return 0.7, 0.0, 0.0
    le, re = pts[0], pts[1]
    nose = pts[2]
    eye_center = (le + re) / 2.0
    dx = float(nose[0] - eye_center[0])
    dy = float(nose[1] - eye_center[1])
    eye_dist = float(np.linalg.norm(le - re)) + 1e-6
    yaw = float(np.degrees(np.arctan2(dx, eye_dist)))
    pitch = float(np.degrees(np.arctan2(dy, eye_dist)))
    score = clamp01(1.0 - (abs(yaw) / 45.0) - (abs(pitch) / 35.0) * 0.5)
    return score, yaw, pitch


# ─── Main scorer ───

def score_video(video_path: str, target_fps: float = 10.0):
    """
    Score a video file. Returns frame scores and aggregate stats.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    step = max(1, int(fps / target_fps))

    # Extract frames
    frames = []
    idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % step == 0:
            ts = idx / fps
            # Downscale for performance
            h, w = frame.shape[:2]
            if w > 720:
                scale = 720.0 / w
                frame = cv2.resize(frame, (720, int(h * scale)))
            frames.append((ts, frame))
        idx += 1
    cap.release()

    if not frames:
        raise ValueError("No frames extracted from video")

    # Detect faces
    face_boxes = []
    eye_scores_raw = []
    found_flags = []
    for _, frame in frames:
        fb, kps = detect_face(frame)
        face_boxes.append(fb)
        found_flags.append(fb is not None)
        if fb is not None:
            score, _, _ = score_eye_from_landmarks(kps)
            eye_scores_raw.append(score)
        else:
            eye_scores_raw.append(0.1)

    # Face stability
    h0, w0 = frames[0][1].shape[:2]
    diag = float((w0**2 + h0**2) ** 0.5) + 1e-6
    k_pos, k_size = 4.5, 3.5
    face_stab = []
    prev = None
    prev_valid = None
    for fb in face_boxes:
        if fb is None:
            face_stab.append(0.1)
            prev = None
            continue
        ref = prev if prev is not None else prev_valid
        if ref is None:
            face_stab.append(0.95)
            prev = fb
            prev_valid = fb
            continue
        dpos = float(((fb.cx - ref.cx)**2 + (fb.cy - ref.cy)**2) ** 0.5)
        drift_norm = dpos / diag
        area = fb.w * fb.h
        ref_area = ref.w * ref.h
        size_drift = abs(np.log(max(1e-6, area / (ref_area + 1e-6))))
        pos_score = float(np.exp(-k_pos * drift_norm))
        size_score = float(np.exp(-k_size * size_drift))
        s = 0.15 + 0.85 * (0.65 * pos_score + 0.35 * size_score)
        face_stab.append(clamp01(s))
        prev = fb
        prev_valid = fb

    # Other scores
    light_res = score_lighting_pairs(frames)
    motion_res = score_motion_pairs(frames)
    comp_res = score_composition_frames(frames[0][1].shape, face_boxes)

    # Normalize
    def prep(raw):
        capped = robust_zcap(raw, z=3.0)
        normed = normalize_to_01(capped)
        sm = smooth_1d(normed, w=3)
        return [clamp01(x) for x in sm]

    face_scores = [clamp01(x) for x in smooth_1d(face_stab, w=3)]
    eye_scores = prep(eye_scores_raw)
    light_scores = prep([r["score"] for r in light_res])
    motion_scores = prep([r["score"] for r in motion_res])
    comp_scores = prep([r["score"] for r in comp_res])

    # Weighted final
    W = {"face": 0.25, "eye": 0.20, "light": 0.20, "motion": 0.20, "comp": 0.15}
    frame_results = []
    for i in range(len(frames)):
        base = (
            W["face"] * face_scores[i] +
            W["eye"] * eye_scores[i] +
            W["light"] * light_scores[i] +
            W["motion"] * motion_scores[i] +
            W["comp"] * comp_scores[i]
        )
        if not found_flags[i]:
            base = min(base, 0.20)
        frame_results.append(FrameScore(
            timestamp=frames[i][0],
            face_stability=face_scores[i],
            eye_engagement=eye_scores[i],
            lighting_consistency=light_scores[i],
            motion_smoothness=motion_scores[i],
            composition=comp_scores[i],
            found_face=found_flags[i],
            final_score=clamp01(base),
        ))

    # Aggregate
    finals = [f.final_score for f in frame_results]
    mean_score = float(np.mean(finals))
    variance = float(np.var(finals))
    best_score = float(np.max(finals))
    worst_score = float(np.min(finals))
    face_found_ratio = sum(found_flags) / max(1, len(found_flags))

    # Confidence
    if face_found_ratio > 0.8 and variance < 0.01:
        confidence = "high"
    elif face_found_ratio > 0.5 and variance < 0.03:
        confidence = "medium"
    else:
        confidence = "low"

    # Best window (sliding window for best 4.5s segment)
    window_sec = 4.5
    fps_actual = len(frames) / max(0.1, duration)
    window_frames = max(1, int(window_sec * fps_actual))
    best_window = None
    if len(finals) >= window_frames:
        best_mean = -1
        for start in range(len(finals) - window_frames + 1):
            segment = finals[start:start + window_frames]
            seg_mean = float(np.mean(segment))
            seg_var = float(np.var(segment))
            adjusted = seg_mean - 0.5 * seg_var
            if adjusted > best_mean:
                best_mean = adjusted
                best_window = {
                    "start_sec": frame_results[start].timestamp,
                    "end_sec": frame_results[start + window_frames - 1].timestamp,
                    "mean_score": seg_mean,
                    "variance": seg_var,
                    "final_score": adjusted,
                }

    return {
        "duration_sec": duration,
        "total_frames_analyzed": len(frames),
        "face_found_ratio": round(face_found_ratio, 3),
        "mean_score": round(mean_score, 4),
        "best_score": round(best_score, 4),
        "worst_score": round(worst_score, 4),
        "variance": round(variance, 6),
        "confidence": confidence,
        "best_window": best_window,
        "weights": W,
        "channel_means": {
            "face_stability": round(float(np.mean(face_scores)), 4),
            "eye_engagement": round(float(np.mean(eye_scores)), 4),
            "lighting": round(float(np.mean(light_scores)), 4),
            "motion": round(float(np.mean(motion_scores)), 4),
            "composition": round(float(np.mean(comp_scores)), 4),
        },
        "frames": [asdict(f) for f in frame_results],
    }


# ─── API Routes ───

@app.get("/health")
def health():
    return {
        "status": "ok",
        "insightface": HAS_INSIGHTFACE,
        "opencv": cv2.__version__,
    }

@app.post("/score")
async def score_endpoint(file: UploadFile = File(...)):
    """Score an uploaded video file."""
    if not file.filename.lower().endswith((".mp4", ".webm", ".mov", ".avi")):
        raise HTTPException(400, "Only video files are supported (.mp4, .webm, .mov, .avi)")

    # Save to temp file
    suffix = Path(file.filename).suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = score_video(tmp_path)
        return result
    except Exception as e:
        raise HTTPException(500, f"Scoring failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

class ScorePathRequest(BaseModel):
    video_path: str
    target_fps: float = 10.0

@app.post("/score-path")
async def score_path_endpoint(req: ScorePathRequest):
    """Score a video by file path (for local use)."""
    if not os.path.exists(req.video_path):
        raise HTTPException(404, f"Video not found: {req.video_path}")
    try:
        result = score_video(req.video_path, req.target_fps)
        return result
    except Exception as e:
        raise HTTPException(500, f"Scoring failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
