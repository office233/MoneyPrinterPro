import { NextResponse } from 'next/server';
import path from 'path';
import { GENERATED_DIR } from '@/lib/personas';
import { isScoringAvailable, scoreVideoByPath } from '@/lib/scoring/client';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/score — Score a generated video
 * Body: { filename: "persona-123.mp4" }
 */
export async function POST(request) {
  try {
    const { filename } = await request.json();
    if (!filename) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }

    const available = await isScoringAvailable();
    if (!available) {
      return NextResponse.json({
        error: 'Scoring service is not running. Start it with: cd scoring-service && uvicorn main:app --port 8000',
        available: false,
      }, { status: 503 });
    }

    const videoPath = path.join(GENERATED_DIR, filename);
    const scores = await scoreVideoByPath(videoPath);

    // Update job in DB if we can find it
    try {
      const db = getDb();
      const job = db.prepare('SELECT id FROM jobs WHERE video_path = ? ORDER BY created_at DESC LIMIT 1').get(filename);
      if (job) {
        db.prepare('UPDATE jobs SET cost_estimate = cost_estimate WHERE id = ?').run(job.id);
      }
    } catch { /* ignore DB errors */ }

    return NextResponse.json({
      success: true,
      filename,
      scores: {
        mean_score: scores.mean_score,
        best_score: scores.best_score,
        confidence: scores.confidence,
        face_found_ratio: scores.face_found_ratio,
        channels: scores.channel_means,
        best_window: scores.best_window,
        variance: scores.variance,
      },
    });
  } catch (err) {
    console.error('[score] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/score/status — Check if scoring service is available
 */
export async function GET() {
  const available = await isScoringAvailable();
  return NextResponse.json({ available });
}
