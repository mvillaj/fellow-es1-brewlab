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

1. **Stop rolling your own identity.** One decision that deletes several problems
   below. Do it first, because it changes the shape of the user table everything
   else hangs off.
2. **Replace the parts that only work for one person** — SQLite, the missing
   migration path, plaintext Fellow tokens.
3. **Add what a public endpoint needs** — rate limits, CORS, cost controls,
   error hygiene, TLS.

---

## Already handled

Verified against the code, not remembered. Don't redo these.

| | Where |
| --- | --- |
| The JWT secret cannot silently fall back to the dev value — the server refuses to boot when `NODE_ENV=production` and the secret is missing, the dev default, or `change-me`. | `resolveSecret()`, `server/src/lib/auth.ts` |
| Live mode warns that writes reach a real machine. The condition was inverted once, so live mode was the one case that stayed silent. Fixed. | `GET /status`, `server/src/routes/fellow.ts` |
| Non-affiliation with Fellow is stated where credentials are entered, and in the README. | `client/src/pages/Fellow.tsx`, `README.md` |
| Fellow's own factory profiles cannot be overwritten. `profileOrigin()` fails closed — anything it does not positively recognise as yours is read-only. | `server/src/fellow/live.ts` |
| The Fellow **password** is used for the login call and never persisted. | `POST /connect`, `server/src/routes/fellow.ts` |
| Account dumps from the probe, discover and HAR scripts are gitignored as a pattern, not file by file. | `.gitignore` |

---

## Decision: hand identity to a platform

Do not ship the current auth. It is fine for a local tool and wrong for a hosted
one — not because it is badly written, but because the list of things it does not
do is long and every one of them is table stakes: password reset, email
verification, MFA, breach-password screening, session revocation, account
lockout, audit trail.

Delegating to **Auth0**, **Clerk**, or similar deletes all of that plus blocker 6
below, and removes `BREWLAB_JWT_SECRET` from your operational surface entirely.

### What changes

