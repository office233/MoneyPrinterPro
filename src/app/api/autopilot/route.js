import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/autopilot — Get autopilot status and queue
 */
export async function GET() {
  try {
    const db = getDb();

    // Get recent jobs grouped by status
    const queue = db.prepare(`
      SELECT * FROM jobs
      WHERE created_at > datetime('now', '-7 days')
      ORDER BY created_at DESC
      LIMIT 50
    `).all();

    // Today's stats
    const todayStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN output_type = 'image' THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN output_type = 'video' THEN 1 ELSE 0 END) as videos,
        ROUND(SUM(COALESCE(cost_estimate, 0)), 3) as cost
      FROM jobs
      WHERE created_at > datetime('now', '-1 day')
    `).get();

    // Per-persona stats
    const personaStats = db.prepare(`
      SELECT
        persona,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        MAX(created_at) as last_generated
      FROM jobs
      GROUP BY persona
      ORDER BY last_generated DESC
    `).all();

    return NextResponse.json({
      queue: queue.map(j => ({
        ...j,
        imageUrl: j.image_path ? `/api/files/${j.image_path}` : null,
        videoUrl: j.video_path ? `/api/files/${j.video_path}` : null,
      })),
      todayStats,
      personaStats,
    });
  } catch (err) {
    console.error('[autopilot] error:', err);
    return NextResponse.json({ error: err.message, queue: [], todayStats: {}, personaStats: [] }, { status: 500 });
  }
}

/**
 * POST /api/autopilot — Run one autopilot cycle (plan + generate)
 * Body: { persona, outputType?, count? }
 */
export async function POST(request) {
  const startTime = Date.now();
  const apiKey = request.headers.get('x-api-key')?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key provided.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { persona, outputType = 'image', style, count = 1 } = body;
  if (!persona) {
    return NextResponse.json({ error: 'persona is required' }, { status: 400 });
  }

  const results = [];
  const maxCount = Math.min(count, 10); // Cap at 10

  for (let i = 0; i < maxCount; i++) {
    try {
      // Try to use planner engine
      let plan = null;
      try {
        const { planNext } = await import('@/lib/planner/planner.js');
        plan = planNext(persona);
      } catch {
        plan = { persona, pillar: style || 'lifestyle', format: 'feed_static' };
      }

      // Generate based on output type
      const genUrl = outputType === 'video'
        ? 'http://localhost:3000/api/generate-video'
        : 'http://localhost:3000/api/generate';

      const genBody = outputType === 'video'
        ? { persona, caption: plan.pillar, style: plan.pillar }
        : { persona, style: plan.pillar, outputType: 'image' };

      const res = await fetch(genUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(genBody),
      });

      const data = await res.json();
      results.push({
        index: i + 1,
        success: !!data.success,
        plan,
        ...(data.success ? data : { error: data.error }),
      });

      // Small delay between generations to avoid rate limiting
      if (i < maxCount - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      results.push({ index: i + 1, success: false, error: err.message });
    }
  }

  return NextResponse.json({
    completed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    duration_ms: Date.now() - startTime,
    results,
  });
}
