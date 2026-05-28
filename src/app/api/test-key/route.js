import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  // Simple IP-based rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ valid: false, error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  const apiKey = request.headers.get('x-api-key')?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { valid: false, error: 'No API key provided' },
      { status: 400 },
    );
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (text) return NextResponse.json({ valid: true });
    return NextResponse.json(
      { valid: false, error: 'Unexpected empty response from Gemini' },
      { status: 500 },
    );
  } catch (err) {
    const message = err?.message || 'Unknown error';
    if (/API_KEY_INVALID|401/.test(message)) {
      return NextResponse.json(
        { valid: false, error: 'Invalid API key. Please check and try again.' },
        { status: 401 },
      );
    }
    if (/PERMISSION_DENIED|403/.test(message)) {
      return NextResponse.json(
        { valid: false, error: 'API key lacks the required permissions.' },
        { status: 403 },
      );
    }
    if (/RESOURCE_EXHAUSTED|429/.test(message)) {
      return NextResponse.json(
        { valid: false, error: 'Rate limit exceeded. The key is valid but quota is exhausted.' },
        { status: 429 },
      );
    }
    console.error('[test-key] error:', err);
    return NextResponse.json(
      { valid: false, error: 'Could not verify the key. Please try again.' },
      { status: 500 },
    );
  }
}

