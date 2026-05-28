import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  REFERENCE_DIR,
  GENERATED_DIR,
  findRefImage,
  readBlueprint,
  ensureDir,
} from '@/lib/personas';
import { validateGenerateBody } from '@/lib/validation';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1 * 1024 * 1024;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 10_000;

// Fallback style prompts (used when engines are not available)
const STYLE_PROMPTS = {
  lifestyle: 'natural lifestyle, candid moment, warm golden light, bokeh background',
  urban_power: 'urban city, confident stance, architectural background, street style, fashion',
  music_life: 'stage performance, concert atmosphere, dramatic neon lighting',
  travel: 'travel destination, golden hour, wanderlust, scenic background',
  executive: 'corporate elegant, professional, clean modern interior',
  luxury_editorial: 'luxury editorial, polished refined, high-end fashion',
  creative: 'creative artistic, bold colors, experimental composition',
  luxury: 'luxury editorial, polished refined, high-end fashion',
  urban: 'urban city, confident stance, architectural background, street style',
  corporate: 'corporate elegant, professional, clean modern interior',
};

const SHOT_PROMPTS = {
  three_quarter_candid: '3/4 body shot, mid-thigh up, eye level, relaxed pose',
  full_body_walk: 'full body head-to-toe, walking toward camera, confident',
  portrait_close: 'head and shoulders portrait, close-up, sharp focus on face',
  portrait_three_quarter: 'waist-up portrait, one shoulder forward',
  over_shoulder: 'looking back over shoulder, mysterious',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build strong identity lock prompt — ported from old pipeline's generate-image.cjs
 * Much more detailed than the original simple version
 */
function buildIdentityPrompt(blueprint) {
  const s = blueprint?.physical_spec;
  if (!s) return '';

  const rules = blueprint?.identity_rules;
  const forbidden = rules?.forbidden?.length
    ? `\nDO NOT change hair color (forbidden: ${rules.forbidden.join(', ')}).`
    : '';

  return `CRITICAL IDENTITY LOCK - The person MUST be IDENTICAL to the reference image:
- Face shape: ${s.face_shape}
- Jawline: ${s.jawline}
- Eyes: ${s.eyes}
- Nose: ${s.nose}
- Hair: ${s.hair_default}
- Skin tone: ${s.skin_tone}
- Body: ${s.body_type}
- Age appearance: ${s.age_appearance}

DO NOT alter facial bone structure.
DO NOT change eye shape, eye color, or nose shape.${forbidden}
Keep natural proportions.
Same person as reference image - exact match required.`;
}

/**
 * Try to build an engine-enhanced prompt with visual context
 */
async function tryBuildEnginePrompt(persona, style, shotType, location, blueprint) {
  try {
    const { buildVisualContext } = await import('@/lib/engines/visual-context.js');

    // Build a scene object from the simple inputs
    const scene = {
      city: location || 'Urban City',
      spot: location || 'premium urban setting',
      category: style === 'music_life' ? 'music' : style === 'travel' ? 'travel' : 'urban',
      time_of_day: 'golden_hour',
      weather: 'clear',
      outfit_description: 'stylish outfit matching the scene',
    };

    const shot = {
      shot_archetype: shotType || 'three_quarter_candid',
      shot_key: shotType || 'three_quarter_candid',
      shot_tags: shotType || 'candid',
      full_prompt: SHOT_PROMPTS[shotType] || '3/4 body, natural candid pose',
    };

    const visualContext = buildVisualContext({
      persona,
      pillar: style || 'lifestyle',
      scene,
      shot,
      format: 'feed_static',
    });

    // Build full prompt with visual context (like old pipeline)
    const identityPrompt = buildIdentityPrompt(blueprint);
    const locationText = location || 'premium urban setting';

    return `${identityPrompt}

Generate an ultra-realistic photo of this EXACT person from the reference image.

LOCATION: ${visualContext.scene?.city || locationText}, ${visualContext.scene?.spot || locationText}
TIME: ${visualContext.resolved_time || 'golden_hour'}

${visualContext.shot?.full_prompt || SHOT_PROMPTS[shotType] || '3/4 body, natural candid pose'}

LIGHTING: ${visualContext.lighting_prompt || 'natural golden hour lighting'}
SHADOW DIRECTION: ${visualContext.shadow_prompt || 'soft directional shadows'}
${visualContext.weather_prompt || ''}
MOTION: ${visualContext.motion_prompt || 'still pose'}

Style: natural photo, 9:16 portrait, visible skin texture, sharp background, candid moment aesthetic.
The person MUST be identical to the reference image.`;
  } catch (err) {
    // Engines not available — fall back to simple prompt
    console.warn('[generate] Engine-enhanced prompt unavailable, using fallback:', err.message);
    return null;
  }
}

async function readJsonBody(request) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) {
    const err = new Error('Request body too large');
    err.status = 413;
    throw err;
  }
  try {
    return await request.json();
  } catch {
    const err = new Error('Invalid JSON body');
    err.status = 400;
    throw err;
  }
}

