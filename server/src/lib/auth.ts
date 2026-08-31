import type { NextFunction, Request, Response } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { BUILT_IN_GRINDERS, BUILT_IN_MACHINES, specToUserMachine } from '@brewlab/shared';
import { db, id, nowIso } from './db';

/**
 * Fail at boot, not on the first request. Without these, clerkMiddleware throws
 * per-request and every route — including ones that should be readable while
 * signed out — answers 500 with a stack trace instead of anything actionable.
 * The publishable key is needed server-side too: Clerk derives the instance's
 * issuer and JWKS endpoint from it in order to verify session tokens.
 */
function requireClerkKeys() {
  const missing = ['CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'].filter(
    (k) => !process.env[k]?.trim(),
  );
  if (missing.length === 0) return;
  throw new Error(
    `${missing.join(' and ')} must be set. Copy them from https://dashboard.clerk.com ` +
      '(your app -> API keys) into the .env at the repo root — see .env.example.',
  );
}

requireClerkKeys();

export interface AuthedRequest extends Request {
  userId?: string;
  displayName?: string;
}

interface UserRow {
  id: string;
  display_name: string;
}

/**
 * Clerk owns identity; this table owns everything hanging off it. The mapping is
 * deliberately one column wide: `req.userId` stays a local usr_ id, so the six
 * `user_id` foreign keys and every route that reads them are untouched.
 */
function findLocalUser(clerkSubject: string): UserRow | undefined {
  return db
    .prepare('SELECT id, display_name FROM users WHERE clerk_subject = ?')
    .get(clerkSubject) as UserRow | undefined;
}

/**
 * There is no signup endpoint to hang the first-run setup off any more — Clerk
 * creates the account on its own hosted page and the first we hear of a user is
 * a request that already carries a valid session. So the bench gets built here,
 * on first sight, with the same defaults the old signup route used: an Opus 2
 * and an ES1, because a shelf with nothing on it is a dead end.
 */
function insertUser(clerkSubject: string, email: string, displayName: string): UserRow {
  const now = nowIso();
  const userId = id('usr');
  db.exec('BEGIN');
  try {
    // Re-check inside the transaction: two requests from a brand-new user can
    // both get past the lookup above while the Clerk profile fetch is in flight.
    const raced = findLocalUser(clerkSubject);
    if (raced) {
      db.exec('ROLLBACK');
      return raced;
    }

    db.prepare(
      'INSERT INTO users (id, clerk_subject, email, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, clerkSubject, email, displayName, now);

    const grinder = BUILT_IN_GRINDERS.find((g) => g.id === 'fellow-opus-2')!;
    db.prepare(
      `INSERT INTO grinders (id, user_id, built_in_id, name, burr_type, scale, calibration, is_default, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id('grd'),
      userId,
      grinder.id,
      `${grinder.brand} ${grinder.model}`,
      grinder.burrType,
      JSON.stringify(grinder.scale),
      JSON.stringify(grinder.calibration),
      grinder.notes ?? null,
      now,
    );

    const spec = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
    const machine = specToUserMachine(spec);
    db.prepare(
      `INSERT INTO machines (id, user_id, built_in_id, name, capabilities, limits, is_default, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id('mch'),
      userId,
      spec.id,
      machine.name,
      JSON.stringify(machine.capabilities),
      JSON.stringify(machine.limits),
      spec.notes ?? null,
      now,
    );

    db.exec('COMMIT');
    return { id: userId, display_name: displayName };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Pulls the name and email off the Clerk profile so the UI has something to show. */
async function provision(clerkSubject: string): Promise<UserRow> {
  const profile = await clerkClient.users.getUser(clerkSubject);
  const email =
    profile.primaryEmailAddress?.emailAddress ?? profile.emailAddresses[0]?.emailAddress ?? null;
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
    profile.username ||
    email?.split('@')[0] ||
    'Brewer';

  // `email` is UNIQUE and Clerk allows accounts without one (phone-only, some
  // OAuth providers). Fall back to a per-user synthetic address rather than
  // letting the insert fail and locking the account out of its own bench.
  return insertUser(clerkSubject, email ?? `${clerkSubject}@clerk.local`, displayName);
}

async function resolveUser(req: AuthedRequest): Promise<boolean> {
  const { userId } = getAuth(req);
  if (!userId) return false;
  const row = findLocalUser(userId) ?? (await provision(userId));
  req.userId = row.id;
  req.displayName = row.display_name;
  return true;
}

/** Hard gate: 401 if there is no valid session. */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!(await resolveUser(req))) {
      res.status(401).json({ error: 'Sign in to continue' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Soft gate: attaches the user when present, but lets anonymous callers through. */
export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    await resolveUser(req);
    next();
  } catch (err) {
    next(err);
  }
}
