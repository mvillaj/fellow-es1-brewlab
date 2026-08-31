# Crema — ES1 Brew Lab

An espresso logbook and profile studio for the **Fellow Espresso Series 1**.

Track every shot with the setting that produced it, compare grind sizes across
grinders that don't agree on what a number means, keep a shared library of
coffees, and build multi-stage pressure profiles you can push to your Fellow
account.

React SPA + a small Node API + SQLite. Runs locally for development, or as a
single container with the API serving the built client — see Deploying below.

> **Not affiliated with Fellow.** Crema is an independent hobby project. It is not
> affiliated with, endorsed by or supported by Fellow Products, and it talks to
> Fellow's private API, which can change or stop working without notice.

---

## Quick start

Requires **Node 22.9 or newer** (the API uses the built-in `node:sqlite` and
`--env-file-if-exists`, so there is no native module to compile and no dotenv).

Sign-in is handled by [Clerk](https://clerk.com), so this is the one bit of setup
you cannot skip: copy `.env.example` to `.env` and fill in the two keys from your
Clerk dashboard (API keys). The API refuses to start without them and the client
refuses to boot.

```bash
cp .env.example .env   # then paste your Clerk keys into it
npm install
npm run seed      # demo coffees, profiles and a dial-in in progress
npm run dev       # API on :4000, app on http://localhost:5173
```

Create an account through the app. The first request you make after signing in
provisions your bench — a local user row, a default Opus 2 and a default ES1.

The seeded `michael@example.com`, `dana@example.com` and `sam@example.com` are
demo brewers, not accounts: they exist so the Explore page has public profiles to
show you on day one, and there is no password to sign in as them.

```bash
npm test          # pure-logic tests, no test runner to install
npm run typecheck # tsc across all three packages
npm run reset     # wipe the database and re-seed
```

---

## What's in it

**Shot log.** Dose, yield, time, pre-infusion, temperature, grind setting,
rating and a sour↔bitter taste slider. Every shot stores the micron equivalent
of its grind setting *at the time it was logged*, so recalibrating a grinder
later never rewrites history.

**Grind normalisation.** The interesting problem. An Opus 2 counts in clicks, a
Niche in numbers, a DF64 in rotations — and none of them mean the same thing.
Each grinder carries an affine model, `microns = intercept + setting × µm-per-unit`,
which lets the app translate a setting from one grinder to another and put every
shot on a comparable axis. Fifteen grinders ship built in; custom ones take four
numbers. Since the shipped figures are community estimates rather than lab
measurements, every grinder can be re-fitted from two reference points you
supply — that's the Calibrate button, and it upgrades a grinder's confidence
from *estimated* to *measured*.

**Coffee library.** Your own shelf, plus a shared one. Publish a bag and anyone
can browse it, see how it's been performing, and clone it onto their own shelf.

**Profile studio.** The ES1 runs a shot as ordered, timed phases; each phase
targets a pressure and the machine modulates flow to hold it. The editor mirrors
what the machine actually lets you build: an optional pre-infusion with its own
duration, hold pressure and fill flow; one or more flat infusion steps of
duration and pressure; and an optional ramp down to an end pressure. A falling
curve is successive steps rather than a slope, which is how the factory Lever
profile is built. Fellow's seven factory profiles ship as starting points, with a
live pressure curve alongside.

**Reading a bag.** Paste a link to the roaster's page — or the copy off the bag —
and the coffee form fills in: name, roaster, origin, varietal, process, roast
level, altitude and tasting notes. It fills the form; you still check it and
press save.

Given a link the server fetches the page itself, which is most of the work. A
shop page is mostly *other coffees*: the page this was built against mentions
Colombia 205 times, every one of them a nav link or a recommendation for a
different bag, while the coffee itself is only ever labelled "San Adolfo". So
`server/src/lib/page-text.ts` drops navigation, headers, footers and the
you-may-also-like rack, and puts the page's own structured product data first —
666 KB of markup becomes about 2.5 KB of text with no other coffee in it. Fetches
are restricted to public http(s) addresses, with every redirect hop re-checked.

Where the text names a place but not its country, it may complete it — San Adolfo
is in Huila — and any field filled that way is listed back to you as something to
check, so you can tell what came off the page from what came from the model.

**Suggesting a profile.** Any coffee can be handed to the model for a starting
shot, designed against that coffee's density, process and roast rather than a
factory default, with a sentence or two on why. It opens *unsaved* in the editor,
and is validated by the same `es1ProfileSchema` as anything you type — a
suggestion that breaks a machine limit is rejected before it reaches you, let
alone the machine. Only offered when your machine actually profiles.

Both need `ANTHROPIC_API_KEY`. Without it they render disabled with the reason,
and the app is otherwise untouched — it still needs no secrets to run.

**Dial-in coach.** After each shot the app suggests the single next change
(finer, coarser, longer, shorter, or hold) from shot time and how it tasted.
One change at a time, because two teaches you nothing.

---

## The Fellow integration — read this before you demo it

The app talks to Fellow through one interface, `FellowClient`
(`server/src/fellow/types.ts`), with two implementations:

| Mode | When | What it does |
| --- | --- | --- |
| `mock` (default) | always | An in-memory Fellow cloud: accepts a login, exposes an ES1 and an Aiden, stores profiles, returns a `brew.link`-style share URL. Any email and a 4+ character password will connect. |
| `live` | `FELLOW_MODE=live` | Talks to the real cloud API. |

The endpoints, base URL and auth flow come from the reverse-engineered Aiden
clients ([9b/fellow-aiden](https://github.com/9b/fellow-aiden),
[simmerkaer/fellow-aiden-ts](https://github.com/simmerkaer/fellow-aiden-ts)).
Login is `POST /auth/login` → `accessToken`; devices at `/devices?dataType=real`;
profiles at `/devices/{id}/profiles`.

**The ES1 is on that same backend** — confirmed against a real account with both
machines on it. What those clients don't do is tell the two apart: both simply
take `devices[0]`, which breaks outright on a mixed account. The device objects
carry clear discriminators:

| | Aiden | ES1 |
| --- | --- | --- |
| `id` prefix | `FB_` | `FS_` |
| `sku` | `EBRWS-NA` | `1SSE-NA` |
| `deviceType` | *(absent)* | `Solo` |
| active profile | `ibSelectedProfileId: "plocal1"` | `activeProfileId: "2_mediumroast"` |
| units | `metricUnit`, `preciseUnit` | `tempUnit`, `dvolUnit`, `bvolUnit`, `whUnit`, `htUnit` |
| maintenance | rinse, clean | `backflushRem`, `descaleRem`, `showerRem`, `waterHardness` |

`classifyDevice()` in `server/src/fellow/live.ts` scores those signals and
refuses to guess — an unrecognised device comes back as `unknown` rather than
being handed an espresso profile.

**The ES1 profile schema is captured.** It is a different object from the Aiden's
— that one is drip-specific (bloom ratio, pulse counts, a 14–20 brew ratio) and
cannot express a shot, and the id formats don't match either (`2_mediumroast` vs
`p7` / `plocal1`). The ES1 wire format in `live.ts` was confirmed against a full
GET of a real account plus the responses to a create and a PATCH, 2026-08-28.

Three things are still inferred rather than observed, and are marked as such in
code: `ASSUMED_INFUSION_FLOW_ML_S`, and the `adaptive` / `decliningTemp` /
`transition` values pinned in `OBSERVED_DEFAULTS`. Those three have never been
seen to vary, but rather than re-pin them on every write, an imported profile
carries its original wire record in `brew_profiles.source_wire` and replays them.

### Profiles on the machine

The Fellow page lists what actually lives on your account, tagged by origin, and
imports any of them onto your shelf. Import maps the wire profile back through
`fromEs1Wire`, so the factory Lever arrives as the seven flat stages it really is.

**Fellow's own profiles are never written to.** `profileOrigin()` classifies each
one, and it **fails closed**: only a profile positively identified as yours is
updated in place with `PATCH`. Everything else — factory profiles, weekly Drops,
anything whose folder we don't recognise — is written as a *new* profile in the
custom folder, leaving the original untouched. The editor says so before you push.

That strictness is not theoretical. The classifier keys on a `folder` string that
Fellow's own data spells inconsistently: the captured account has the factory
folder as `"Fellow"`, and both `"drops"` and `"Drops"` on sibling records. It now
compares case-insensitively, prefers the `isDefaultProfile` flag where present,
and treats anything unrecognised as read-only.

### Re-running the probe

```bash
npm run probe -- you@example.com 'your-password'
```

`scripts/fellow-probe.mjs` is dependency-free and **read-only** — no POST, PATCH
or DELETE. It logs in, classifies every device, pulls all profiles and schedules,
prints an inferred field-by-field schema (types, value ranges, enum samples,
nested phase arrays), and writes the full dump to
`scripts/fellow-probe-output.json`. Use it to re-check the wire format against
your own account, or to see what a device other than an ES1 returns.

The Fellow page's **Raw JSON** button does the same thing through the UI, and a
failed push returns Fellow's raw response verbatim.

Two practical notes: the API sends no CORS headers and is picky about its
`User-Agent`, which is why these calls go through the local server rather than
the browser. And in live mode your Fellow token is stored in the SQLite database in
plaintext, which matters wherever this runs and matters more once it is hosted.

Hosting changes the threat model rather than the code. The Fellow token in
plaintext, no rate limits on a route that relays credentials to Fellow, permissive
CORS, and an uncapped model key are all survivable on a laptop and none of them
are survivable on the open internet. Work through them before letting anyone else
sign up.

```bash
FELLOW_MODE=live npm run dev
```

---

## Layout

```
packages/shared/    Types, zod schemas, grinder and machine registries, ES1
                    profile model, dial-in heuristics, tests. Imported as
                    source by both sides.
server/             Express + node:sqlite. Auth, CRUD, the Fellow adapter, seed.
client/             Vite + React SPA. Hand-rolled SVG charts, no chart library.
```

The client and server share one package of types, so a change to the shot model
breaks the build in both places at once — which is the point.

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `BREWLAB_DB` | `server/data/brewlab.db` | SQLite file |
| `CLERK_PUBLISHABLE_KEY` | *(unset)* | **Required.** The API verifies session tokens with it |
| `VITE_CLERK_PUBLISHABLE_KEY` | *(unset)* | **Required.** Same value; Vite only exposes `VITE_`-prefixed vars to the bundle |
| `CLERK_SECRET_KEY` | *(unset)* | **Required.** Server only — never let this reach the client |
| `FELLOW_MODE` | `mock` | `live` to hit the real Fellow API |
| `ANTHROPIC_API_KEY` | *(unset)* | Enables the two model-backed features; without it they show disabled |

These are read from a gitignored `.env` at the repo root if you make one — see
`.env.example` — or from the environment. The server reloads it on restart.
| `FELLOW_API_BASE` | AWS endpoint | Override for a proxy |

---

### Changing the schema

The schema lives in `server/migrations/*.sql`, applied in filename order at boot
and recorded in a `schema_migrations` table. To change it, add the next numbered
file — `002_add_whatever.sql`. Never edit one that has already run; the runner
keys off the filename and will not re-apply it.

`npm run reset` still wipes and re-seeds, which is the right move locally and
the wrong one anywhere with data you care about.

## Deploying

One Fly machine serves the API and the built SPA, with SQLite on a persistent
volume and Litestream streaming backups to object storage. `Dockerfile`,
`docker-entrypoint.sh` and `fly.toml` are in the repo root:

```bash
fly volumes create brewlab_data --size 1 --region sjc
fly secrets set CLERK_SECRET_KEY=sk_live_... CLERK_PUBLISHABLE_KEY=pk_live_...
fly deploy --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

`VITE_CLERK_PUBLISHABLE_KEY` must be a **build arg**, not a `fly secret` — Vite
inlines it into the bundle at build time, so setting it as a secret silently
produces a client that cannot sign anyone in. The same value is *also* needed as
the runtime secret `CLERK_PUBLISHABLE_KEY`, which the API verifies tokens with.

## Where the numbers come from

Machine limits are Fellow's published figures where they exist: temperature
**50–94 °C**, and a 15-bar pump **calibrated for up to 9 bar of extraction**.
Flow-rate bounds, stage-duration maximum and dose range are *not* published —
those are inferred from the seven factory profiles and marked as such in
`RANGE_NOTES` (`packages/shared/src/es1.ts`), which the UI surfaces as field
hints. Grinder calibrations are community estimates, tagged `measured`,
`community` or `estimated`, and a conversion is only ever as confident as its
weaker end.

## FAQ

### How did you get the Fellow API? Is it documented?

No. The device endpoints came from two open-source Aiden clients; the ES1 profile format was captured from a real account.