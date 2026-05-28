import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs — List recent generation jobs
 * Query params: ?persona=ava&limit=50&status=done
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const persona = searchParams.get('persona');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const db = getDb();

    let query = 'SELECT * FROM jobs';
    const conditions = [];
    const params = [];

    if (persona) {
      conditions.push('persona = ?');
      params.push(persona);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const jobs = db.prepare(query).all(...params);

    // Add URL fields for convenience
    for (const job of jobs) {
      if (job.image_path) job.imageUrl = `/api/files/${job.image_path}`;
      if (job.video_path) job.videoUrl = `/api/files/${job.video_path}`;
    }

    // Summary stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN output_type = 'image' THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN output_type = 'video' THEN 1 ELSE 0 END) as videos,
        ROUND(SUM(COALESCE(cost_estimate, 0)), 3) as totalCost,
        ROUND(AVG(CASE WHEN status = 'done' THEN duration_ms END)) as avgDurationMs
      FROM jobs
    `).get();

    return NextResponse.json({ jobs, stats });
  } catch (err) {
    console.error('[jobs] error:', err);
    return NextResponse.json({ error: 'Failed to fetch jobs', jobs: [], stats: {} }, { status: 500 });
  }
}
