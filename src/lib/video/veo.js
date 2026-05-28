import fs from 'fs/promises';
import path from 'path';
import { GENERATED_DIR, ensureDir } from './personas.js';

/**
 * VEO Video Generator — ported from D:\workspace\scripts\generate-veo-video.py
 * Generates 8-second 9:16 videos from images using Google VEO 3.1 via Vertex AI
 */

const VEO_MODEL = 'veo-3.1-generate-001';
const VEO_PROJECT = process.env.VEO_PROJECT || 'exalted-gamma-486916-v0';
const VEO_LOCATION = process.env.VEO_LOCATION || 'us-central1';
const VEO_TIMEOUT_MS = 300_000; // 5 minutes
const VEO_POLL_INTERVAL_MS = 10_000; // 10 seconds

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build video prompt from caption and metadata
 */
function buildVideoPrompt(caption, promptMeta = {}, isContinuation = false) {
  if (isContinuation) {
    const motion = promptMeta.motion_profile || 'minimal';
    const camera = promptMeta.camera || 'static';

    return `Continue seamlessly from the provided frame.
Do not alter wardrobe, hairstyle, lighting or location.
Maintain visual continuity and identity consistency.
No sudden position jumps or scene changes.

Cinematic continuation, 8 seconds:
Camera: ${camera} movement
Motion: ${motion} natural progression
Style: Editorial fashion film, professional grade`.trim();
  }

  const shot = promptMeta.shot || 'medium shot';
  const location = promptMeta.location || 'urban setting';
  const lighting = promptMeta.lighting || 'natural lighting';
  const motion = promptMeta.motion_profile || 'subtle';

  return `Cinematic fashion video, 8 seconds:

Setting: ${location}
Subject: A woman wearing ${caption}
Camera: ${shot}, static position
Lighting: ${lighting}
Motion: ${motion}, minimal camera movement
Style: Editorial fashion film, professional grade`.trim();
}

/**
 * Detect MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return types[ext] || 'image/png';
}

/**
 * Generate a video using VEO 3.1 API
 * 
 * @param {string} apiKey - Gemini/Google API key
 * @param {string} imagePath - Path to source image
 * @param {string} caption - Description/caption for the video
 * @param {object} promptMeta - Additional prompt metadata (shot, location, lighting, motion_profile, camera)
 * @param {string|null} continuationFrom - Path to continuation frame (for seamless chaining)
 * @returns {Promise<{videoPath: string, duration_ms: number}>}
 */
export async function generateVideo(apiKey, imagePath, caption, promptMeta = {}, continuationFrom = null) {
  const { GoogleGenAI } = await import('@google/genai');

  const inputPath = continuationFrom || imagePath;
  const isContinuation = !!continuationFrom;
  const videoPrompt = buildVideoPrompt(caption, promptMeta, isContinuation);

  // Read input image
  const imageBytes = await fs.readFile(inputPath);
  const mimeType = getMimeType(inputPath);
  const imageBase64 = imageBytes.toString('base64');

  // Initialize client
  // Try Vertex AI first, fall back to Gemini API key
  let client;
  try {
    client = new GoogleGenAI({
      vertexai: true,
      project: VEO_PROJECT,
      location: VEO_LOCATION,
    });
  } catch {
    // Fall back to API key mode
    client = new GoogleGenAI({ apiKey });
  }

  const startTime = Date.now();

  // Call VEO API
  let operation;
  try {
    operation = await client.models.generateVideos({
      model: VEO_MODEL,
      prompt: videoPrompt,
      image: {
        imageBytes: imageBase64,
        mimeType,
      },
      config: {
        durationSeconds: 8,
        aspectRatio: '9:16',
        fps: 24,
        generateAudio: false,
      },
    });
  } catch (err) {
    throw new Error(`VEO API call failed: ${err.message}`);
  }

  // Poll for completion
  const deadline = Date.now() + VEO_TIMEOUT_MS;

  while (!operation.done) {
    if (Date.now() > deadline) {
      throw new Error('VEO generation timed out (5 minutes). Try again.');
    }
    await sleep(VEO_POLL_INTERVAL_MS);
    try {
      operation = await client.operations.get({ operation });
    } catch (err) {
      throw new Error(`VEO polling failed: ${err.message}`);
    }
  }

  // Extract video data
  if (!operation.result?.generatedVideos?.length) {
    throw new Error('VEO returned no videos. The prompt may have been refused.');
  }

  const video = operation.result.generatedVideos[0];
  let videoData = null;

  if (video.video?.videoBytes) {
    videoData = Buffer.from(video.video.videoBytes, 'base64');
  } else if (video.video?.uri) {
    // Download from URI
    const response = await fetch(video.video.uri);
    if (!response.ok) throw new Error(`Failed to download video from ${video.video.uri}`);
    videoData = Buffer.from(await response.arrayBuffer());
  } else if (video.videoBytes) {
    videoData = Buffer.from(video.videoBytes, 'base64');
  }

  if (!videoData) {
    throw new Error('Could not extract video data from VEO response.');
  }

  // Save video
  await ensureDir(GENERATED_DIR);
  const basename = path.basename(imagePath, path.extname(imagePath));
  const filename = `${basename}-${Date.now()}.mp4`;
  const videoPath = path.join(GENERATED_DIR, filename);
  await fs.writeFile(videoPath, videoData);

  return {
    videoPath,
    filename,
    duration_ms: Date.now() - startTime,
  };
}

export { buildVideoPrompt };
