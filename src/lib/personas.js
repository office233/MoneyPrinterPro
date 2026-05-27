// ─── Shared persona/asset filesystem helpers ─────────────────
// Single source of truth for directory layout and reference-image lookup,
// so every API route resolves the same paths the same way.

import fs from 'fs/promises';
import path from 'path';

export const ROOT = process.cwd();
export const REFERENCE_DIR = path.join(ROOT, 'assets', 'reference');
export const GENERATED_DIR = path.join(ROOT, 'assets', 'generated');
export const PERSONAS_DIR = path.join(ROOT, 'personas');
export const IDENTITY_DIR = path.join(ROOT, 'identity');

const REF_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

/**
 * Locate the reference image for a persona slug.
 * Caller is expected to have validated `name` with isValidSlug first.
 * @returns {Promise<string|null>} absolute path, or null if none found.
 */
export async function findRefImage(name) {
  for (const ext of REF_EXTS) {
    const candidates = [
      path.join(REFERENCE_DIR, `${name}-ref${ext}`),
      path.join(PERSONAS_DIR, name, `ref${ext}`),
    ];
    for (const p of candidates) {
      if (await exists(p)) return p;
    }
  }
  return null;
}

/**
 * Read a persona's identity.json if present. Returns null on missing/malformed.
 */
export async function readIdentity(name) {
  const p = path.join(PERSONAS_DIR, name, 'identity.json');
  if (!(await exists(p))) return null;
  try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { return null; }
}

/**
 * Read a persona's physical blueprint if present. Returns null on missing/malformed.
 */
export async function readBlueprint(name) {
  for (const p of [
    path.join(IDENTITY_DIR, `${name}_physical_blueprint.json`),
    path.join(PERSONAS_DIR, name, 'blueprint.json'),
  ]) {
    if (await exists(p)) {
      try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* skip */ }
    }
  }
  return null;
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

/** Summarize a persona for list/detail responses. */
export async function summarizePersona(name) {
  const identity = await readIdentity(name);
  const [refPath, blueprintPath] = await Promise.all([
    findRefImage(name),
    exists(path.join(IDENTITY_DIR, `${name}_physical_blueprint.json`)),
  ]);
  return {
    name,
    displayName: identity?.name || name.charAt(0).toUpperCase() + name.slice(1),
    description: identity?.archetype || '',
    style: identity?.photo_style || 'lifestyle',
    hasRefImage: refPath !== null,
    hasBlueprint: blueprintPath,
  };
}
