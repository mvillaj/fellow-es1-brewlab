# Deploying

Crema was built local-first, and that is not a slogan: it is the assumption every
security decision in this codebase rests on. On your own machine the threat model
is *whoever can read the database already owns the laptop*, so there is nothing
left to protect.

Hosting inverts that. One server now holds many people's Fellow credentials, and
their real espresso machines are on the other end. That is worth attacking, and
it is worth attacking *you* to get to.

This file assumes you have decided to host anyway. It is the list of what has to
change first, what it costs, and the promises you will have to stop making.
Nothing here matters for `npm run dev` on your own machine.

---

## The shape of the work

Roughly three tranches, in dependency order:

1. ~~**Stop rolling your own identity.**~~ **Done** — Clerk owns sign-in. See
   below.
2. **Replace the parts that only work for one person** — *partly done.* The
   migration path exists now; SQLite has been kept as a deliberate, documented
   choice rather than an accident; **plaintext Fellow tokens remain**.
3. **Add what a public endpoint needs** — rate limits, CORS, cost controls,
   error hygiene, TLS. **Almost entirely still open**, and this is now the
   tranche standing between you and other people using this.

---

## Already handled

Verified against the code, not remembered. Don't redo these.

| | Where |
| --- | --- |
| The server refuses to boot unless both Clerk keys are set, instead of starting fine and answering 500 to every request once traffic arrives. | `requireClerkKeys()`, `server/src/lib/auth.ts` |
| `/api/health` is mounted *ahead* of `clerkMiddleware`, so an auth misconfiguration cannot take the liveness probe down with it. | `server/src/index.ts` |
| The built SPA is served by the API process, with `/api/*` excluded from the client-side-routing fallback so a bad endpoint still returns JSON. | `server/src/index.ts` |
| Live mode warns that writes reach a real machine. The condition was inverted once, so live mode was the one case that stayed silent. Fixed. | `GET /status`, `server/src/routes/fellow.ts` |
| Non-affiliation with Fellow is stated where credentials are entered, and in the README. | `client/src/pages/Fellow.tsx`, `README.md` |
| Fellow's own factory profiles cannot be overwritten. `profileOrigin()` fails closed — anything it does not positively recognise as yours is read-only. | `server/src/fellow/live.ts` |
| The Fellow **password** is used for the login call and never persisted. | `POST /connect`, `server/src/routes/fellow.ts` |
| Account dumps from the probe, discover and HAR scripts are gitignored as a pattern, not file by file. | `.gitignore` |

---

## Done: identity is handed to Clerk

This was the largest open decision in this document, and it has been made and
implemented. The hand-rolled bcrypt-and-HS256 auth is gone; **Clerk** owns
sign-in, which also closes blocker 6 below and removes `BREWLAB_JWT_SECRET` from
the operational surface entirely.

### What changed

| Before | Now |
| --- | --- |
| `POST /auth/signup`, `POST /auth/login` with bcrypt | Deleted. `bcryptjs` and `jsonwebtoken` uninstalled. Clerk owns the flow. |
| `signToken()` minted a 30-day HS256 JWT on a shared secret | Clerk issues short-lived tokens |
| `requireAuth` called `jwt.verify(token, SECRET)` | `clerkMiddleware()` verifies against Clerk's JWKS; `getAuth(req)` reads the result |
| `users` held `email` + `password_hash` | `users` holds `clerk_subject` (unique, nullable). No credential material at all. |
| `client/src/lib/auth.tsx`, hand-rolled | Clerk's `ClerkProvider`, with a thin bridge that keeps the app's own `useAuth()` shape |

**The local user id was kept**, as this document argued it should be. Every other
table still foreign-keys to a `usr_` id with `ON DELETE CASCADE`; `clerk_subject`
is the single column the provider's identifier appears in, so changing providers
touches one column rather than six tables.

**First-run seeding moved rather than vanished.** The default grinder and ES1
that `POST /auth/signup` used to create now happen in `insertUser()` in
`server/src/lib/auth.ts`, on the first authenticated request from a subject the
database has not seen. Without that, new accounts would land on an empty bench.

