// Simple in-memory rate limiter (per IP)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 requests per window
const rateLimitMap = new Map();

export function rateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 1, start: now };
  } else {
    entry.count++;
  }
  rateLimitMap.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}
