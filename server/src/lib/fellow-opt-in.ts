import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from './auth';

export const OPT_IN_REQUIRED =
  'The Fellow integration is off for your account. Turn it on from the Fellow page first.';

/**
 * Refuses every Fellow route to a user who has not accepted the warning.
 *
 * This is the enforcement; hiding buttons in the client is only courtesy. The
 * lookup is passed in so the gate can be tested without opening a database.
 * Mount after requireAuth.
 */
export function fellowOptInGate(isOptedIn: (userId: string) => boolean) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userId || !isOptedIn(req.userId)) {
      res.status(403).json({ error: OPT_IN_REQUIRED });
      return;
    }
    next();
  };
}
