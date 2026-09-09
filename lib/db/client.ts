/**
 * SQLite connection + schema.
 *
 * Single-user app, so SQLite is the right amount of database: real SQL, zero
 * ops, one file to back up. Note the deploy constraint in docs/ARCHITECTURE.md
 * §4 — this needs a persistent filesystem, so it won't run on Vercel's
 * serverless functions. All access goes through lib/db/* to keep that swappable.
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = process.env.RECIPEBOX_DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(path.join(dir, "recipebox.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(conn: Database.Database): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      source_type    TEXT NOT NULL,
      source_ref     TEXT,
      image_path     TEXT,
      base_servings  REAL NOT NULL DEFAULT 1,
      total_time_min INTEGER,
      steps          TEXT NOT NULL DEFAULT '[]',
      tags           TEXT NOT NULL DEFAULT '[]',
      notes          TEXT,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id            TEXT PRIMARY KEY,
      recipe_id     TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position      INTEGER NOT NULL,
      raw           TEXT NOT NULL,
      quantity      REAL,
      unit          TEXT,
      item          TEXT NOT NULL,
      canonical     TEXT NOT NULL,
      prep          TEXT,
      grams         REAL,
      grams_source  TEXT,
      fdc_id        INTEGER,
      optional      INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id);
    -- Drives pantry matching and grocery merging; both join on canonical.
    CREATE INDEX IF NOT EXISTS idx_ingredients_canonical ON ingredients(canonical);

    CREATE TABLE IF NOT EXISTS food_cache (
      canonical            TEXT PRIMARY KEY,
      nutrients            TEXT NOT NULL,
      density_g_per_ml     REAL,
      grams_per_item       REAL,
      grams_per_count_unit TEXT,
      portions             TEXT,
      fdc_id               INTEGER,
      cached_at            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pantry_items (
      id         TEXT PRIMARY KEY,
      canonical  TEXT NOT NULL UNIQUE,
      label      TEXT NOT NULL,
      quantity   REAL,
      unit       TEXT,
      grams      REAL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_plan_entries (
      id        TEXT PRIMARY KEY,
      plan_id   TEXT NOT NULL,
      date      TEXT NOT NULL,
      slot      TEXT NOT NULL,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      servings  REAL NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_plan_entries_plan ON meal_plan_entries(plan_id);
  `);
}
