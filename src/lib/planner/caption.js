import fs from 'fs';
import path from 'path';

export function generateCaption(persona, pillar = null) {
  const captionEnginePath = path.join(
    process.cwd(),
    `personas/${persona}/caption_engine.json`
  );
  
  const engine = JSON.parse(fs.readFileSync(captionEnginePath, 'utf8'));
  
  // Pillar-aware tone selection
  let selectedTone;
  
  if (pillar === 'music_life' || pillar === 'music') {
    // Force music_creation tone if available
    selectedTone = engine.tone_library.music_creation ? 'music_creation' : null;
  } else if (pillar === 'executive') {
    // Prefer executive_calm
    selectedTone = engine.tone_library.executive_calm ? 'executive_calm' : null;
  } else if (pillar === 'urban_power') {
    // Prefer power_minimal
    selectedTone = engine.tone_library.power_minimal ? 'power_minimal' : null;
  }
  
  // If no pillar-specific tone, use weighted random
  if (!selectedTone) {
    const toneWeights = engine.tone_weights;
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [tone, weight] of Object.entries(toneWeights)) {
      cumulative += weight;
      if (rand <= cumulative) {
        selectedTone = tone;
        break;
      }
    }
  }
  
  // Pick random line from selected tone
  const lines = engine.tone_library[selectedTone];
  if (!lines || lines.length === 0) {
    return 'Keep building.';
  }
  
  const mainLine = lines[Math.floor(Math.random() * lines.length)];
  
  // Optional: add soft CTA (20% chance)
  if (engine.soft_cta_pool && Math.random() < 0.20) {
    const cta = engine.soft_cta_pool[Math.floor(Math.random() * engine.soft_cta_pool.length)];
    return `${mainLine} ${cta}`;
  }
  
  return mainLine;
}
