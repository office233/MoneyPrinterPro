import fs from 'fs';
import path from 'path';
import { getDb } from '../db.js';

// 1️⃣ Check for override
function checkOverride(db, persona) {
  const override = db.prepare(`
    SELECT * FROM override_queue
    WHERE persona = ? AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
  `).get(persona);
  
  if (override) {
    db.prepare(`UPDATE override_queue SET status = 'used' WHERE id = ?`).run(override.id);
    return {
      persona,
      pillar: override.force_pillar || 'urban_power',
      format: override.force_video ? 'video_ai' : 'feed_static',
      brand: override.force_brand === 1,
      music: false,
      override: true
    };
  }
  return null;
}

// 2️⃣ Check daily limits
function checkDailyLimits(db, persona, rules) {
  const today = Date.now() - (Date.now() % (24 * 60 * 60 * 1000));
  
  const postsToday = db.prepare(`
    SELECT COUNT(*) as cnt FROM posts
    WHERE persona = ? AND created_at >= ?
  `).get(persona, today).cnt;
  
  if (postsToday >= rules.global.max_posts_per_day) {
    throw new Error(`❌ Daily limit reached: ${postsToday}/${rules.global.max_posts_per_day}`);
  }
  
  return postsToday;
}

// 3️⃣ Weighted pillar selection
function selectPillar(db, persona) {
  const pillars = db.prepare(`
    SELECT pillar, weight FROM planner_state
    WHERE persona = ?
  `).all(persona);
  
  const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
  let rand = Math.random() * totalWeight;
  
  for (const p of pillars) {
    rand -= p.weight;
    if (rand <= 0) return p.pillar;
  }
  
  return pillars[0].pillar;
}

// 4️⃣ Decide format
function decideFormat(db, persona, rules) {
  const today = Date.now() - (Date.now() % (24 * 60 * 60 * 1000));
  
  const videoToday = db.prepare(`
    SELECT COUNT(*) as cnt FROM posts
    WHERE persona = ? AND created_at >= ? AND platform = 'instagram' AND status LIKE '%video%'
  `).get(persona, today).cnt;
  
  if (videoToday < rules.format_limits.max_video_ai_per_day) {
    if (Math.random() < 0.30) {
      return 'video_ai';
    }
  }
  
  if (Math.random() < 0.70) {
    return 'reel_static';
  }
  
  return 'feed_static';
}

// 5️⃣ Decide brand
function decideBrand(db, persona, rules) {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  const brandCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM posts
    WHERE persona = ? AND created_at >= ? AND status LIKE '%brand%'
  `).get(persona, sevenDaysAgo).cnt;
  
  const totalPosts = db.prepare(`
    SELECT COUNT(*) as cnt FROM posts
    WHERE persona = ? AND created_at >= ?
  `).get(persona, sevenDaysAgo).cnt;
  
  if (totalPosts === 0) return false;
  
  const brandRatio = brandCount / totalPosts;
  
  if (brandRatio >= rules.brand_limits.brand_ratio_limit) {
    return false;
  }
  
  return Math.random() < 0.15;
}

// 6️⃣ Decide music (Ava only)
function decideMusic(db, persona, rules) {
  if (persona !== 'ava') return false;
  
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  const musicCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM posts
    WHERE persona = ? AND created_at >= ? AND status LIKE '%music%'
  `).get(persona, sevenDaysAgo).cnt;
  
  if (musicCount >= rules.music_limits.max_music_per_week) {
    return false;
  }
  
  return Math.random() < 0.10;
}

// 🚀 MAIN
export function planNext(persona) {
  const rulesPath = path.join(process.cwd(), 'src/config/planner_rules.json');
  const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  const db = getDb();

  try {
    // Check override first
    const override = checkOverride(db, persona);
    if (override) {
      return override;
    }
    
    // Check limits
    checkDailyLimits(db, persona, rules);
    
    // Build plan
    const pillar = selectPillar(db, persona);
    const format = decideFormat(db, persona, rules);
    const brand = decideBrand(db, persona, rules);
    const music = decideMusic(db, persona, rules);
    
    const plan = {
      persona,
      pillar,
      format,
      brand,
      music,
      override: false
    };
    
    return plan;
  } finally {
    // Note: db lifecycle managed by caller/getDb — no close here
  }
}
