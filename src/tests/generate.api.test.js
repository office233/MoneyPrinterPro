// src/tests/generate.api.test.js
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app"; // Assuming Next.js custom server export

describe("POST /api/generate", () => {
  it("should return an imageUrl", async () => {
    const resp = await request(app)
      .post("/api/generate")
      .send({
        persona: "ava",
        caption: "park sunset",
        style: "lifestyle",
        promptMeta: {}
      })
      .set("x-api-key", "dummy-key");
    expect(resp.status).toBe(200);
    expect(resp.body).toHaveProperty("imageUrl");
    expect(typeof resp.body.imageUrl).toBe("string");
  });
});
