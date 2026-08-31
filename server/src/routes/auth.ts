import { Router } from 'express';
import type { PublicUser } from '@brewlab/shared';
import { db } from '../lib/db';
import { requireAuth, type AuthedRequest } from '../lib/auth';

export const authRouter: Router = Router();

const publicUser = (r: any): PublicUser => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  createdAt: r.created_at,
});

/**
 * All that is left of this router. Clerk runs signup and sign-in on its own
 * hosted pages, so there is nothing here to post credentials to; the client
 * calls this on load both to read the local profile and to force the
 * first-sight provisioning in requireAuth to happen before anything else asks
 * for a grinder or a machine.
 */
authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!);
  res.json(publicUser(row));
});
