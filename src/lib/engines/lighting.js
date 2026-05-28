import { resolveTimeOfDay } from './time-resolver.js';

// Lighting profiles based on resolved time + category
const lightingProfiles = {
  "sunrise": {
    "urban": "golden sunrise warm lighting, soft morning glow, long gentle shadows",
    "indoor": "warm sunrise light through windows, soft morning ambiance",
    "music": "warm stage pre-show lighting, golden ambient glow",
    "travel": "golden sunrise travel atmosphere, warm morning light",
    "nature": "soft golden sunrise light, natural dawn glow, warm horizon"
  },
  "sunset": {
    "urban": "golden hour warm lighting, cinematic rim light, long dramatic shadows",
    "indoor": "warm golden sunset light streaming in",
    "music": "warm stage golden lighting, dramatic sunset spotlight",
    "travel": "golden hour travel glow, warm sunset ambiance",
    "nature": "golden sunset natural light, warm horizon glow"
  },
  "golden_hour": {
    "urban": "golden hour warm lighting, cinematic rim light, long shadows",
    "indoor": "warm golden window light streaming in",
    "music": "warm stage lighting, golden spotlight",
    "travel": "golden hour travel glow",
    "nature": "golden sunset natural light"
  },
  "blue_hour": {
    "urban": "blue hour twilight, neon reflections starting, cool ambient",
    "indoor": "soft interior lighting, warm against cool windows",
    "music": "dramatic blue stage lighting, spotlight contrast",
    "travel": "twilight travel atmosphere",
    "nature": "cool twilight natural light"
  },
  "night": {
    "urban": "dramatic neon lighting, urban night reflections, artificial light mix",
    "indoor": "warm interior lighting, night atmosphere",
    "music": "dramatic concert lighting, intense spotlights, stage fog",
    "travel": "luxury night lighting, soft ambient",
    "nature": "soft moonlight ambience, low natural visibility, cool blue night tone"
  },
  "morning": {
    "urban": "soft morning light, cool tones, minimal shadows",
    "indoor": "soft window light, morning glow",
    "music": "stage pre-show lighting, ambient warmth",
    "travel": "golden morning travel light",
    "nature": "soft dawn light, natural ambient"
  },
  "afternoon": {
    "urban": "bright natural daylight, balanced shadows",
    "indoor": "bright window light, high key lighting",
    "music": "bright stage lighting, high energy",
    "travel": "bright travel daylight",
    "nature": "bright natural sunlight"
  },
  "midday": {
    "urban": "bright natural daylight, strong shadows, high contrast",
    "indoor": "bright window light, high key lighting",
    "music": "bright stage lighting, high energy",
    "travel": "bright travel daylight",
    "nature": "bright natural sunlight"
  },
  "day": {
    "urban": "natural daylight, balanced exposure",
    "indoor": "soft natural window light",
    "music": "stage ambient lighting",
    "travel": "natural travel daylight",
    "nature": "natural daylight, soft ambient"
  }
};

export function buildLighting(scene) {
  // Resolve actual time from scene
  const resolvedTime = resolveTimeOfDay(scene);
  const category = scene.category;
  
  const lightingPrompt = lightingProfiles[resolvedTime]?.[category] || "natural lighting";
  
  return {
    lighting_key: `${resolvedTime}_${category}`,
    lighting_prompt: lightingPrompt,
    resolved_time: resolvedTime,
    category: category
  };
}
