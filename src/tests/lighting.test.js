// src/tests/lighting.test.js
import { describe, it, expect } from "vitest";
import { applyLighting } from "../lib/engines/lighting.js";

describe("applyLighting", () => {
  it("adds lighting field", () => {
    const input = { image: "dummy.png", meta: {} };
    const out = applyLighting(input, { type: "natural" });
    expect(out).toHaveProperty("lighting");
    expect(out.lighting).toBe("natural");
  });
});
