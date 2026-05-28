// src/tests/validation.test.js
// Tests for input validation logic used across API routes
import { describe, it, expect } from "vitest";

// Inline validation helpers (mirror logic from API routes)
function validateGenerateRequest(body) {
  const errors = [];
  if (!body) errors.push("Request body is required");
  if (!body?.persona || typeof body.persona !== "string")
    errors.push("persona is required and must be a string");
  if (!body?.style || typeof body.style !== "string")
    errors.push("style is required and must be a string");
  if (body?.caption && typeof body.caption !== "string")
    errors.push("caption must be a string");
  return { valid: errors.length === 0, errors };
}

function validateApiKey(key) {
  if (!key) return { valid: false, error: "API key is required" };
  if (typeof key !== "string") return { valid: false, error: "API key must be a string" };
  if (key.length < 10) return { valid: false, error: "API key too short" };
  return { valid: true };
}

function sanitizePrompt(text) {
  return text
    .replace(/[<>]/g, "")        // strip HTML tags
    .replace(/\r?\n/g, " ")      // flatten newlines
    .trim()
    .slice(0, 2000);             // hard limit
}

describe("validateGenerateRequest", () => {
  it("accepts valid request", () => {
    const result = validateGenerateRequest({
      persona: "ava",
      style: "lifestyle",
      caption: "sunset in park",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing persona", () => {
    const result = validateGenerateRequest({ style: "lifestyle" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("persona is required and must be a string");
  });

  it("rejects missing style", () => {
    const result = validateGenerateRequest({ persona: "ava" });
    expect(result.valid).toBe(false);
  });

  it("rejects empty body", () => {
    const result = validateGenerateRequest(null);
    expect(result.valid).toBe(false);
  });

  it("accepts request without caption", () => {
    const result = validateGenerateRequest({ persona: "ava", style: "cinematic" });
    expect(result.valid).toBe(true);
  });

  it("rejects non-string caption", () => {
    const result = validateGenerateRequest({
      persona: "ava",
      style: "lifestyle",
      caption: 123,
    });
    expect(result.valid).toBe(false);
  });
});

describe("validateApiKey", () => {
  it("accepts valid key", () => {
    expect(validateApiKey("sk_test_1234567890")).toEqual({ valid: true });
  });

  it("rejects empty key", () => {
    expect(validateApiKey("").valid).toBe(false);
  });

  it("rejects null key", () => {
    expect(validateApiKey(null).valid).toBe(false);
  });

  it("rejects short key", () => {
    expect(validateApiKey("abc").valid).toBe(false);
  });
});

describe("sanitizePrompt", () => {
  it("strips HTML tags", () => {
    expect(sanitizePrompt("<script>alert('xss')</script>")).toBe("scriptalert('xss')/script");
  });

  it("flattens newlines", () => {
    expect(sanitizePrompt("line1\nline2\r\nline3")).toBe("line1 line2 line3");
  });

  it("trims whitespace", () => {
    expect(sanitizePrompt("  hello  ")).toBe("hello");
  });

  it("enforces max length", () => {
    const long = "a".repeat(3000);
    expect(sanitizePrompt(long).length).toBe(2000);
  });
});
