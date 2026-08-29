import { Router } from 'express';
import { BUILT_IN_MACHINES, machineInputSchema } from '@brewlab/shared';
import { bool, db, id, nowIso } from '../lib/db';
import { requireAuth, type AuthedRequest } from '../lib/auth';
import { required, toMachine } from '../lib/rows';

export const machineRouter: Router = Router();

/** The catalogue is public — you should be able to browse it before signing up. */
machineRouter.get('/catalog', (_req, res) => {
  res.json(BUILT_IN_MACHINES);
});

machineRouter.use(requireAuth);

machineRouter.get('/', (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM machines WHERE user_id = ? ORDER BY is_default DESC, created_at ASC')
    .all(req.userId!) as any[];
  res.json(rows.map(toMachine));
});

machineRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = machineInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid machine' });
    return;
  }
  const m = parsed.data;
  const mid = id('mch');
  if (m.isDefault) db.prepare('UPDATE machines SET is_default = 0 WHERE user_id = ?').run(req.userId!);
  db.prepare(
    `INSERT INTO machines (id, user_id, built_in_id, name, capabilities, limits, is_default, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    mid,
    req.userId!,
    m.builtInId ?? null,
    m.name,
    JSON.stringify(m.capabilities),
    JSON.stringify(m.limits),
    bool(m.isDefault),
    m.notes ?? null,
    nowIso(),
  );
  res.status(201).json(toMachine(required(db.prepare('SELECT * FROM machines WHERE id = ?').get(mid), 'machine')));
});

machineRouter.patch('/:id', (req: AuthedRequest, res) => {
  const existing = db
    .prepare('SELECT * FROM machines WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId!) as any;
  if (!existing) {
    res.status(404).json({ error: 'Machine not found' });
    return;
  }
  const merged = { ...toMachine(existing), ...req.body };
  const parsed = machineInputSchema.safeParse(merged);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid machine' });
    return;
  }
  const m = parsed.data;
  if (m.isDefault) db.prepare('UPDATE machines SET is_default = 0 WHERE user_id = ?').run(req.userId!);
  db.prepare(
    `UPDATE machines SET built_in_id = ?, name = ?, capabilities = ?, limits = ?, is_default = ?, notes = ?
     WHERE id = ? AND user_id = ?`,
  ).run(
    m.builtInId ?? null,
    m.name,
    JSON.stringify(m.capabilities),
    JSON.stringify(m.limits),
    bool(m.isDefault),
    m.notes ?? null,
    req.params.id,
    req.userId!,
  );
  res.json(toMachine(required(db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id), 'machine')));
});

machineRouter.delete('/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM machines WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
  res.status(204).end();
});
