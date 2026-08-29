import { Router } from 'express';
import {
  BUILT_IN_GRINDERS,
  convertSetting,
  grinderInputSchema,
  settingToMicrons,
  grindBucket,
} from '@brewlab/shared';
import { bool, db, id, nowIso } from '../lib/db';
import { requireAuth, type AuthedRequest } from '../lib/auth';
import { required, toGrinder } from '../lib/rows';

export const grinderRouter: Router = Router();

/** The catalogue is public — you should be able to browse it before signing up. */
grinderRouter.get('/catalog', (_req, res) => {
  res.json(BUILT_IN_GRINDERS);
});

grinderRouter.use(requireAuth);

grinderRouter.get('/', (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM grinders WHERE user_id = ? ORDER BY is_default DESC, created_at ASC')
    .all(req.userId!) as any[];
  res.json(rows.map(toGrinder));
});

grinderRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = grinderInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid grinder' });
    return;
  }
  const g = parsed.data;
  const gid = id('grd');
  if (g.isDefault) db.prepare('UPDATE grinders SET is_default = 0 WHERE user_id = ?').run(req.userId!);
  db.prepare(
    `INSERT INTO grinders (id, user_id, built_in_id, name, burr_type, scale, calibration, is_default, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    gid,
    req.userId!,
    g.builtInId ?? null,
    g.name,
    g.burrType ?? null,
    JSON.stringify(g.scale),
    JSON.stringify(g.calibration),
    bool(g.isDefault),
    g.notes ?? null,
    nowIso(),
  );
  res.status(201).json(toGrinder(required(db.prepare('SELECT * FROM grinders WHERE id = ?').get(gid), 'grinder')));
});

grinderRouter.patch('/:id', (req: AuthedRequest, res) => {
  const existing = db
    .prepare('SELECT * FROM grinders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId!) as any;
  if (!existing) {
    res.status(404).json({ error: 'Grinder not found' });
    return;
  }
  const merged = { ...toGrinder(existing), ...req.body };
  const parsed = grinderInputSchema.safeParse(merged);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid grinder' });
    return;
  }
  const g = parsed.data;
  if (g.isDefault) db.prepare('UPDATE grinders SET is_default = 0 WHERE user_id = ?').run(req.userId!);
  db.prepare(
    `UPDATE grinders SET built_in_id = ?, name = ?, burr_type = ?, scale = ?, calibration = ?, is_default = ?, notes = ?
     WHERE id = ? AND user_id = ?`,
  ).run(
    g.builtInId ?? null,
    g.name,
    g.burrType ?? null,
    JSON.stringify(g.scale),
    JSON.stringify(g.calibration),
    bool(g.isDefault),
    g.notes ?? null,
    req.params.id,
    req.userId!,
  );
  res.json(toGrinder(required(db.prepare('SELECT * FROM grinders WHERE id = ?').get(req.params.id), 'grinder')));
});

grinderRouter.delete('/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM grinders WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
  res.status(204).end();
});

/**
 * Translate a setting from one of my grinders to another.
 * POST /api/grinders/convert { fromId, setting, toId }
 */
grinderRouter.post('/convert', (req: AuthedRequest, res) => {
  const { fromId, toId, setting } = req.body ?? {};
  if (typeof setting !== 'number') {
    res.status(400).json({ error: 'setting must be a number' });
    return;
  }
  const load = (gid: string) => {
    const row = db
      .prepare('SELECT * FROM grinders WHERE id = ? AND user_id = ?')
      .get(gid, req.userId!) as any;
    return row ? toGrinder(row) : null;
  };
  const from = load(fromId);
  const to = load(toId);
  if (!from || !to) {
    res.status(404).json({ error: 'Both grinders must be on your shelf' });
    return;
  }
  const result = convertSetting(from, setting, to);
  res.json({
    ...result,
    bucket: grindBucket(result.microns),
    from: { id: from.id, name: from.name, setting, microns: Math.round(settingToMicrons(from, setting)) },
    to: { id: to.id, name: to.name },
  });
});
