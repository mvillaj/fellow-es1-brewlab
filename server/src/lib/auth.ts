import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db';

const DEV_SECRET = 'dev-only-secret-change-me-before-this-leaves-your-laptop';

/**
 * The fallback exists so `npm run dev` works with no setup, and it must never
 * reach a deployment: this string is in the repository, so anyone holding it can
 * forge `{ sub: <any user id> }` and pass requireAuth as that user — which means
 * reading their Fellow devices and pushing profiles to their machine. Refuse to
 * boot rather than serve with a secret everyone already has.
 */
function resolveSecret(): string {
  const configured = process.env.BREWLAB_JWT_SECRET?.trim();
  if (configured && configured !== DEV_SECRET && configured !== 'change-me') return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BREWLAB_JWT_SECRET must be set to a unique value in production. Refusing to start ' +
        'with the development secret, which is public in the repository.',
    );
  }
  console.warn('  ⚠  Using the development JWT secret. Set BREWLAB_JWT_SECRET before deploying.');
  return DEV_SECRET;
}

const SECRET = resolveSecret();

export interface AuthedRequest extends Request {
  userId?: string;
  displayName?: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' });
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function resolveUser(req: AuthedRequest): boolean {
  const token = readToken(req);
  if (!token) return false;
  try {
    const payload = jwt.verify(token, SECRET) as { sub?: string };
    if (!payload.sub) return false;
    const row = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(payload.sub) as
      | { id: string; display_name: string }
      | undefined;
    if (!row) return false;
    req.userId = row.id;
    req.displayName = row.display_name;
    return true;
  } catch {
    return false;
  }
}

/** Hard gate: 401 if there is no valid session. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!resolveUser(req)) {
    res.status(401).json({ error: 'Sign in to continue' });
    return;
  }
  next();
}

/** Soft gate: attaches the user when present, but lets anonymous callers through. */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  resolveUser(req);
  next();
}
