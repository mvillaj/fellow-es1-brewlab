import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { markOnboarded } from './onboarding.ts';

/**
 * Two failures worth catching: an existing user being sent through getting
 * started after the upgrade, and a replay of the page moving the date a user
 * first finished it.
 */
const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, '../../migrations');
const ONBOARDING = '007_onboarding.sql';

// migrate.ts reads its directory once at import, so point it at a scratch copy
// first. Everything before 007 goes in now; 007 is added once there is a user.
const dir = mkdtempSync(join(tmpdir(), 'brewlab-migrations-'));
for (const f of readdirSync(SOURCE).filter((f) => f.endsWith('.sql') && f < ONBOARDING)) {
  copyFileSync(join(SOURCE, f), join(dir, f));
}
process.env.BREWLAB_MIGRATIONS = dir;
const { runMigrations } = await import('./migrate.ts');
after(() => rmSync(dir, { recursive: true, force: true }));

const onboardedAt = (db: DatabaseSync, id: string) =>
  (
    db.prepare('SELECT onboarded_at FROM users WHERE id = ?').get(id) as {
      onboarded_at: string | null;
    }
  ).onboarded_at;

test('users who joined before getting started existed count as onboarded from the day they joined', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  db.prepare(
    "INSERT INTO users (id, email, display_name, created_at) VALUES ('usr_old', 'old@example.com', 'Old', '2026-03-01')",
  ).run();

  copyFileSync(join(SOURCE, ONBOARDING), join(dir, ONBOARDING));
  runMigrations(db);

  assert.equal(onboardedAt(db, 'usr_old'), '2026-03-01');

  // And someone arriving after the upgrade has not been through it yet.
  db.prepare(
    "INSERT INTO users (id, email, display_name, created_at) VALUES ('usr_new', 'new@example.com', 'New', '2026-10-11')",
  ).run();
  assert.equal(onboardedAt(db, 'usr_new'), null);
});

test('marking onboarded sets the date once and leaves it alone after that', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  db.prepare(
    "INSERT INTO users (id, email, display_name, created_at) VALUES ('usr_1', 'a@example.com', 'A', '2026-10-11')",
  ).run();

  markOnboarded(db, 'usr_1', '2026-10-11T08:00:00.000Z');
  assert.equal(onboardedAt(db, 'usr_1'), '2026-10-11T08:00:00.000Z');

  markOnboarded(db, 'usr_1', '2026-10-12T08:00:00.000Z');
  assert.equal(onboardedAt(db, 'usr_1'), '2026-10-11T08:00:00.000Z');
});
