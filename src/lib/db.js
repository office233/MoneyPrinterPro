import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Resolve project root (two levels up from src/lib/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const DB_DIR = path.join(PROJECT_ROOT, "data");
const DB_PATH = path.join(DB_DIR, "money-printer.db");

/** @type {import('better-sqlite3').Database | null} */
let _db = null;

/**
 * Initialize all database tables.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to call on every startup.
 */
function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      persona         TEXT NOT NULL,
      output_type     TEXT NOT NULL CHECK(output_type IN ('image', 'video')),
      style           TEXT,
      shot_type       TEXT,
      status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending', 'running', 'done', 'failed')),
      image_path      TEXT,
      video_path      TEXT,
      prompt          TEXT,
      model           TEXT,
      duration_ms     INTEGER,
      cost_estimate   REAL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      error           TEXT
    );

    CREATE TABLE IF NOT EXISTS post_scene (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id          INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      city            TEXT NOT NULL,
      category        TEXT NOT NULL,
      spot            TEXT NOT NULL,
      time_of_day     TEXT NOT NULL,
      weather         TEXT NOT NULL,
      vibe_tag        TEXT NOT NULL,
      location_key    TEXT NOT NULL,
      shot_key        TEXT,
      shot_archetype  TEXT,
      outfit          TEXT
    );

    CREATE TABLE IF NOT EXISTS planner_state (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      persona         TEXT NOT NULL,
      pillar          TEXT NOT NULL,
      weight          REAL NOT NULL DEFAULT 1.0,
      last_used       TEXT
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_jobs_persona_status
      ON jobs(persona, status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at
      ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_post_scene_job_id
      ON post_scene(job_id);
    CREATE INDEX IF NOT EXISTS idx_post_scene_location_key
      ON post_scene(location_key);
    CREATE INDEX IF NOT EXISTS idx_planner_persona_pillar
      ON planner_state(persona, pillar);
  `);
}

/**
 * Returns the singleton database instance.
 * Opens the database and creates tables on first call.
 *
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (_db) return _db;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  _db.pragma("journal_mode = WAL");
  // Enable foreign key enforcement
  _db.pragma("foreign_keys = ON");

  initTables(_db);

  return _db;
}

/**
 * Close the database connection (useful for graceful shutdown).
 */
export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export { DB_PATH };
