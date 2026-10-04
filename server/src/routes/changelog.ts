import { Router } from 'express';
import { changelogEntryInputSchema } from '@brewlab/shared';
import { db, id, nowIso } from '../lib/db';
import { requireAdmin, requireAuth, type AuthedRequest } from '../lib/auth';
import { required, toChangelogEntry } from '../lib/rows';

export const changelogRouter: Router = Router();

const SELECT = `
  SELECT c.*, u.display_name AS author_name
  FROM changelog_entries c LEFT JOIN users u ON u.id = c.author_id`;

const load = (entryId: string) =>
  toChangelogEntry(required(db.prepare(`${SELECT} WHERE c.id = ?`).get(entryId), 'changelog entry'));

/** Public: release notes are worth reading before you sign up. */
changelogRouter.get('/', (_req, res) => {
  const rows = db.prepare(`${SELECT} ORDER BY c.published_on DESC, c.created_at DESC`).all() as any[];
  res.json(rows.map(toChangelogEntry));
});

changelogRouter.use(requireAuth, requireAdmin);

changelogRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = changelogEntryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid entry' });
    return;
  }
  const e = parsed.data;
  const eid = id('chg');
  const now = nowIso();
  db.prepare(
    `INSERT INTO changelog_entries (id, author_id, title, version, published_on, changes, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(eid, req.userId!, e.title, e.version || null, e.publishedOn, JSON.stringify(e.changes), e.body, now, now);
  res.status(201).json(load(eid));
});

changelogRouter.put('/:id', (req: AuthedRequest, res) => {
  const parsed = changelogEntryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid entry' });
    return;
  }
  const e = parsed.data;
  const result = db
    .prepare(
      `UPDATE changelog_entries SET title = ?, version = ?, published_on = ?, changes = ?, body = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(e.title, e.version || null, e.publishedOn, JSON.stringify(e.changes), e.body, nowIso(), req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }
  res.json(load(req.params.id));
});

changelogRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM changelog_entries WHERE id = ?').run(req.params.id);
  res.status(204).end();
});
