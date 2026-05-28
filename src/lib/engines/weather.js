import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve from project root: src/lib/engines/ → ../../config/weather_rules.json
const WEATHER_RULES_PATH = path.resolve(__dirname, '../../config/weather_rules.json');

const weatherRules = JSON.parse(fs.readFileSync(WEATHER_RULES_PATH, 'utf8'));

export function validateWeather(scene) {
  const weather = scene.weather;
  
  if (!weatherRules[weather]) {
    return {
      ...scene,
      weather_prompt: "",
      outfit_fixed: false
    };
  }
  
  const rules = weatherRules[weather];
  let modifiedOutfit = scene.outfit_description;
  let outfitFixed = false;
  
  // 1️⃣ Check required keywords (rain protection, etc.)
  if (rules.required_keywords) {
    const hasRequired = rules.required_keywords.some(keyword =>
      modifiedOutfit.toLowerCase().includes(keyword)
    );
    
    if (!hasRequired) {
      // Add protective layer
      const protection = rules.required_keywords[0]; // Use first required item
      modifiedOutfit = `${modifiedOutfit}, structured ${protection}`;
      outfitFixed = true;
    }
  }
  
  // 2️⃣ Remove forbidden keywords (silk in rain, etc.)
  if (rules.forbidden_keywords) {
    rules.forbidden_keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(modifiedOutfit)) {
        modifiedOutfit = modifiedOutfit.replace(regex, 'cotton');
        outfitFixed = true;
      }
    });
  }
  
  return {
    ...scene,
    outfit_description: modifiedOutfit,
    weather_prompt: rules.prompt_modifier || "",
    outfit_fixed: outfitFixed
  };
}
