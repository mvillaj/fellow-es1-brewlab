import { Router } from 'express';
import { settingToMicrons, shotInputSchema, suggestNextShot } from '@brewlab/shared';
import { bool, db, id, nowIso } from '../lib/db';
import { requireAuth, type AuthedRequest } from '../lib/auth';
import { toGrinder, toMachine, toShot } from '../lib/rows';

export const shotRouter: Router = Router();

const SELECT = `
  SELECT s.*, c.name AS coffee_name, g.name AS grinder_name, m.name AS machine_name, p.name AS profile_name
  FROM shots s
  LEFT JOIN coffees c ON c.id = s.coffee_id
  LEFT JOIN grinders g ON g.id = s.grinder_id
  LEFT JOIN machines m ON m.id = s.machine_id
  LEFT JOIN brew_profiles p ON p.id = s.profile_id
`;

shotRouter.use(requireAuth);

shotRouter.get('/', (req: AuthedRequest, res) => {
  const clauses = ['s.user_id = ?'];
  const params: unknown[] = [req.userId!];
  if (req.query.coffeeId) {
    clauses.push('s.coffee_id = ?');
    params.push(req.query.coffeeId);
  }
  const limit = Math.min(500, Number(req.query.limit ?? 200));
  const rows = db
    .prepare(`${SELECT} WHERE ${clauses.join(' AND ')} ORDER BY s.brewed_at DESC LIMIT ${limit}`)
    .all(...(params as any[])) as any[];
  res.json(rows.map(toShot));
});

shotRouter.get('/:id', (req: AuthedRequest, res) => {
  const row = db.prepare(`${SELECT} WHERE s.id = ? AND s.user_id = ?`).get(req.params.id, req.userId!) as any;
  if (!row) {
    res.status(404).json({ error: 'Shot not found' });
    return;
  }
  res.json(toShot(row));
});

shotRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = shotInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid shot' });
    return;
  }
  const s = parsed.data;

  // A shot is always pulled on something. If the client did not say which,
  // assume the machine on the bench -- the same default the form shows.
  const machineRow = (
    s.machineId
      ? db.prepare('SELECT * FROM machines WHERE id = ? AND user_id = ?').get(s.machineId, req.userId!)
      : db
          .prepare('SELECT * FROM machines WHERE user_id = ? ORDER BY is_default DESC, created_at ASC LIMIT 1')
          .get(req.userId!)
  ) as any;
  const machine = machineRow ? toMachine(machineRow) : null;

  // The shot schema only bounds temperature loosely, because what counts as
  // out of range depends on the machine. Enforce the real range here.
  if (machine && s.brewTempC != null) {
    const { min, max } = machine.limits.tempC;
    if (s.brewTempC < min || s.brewTempC > max) {
      res.status(400).json({ error: `${machine.name} brews between ${min} and ${max} \u00b0C` });
      return;
    }
  }

  // Freeze the micron equivalent at log time. If the user recalibrates the
  // grinder later we still know what this shot actually was.
  let microns: number | null = null;
  if (s.grinderId && s.grindSetting != null) {
    const row = db
      .prepare('SELECT * FROM grinders WHERE id = ? AND user_id = ?')
      .get(s.grinderId, req.userId!) as any;
    if (row) microns = Math.round(settingToMicrons(toGrinder(row), s.grindSetting));
  }

  const sid = id('sht');
  db.prepare(
    `INSERT INTO shots (id, user_id, coffee_id, grinder_id, machine_id, profile_id, brewed_at, grind_setting, grind_microns,
       dose_g, yield_g, shot_time_s, pre_infusion_s, brew_temp_c, peak_pressure_bar, basket, wdt,
       rating, taste_balance, flavour_notes, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sid,
    req.userId!,
    s.coffeeId ?? null,
    s.grinderId ?? null,
    machine?.id ?? null,
    s.profileId ?? null,
    s.brewedAt ?? nowIso(),
    s.grindSetting ?? null,
    microns,
    s.doseG,
    s.yieldG,
    s.shotTimeS,
    s.preInfusionS ?? null,
    s.brewTempC ?? null,
    s.peakPressureBar ?? null,
    s.basket ?? null,
    bool(s.wdt),
    s.rating ?? null,
    s.tasteBalance ?? null,
    JSON.stringify(s.flavourNotes ?? []),
    s.notes ?? null,
    nowIso(),
  );

  const row = db.prepare(`${SELECT} WHERE s.id = ?`).get(sid) as any;
  const shot = toShot(row);
  res.status(201).json({ shot, suggestion: suggestNextShot(shot) });
});

shotRouter.delete('/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM shots WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
  res.status(204).end();
});

/** Headline numbers for the dashboard. */
shotRouter.get('/meta/stats', (req: AuthedRequest, res) => {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              ROUND(AVG(rating), 2) AS avg_rating,
              ROUND(AVG(shot_time_s), 1) AS avg_time,
              ROUND(AVG(yield_g / dose_g), 2) AS avg_ratio,
              SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) AS good_shots
       FROM shots WHERE user_id = ?`,
    )
    .get(req.userId!) as any;
  const streak = db
    .prepare(
      `SELECT COUNT(DISTINCT substr(brewed_at, 1, 10)) AS days FROM shots
       WHERE user_id = ? AND brewed_at >= date('now', '-30 days')`,
    )
    .get(req.userId!) as any;
  res.json({
    total: row?.total ?? 0,
    avgRating: row?.avg_rating ?? null,
    avgTimeS: row?.avg_time ?? null,
    avgRatio: row?.avg_ratio ?? null,
    goodShots: row?.good_shots ?? 0,
    activeDaysLast30: streak?.days ?? 0,
  });
});
