import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request } from 'express';
import type { AuthedRequest } from './auth';

/**
 * Limiters mounted inside the routers run after requireAuth, so they can key on
 * the user. The app-wide one runs before it and falls back to the address.
 *
 * ipKeyGenerator rather than req.ip directly: it normalises IPv6 to a /64
 * prefix, so a single client cannot walk through addresses in its own subnet to
 * get a fresh bucket each time.
 */
function keyByUserOrIp(req: Request): string {
  const userId = (req as AuthedRequest).userId;
  return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? '');
}

const message = (error: string) => ({ error });

/** Blunt protection against floods. Generous — the per-route limits do the work. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: message('Too many requests. Try again shortly.'),
});

/**
 * The sharp edge. This route forwards an arbitrary email and password to
 * Fellow's login endpoint from this server's IP, which unlimited is a
 * credential-stuffing relay pointed at Fellow and attributable to us.
 */
export const fellowConnectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  skipSuccessfulRequests: true,
  message: message('Too many connection attempts. Wait a few minutes and try again.'),
});

/**
 * A backstop, not the real control — the spend ceiling in ai-budget.ts is what
 * bounds the bill. This just stops a loop burning the daily budget in seconds.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: message('That is a lot of model calls in an hour. Try again later.'),
});
