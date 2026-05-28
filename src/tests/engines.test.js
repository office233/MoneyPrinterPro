// src/tests/engines.test.js
// Tests for engine logic patterns used in the generation pipeline
import { describe, it, expect } from "vitest";

// Inline engine helpers (mirror patterns from src/lib/engines/)
function resolveTimeOfDay(hour) {
  if (hour >= 5 && hour < 8) return "golden_hour_morning";
  if (hour >= 8 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "golden_hour_evening";
  if (hour >= 20 && hour < 22) return "blue_hour";
  return "night";
}

function resolveLighting(timeOfDay) {
  const map = {
    golden_hour_morning: { type: "natural", warmth: "warm", intensity: 0.7 },
    morning: { type: "natural", warmth: "neutral", intensity: 0.8 },
    midday: { type: "natural", warmth: "neutral", intensity: 1.0 },
    afternoon: { type: "natural", warmth: "warm", intensity: 0.85 },
    golden_hour_evening: { type: "natural", warmth: "very_warm", intensity: 0.6 },
    blue_hour: { type: "ambient", warmth: "cool", intensity: 0.4 },
    night: { type: "artificial", warmth: "cool", intensity: 0.3 },
  };
  return map[timeOfDay] || map.midday;
}

function resolveShadow(lighting) {
  if (lighting.intensity >= 0.8) return { type: "hard", direction: "overhead", opacity: 0.7 };
  if (lighting.intensity >= 0.5) return { type: "soft", direction: "angled", opacity: 0.4 };
  return { type: "diffuse", direction: "ambient", opacity: 0.15 };
}

function buildPromptMeta(hour, weather = "clear") {
  const time = resolveTimeOfDay(hour);
  const lighting = resolveLighting(time);
  const shadow = resolveShadow(lighting);
  return { time, lighting, shadow, weather };
}

describe("resolveTimeOfDay", () => {
  it("returns golden_hour_morning for 6am", () => {
    expect(resolveTimeOfDay(6)).toBe("golden_hour_morning");
  });
  it("returns midday for noon", () => {
    expect(resolveTimeOfDay(12)).toBe("midday");
  });
  it("returns golden_hour_evening for 18:00", () => {
    expect(resolveTimeOfDay(18)).toBe("golden_hour_evening");
  });
  it("returns night for 23:00", () => {
    expect(resolveTimeOfDay(23)).toBe("night");
  });
  it("returns night for 3am", () => {
    expect(resolveTimeOfDay(3)).toBe("night");
  });
});

describe("resolveLighting", () => {
  it("returns warm lighting for golden hour morning", () => {
    const l = resolveLighting("golden_hour_morning");
    expect(l.warmth).toBe("warm");
    expect(l.type).toBe("natural");
  });
  it("returns cool lighting for night", () => {
    const l = resolveLighting("night");
    expect(l.warmth).toBe("cool");
    expect(l.type).toBe("artificial");
  });
  it("falls back to midday for unknown time", () => {
    const l = resolveLighting("unknown_time");
    expect(l.intensity).toBe(1.0);
  });
});

describe("resolveShadow", () => {
  it("returns hard shadows for high intensity", () => {
    expect(resolveShadow({ intensity: 1.0 }).type).toBe("hard");
  });
  it("returns soft shadows for medium intensity", () => {
    expect(resolveShadow({ intensity: 0.6 }).type).toBe("soft");
  });
  it("returns diffuse shadows for low intensity", () => {
    expect(resolveShadow({ intensity: 0.2 }).type).toBe("diffuse");
  });
});

describe("buildPromptMeta (integration)", () => {
  it("builds coherent metadata for noon", () => {
    const meta = buildPromptMeta(12);
    expect(meta.time).toBe("midday");
    expect(meta.lighting.type).toBe("natural");
    expect(meta.shadow.type).toBe("hard");
    expect(meta.weather).toBe("clear");
  });
  it("builds coherent metadata for midnight", () => {
    const meta = buildPromptMeta(0);
    expect(meta.time).toBe("night");
    expect(meta.lighting.type).toBe("artificial");
    expect(meta.shadow.type).toBe("diffuse");
  });
});
