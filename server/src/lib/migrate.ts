import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = process.env.BREWLAB_MIGRATIONS ?? resolve(here, '../../migrations');

/**
 * Applies pending .sql files in filename order, one transaction each, recording
 * what ran in schema_migrations.
 *
 * This replaces the CREATE TABLE IF NOT EXISTS block that used to sit inline in
 * db.ts. That was fine while the schema never changed, but it had no notion of
 * version: there was no way to add a column to a database that already held
 * data, which is exactly the problem you get the first time you want to change
 * anything after going live.
 *
 * Deliberately not clever. No down-migrations (restore from a backup instead),
 * no checksums, no locking — a single writer owns this file, which is the same
 * assumption SQLite on one machine already makes.
 */
export function runMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map(
      (r) => r.version,
    ),
  );

  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => !applied.has(f));

  if (pending.length === 0) return;

  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
      console.log(`  migrated ${file}`);
    } catch (err) {
      db.exec('ROLLBACK');
      // Refuse to serve a half-migrated database — the alternative is routes
      // failing one query at a time against a schema nobody can describe.
      throw new Error(`Migration ${file} failed, rolled back: ${(err as Error).message}`);
    }
  }
}
