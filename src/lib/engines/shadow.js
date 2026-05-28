// Light direction definitions per lighting scenario
const lightDirections = {
  "sunrise": "light_from_left_45deg",
  "sunset": "light_from_right_45deg", 
  "golden_hour": "light_from_side_45deg",
  "blue_hour": "ambient_diffused",
  "night_urban": "rear_rim_light",
  "night_nature": "soft_ambient",
  "morning": "front_left_soft",
  "afternoon": "overhead_natural",
  "midday": "overhead_harsh",
  "day": "natural_overhead"
};

const shadowPrompts = {
  "light_from_left_45deg": `
    primary light source from camera left at 45 degrees,
    shadows falling toward camera right,
    consistent facial shadow structure,
    warm golden rim light on left side
  `,
  "light_from_right_45deg": `
    primary light source from camera right at 45 degrees,
    shadows falling toward camera left,
    consistent facial shadow structure,
    warm golden rim light on right side
  `,
  "light_from_side_45deg": `
    primary light source from side at 45 degrees,
    long soft shadows,
    consistent shadow direction,
    dramatic side lighting
  `,
  "ambient_diffused": `
    soft diffused ambient lighting,
    minimal shadow contrast,
    twilight ambient glow,
    no harsh shadows
  `,
  "rear_rim_light": `
    strong rim light from behind subject,
    dramatic backlit silhouette edge,
    subtle facial shadow from front fill,
    neon reflections as accent lights
  `,
  "soft_ambient": `
    soft ambient moonlight,
    minimal shadow definition,
    cool blue ambient tone,
    natural low-light atmosphere
  `,
  "front_left_soft": `
    soft frontal lighting from left,
    gentle shadows,
    natural morning light quality,
    balanced exposure
  `,
  "overhead_natural": `
    natural overhead sunlight,
    vertical shadow direction,
    balanced natural exposure,
    realistic daytime shadows
  `,
  "overhead_harsh": `
    strong overhead sunlight,
    sharp vertical shadows,
    high contrast lighting,
    intense midday exposure
  `,
  "natural_overhead": `
    natural daylight from above,
    soft natural shadows,
    balanced exposure,
    realistic outdoor lighting
  `
};

export function buildShadowConsistency(lightingKey, resolvedTime) {
  const direction = lightDirections[resolvedTime] || "natural_overhead";
  const shadowPrompt = shadowPrompts[direction] || "consistent directional lighting, realistic shadow continuity";
  
  return {
    shadow_direction: direction,
    shadow_prompt: shadowPrompt.trim().replace(/\s+/g, ' '),
    video_consistency_prompt: `
      maintain identical light direction across all frames,
      shadow consistency during movement,
      no shifting light source,
      realistic shadow physics throughout motion
    `.trim().replace(/\s+/g, ' ')
  };
}
