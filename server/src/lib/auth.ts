import type { NextFunction, Request, Response } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { db, id, nowIso } from './db';
import { profileFromClerk } from './clerk-profile';

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
 * a request that already carries a valid session. So the row gets created here,
 * on first sight. The bench starts empty: getting started asks what the user
 * owns and adds that, rather than assuming everyone has an ES1.
 */
function insertUser(clerkSubject: string, email: string, displayName: string): UserRow {
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
    ).run(userId, clerkSubject, email, displayName, nowIso());

    db.exec('COMMIT');
    return { id: userId, display_name: displayName };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Pulls the name and email off the Clerk profile so the UI has something to show. */
async function provision(clerkSubject: string): Promise<UserRow> {
  const { email, displayName } = profileFromClerk(
    clerkSubject,
    await clerkClient.users.getUser(clerkSubject),
  );
  return insertUser(clerkSubject, email, displayName);
}

/**
 * Copies Clerk's current name and email onto the local row. The email only
 * moves if no other row holds it: it is UNIQUE here, and a seeded demo brewer
 * sharing an address should not make a rename fail.
 */
export function mirrorClerkProfile(userId: string, profile: { email: string; displayName: string }) {
  db.prepare(
    `UPDATE users SET display_name = ?,
       email = CASE WHEN EXISTS (SELECT 1 FROM users WHERE email = ? AND id <> ?) THEN email ELSE ? END
     WHERE id = ?`,
  ).run(profile.displayName, profile.email, userId, profile.email, userId);
}

async function resolveUser(req: AuthedRequest): Promise<boolean> {
  const { userId } = getAuth(req);
  if (!userId) return false;
  const row = findLocalUser(userId) ?? (await provision(userId));
  req.userId = row.id;
  req.displayName = row.display_name;
  return true;
}

/**
 * Who may write site-wide content (the changelog). An env list rather than a
 * column, so granting it needs no migration and no way to grant it from the app.
 * Unset means nobody, which is the safe reading of a missing setting.
 */
function adminEmails(): Set<string> {
  return new Set(
    (process.env.BREWLAB_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(userId: string): boolean {
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as
    | { email: string }
    | undefined;
  return Boolean(row && adminEmails().has(row.email.toLowerCase()));
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

/** Admin gate. Mount after requireAuth. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!isAdmin(req.userId!)) {
    res.status(403).json({ error: 'Only the site owner can do that' });
    return;
  }
  next();
}
