import { Router } from 'express';
import { STOCK_PROFILES, brewProfileInputSchema } from '@brewlab/shared';
import { bool, db, id, nowIso } from '../lib/db';
import { optionalAuth, requireAuth, type AuthedRequest } from '../lib/auth';
import { required, toProfile } from '../lib/rows';

export const profileRouter: Router = Router();

const SELECT = `SELECT p.*, u.display_name AS owner_name FROM brew_profiles p JOIN users u ON u.id = p.user_id`;

/** Fellow's factory profiles, as starting points for the editor. */
profileRouter.get('/stock', (_req, res) => {
  res.json(STOCK_PROFILES);
});

profileRouter.get('/public', optionalAuth, (_req, res) => {
  const rows = db
    .prepare(`${SELECT} WHERE p.is_public = 1 ORDER BY p.updated_at DESC LIMIT 200`)
    .all() as any[];
  res.json(rows.map(toProfile));
});

profileRouter.use(requireAuth);

profileRouter.get('/', (req: AuthedRequest, res) => {
  const rows = db
    .prepare(`${SELECT} WHERE p.user_id = ? ORDER BY p.updated_at DESC`)
    .all(req.userId!) as any[];
  res.json(rows.map(toProfile));
});

profileRouter.get('/:id', (req: AuthedRequest, res) => {
  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id) as any;
  if (!row || (!row.is_public && row.user_id !== req.userId)) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json(toProfile(row));
});

profileRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = brewProfileInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' });
    return;
  }
  const p = parsed.data;
  const pid = id('prf');
  const now = nowIso();
  db.prepare(
    `INSERT INTO brew_profiles (id, user_id, name, description, is_public, profile, sync_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'local', ?, ?)`,
  ).run(pid, req.userId!, p.name, p.description ?? null, bool(p.isPublic), JSON.stringify({ ...p.profile, id: pid }), now, now);
  res.status(201).json(toProfile(required(db.prepare(`${SELECT} WHERE p.id = ?`).get(pid), 'profile')));
});

profileRouter.patch('/:id', (req: AuthedRequest, res) => {
  const existing = db
    .prepare('SELECT * FROM brew_profiles WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId!) as any;
  if (!existing) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  const current = toProfile(existing);
  const parsed = brewProfileInputSchema.safeParse({
    name: req.body.name ?? current.name,
    description: req.body.description ?? current.description,
    isPublic: req.body.isPublic ?? current.isPublic,
    profile: req.body.profile ?? current.profile,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' });
    return;
  }
  const p = parsed.data;
  // Editing a profile that already went to the machine makes the copy up there stale.
  const syncState = current.fellowProfileId ? 'stale' : 'local';
  db.prepare(
    `UPDATE brew_profiles SET name=?, description=?, is_public=?, profile=?, sync_state=?, updated_at=?
     WHERE id=? AND user_id=?`,
  ).run(
    p.name,
    p.description ?? null,
    bool(p.isPublic),
    JSON.stringify({ ...p.profile, id: req.params.id }),
    syncState,
    nowIso(),
    req.params.id,
    req.userId!,
  );
  res.json(toProfile(required(db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id), 'profile')));
});

profileRouter.delete('/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM brew_profiles WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
  res.status(204).end();
});

/** Copy a published profile — mine or someone else's — into my library. */
profileRouter.post('/:id/clone', (req: AuthedRequest, res) => {
  const src = db.prepare('SELECT * FROM brew_profiles WHERE id = ?').get(req.params.id) as any;
  if (!src || (!src.is_public && src.user_id !== req.userId)) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  const source = toProfile(src);
  const pid = id('prf');
  const now = nowIso();
  db.prepare(
    `INSERT INTO brew_profiles (id, user_id, name, description, is_public, profile, sync_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, 'local', ?, ?)`,
  ).run(
    pid,
    req.userId!,
    `${source.name} (copy)`,
    source.description,
    JSON.stringify({ ...source.profile, id: pid, name: `${source.name} (copy)` }),
    now,
    now,
  );
  res.status(201).json(toProfile(required(db.prepare(`${SELECT} WHERE p.id = ?`).get(pid), 'profile')));
});
