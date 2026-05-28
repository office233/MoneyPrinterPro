import fs from 'fs';
import path from 'path';
import { getDb } from '../db.js';

export function pickNextScene(persona, forcedCategory = null) {
  const db = getDb();

  const locationsPath = path.join(process.cwd(), `personas/${persona}/locations.universe.json`);
  const outfitsPath = path.join(process.cwd(), `personas/${persona}/outfits.universe.json`);

  const locationsData = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
  const outfitsData = JSON.parse(fs.readFileSync(outfitsPath, 'utf8'));

  // Helper: Check if used within N days
  function usedWithinDays(field, value, days) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const rows = db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM post_scene 
      WHERE post_id IN (SELECT id FROM posts WHERE persona = ? AND created_at >= ?)
      AND ${field} = ?
    `).get(persona, cutoff, value);
    return rows.cnt > 0;
  }

  // Pick location
  function pickLocation() {
    const rules = locationsData.rules.anti_repeat;
    const categories = locationsData.categories;
    const categoryWeights = locationsData.category_weights;
    
    let selectedCategory;
    
    // If forced category is provided, use it
    if (forcedCategory && categories[forcedCategory]) {
      selectedCategory = forcedCategory;
    } else {
      // Pick category by weight
      const rand = Math.random();
      let cumulative = 0;
      
      for (const [cat, weight] of Object.entries(categoryWeights)) {
        cumulative += weight;
        if (rand <= cumulative) {
          selectedCategory = cat;
          break;
        }
      }
      
      if (!selectedCategory) selectedCategory = Object.keys(categoryWeights)[0];
    }
    
    const categoryData = categories[selectedCategory];
    const cities = categoryData.cities;
    const spots = categoryData.spots;
    const vibeTags = categoryData.vibe_tags;
    
    // Filter valid cities
    const validCities = cities.filter(city => !usedWithinDays('city', city, rules.same_city_within_days));
    
    if (validCities.length === 0) {
      throw new Error('No valid cities found! All used within ' + rules.same_city_within_days + ' days.');
    }
    
    const city = validCities[Math.floor(Math.random() * validCities.length)];
    
    // Filter valid spots
    const validSpots = spots.filter(spot => {
      const locationKey = `${city.toLowerCase().replace(/\s/g, '_')}_${spot.toLowerCase().replace(/\s/g, '_')}`;
      return !usedWithinDays('location_key', locationKey, rules.same_location_key_within_days);
    });
    
    if (validSpots.length === 0) {
      throw new Error('No valid spots found for city: ' + city);
    }
    
    const spot = validSpots[Math.floor(Math.random() * validSpots.length)];
    const locationKey = `${city.toLowerCase().replace(/\s/g, '_')}_${spot.toLowerCase().replace(/\s/g, '_')}`;
    
    // Pick time of day
    const times = locationsData.time_of_day;
    const validTimes = times.filter(t => !usedWithinDays('time_of_day', t, rules.same_time_within_days));
    const timeOfDay = validTimes.length > 0 
      ? validTimes[Math.floor(Math.random() * validTimes.length)]
      : times[Math.floor(Math.random() * times.length)];
    
    // Pick weather
    const weathers = locationsData.weather;
    const validWeathers = weathers.filter(w => !usedWithinDays('weather', w, rules.same_weather_within_days));
    const weather = validWeathers.length > 0
      ? validWeathers[Math.floor(Math.random() * validWeathers.length)]
      : weathers[Math.floor(Math.random() * weathers.length)];
    
    // Pick vibe tag
    const validVibes = vibeTags.filter(v => !usedWithinDays('vibe_tag', v, rules.same_vibe_within_days));
    const vibeTag = validVibes.length > 0
      ? validVibes[Math.floor(Math.random() * validVibes.length)]
      : vibeTags[Math.floor(Math.random() * vibeTags.length)];
    
    return {
      city,
      spot,
      location_key: locationKey,
      category: selectedCategory,
      time_of_day: timeOfDay,
      weather,
      vibe_tag: vibeTag
    };
  }

  // Pick outfit
  function pickOutfit() {
    const colors = outfitsData.colors;
    const fabrics = outfitsData.fabrics;
    const fits = outfitsData.fits;
    const tops = outfitsData.tops;
    const bottoms = outfitsData.bottoms;
    const shoes = outfitsData.shoes;
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fabric = fabrics[Math.floor(Math.random() * fabrics.length)];
    const fit = fits[Math.floor(Math.random() * fits.length)];
    const top = tops[Math.floor(Math.random() * tops.length)];
    const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const footwear = shoes[Math.floor(Math.random() * shoes.length)];
    
    const outfitDescription = `${color} ${fabric} ${fit} ${top}, ${bottom}, ${footwear}`;
    
    return {
      outfit_description: outfitDescription,
      color,
      fabric,
      fit,
      top,
      bottom,
      shoes: footwear
    };
  }

  // Main
  const location = pickLocation();
  const outfit = pickOutfit();

  const scene = {
    persona,
    ...location,
    ...outfit
  };

  return scene;
}