| Today | After |
| --- | --- |
| `POST /auth/signup`, `POST /auth/login` with bcrypt | Deleted. The platform owns the flow. |
| `signToken()` mints a 30-day HS256 JWT with a shared secret | The platform issues short-lived tokens; you verify them |
| `requireAuth` calls `jwt.verify(token, SECRET)` | Verify the platform's RS256 token against its JWKS, checking `iss` and `aud` |
| `users` holds `email` + `password_hash` | `users` holds a `subject` (the platform's stable user id), unique, indexed. No credential material at all. |
| `client/src/lib/auth.tsx` (58 lines, hand-rolled) | The platform's React provider |

**Keep the local user id.** Every other table foreign-keys to `users.id` with
`ON DELETE CASCADE`, and that is worth preserving. Map platform subject → local
id on first sign-in; do not scatter the platform's identifier through the schema.

**Keep the first-run seeding.** `POST /auth/signup` currently gives every new
account a default grinder and a default ES1 machine (`server/src/routes/auth.ts`).
That has to move to a "first time we have seen this subject" path, or new users
land on an empty bench and the app looks broken.

**Plan for the users you already have.** Local accounts have no platform subject.
Either accept that hosted is a fresh start, or write a one-time link-by-email
migration — decide before launch, not after someone asks where their shots went.

---

## Blockers

A deployment with any of these open is a real incident waiting to happen.

### 1. SQLite will not survive being hosted

`server/src/lib/db.ts` opens a `DatabaseSync` — the **synchronous** `node:sqlite`
driver — against a file on local disk. Every query blocks the event loop, which is
invisible at one user and is your latency profile at fifty. The file also has to
live somewhere durable, which rules out most ephemeral container filesystems.

Move to Postgres, or accept a single small instance with a persistent volume and
know that is what you have chosen. The row mappers in `server/src/lib/rows.ts` are
already the only place that knows about column shapes, so the port is contained —
but it is a port, not a config change.

### 2. There is no migration path at all

There is no `ALTER TABLE`, no version table, no migration runner anywhere in the
repo. The schema is a single `CREATE TABLE IF NOT EXISTS` block, and the way it
has been evolved so far is `npm run reset`, which deletes the database.

That is entirely reasonable for a local tool and completely disqualifying for a
hosted one: the first schema change after launch would take everyone's shot
history with it. Pick a migration tool before the first real user, not after.

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
`express`, `cors`, `bcryptjs`, `jsonwebtoken`, `zod` and the Anthropic SDK.

`POST /api/fellow/connect` is the sharp edge: it forwards arbitrary email and
password pairs to Fellow's login endpoint from your server's IP. Hosted, that is a
credential-stuffing relay pointed at Fellow, and the traffic is attributable to
you. Limit per user, per IP, and globally.

### 5. CORS reflects any origin

`app.use(cors({ origin: true }))` echoes back whatever `Origin` it is given.
Restrict to a known allowlist. (Once identity moves to a platform, the token stops
living in `localStorage`, which removes the other half of this problem.)

### 6. Sessions last 30 days and cannot be revoked

`expiresIn: '30d'`, stateless, nothing can invalidate it — signing out only drops
the client's copy. **An identity platform solves this outright**, which is most of
why it is worth adopting.

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
metered. Roughly nine cents a run today — trivial for one person, an open tap for
a script. Per-user quotas and a global ceiling before this is public, plus a way
to turn the features off without a redeploy.

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
straight to the client (`server/src/index.ts:39`), and Fellow errors embed the
upstream response body (`request()` in `server/src/fellow/live.ts`). Log the
detail, return a generic message and an error id.

**No Fellow token lifecycle.** `refresh_token` is written and read back into the
session object but never actually used to refresh anything. A token works until
Fellow decides otherwise — fragile, and a long window for a leaked one.

**HTTPS is not optional.** The user's Fellow password crosses your server in
cleartext at `/connect`. TLS end to end, HSTS, no plain-HTTP listener.

**Nothing serves the client.** `server/src/index.ts` has no static handler and
there is no Dockerfile. Decide whether the API serves the built SPA or a CDN does,
and build the artifact.

**No backups, no structured logs, no readiness probe.** `/api/health` reports
liveness only — it will happily say `ok` with an unreachable database.

**Check `FELLOW_MODE` per environment.** Your local `.env` currently sets
`FELLOW_MODE=live`, so a stray deploy inheriting it would point at the real Fellow
API on first boot. Set it explicitly in every environment rather than relying on
the default.

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
- [ ] Auth delegated to a platform; `/auth/signup`, `/auth/login` and bcrypt removed
- [ ] Tokens verified against the platform's JWKS, with `iss` and `aud` checked
- [ ] `users` holds a subject, no credential material
- [ ] First-run grinder and machine seeding moved to first-sign-in
- [ ] Decision made and communicated about existing local accounts

**Data**
- [ ] Postgres, or a persistent volume chosen with eyes open
- [ ] Migration tool in place before the first real user
- [ ] Backups, and a restore actually tested
- [ ] Fellow tokens encrypted at rest, key held off the app host

**Exposure**
- [ ] Rate limits on `/api/fellow/connect`, `/api/auth/*` and both `/api/ai/*` routes
- [ ] Per-user and global spend caps on the model calls; a kill switch that needs no redeploy
- [ ] `fetchPageText` pins the resolved address, and is rate limited
- [ ] CORS restricted to a known origin allowlist
- [ ] Error responses carry no internal detail
- [ ] TLS end to end, HSTS on

**Fellow**
- [ ] Disconnect revokes upstream, or the UI says plainly that it does not
- [ ] `FELLOW_MODE` set explicitly per environment
- [ ] No `fellow-*-output.json` anywhere on the host
- [ ] Fellow's terms of service actually read

**Honesty**
- [ ] `Fellow.tsx` credential copy rewritten to match where credentials really go
- [ ] Non-affiliation notice visible before credentials are entered
- [ ] Privacy policy: what is stored, how it is protected, how to delete it