async function generateWithGemini(apiKey, prompt, refPath) {
  const { GoogleGenAI, Modality } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';

  const parts = [];
  if (refPath) {
    const data = await fs.readFile(refPath);
    const ext = path.extname(refPath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    parts.push({ inlineData: { mimeType, data: data.toString('base64') } });
  }
  parts.push({ text: prompt });

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: [Modality.IMAGE] },
      });
      const responseParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of responseParts) {
        if (part.inlineData?.data) return Buffer.from(part.inlineData.data, 'base64');
      }
      throw new Error('No image data in Gemini response — the model may have refused the prompt.');
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.httpStatusCode || null;
      const retryable =
        status === 429 || status === 503 ||
        /429|resource.*exhausted|quota|503|overloaded/i.test(err.message);
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }
  }
  throw formatGeminiError(lastError);
}

function formatGeminiError(err) {
  const msg = err?.message || String(err);
  const status = err?.status || err?.httpStatusCode || null;
  if (status === 429 || /429|resource.*exhausted|quota/i.test(msg)) {
    return new Error('Rate limited by Gemini (429). Wait a minute and try again.');
  }
  if (status === 403 || /403|permission|forbidden/i.test(msg)) {
    return new Error('Gemini rejected the API key. Check it in Settings and ensure the Generative Language API is enabled.');
  }
  if (status === 503 || /503|overloaded|unavailable/i.test(msg)) {
    return new Error('Gemini is temporarily unavailable (503). Try again in a minute.');
  }
  return new Error('Gemini generation failed. Please try again.');
}

/**
 * Save job to database
 */
function saveJob(data) {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO jobs (persona, output_type, style, shot_type, status, image_path, prompt, model, duration_ms, cost_estimate, error)
      VALUES (@persona, @outputType, @style, @shotType, @status, @imagePath, @prompt, @model, @durationMs, @costEstimate, @error)
    `);
    const result = stmt.run({
      persona: data.persona,
      outputType: data.outputType || 'image',
      style: data.style || null,
      shotType: data.shotType || null,
      status: data.status || 'done',
      imagePath: data.imagePath || null,
      prompt: data.prompt || null,
      model: data.model || null,
      durationMs: data.durationMs || null,
      costEstimate: data.costEstimate || null,
      error: data.error || null,
    });
    return result.lastInsertRowid;
  } catch (err) {
    // DB errors should not break generation
    console.error('[generate] DB save error:', err.message);
    return null;
  }
}

export async function POST(request) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
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
    body = await readJsonBody(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 400 });
  }

  const parsed = validateGenerateBody(body);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { persona, outputType, style, shotType, location, customPrompt } = parsed.value;

  try {
    await ensureDir(GENERATED_DIR);
    await ensureDir(REFERENCE_DIR);

    const [refPath, blueprint] = await Promise.all([
      findRefImage(persona),
      readBlueprint(persona),
    ]);

    // Try engine-enhanced prompt first, fall back to simple prompt
    let fullPrompt;
    let usedEngines = false;

    if (customPrompt) {
      fullPrompt = customPrompt;
    } else {
      const enginePrompt = await tryBuildEnginePrompt(persona, style, shotType, location, blueprint);
      if (enginePrompt) {
        fullPrompt = enginePrompt;
        usedEngines = true;
      } else {
        // Fallback to original simple prompt
        const styleText = STYLE_PROMPTS[style] || STYLE_PROMPTS.lifestyle;
        const shotText = shotType && SHOT_PROMPTS[shotType]
          ? SHOT_PROMPTS[shotType]
          : '3/4 body, natural candid pose';
        const locationText = location || 'premium urban setting';
        fullPrompt = `Ultra-realistic photo of a person. ${buildIdentityPrompt(blueprint)} ${shotText}. Location: ${locationText}. ${styleText}. Cinematic color grading, natural skin texture, sharp detail, 9:16 portrait, professional photography.`;
      }
    }

    const modelUsed = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';
    const imageBuffer = await generateWithGemini(apiKey, fullPrompt, refPath);

    const filename = `${persona}-${Date.now()}.png`;
    await fs.writeFile(path.join(GENERATED_DIR, filename), imageBuffer);

    const durationMs = Date.now() - startTime;

    // Save job to database
    const jobId = saveJob({
      persona,
      outputType,
      style,
      shotType,
      status: 'done',
      imagePath: filename,
      prompt: fullPrompt.slice(0, 2000), // truncate for DB
      model: modelUsed,
      durationMs,
      costEstimate: 0.045, // ~$0.045 per 512px image
    });

    return NextResponse.json({
      success: true,
      jobId,
      persona,
      outputType,
      style,
      provider: 'gemini',
      usedEngines,
      imageUrl: `/api/files/${filename}`,
      duration_ms: durationMs,
      model: modelUsed,
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;

    // Save failed job to database
    saveJob({
      persona,
      outputType,
      style,
      shotType,
      status: 'failed',
      prompt: customPrompt?.slice(0, 2000),
      model: process.env.IMAGE_MODEL || 'gemini-2.5-flash-image',
      durationMs,
      error: err?.message?.slice(0, 500),
    });

    console.error('[generate] error:', err);
    const safeMessage =
      err?.message && !/[\\/:]/.test(err.message)
        ? err.message
        : 'Generation failed. Check server logs.';
    return NextResponse.json(
      { error: safeMessage, duration_ms: durationMs },
      { status: 500 },
    );
  }
}