**Existing local accounts were not migrated** — hosted is a fresh start, taken
deliberately. The seeded demo brewers survive as rows with a null `clerk_subject`:
data that gives the Explore page something to show, not accounts anyone can enter.

### Still open here

- The `/api/auth/*` rate limit in the checklist below now applies to `/auth/me`
  only, but that route provisions on first call — keep it limited.
- Clerk's own dashboard settings (MFA, session lifetime, allowed origins) are
  configuration this repo does not hold. Review them before launch.

---

## Deploying: one Fly machine

The current setup is a single Fly machine that serves both the API and the built
SPA, with SQLite on a persistent volume. Splitting the frontend onto a CDN is
about an hour of work and unlocks nothing at this size — the storage layer, not
the topology, is what determines how this scales.

`Dockerfile`, `docker-entrypoint.sh` and `fly.toml` are in the repo root.

### First deploy

```bash
fly launch --no-deploy            # or `fly apps create` if fly.toml is already right
fly volumes create brewlab_data --size 1 --region sjc

fly secrets set \
  CLERK_SECRET_KEY=sk_live_... \
  CLERK_PUBLISHABLE_KEY=pk_live_... \
  ANTHROPIC_API_KEY=sk-ant-...

fly deploy --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

### The one thing that catches everyone

`VITE_CLERK_PUBLISHABLE_KEY` is a **build arg, not a secret**. Vite substitutes
`VITE_`-prefixed variables into the JS bundle at build time; nothing reads them
at runtime. `fly secrets set VITE_CLERK_PUBLISHABLE_KEY=...` looks like it worked
and produces a client that boots to "Missing VITE_CLERK_PUBLISHABLE_KEY". The
Dockerfile fails the build rather than let that ship.

The same key is *also* needed as a runtime secret under its unprefixed name
(`CLERK_PUBLISHABLE_KEY`), because the API verifies session tokens with it. Same
value, two mechanisms.

### Backups

Litestream is built into the image but **off unless configured**. Point it at any
S3-compatible bucket — Cloudflare R2 is the cheap default:

```bash
fly secrets set \
  LITESTREAM_REPLICA_URL=s3://your-bucket/brewlab \
  LITESTREAM_ACCESS_KEY_ID=... \
  LITESTREAM_SECRET_ACCESS_KEY=...
