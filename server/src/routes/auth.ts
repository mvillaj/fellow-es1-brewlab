import { Router } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { accountUpdateSchema, type PublicUser } from '@brewlab/shared';
import { db } from '../lib/db';
import { isAdmin, mirrorClerkProfile, requireAuth, type AuthedRequest } from '../lib/auth';
import { clerkErrorMessage, profileFromClerk } from '../lib/clerk-profile';

export const authRouter: Router = Router();

const publicUser = (r: any): PublicUser => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  createdAt: r.created_at,
  isAdmin: isAdmin(r.id),
});

const readUser = (userId: string) => publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));

/**
 * Clerk runs signup and sign-in on its own hosted pages, so there is nothing
 * here to post credentials to; the client calls this on load both to read the
 * local profile and to force the first-sight provisioning in requireAuth to
 * happen before anything else asks for a grinder or a machine.
 */
authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json(readUser(req.userId!));
});

/**
 * The account page's name form. Clerk is written first and is the source of
 * truth: if it refuses, nothing local changes, and what gets mirrored is what
 * Clerk saved rather than what was sent.
 */
authRouter.patch('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  const parsed = accountUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the fields and try again' });
    return;
  }
  const subject = getAuth(req).userId!;
  let updated;
  try {
    updated = await clerkClient.users.updateUser(subject, parsed.data);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status && status >= 400 && status < 500) {
      res.status(422).json({ error: clerkErrorMessage(err) });
      return;
    }
    next(err);
    return;
  }
  mirrorClerkProfile(req.userId!, profileFromClerk(subject, updated));
  res.json(readUser(req.userId!));
});

/**
 * Email, password and connected accounts are changed in Clerk's own profile
 * dialog, which never touches this server. The account page calls this when
 * Clerk reports a change, so the local copy (and the admin check that reads
 * it) catches up.
 */
authRouter.post('/me/sync', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const subject = getAuth(req).userId!;
    mirrorClerkProfile(req.userId!, profileFromClerk(subject, await clerkClient.users.getUser(subject)));
    res.json(readUser(req.userId!));
  } catch (err) {
    next(err);
  }
});
