// ─── Shared input validation helpers ─────────────────────────
// Centralized to keep API routes consistent and to avoid duplicating
// path-traversal / slug rules across handlers.

import path from 'path';

/** Persona/asset IDs: lowercase letters, digits, hyphen. 1-40 chars. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Generated filenames: same as slug rules plus a single allowed extension. */
const FILENAME_RE = /^[a-z0-9][a-z0-9-]{0,79}\.(png|jpg|jpeg|webp|mp4|webm)$/i;

const ALLOWED_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const STYLE_WHITELIST = new Set([
  'lifestyle', 'urban_power', 'music_life', 'travel',
  'executive', 'luxury_editorial', 'creative',
  'luxury', 'urban', 'corporate',
]);

const SHOT_WHITELIST = new Set([
  'three_quarter_candid', 'full_body_walk',
  'portrait_close', 'portrait_three_quarter', 'over_shoulder',
]);

const OUTPUT_TYPE_WHITELIST = new Set(['image', 'video', 'both']);

export const LIMITS = {
  MAX_REF_IMAGE_BYTES: 8 * 1024 * 1024,        // 8 MB
  MAX_DESCRIPTION_CHARS: 500,
  MAX_DISPLAY_NAME_CHARS: 80,
  MAX_LOCATION_CHARS: 200,
  MAX_PROMPT_CHARS: 2000,
};

export function isValidSlug(value) {
  return typeof value === 'string' && SLUG_RE.test(value);
}

export function isValidFilename(value) {
  return typeof value === 'string' && FILENAME_RE.test(value);
}

/**
 * Resolve a child path and assert it stays inside `rootDir`.
 * Throws on traversal attempts so handlers can return a 400/403.
 */
export function safeJoin(rootDir, ...segments) {
  const resolvedRoot = path.resolve(rootDir);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const rel = path.relative(resolvedRoot, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path traversal blocked');
  }
  return candidate;
}

export function normalizeImageExt(filename, mimeType) {
  const raw = path.extname(filename || '').replace(/^\./, '').toLowerCase();
  if (ALLOWED_IMAGE_EXT.has(raw)) return raw === 'jpeg' ? 'jpg' : raw;
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/jpeg') return 'jpg';
  return null;
}

export function isAllowedImageMime(mimeType) {
  return ALLOWED_IMAGE_MIME.has(mimeType);
}

export function clampString(value, max) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function validateGenerateBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object' };
  }
  const { persona, outputType, style, shotType, location, customPrompt } = body;

  if (!isValidSlug(persona)) {
    return { error: 'Invalid persona id (lowercase letters/digits/hyphen, max 40 chars)' };
  }

  const out = { persona };
  out.outputType = OUTPUT_TYPE_WHITELIST.has(outputType) ? outputType : 'image';
  out.style = STYLE_WHITELIST.has(style) ? style : 'lifestyle';
  out.shotType = SHOT_WHITELIST.has(shotType) ? shotType : null;
  out.location = location ? clampString(location, LIMITS.MAX_LOCATION_CHARS) : null;
  out.customPrompt = customPrompt ? clampString(customPrompt, LIMITS.MAX_PROMPT_CHARS) : null;
  return { value: out };
}

export function validateCreatePersonaFields({ name, displayName, description, style }) {
  const slug = typeof name === 'string' ? name.trim().toLowerCase().replace(/\s+/g, '-') : '';
  if (!isValidSlug(slug)) {
    return { error: 'Invalid persona name (lowercase letters/digits/hyphen only)' };
  }
  return {
    value: {
      name: slug,
      displayName: clampString(displayName || slug, LIMITS.MAX_DISPLAY_NAME_CHARS),
      description: clampString(description, LIMITS.MAX_DESCRIPTION_CHARS),
      style: STYLE_WHITELIST.has(style) ? style : 'lifestyle',
    },
  };
}
