import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve from project root: src/lib/engines/ → ../../config/shot_rules.json
const SHOT_RULES_PATH = path.resolve(__dirname, '../../config/shot_rules.json');

const shotRules = JSON.parse(fs.readFileSync(SHOT_RULES_PATH, 'utf8'));

function validateShotLocation(shotArchetype, locationCategory) {
  const allowedCategories = shotRules[shotArchetype];
  if (!allowedCategories) return true;
  return allowedCategories.includes(locationCategory);
}

function getCompatibleShots(category) {
  const compatibleShots = [];
  for (const [shot, allowedCats] of Object.entries(shotRules)) {
    if (allowedCats.includes(category)) {
      compatibleShots.push(shot);
    }
  }
  return compatibleShots;
}

export function validateScene(data) {
  let { persona, pillar, scene, shot } = data;
  let wasFixed = false;
  let fixLog = [];

  console.log('🔍 Validating scene consistency...');

  // 1️⃣ MUSIC PILLAR ENFORCEMENT
  if (pillar === 'music_life' || pillar === 'music') {
    if (scene.category !== 'music') {
      fixLog.push(`❌ Music pillar but category=${scene.category} (should be music)`);
      // Can't change scene category here - orchestrator should handle this
      // But we can fix the shot to match actual category
    }
    
    // Check shot compatibility with ACTUAL category (not ideal, but fixes mismatch)
    if (!validateShotLocation(shot.shot_archetype, scene.category)) {
      const compatibleShots = getCompatibleShots(scene.category);
      if (compatibleShots.length > 0) {
        const oldShot = shot.shot_archetype;
        shot.shot_archetype = compatibleShots[Math.floor(Math.random() * compatibleShots.length)];
        fixLog.push(`🔧 Changed shot: ${oldShot} → ${shot.shot_archetype} (to match ${scene.category})`);
        wasFixed = true;
      }
    }
  }
  
  // 2️⃣ GENERAL SHOT-LOCATION COMPATIBILITY
  else {
    if (!validateShotLocation(shot.shot_archetype, scene.category)) {
      const compatibleShots = getCompatibleShots(scene.category);
      
      if (compatibleShots.length > 0) {
        const oldShot = shot.shot_archetype;
        shot.shot_archetype = compatibleShots[Math.floor(Math.random() * compatibleShots.length)];
        fixLog.push(`🔧 Changed shot: ${oldShot} → ${shot.shot_archetype} (to match ${scene.category})`);
        wasFixed = true;
      } else {
        fixLog.push(`⚠️  No compatible shots found for category ${scene.category}`);
      }
    }
  }

  if (wasFixed) {
    console.log('⚙️  AUTO-FIX APPLIED:');
    fixLog.forEach(log => console.log(`   ${log}`));
  } else {
    console.log('✅ Scene validation passed - no fixes needed');
  }

  return { scene, shot, wasFixed, fixLog };
}
