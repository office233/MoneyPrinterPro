import fs from 'fs';
import path from 'path';

/**
 * Publish Guard — ported from D:\workspace\engine\publish_guard.js
 * Decides if generated content passes quality thresholds for publishing
 */

const CONF_RANK = { fallback: 0, low: 1, medium: 2, high: 3 };

function loadThresholds() {
  const p = path.join(process.cwd(), 'src', 'config', 'publish_guard_thresholds.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function pickThreshold(thresholds, { persona, mode, content_mode }) {
  if (content_mode === 'commercial') {
    return thresholds.commercial.any;
  }
  const personaCfg = thresholds[persona] || thresholds.ava;
  return personaCfg[mode] || personaCfg.default;
}

/**
 * Evaluate whether content passes the quality gate
 * 
 * @param {object} params
 * @param {string} params.persona - Persona name
 * @param {string} params.mode - Mode (default, strict, etc.)
 * @param {string} params.content_mode - Content mode (lifestyle, commercial)
 * @param {object} params.scores - Score data { mean_score, final_score, confidence }
 * @returns {{ ok: boolean, reason: string, details: object }}
 */
export function evaluateGuard({
  persona,
  mode = 'default',
  content_mode = 'lifestyle',
  scores = {},
}) {
  const thresholds = loadThresholds();
  const rule = pickThreshold(thresholds, { persona, mode, content_mode });

  const mean = Number(scores.mean_score ?? -1);
  const finalScore = Number(scores.final_score ?? -1);
  const conf = String(scores.confidence ?? 'fallback');

  const confOk = (CONF_RANK[conf] ?? 0) >= (CONF_RANK[rule.min_confidence] ?? 2);
  const meanOk = mean >= rule.min_mean;
  const finalOk = finalScore >= rule.min_final;

  const ok = confOk && meanOk && finalOk;

  return {
    ok,
    reason: ok ? 'pass' : 'blocked',
    details: {
      persona,
      mode,
      content_mode,
      thresholds: rule,
      got: { mean, finalScore, confidence: conf },
      checks: { confOk, meanOk, finalOk },
    },
  };
}

/**
 * Simple image quality evaluation without ML
 * Uses basic heuristics for quick pass/fail on images
 */
export function evaluateImageBasic({ persona, fileSize, durationMs }) {
  // Basic quality checks
  const sizeOk = fileSize > 50000; // > 50KB suggests decent quality
  const timeOk = durationMs > 1000; // > 1s suggests actual generation, not cached/error

  return {
    ok: sizeOk && timeOk,
    reason: sizeOk && timeOk ? 'pass' : 'blocked',
    details: {
      checks: { sizeOk, timeOk },
      got: { fileSize, durationMs },
    },
  };
}
