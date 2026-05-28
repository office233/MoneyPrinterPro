import { validateScene } from './scene-validator.js';
import { validateWeather } from './weather.js';
import { buildLighting } from './lighting.js';
import { buildShadowConsistency } from './shadow.js';
import { applyPillarOutfitBias } from './outfit-bias.js';
import { selectMotion } from './motion.js';

export function buildVisualContext(data) {
  let { persona, pillar, scene, shot, format } = data;
  
  console.log('🎨 Building visual context...');
  
  const fixes = [];
  
  // 1️⃣ Scene validation (shot-location consistency)
  const sceneValidation = validateScene({ persona, pillar, scene, shot });
  if (sceneValidation.wasFixed) {
    shot = sceneValidation.shot;
    fixes.push('scene: shot adjusted for location compatibility');
  }
  
  // 2️⃣ Weather validation (outfit realism)
  scene = validateWeather(scene);
  if (scene.outfit_fixed) {
    fixes.push('weather: outfit adjusted for weather conditions');
  }
  
  // 3️⃣ Pillar outfit bias (style consistency)
  const outfitBias = applyPillarOutfitBias(persona, pillar, scene.outfit_description);
  if (outfitBias.modified) {
    scene.outfit_description = outfitBias.outfit;
    fixes.push(`pillar: outfit adjusted to match ${pillar} style`);
  }
  
  // 4️⃣ Lighting profile (with time resolution)
  const lighting = buildLighting(scene);
  
  // 5️⃣ Shadow consistency (for video AI)
  const shadow = buildShadowConsistency(lighting.lighting_key, lighting.resolved_time);
  
  // 6️⃣ Motion selection (for video/reel formats)
  const motion = selectMotion(shot.shot_archetype, format || 'feed_static');
  
  // 7️⃣ Log all fixes or confirm clean
  if (fixes.length > 0) {
    console.log('   ⚙️  Auto-fixes applied:');
    fixes.forEach(fix => console.log(`      - ${fix}`));
  } else {
    console.log('   ✅ No fixes needed - scene consistent');
  }
  
  console.log(`   💡 Lighting: ${lighting.lighting_key} (${lighting.resolved_time})`);
  console.log(`   🎬 Shadow: ${shadow.shadow_direction}`);
  if (format === 'video_ai' || format === 'reel_static') {
    console.log(`   🎥 Motion: ${motion.camera_motion}`);
  }
  
  // 8️⃣ Build unified context
  const visualContext = {
    scene,
    shot,
    format: format || 'feed_static',
    lighting_prompt: lighting.lighting_prompt,
    weather_prompt: scene.weather_prompt || "",
    shadow_prompt: shadow.shadow_prompt,
    video_consistency_prompt: shadow.video_consistency_prompt,
    motion_prompt: motion.motion_prompt,
    video_motion_bias: motion.video_motion_bias,
    resolved_time: lighting.resolved_time,
    pillar_style: outfitBias.pillar_style,
    was_fixed: fixes.length > 0,
    fixes_applied: fixes
  };
  
  console.log('✅ Visual context ready');
  
  return visualContext;
}
