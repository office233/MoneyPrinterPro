export function resolveTimeOfDay(scene) {
  const spot = scene.spot ? scene.spot.toLowerCase() : '';
  const timeField = scene.time_of_day ? scene.time_of_day.toLowerCase() : '';
  
  // Priority 1: Explicit keywords in spot name
  if (spot.includes('sunrise') || spot.includes('dawn')) return 'sunrise';
  if (spot.includes('sunset') || spot.includes('dusk')) return 'sunset';
  if (spot.includes('night') || spot.includes('midnight')) return 'night';
  if (spot.includes('morning')) return 'morning';
  if (spot.includes('evening')) return 'evening';
  
  // Priority 2: time_of_day field
  if (timeField.includes('early morning')) return 'morning';
  if (timeField.includes('golden hour')) return 'golden_hour';
  if (timeField.includes('blue hour')) return 'blue_hour';
  if (timeField.includes('midnight')) return 'night';
  if (timeField.includes('rainy afternoon')) return 'afternoon';
  if (timeField.includes('foggy morning')) return 'morning';
  if (timeField.includes('sunny midday')) return 'midday';
  
  // Fallback: default to day
  return 'day';
}
