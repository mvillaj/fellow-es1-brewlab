import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { GRINDERS_BY_ID } from '@brewlab/shared';
import { runMigrations } from './migrate.ts';

/**
 * 006 hand-copies the corrected specs into SQL. The failure worth catching is
 * drift: the migration moving a bench onto numbers that no longer match what
 * a newly added grinder gets.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(resolve(here, '../../migrations/006_grinder_recalibration.sql'), 'utf8');

const OLD: Record<string, { scale: object; calibration: object; notes: string | null }> = {
  'fellow-opus-2': {
    scale: { kind: 'clicks', min: 1, max: 41, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 28, interceptUm: 150, source: 'estimated' },
    notes:
      'Same 41-step dial as the original Opus, tightened burr alignment. Calibration here is an estimate — worth dialling in with the two-point calibrator.',
  },
  '1zpresso-j-ultra': {
    scale: { kind: 'clicks', min: 0, max: 120, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 8.0, interceptUm: 0, source: 'measured' },
    notes: '8.0 µm per click, 30 clicks per rotation. Published by 1Zpresso.',
  },
  '1zpresso-j-max': {
    scale: { kind: 'clicks', min: 0, max: 90, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 8.8, interceptUm: 0, source: 'measured' },
    notes: '8.8 µm per click, 90 clicks per rotation. Espresso-first hand grinder.',
  },
  '1zpresso-jx-pro': {
    scale: { kind: 'clicks', min: 0, max: 120, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 12.5, interceptUm: 0, source: 'measured' },
    notes: null,
  },
  '1zpresso-k-ultra': {
    scale: { kind: 'clicks', min: 0, max: 100, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 12.5, interceptUm: 0, source: 'measured' },
    notes: null,
  },
};

function bench() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  db.prepare("INSERT INTO users (id, email, display_name, created_at) VALUES ('usr_1', 'e2e@example.com', 'E2E', '2026-10-11')").run();
  return db;
}

function addGrinder(db: DatabaseSync, gid: string, builtInId: string, row: (typeof OLD)[string]) {
  db.prepare(
    `INSERT INTO grinders (id, user_id, built_in_id, name, scale, calibration, notes, created_at)
     VALUES (?, 'usr_1', ?, ?, ?, ?, ?, '2026-10-11')`,
  ).run(gid, builtInId, builtInId, JSON.stringify(row.scale), JSON.stringify(row.calibration), row.notes);
}

function read(db: DatabaseSync, gid: string) {
  const r = db.prepare('SELECT scale, calibration, notes FROM grinders WHERE id = ?').get(gid) as any;
  return { scale: JSON.parse(r.scale), calibration: JSON.parse(r.calibration), notes: r.notes };
}

test('grinders on the old built-in values move to exactly the current spec', () => {
  const db = bench();
  for (const [builtInId, row] of Object.entries(OLD)) addGrinder(db, `grd_${builtInId}`, builtInId, row);
  db.exec(MIGRATION);

  for (const builtInId of Object.keys(OLD)) {
    const spec = GRINDERS_BY_ID[builtInId];
    const got = read(db, `grd_${builtInId}`);
    assert.deepEqual(got.scale, spec.scale, `${builtInId} scale`);
    assert.deepEqual(got.calibration, spec.calibration, `${builtInId} calibration`);
    assert.equal(got.notes, spec.notes, `${builtInId} notes`);
  }
});

test('a recalibrated grinder and its owner\'s notes are left alone', () => {
  const db = bench();
  const mine = {
    ...OLD['fellow-opus-2'],
    calibration: { umPerUnit: 22, interceptUm: 160, source: 'measured' },
    notes: 'Burrs swapped in September.',
  };
  addGrinder(db, 'grd_mine', 'fellow-opus-2', mine);
  addGrinder(db, 'grd_noted', '1zpresso-j-ultra', { ...OLD['1zpresso-j-ultra'], notes: 'Travel grinder.' });
  db.exec(MIGRATION);

  assert.deepEqual(read(db, 'grd_mine'), mine);
  assert.equal(read(db, 'grd_noted').notes, 'Travel grinder.');
  assert.equal(read(db, 'grd_noted').scale.max, 500);
});

test('shots keep the setting and microns they were logged with', () => {
  const db = bench();
  addGrinder(db, 'grd_o2', 'fellow-opus-2', OLD['fellow-opus-2']);
  db.prepare(
    `INSERT INTO shots (id, user_id, grinder_id, brewed_at, grind_setting, grind_microns, dose_g, yield_g, shot_time_s, created_at)
     VALUES ('sht_1', 'usr_1', 'grd_o2', '2026-10-01', 4, 262, 18, 40, 28, '2026-10-01')`,
  ).run();
  db.exec(MIGRATION);

  const shot = db.prepare('SELECT grind_setting, grind_microns FROM shots WHERE id = ?').get('sht_1') as any;
  assert.equal(shot.grind_setting, 4);
  assert.equal(shot.grind_microns, 262);
});
