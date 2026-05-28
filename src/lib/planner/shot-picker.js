import fs from 'fs';
import path from 'path';
import { getDb } from '../db.js';

function weightedPick(items, weightFn) {
  const total = items.reduce((s, x) => s + weightFn(x), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightFn(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function normalizeKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickShotFromEngine(enginePath, sceneCategory, recentScenes = []) {
  const E = JSON.parse(fs.readFileSync(enginePath, 'utf8'));

  const archetypeEntries = Object.entries(E.weights.archetypes).map(([id, w]) => ({ id, w }));
  let archetype = weightedPick(archetypeEntries, x => x.w).id;

  const cfg = E.constraints;

  const lastShotKeys = new Set(recentScenes.slice(0, cfg.max_same_shot_key_last_n.n).map(x => x.shot_key).filter(Boolean));
  const lastArchetypes = new Set(recentScenes.slice(0, cfg.max_same_archetype_last_n.n).map(x => x.shot_archetype).filter(Boolean));
  const mirrorCount = recentScenes.slice(0, cfg.max_mirror_last_n.n).filter(x => (x.shot_tags || '').includes('mirror')).length;
  const fullBodyCount = recentScenes.slice(0, cfg.max_full_body_last_n?.n || 0).filter(x => (x.shot_tags || '').includes('full_body')).length;

  if (lastArchetypes.has(archetype)) {
    const filtered = archetypeEntries.filter(x => !lastArchetypes.has(x.id));
    if (filtered.length) archetype = weightedPick(filtered, x => x.w).id;
  }

  const noMirror = (cfg.no_mirror_with_categories || []).includes(sceneCategory);

  const A = E.archetypes[archetype];
  if (!A) throw new Error(`Missing archetype: ${archetype}`);

  const framing = pickOne(A.framing || ['3/4 body']);
  const camera_angle = pickOne(A.camera_angle || ['eye level']);
  const pose = pickOne(A.pose || ['natural posture']);
  const expression = pickOne(A.expression || ['neutral']);
  const action = pickOne(A.action || ['none']);
  const hands = pickOne(A.hands || ['not visible']);
  const composition = pickOne(A.composition || ['rule of thirds']);

  const lighting = pickOne(E.modifiers.lighting);
  const distance = pickOne(E.modifiers.distance);
  const movement = pickOne(E.modifiers.movement);
  const background_detail = pickOne(E.modifiers.background_detail);
  const lens = pickOne(E.modifiers.lens);
  const guard = pickOne(E.modifiers.style_guard);

  const tags = [];
  if (String(archetype).includes('mirror')) tags.push('mirror');
  if (framing.includes('full body')) tags.push('full_body');
  if (framing.includes('3/4') || framing.includes('mid') || framing.includes('knee')) tags.push('three_quarter');
  if (framing.includes('head') || framing.includes('portrait') || framing.includes('tight')) tags.push('portrait');

  if (noMirror && tags.includes('mirror')) {
    const nonMirror = archetypeEntries.filter(x => !x.id.includes('mirror'));
    archetype = weightedPick(nonMirror, x => x.w).id;
    return pickShotFromEngine(enginePath, sceneCategory, recentScenes);
  }

  if (cfg.max_mirror_last_n && mirrorCount >= cfg.max_mirror_last_n.max && tags.includes('mirror')) {
    return pickShotFromEngine(enginePath, sceneCategory, recentScenes);
  }

  if (cfg.max_full_body_last_n && fullBodyCount >= cfg.max_full_body_last_n.max && tags.includes('full_body')) {
    return pickShotFromEngine(enginePath, sceneCategory, recentScenes);
  }

  const shotKey = normalizeKey([archetype, framing, camera_angle, pose, action, hands, lighting, distance, movement].join('|'));

  if (lastShotKeys.has(shotKey)) {
    return pickShotFromEngine(enginePath, sceneCategory, recentScenes);
  }

  const shotPrompt = `SHOT TYPE: ${archetype}. Framing: ${framing}. Camera angle: ${camera_angle}. Distance: ${distance}. Pose: ${pose}. Action: ${action}. Hands: ${hands}. Expression: ${expression}. Composition: ${composition}. Lighting: ${lighting}. Movement: ${movement}. Background detail: ${background_detail}. Lens: ${lens}. ${guard}`;

  return {
    shot_archetype: archetype,
    shot_key: shotKey,
    shot_tags: tags.join(','),
    lens_mode: E.constraints.lens_mode_locked || 'standard_iphone',
    shot_prompt: shotPrompt
  };
}

export function pickShot(persona, sceneCategory, recentScenes = null) {
  const enginePath = path.join(process.cwd(), `personas/${persona}/shot_engine.json`);

  // If recentScenes not provided, fetch from DB
  if (recentScenes === null) {
    const db = getDb();
    recentScenes = db.prepare(`
      SELECT shot_key, shot_archetype, shot_tags
      FROM post_scene
      WHERE post_id IN (SELECT id FROM posts WHERE persona = ? ORDER BY created_at DESC LIMIT 20)
    `).all(persona);
  }

  const shot = pickShotFromEngine(enginePath, sceneCategory, recentScenes);
  shot.full_prompt = shot.shot_prompt;
  shot.novelty = 5;

  return shot;
}
