import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request } from 'express';
import type { AuthedRequest } from './auth';
import { isCloudflareEdge } from './cloudflare.ts';

/**
 * Limiters mounted inside the routers run after requireAuth, so they can key on
 * the user. The app-wide one runs before it and falls back to the address.
 *
 * ipKeyGenerator rather than req.ip directly: it normalises IPv6 to a /56
 * prefix, so a single client cannot walk through addresses in its own subnet to
 * get a fresh bucket each time.
 */
export function keyByUserOrIp(req: Request): string {
  const userId = (req as AuthedRequest).userId;
  return userId ? `user:${userId}` : ipKeyGenerator(clientAddress(req));
}

/**
 * req.ip was the wrong source: it reads the last X-Forwarded-For hop, which
 * behind Cloudflare is an edge address shared by every visitor, so one flood
 * locked everybody out.
 *
 * Fly's proxy sets Fly-Client-IP on every request, overwriting anything the
 * client sent, and machines are only reachable through that proxy — so it is
 * the address that actually connected. When that is a Cloudflare edge, the
 * visitor is in CF-Connecting-IP. That header is only believed when the
 * connection came from Cloudflare: anyone can send it straight to fly.dev.
 * Falls back to req.ip off Fly (local dev).
 */
export function clientAddress(req: Request): string {
  const connected = req.get('fly-client-ip')?.trim();
  if (!connected) return req.ip ?? '';
  const visitor = req.get('cf-connecting-ip')?.trim();
  return visitor && isCloudflareEdge(connected) ? visitor : connected;
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