```

The entrypoint then restores on boot if the volume is empty and replicates
continuously. Unset, it prints a line on every boot saying the volume is the only
copy, which it means literally.

**Test a restore before you need one.** `litestream restore` against a scratch
path, open the result, confirm your shots are in it. An untested backup is a
belief, not a backup.

### Cost and its consequences

`auto_stop_machines = "stop"` with `min_machines_running = 0` means the machine
sleeps when idle and wakes on request — a few dollars a month for personal use,
at the price of a cold start on the first request after a quiet spell. Machines
stop cleanly, so SQLite checkpoints and Litestream finishes its last push.

One machine also means one writer, and `DatabaseSync` still blocks the event
loop (blocker 1). Both are correct at personal scale and both are what eventually
push this to Turso or Postgres.

---

## Blockers

A deployment with any of these open is a real incident waiting to happen.

Re-checked against the code, not remembered. Six of the nine still stand, and the
three that moved did so because work was actually done — not because the risk got
re-described.

| | Blocker | Status |
| --- | --- | --- |
| 1 | SQLite will not survive being hosted | **Decided** — volume chosen deliberately; the limits are accepted, not removed |
| 2 | No migration path | **Resolved** — versioned runner, schema baselined |
| 3 | Fellow tokens stored in plaintext | **Open** — unchanged, and now the most serious one |
| 4 | Nothing is rate limited | **Open** — no limiter of any kind |
| 5 | CORS reflects any origin | **Open**, severity reduced — token left `localStorage` |
| 6 | 30-day unrevocable sessions | **Resolved** — Clerk issues short-lived, revocable sessions |
| 7 | Disconnect does not revoke upstream | **Open** — unchanged |
| 8 | Model key uncapped | **Open** — and the cost estimate needs re-doing |
| 9 | Page fetcher becomes a public URL fetcher | **Open** — existing guards intact, the three hosted gaps remain |

**Blocker 3 is the one to fix next.** It was always the worst of these, and every
other change has made it relatively more prominent: identity is no longer a
credential store, but `fellow_connections` still is one.

### 1. SQLite will not survive being hosted — *decided, not fixed*

Still literally true: `server/src/lib/db.ts` opens a `DatabaseSync` — the
**synchronous** `node:sqlite` driver — against a file on local disk. Every query
blocks the event loop, which is invisible at one user and is your latency profile
at fifty.

The choice this document offered has been taken: **a single small instance with a
persistent volume**, deliberately, with the trade understood. The Fly config
mounts `/data` and `BREWLAB_DB` points at it, which handles the "ephemeral
container filesystem" half of the problem.

What that choice does **not** fix, and what you are accepting:

- **One writer, one machine.** No horizontal scaling. `fly scale count 2` would
  corrupt things, not speed them up.
- **The event loop still blocks** on every query. Fine at one user. Not at fifty.
- **The volume is a single point of failure** unless Litestream is actually
  turned on — see the Data checklist.

The row mappers in `server/src/lib/rows.ts` are still the only place that knows
about column shapes, and the migration runner now gives you a versioned schema, so
the eventual port to Turso or Postgres stays contained. It remains a port, not a
config change.

### 2. There is no migration path at all — *resolved*

Was: a single `CREATE TABLE IF NOT EXISTS` block evolved by `npm run reset`,
which deletes the database.

Now: `server/migrations/*.sql` applied in filename order by
`server/src/lib/migrate.ts`, one transaction each, recorded in a
`schema_migrations` table. `001_init.sql` is the existing schema verbatim and is
idempotent, so it baselines a database created before migrations existed rather
than fighting it.

To change the schema, add `002_whatever.sql`. **Never edit a file that has already
run** — the runner keys off the filename and will not re-apply it. There are no
down-migrations on purpose: restoring from a backup is the honest recovery path
for a single-writer SQLite database, and a half-applied `down` is worse than no
`down` at all.

### 3. Fellow tokens are stored in plaintext

`fellow_connections.access_token` and `refresh_token` are written raw
(`server/src/lib/db.ts`, populated by `POST /connect`). A database snapshot, a
stray backup, or one injection hands over live credentials for every connected
Fellow account.

Minimum bar: envelope encryption with the key in a KMS or vault, never on the app
host. Stronger, if Crema only ever acts while the user is present: derive the key
from the session at sign-in so a stolen database is inert without them. Every
Fellow action today is a foreground button press, so that costs nothing — **until**
someone adds scheduling, at which point the server must act alone and you are back
to the first option. See [Prior art](#prior-art).

### 4. Nothing is rate limited

No `helmet`, no `express-rate-limit` — the server's entire dependency list is
`express`, `cors`, `zod`, `@clerk/express` and the Anthropic SDK. (`bcryptjs` and
`jsonwebtoken` are gone with the old auth; nothing replaced them that limits
anything.)

Clerk rate-limits its *own* sign-in endpoints, which covers the flow that used to
be `/auth/signup` and `/auth/login`. It does nothing for your routes. `/auth/me`
is now the only endpoint under `/api/auth/*`, and it provisions a bench on first
call — cheap, but not free, and worth limiting.

`POST /api/fellow/connect` is the sharp edge: it forwards arbitrary email and
password pairs to Fellow's login endpoint from your server's IP. Hosted, that is a
credential-stuffing relay pointed at Fellow, and the traffic is attributable to
you. Limit per user, per IP, and globally.

### 5. CORS reflects any origin

`app.use(cors({ origin: true }))` echoes back whatever `Origin` it is given —
unchanged, `server/src/index.ts:24`. Restrict to a known allowlist.

The second half of this *has* resolved: the session token no longer lives in
`localStorage`. Clerk holds it and the client sends it as an `Authorization`
header, and `cors()` is not configured with `credentials`, so no cookies ride
along on a cross-origin request. That lowers the severity — a hostile origin
cannot read a token it was never given — but reflecting every origin is still
wrong, and now that the SPA is served from the same origin as the API there is no
longer any reason for it to be permissive.

### 6. Sessions last 30 days and cannot be revoked — *resolved*

Was: `expiresIn: '30d'`, stateless, nothing could invalidate it. Clerk now issues
short-lived tokens and holds revocable sessions, so signing out and remote
revocation both actually work. Set the session lifetime you want in the Clerk
dashboard — it is no longer a constant in this repo.

### 7. Disconnect does not revoke anything upstream

`POST /disconnect` deletes the local row and stops. The Fellow token stays valid,
so a copy taken beforehand keeps working while the user reasonably believes they
have cut access off. Either revoke upstream, or say plainly in the UI that
disconnecting only forgets the token locally.

### 8. The model key is your bill, and nothing caps it

`ANTHROPIC_API_KEY` is read server-side (`server/src/lib/ai.ts`) and every call is
charged to whoever owns that key. Hosted, that is you, for everyone.

Two calls are exposed: `POST /api/ai/extract-coffee` and
`POST /api/ai/suggest-profile/:coffeeId`. Both are authenticated, neither is
metered. Trivial for one person, an open tap for a script. Per-user quotas and a
global ceiling before this is public, plus a way to turn the features off without
a redeploy.

**Re-price this before you rely on it.** The original "roughly nine cents a run"
estimate is not verified here and the model in `server/src/lib/ai.ts` is now
`claude-opus-5`, which is not the model that number was measured against. Work out
the real per-call cost against current pricing, then set the ceiling — an
unmetered endpoint whose unit cost you are guessing at is the bad combination.

### 9. The page fetcher becomes a public URL fetcher

`fetchPageText()` (`server/src/lib/page-text.ts`) takes a user-supplied URL and
fetches it from your infrastructure. It already refuses non-`http(s)` schemes and
private, loopback, link-local and metadata addresses, re-checking every redirect
hop — that was built with this in mind, and it is verified by tests.

Hosted, three more things become true and none of them are handled:

- **DNS rebinding.** The address is resolved for the check and resolved again by
  `fetch`. Pin the resolved IP, or resolve once and connect to that address.
- **Amplification.** Ten megabytes fetched per request, on demand, from your
  egress. There is a 2 MB read cap and a 12-second timeout; there is no
  per-user rate limit.
- **Untrusted content reaching a model.** A hostile page can carry text aimed at
  the extraction prompt. The blast radius is small because the output is schema-
  constrained to coffee fields and is only ever *shown* to the user for review —
  but it is worth knowing that is the only reason it is small.

---

## Fix before real users

**Internal errors are returned verbatim.** The global handler sends `err.message`
straight to the client (`server/src/index.ts:76`), and Fellow errors embed the
upstream response body (`request()` in `server/src/fellow/live.ts`). Log the
detail, return a generic message and an error id.

**No Fellow token lifecycle.** `refresh_token` is written and read back into the
session object but never actually used to refresh anything. A token works until
Fellow decides otherwise — fragile, and a long window for a leaked one.

**HTTPS — half done.** `fly.toml` sets `force_https`, so there is no plain-HTTP
listener in front of the app. HSTS is still not sent by anything, and the Fellow
password still crosses your server in cleartext at `/connect` on the way to
Fellow. Add the header; the second point is inherent and belongs in the copy
rewrite below.

~~**Nothing serves the client.**~~ **Done.** `server/src/index.ts` serves
`client/dist` with an SPA fallback that excludes `/api/*`, and there is a
`Dockerfile`, a `docker-entrypoint.sh` and a `fly.toml`.

**Structured logs and a readiness probe are still missing.** `/api/health`
reports liveness only — it will happily say `ok` with an unreachable database.
Backups now exist as a capability (Litestream) but are **off until configured**,
which is not the same as having them.

**Check `FELLOW_MODE` per environment.** Re-verified: your local `.env` still
sets `FELLOW_MODE=live`, so a stray deploy inheriting it would point at the real
Fellow API on first boot. `fly.toml` now pins `FELLOW_MODE = "mock"` explicitly,
which is the safe default — but that only protects the Fly app, not any other
environment, and flipping it to `live` is a decision worth making on purpose.

**No probe dumps on the host.** `scripts/fellow-*-output.json` are full account
dumps — the one on disk here carries three real device ids and their serial
numbers. They are gitignored now, but they must never be deployed either.

---

## The sentence you will have to stop saying

`client/src/pages/Fellow.tsx:95` currently tells the user their credentials go to
*"the local API on your own machine and nowhere else."*

Hosted, that is false. It is the most important string in the app, because it is
the claim someone reads immediately before typing a password. Rewrite it to say
exactly where credentials go, how they are protected, and who can reach them —
and make sure the answer is one you would be comfortable defending in the incident
email.

Everything else on this list is engineering. This one is honesty.

---

## Legal and operational

**The Fellow API is private and reverse-engineered.** The endpoints came from the
open-source Aiden clients plus traffic captured from the iOS app. There is no
documented third-party access, no OAuth, and no contract. It can change or close
without notice, and a hosted service is far more visible than a local tool. Read
Fellow's terms before you deploy, not after.

**One IP logging into many Fellow accounts** is the exact shape abuse detection
looks for. Whatever you build, do not make Crema look like a botnet.

**You become a custodian.** Hosting means holding credentials to other people's
appliances. That carries disclosure duties, a deletion path, and a breach plan. If
you would not want to write the incident email, do not collect the data.

---

## Prior art

[fellowaidenprofiler.com](https://fellowaidenprofiler.com/how-it-works) hosts this
for the Aiden, the drip brewer. Two of its choices are worth copying:

- **It does not run its own auth.** Sign-in is delegated to Auth0 — *"passwords
  for email sign-in live with Auth0, not here."* Exactly the call recommended
  above, made by someone already carrying the consequences.
- **It stores the Fellow password, encrypted, rather than only a token** —
  *"encrypted the moment it arrives and stays encrypted at rest, with the
  encryption keys themselves protected by a hardware-backed key vault."* That
  looks wrong until you notice Fellow has no OAuth and no working refresh path, so
  acting for a user later means being able to log in again. If Crema grows
  scheduling, it meets the same fork.

It publishes no non-affiliation notice, which is a gap rather than a model.

---

## Pre-deploy checklist

**Identity**
- [x] Auth delegated to a platform; `/auth/signup`, `/auth/login` and bcrypt removed
- [x] Tokens verified against the platform's JWKS
- [x] `users` holds a subject, no credential material
- [x] First-run grinder and machine seeding moved to first-sign-in
- [x] Decision made about existing local accounts (fresh start; demo rows kept as data)
- [ ] `CLERK_SECRET_KEY` held in the host's secret store, not a checked-in file
- [ ] Clerk dashboard reviewed: session lifetime, MFA, allowed origins

**Data**
- [x] Persistent volume chosen with eyes open (Fly `[[mounts]]` -> `/data`)
- [x] Migration runner in place, with the schema baselined
- [x] Continuous backup available (Litestream, opt-in via `LITESTREAM_REPLICA_URL`)
- [ ] Litestream actually enabled, and **a restore actually tested**
- [ ] `BREWLAB_DB` confirmed pointing at the mount on the deployed machine
- [ ] Fellow tokens encrypted at rest, key held off the app host

**Exposure**
- [ ] Rate limits on `/api/fellow/connect`, `/api/auth/*` and both `/api/ai/*` routes
- [ ] Per-user and global spend caps on the model calls; a kill switch that needs no redeploy
- [ ] `fetchPageText` pins the resolved address, and is rate limited
- [ ] CORS restricted to a known origin allowlist
- [ ] Error responses carry no internal detail
- [x] No plain-HTTP listener (`force_https` in `fly.toml`)
- [ ] HSTS header actually sent
- [ ] Structured logs, and a readiness probe that checks the database

**Fellow**
- [ ] Disconnect revokes upstream, or the UI says plainly that it does not
- [ ] `FELLOW_MODE` set explicitly per environment
- [ ] No `fellow-*-output.json` anywhere on the host
- [ ] Fellow's terms of service actually read

**Honesty**
- [ ] `Fellow.tsx` credential copy rewritten to match where credentials really go
- [ ] Non-affiliation notice visible before credentials are entered
- [ ] Privacy policy: what is stored, how it is protected, how to delete it
