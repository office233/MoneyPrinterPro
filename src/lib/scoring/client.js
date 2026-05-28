/**
 * Scoring Client — calls the Python FastAPI scoring service
 * Default: http://localhost:8000
 */

const SCORING_URL = process.env.SCORING_SERVICE_URL || 'http://localhost:8000';

/**
 * Check if the scoring service is available
 */
export async function isScoringAvailable() {
  try {
    const res = await fetch(`${SCORING_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Score a video by file path (local use)
 * @param {string} videoPath - Absolute path to video file
 * @param {number} targetFps - Target FPS for analysis (default 10)
 * @returns {Promise<object>} Scoring results
 */
export async function scoreVideoByPath(videoPath, targetFps = 10) {
  const res = await fetch(`${SCORING_URL}/score-path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_path: videoPath, target_fps: targetFps }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Scoring service error' }));
    throw new Error(err.detail || 'Scoring failed');
  }
  return res.json();
}

/**
 * Score a video by uploading the file
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<object>} Scoring results
 */
export async function scoreVideoByUpload(videoBuffer, filename) {
  const formData = new FormData();
  const blob = new Blob([videoBuffer], { type: 'video/mp4' });
  formData.append('file', blob, filename);

  const res = await fetch(`${SCORING_URL}/score`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Scoring service error' }));
    throw new Error(err.detail || 'Scoring failed');
  }
  return res.json();
}
