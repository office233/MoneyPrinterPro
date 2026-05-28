import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { findRefImage, GENERATED_DIR, ensureDir } from '@/lib/personas';
import { generateVideo } from '@/lib/video/veo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Video generation can take up to 5 minutes
export const maxDuration = 300;

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const startTime = Date.now();

  const apiKey = request.headers.get('x-api-key')?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No API key provided. Add your Gemini key in Settings.' },
      { status: 401 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { persona, caption, style, imagePath, promptMeta } = body;

  if (!persona) {
    return NextResponse.json({ error: 'Persona is required' }, { status: 400 });
  }

  // Use provided image path or find reference image
  let sourceImagePath = imagePath;
  if (!sourceImagePath) {
    sourceImagePath = await findRefImage(persona);
    if (!sourceImagePath) {
      return NextResponse.json(
        { error: 'No source image. Generate an image first or upload a reference photo.' },
        { status: 400 },
      );
    }
  }

  // Create a pending job
  let jobId;
  try {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO jobs (persona, output_type, style, status, model)
      VALUES (?, 'video', ?, 'running', 'veo-3.1')
    `).run(persona, style || null);
    jobId = result.lastInsertRowid;
  } catch (err) {
    console.error('[generate-video] DB error:', err.message);
  }

  try {
    await ensureDir(GENERATED_DIR);

    const result = await generateVideo(
      apiKey,
      sourceImagePath,
      caption || 'Fashion editorial video',
      promptMeta || {},
    );

    const durationMs = Date.now() - startTime;

    // Update job in database
    if (jobId) {
      try {
        const db = getDb();
        db.prepare(`
          UPDATE jobs SET status = 'done', video_path = ?, duration_ms = ?, cost_estimate = 0.50
          WHERE id = ?
        `).run(result.filename, durationMs, jobId);
      } catch (err) {
        console.error('[generate-video] DB update error:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      persona,
      videoUrl: `/api/files/${result.filename}`,
      duration_ms: durationMs,
      model: 'veo-3.1',
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;

    // Update job as failed
    if (jobId) {
      try {
        const db = getDb();
        db.prepare(`
          UPDATE jobs SET status = 'failed', duration_ms = ?, error = ?
          WHERE id = ?
        `).run(durationMs, err?.message?.slice(0, 500), jobId);
      } catch (dbErr) {
        console.error('[generate-video] DB update error:', dbErr.message);
      }
    }

    console.error('[generate-video] error:', err);
    const safeMessage =
      err?.message && !/[\\/:]/.test(err.message)
        ? err.message
        : 'Video generation failed. Check server logs.';
    return NextResponse.json(
      { error: safeMessage, duration_ms: durationMs },
      { status: 500 },
    );
  }
}
