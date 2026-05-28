// src/tests/db.job.test.js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../lib/db.js";

let db;

beforeAll(() => {
  // SQLite in‑memory DB for fast tests
  db = getDb(":memory:");
  db.exec(`
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona TEXT,
      output_type TEXT,
      status TEXT,
      created_at TEXT
    );
  `);
});

afterAll(() => {
  db.close();
});

describe("Job DB", () => {
  it("can insert and fetch a job", () => {
    const stmt = db.prepare(
      "INSERT INTO jobs (persona, output_type, status, created_at) VALUES (?,?,?,?)"
    );
    stmt.run("ava", "image", "done", "2026-05-28 12:00:00");
    const row = db.prepare("SELECT * FROM jobs WHERE persona = ?").get("ava");
    expect(row).toBeDefined();
    expect(row.persona).toBe("ava");
    expect(row.output_type).toBe("image");
    expect(row.status).toBe("done");
  });
});
