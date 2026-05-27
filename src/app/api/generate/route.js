import { rateLimit } from '@/lib/rate-limit';
  // Simple IP-based rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1 MB JSON cap — generate bodies are tiny; anything larger is abuse.
const MAX_BODY_BYTES = 1 * 1024 * 1024;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 10_000;

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

function buildIdentityPrompt(blueprint) {
  const s = blueprint?.physical_spec;
  if (!s) return '';
  return `Person: ${s.face_shape} face, ${s.jawline} jaw, ${s.eyes} eyes, ${s.nose} nose, ${s.hair_default} hair, ${s.skin_tone} skin, ${s.body_type} body, appears ${s.age_appearance}.`;
}

async function readJsonBody(request) {
  // Hard cap before parsing so a giant body cannot exhaust memory.
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

export async function POST(request) {
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

    const styleText = STYLE_PROMPTS[style] || STYLE_PROMPTS.lifestyle;
    const shotText = shotType && SHOT_PROMPTS[shotType]
      ? SHOT_PROMPTS[shotType]
      : '3/4 body, natural candid pose';
    const locationText = location || 'premium urban setting';

    const fullPrompt = customPrompt ||
      `Ultra-realistic photo of a person. ${buildIdentityPrompt(blueprint)} ${shotText}. Location: ${locationText}. ${styleText}. Cinematic color grading, natural skin texture, sharp detail, 9:16 portrait, professional photography.`;

    const modelUsed = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';
    const imageBuffer = await generateWithGemini(apiKey, fullPrompt, refPath);

    const filename = `${persona}-${Date.now()}.png`;
    await fs.writeFile(path.join(GENERATED_DIR, filename), imageBuffer);

    return NextResponse.json({
      success: true,
      persona,
      outputType,
      style,
      provider: 'gemini',
      imageUrl: `/api/files/${filename}`,
      duration_ms: Date.now() - startTime,
      model: modelUsed,
    });
  } catch (err) {
    // Gemini-friendly messages are pre-sanitized by formatGeminiError.
    // Other failures get a generic message; full error stays in server logs only
    // so we never leak filesystem paths from path.join / fs errors to clients.
    console.error('[generate] error:', err);
    const safeMessage =
      err?.message && !/[\\/:]/.test(err.message)
        ? err.message
        : 'Generation failed. Check server logs.';
    return NextResponse.json(
      { error: safeMessage, duration_ms: Date.now() - startTime },
      { status: 500 },
    );
  }
}
