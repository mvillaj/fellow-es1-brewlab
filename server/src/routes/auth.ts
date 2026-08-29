import bcrypt from 'bcryptjs';
import { Router } from 'express';
import {
  BUILT_IN_GRINDERS,
  BUILT_IN_MACHINES,
  specToUserMachine,
  loginSchema,
  signupSchema,
  type AuthResponse,
  type PublicUser,
} from '@brewlab/shared';
import { bool, db, id, nowIso } from '../lib/db';
import { requireAuth, signToken, type AuthedRequest } from '../lib/auth';

export const authRouter: Router = Router();

const publicUser = (r: any): PublicUser => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  createdAt: r.created_at,
});

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid signup' });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'That email already has an account' });
    return;
  }

  const userId = id('usr');
  const now = nowIso();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, email, await bcrypt.hash(parsed.data.password, 10), parsed.data.displayName, now);

  // A new shelf with nothing on it is a dead end. Give everyone an Opus 2 to
  // start with — it is the grinder most likely to be sitting next to an ES1.
  const seed = BUILT_IN_GRINDERS.find((g) => g.id === 'fellow-opus-2')!;
  db.prepare(
    `INSERT INTO grinders (id, user_id, built_in_id, name, burr_type, scale, calibration, is_default, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id('grd'),
    userId,
    seed.id,
    `${seed.brand} ${seed.model}`,
    seed.burrType,
    JSON.stringify(seed.scale),
    JSON.stringify(seed.calibration),
    seed.notes ?? null,
    now,
  );

  // Same reasoning for the bench: default everyone to an ES1, the machine this
  // app knows most about. Swapping it on the Machines page is what turns the
  // profile studio and the Fellow page off.
  const machineSpec = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
  const machine = specToUserMachine(machineSpec);
  db.prepare(
    `INSERT INTO machines (id, user_id, built_in_id, name, capabilities, limits, is_default, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id('mch'),
    userId,
    machineSpec.id,
    machine.name,
    JSON.stringify(machine.capabilities),
    JSON.stringify(machine.limits),
    machineSpec.notes ?? null,
    now,
  );

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const body: AuthResponse = { token: signToken(userId), user: publicUser(row) };
  res.status(201).json(body);
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(parsed.data.email.toLowerCase().trim()) as any;
  if (!row || !(await bcrypt.compare(parsed.data.password, row.password_hash))) {
    res.status(401).json({ error: 'Wrong email or password' });
    return;
  }
  const body: AuthResponse = { token: signToken(row.id), user: publicUser(row) };
  res.json(body);
});

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!);
  res.json(publicUser(row));
});

// Referenced by the seed script so it can reuse the same hashing rules.
export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export { bool };
