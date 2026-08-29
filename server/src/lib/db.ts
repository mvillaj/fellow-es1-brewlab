import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.BREWLAB_DB ?? resolve(here, '../../data/brewlab.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grinders (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  built_in_id  TEXT,
  name         TEXT NOT NULL,
  burr_type    TEXT,
  scale        TEXT NOT NULL,
  calibration  TEXT NOT NULL,
  is_default   INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_grinders_user ON grinders(user_id);

CREATE TABLE IF NOT EXISTS machines (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  built_in_id  TEXT,
  name         TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  limits       TEXT NOT NULL,
  is_default   INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_machines_user ON machines(user_id);

CREATE TABLE IF NOT EXISTS coffees (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  roaster        TEXT NOT NULL,
  origin         TEXT,
  region         TEXT,
  producer       TEXT,
  varietal       TEXT,
  process        TEXT,
  roast_level    TEXT,
  altitude_masl  INTEGER,
  roast_date     TEXT,
  tasting_notes  TEXT NOT NULL DEFAULT '[]',
  url            TEXT,
  notes          TEXT,
  is_public      INTEGER NOT NULL DEFAULT 0,
  cloned_from_id TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coffees_owner ON coffees(owner_id);
CREATE INDEX IF NOT EXISTS idx_coffees_public ON coffees(is_public);

CREATE TABLE IF NOT EXISTS shots (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coffee_id        TEXT REFERENCES coffees(id) ON DELETE SET NULL,
  grinder_id       TEXT REFERENCES grinders(id) ON DELETE SET NULL,
  machine_id       TEXT REFERENCES machines(id) ON DELETE SET NULL,
  profile_id       TEXT REFERENCES brew_profiles(id) ON DELETE SET NULL,
  brewed_at        TEXT NOT NULL,
  grind_setting    REAL,
  grind_microns    REAL,
  dose_g           REAL NOT NULL,
  yield_g          REAL NOT NULL,
  shot_time_s      REAL NOT NULL,
  pre_infusion_s   REAL,
  brew_temp_c      REAL,
  peak_pressure_bar REAL,
  basket           TEXT,
  wdt              INTEGER NOT NULL DEFAULT 0,
  rating           INTEGER,
  taste_balance    INTEGER,
  flavour_notes    TEXT NOT NULL DEFAULT '[]',
  notes            TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shots_user ON shots(user_id, brewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_shots_coffee ON shots(coffee_id);

CREATE TABLE IF NOT EXISTS brew_profiles (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  is_public         INTEGER NOT NULL DEFAULT 0,
  profile           TEXT NOT NULL,
  sync_state        TEXT NOT NULL DEFAULT 'local',
  fellow_profile_id TEXT,
  last_pushed_at    TEXT,
  -- Where this profile came from. fromEs1Wire drops the folder field, so without
  -- this an imported profile loses the only signal saying it is not ours to write.
  origin            TEXT NOT NULL DEFAULT 'local',
  source_device_id  TEXT,
  -- The original wire record, so fields our model has no room for survive a
  -- round-trip instead of reverting to observed constants.
  source_wire       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON brew_profiles(user_id);

CREATE TABLE IF NOT EXISTS fellow_connections (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode          TEXT NOT NULL,
  email         TEXT NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  devices       TEXT NOT NULL DEFAULT '[]',
  connected_at  TEXT NOT NULL
);
`);

export function jsonCol<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const bool = (v: unknown) => Number(Boolean(v));
export const nowIso = () => new Date().toISOString();

let counter = 0;
export function id(prefix: string): string {
  counter = (counter + 1) % 0xffff;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(3, '0')}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
