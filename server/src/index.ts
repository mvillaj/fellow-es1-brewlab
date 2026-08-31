import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { globalLimiter } from './lib/limits';
import { encryptionConfigured } from './lib/crypto';
import './lib/db';
import { authRouter } from './routes/auth';
import { coffeeRouter } from './routes/coffees';
import { fellowRouter } from './routes/fellow';
import { grinderRouter } from './routes/grinders';
import { machineRouter } from './routes/machines';
import { aiRouter } from './routes/ai';
import { profileRouter } from './routes/profiles';
import { shotRouter } from './routes/shots';
import { getFellowClient } from './fellow/index';

const PORT = Number(process.env.PORT ?? 4000);
// Containers need 0.0.0.0; Node's default of localhost is unreachable from
// outside the container and shows up as a health check that never passes.
const HOST = process.env.HOST ?? '0.0.0.0';
const app = express();

// Fly terminates TLS and forwards, so the real client address arrives in
// X-Forwarded-For. Without this every request appears to come from the proxy and
// the rate limiters bucket the whole world together — one user's traffic would
// lock out everybody. `1` trusts exactly one hop, not an attacker-supplied chain.
app.set('trust proxy', 1);

// An allowlist, not a reflection. In production the SPA is served from this same
// origin, so no CORS headers are needed at all; local dev runs Vite on :5173
// against the API on :4000, which does. CORS_ORIGINS overrides both.
const corsOrigins = process.env.CORS_ORIGINS?.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin:
      corsOrigins?.length
        ? corsOrigins
        : process.env.NODE_ENV === 'production'
          ? false
          : ['http://localhost:5173'],
  }),
);

app.use(express.json({ limit: '1mb' }));

// Deliberately ahead of clerkMiddleware: a health probe that fails when the
// auth provider is misconfigured cannot tell you the process is up, which is
// the one thing it exists to answer.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, fellowMode: getFellowClient().mode, node: process.version });
});

// After /api/health so a flood cannot make the liveness probe fail, which would
// turn a traffic problem into a machine the platform believes is dead.
app.use(globalLimiter);

// Reads the session JWT off the Authorization header and attaches the Clerk auth
// object. Must run before any router, including the ones behind optionalAuth.
app.use(clerkMiddleware());

app.use('/api/auth', authRouter);
app.use('/api/grinders', grinderRouter);
app.use('/api/machines', machineRouter);
app.use('/api/ai', aiRouter);
app.use('/api/coffees', coffeeRouter);
app.use('/api/shots', shotRouter);
app.use('/api/profiles', profileRouter);
app.use('/api/fellow', fellowRouter);

/**
 * Serve the built SPA from the same process as the API. One machine, one origin,
 * no CORS between the two halves and no second thing to deploy — which is the
 * whole reason a single small instance is cheaper than splitting the frontend
 * onto a CDN at this size.
 *
 * Skipped entirely when client/dist is absent, so `npm run dev` still hands the
 * frontend to Vite rather than serving a stale build.
 */
const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = process.env.BREWLAB_CLIENT_DIST ?? resolve(here, '../../client/dist');

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // Deep links like /shots are client-side routes: hand them index.html and let
  // the router sort it out. /api/* is excluded so an unmatched endpoint still
  // gets the JSON 404 below instead of a page of HTML.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Warn rather than refuse to boot: only the Fellow flow needs this, and taking
// the whole app down over a feature some deployments never touch is worse than
// failing that one route with a message that says what to do.
if (!encryptionConfigured()) {
  console.warn(
    '  ⚠  BREWLAB_ENCRYPTION_KEY is not set. Connecting a Fellow account will fail\n' +
      '     until it is. Generate one with `openssl rand -base64 32`.',
  );
}

app.listen(PORT, HOST, () => {
  console.log(`  API      http://localhost:${PORT}`);
  console.log(`  Fellow   ${getFellowClient().mode} mode`);
});
