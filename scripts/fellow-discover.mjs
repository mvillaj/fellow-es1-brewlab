#!/usr/bin/env node
/**
 * Fellow cloud API route discovery — zero dependencies, read-only (GET only).
 *
 *   FELLOW_EMAIL=… FELLOW_PASSWORD=… node scripts/fellow-discover.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * fellow-probe.mjs established that on the /v1 gateway:
 *
 *   GET /devices?dataType=real        -> 200, returns BOTH the Aiden and the ES1
 *   GET /devices/FB_…                 -> 200   (Aiden, with profiles + schedules embedded)
 *   GET /devices/FS_…                 -> 404   "Device could not be found"
 *   GET /devices/FS_…/profiles        -> 404   "Device could not be found"
 *   GET /devices/FS_…/schedules       -> 404   "Device could not be found"
 *
 * So the ES1 is enumerated by the list endpoint but is unknown to every
 * per-device route. Nothing about the profile payload is involved.
 *
 * THE ORACLE
 * ----------
 * The same run turned up a second, more useful signal. Paths the gateway does
 * not map fall through to an IAM-authorised default and reject the bearer token
 * with an API Gateway (not NestJS) error:
 *
 *   403 {"message":"Invalid key=value pair (missing equal-sign) in Authorization
 *        header (hashed with SHA-256 and encoded with Base64): '…'"}
 *
 * That is structurally different from the app's own 404. So:
 *
 *   403 + "Invalid key=value pair"  ->  route does NOT exist on this gateway
 *   200 / 401 / 404 / 4xx from Nest ->  route EXISTS, we just asked it something
 *                                       it could not answer
 *
 * That gives us a cheap way to map the API surface. This script sweeps
 * candidate routes and classifies each one with that oracle, then tries every
 * plausible spelling of the ES1's identifier against the routes we know are
 * mapped.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.FELLOW_API_HOST ?? 'https://l8qtmnc692.execute-api.us-west-2.amazonaws.com';
const STAGE = process.env.FELLOW_API_STAGE ?? '/v1';
const USER_AGENT = process.env.FELLOW_USER_AGENT ?? 'Fellow/5 CFNetwork/1568.300.101 Darwin/24.2.0';

const email = process.argv[2] ?? process.env.FELLOW_EMAIL;
const password = process.argv[3] ?? process.env.FELLOW_PASSWORD;
if (!email || !password) {
  console.error('Usage: FELLOW_EMAIL=… FELLOW_PASSWORD=… node scripts/fellow-discover.mjs');
  process.exit(1);
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const amber = (s) => `\x1b[33m${s}\x1b[0m`;

let token = null;

/** GET an absolute URL and classify it with the oracle above. */
async function probe(url) {
  let res, body;
  try {
    res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    return { url, status: 0, mapped: null, note: `network: ${err.message}` };
  }
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  // Three distinct API Gateway rejections, and they mean different things:
  //   403 "Invalid key=value pair … Authorization header"  -> route not mapped on this stage
  //   403 "Missing Authentication Token"                    -> route not mapped (no auth attempted)
  //   403 "Forbidden"                                       -> the STAGE itself does not exist
  // The last one is why /v3, /beta and /espresso/v1 came back looking mapped on
  // the first run. They are not stages; nothing is behind them.
  const gatewayReject =
    res.status === 403 && typeof body?.message === 'string' && body.message.includes('Invalid key=value pair');
  const missingAuth = res.status === 403 && body?.message === 'Missing Authentication Token';
  const noStage = res.status === 403 && body?.message === 'Forbidden';
  const mapped = !(gatewayReject || missingAuth || noStage);

  const note = noStage
    ? 'no such stage'
    : !mapped
    ? 'no such route'
    : res.ok
      ? Array.isArray(body)
        ? `${body.length} item(s)`
        : 'object'
      : typeof body?.message === 'string'
        ? body.message
        : String(body).slice(0, 70);

  return { url, status: res.status, mapped, note, body: mapped && res.ok ? body : undefined };
}

function report(rows) {
  for (const r of rows) {
    const path = r.url.replace(HOST, '');
    const flag = r.mapped === null ? '?' : r.mapped ? (r.status < 300 ? green('✓') : amber('•')) : dim('·');
    console.log(`  ${flag} ${String(r.status).padEnd(4)} ${path.padEnd(62)} ${dim(r.note)}`);
  }
}

// --- login -------------------------------------------------------------------

const loginRes = await fetch(`${HOST}${STAGE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
  body: JSON.stringify({ email, password }),
});
const loginBody = await loginRes.json().catch(() => null);
if (!loginRes.ok || !loginBody?.accessToken) {
  console.error(`✗ Login failed (${loginRes.status})`, loginBody);
  process.exit(1);
}
token = loginBody.accessToken;
console.log(`✓ Signed in as ${bold(email)}`);

// Pull the device list so the sweep uses real ids rather than hardcoded ones.
const list = await probe(`${HOST}${STAGE}/devices?dataType=real`);
const devices = Array.isArray(list.body) ? list.body : [];
const es1 = devices.find((d) => String(d.id).startsWith('FS_'));
const aiden = devices.find((d) => String(d.id).startsWith('FB_'));
if (!es1) {
  console.error('✗ No FS_ device on this account — nothing to discover.');
  process.exit(1);
}
console.log(dim(`  ES1   ${es1.id}  serial ${es1.serialNumber}`));
console.log(dim(`  Aiden ${aiden?.id ?? '(none)'}`));

const output = { probedAt: new Date().toISOString(), host: HOST, stage: STAGE, sections: {} };

// --- 1. does the ES1 answer to a different identifier? -----------------------
//
// Both routes below are known-mapped (they return 200 for the Aiden), so any
// 200 here means we simply had the wrong id all along.

const uuid = es1.id.replace(/^FS_/, '');
const idVariants = [
  [es1.id, 'FS_ id as listed (baseline)'],
  [uuid, 'bare uuid'],
  [es1.id.toLowerCase(), 'lowercased'],
  [`FS_${uuid.toUpperCase()}`, 'uppercase uuid'],
  [String(es1.serialNumber), 'serial number'],
  [`FS_${es1.serialNumber}`, 'FS_ + serial'],
  [encodeURIComponent(es1.id), 'url-encoded'],
];

console.log(`\n${bold('1. ES1 identifier variants')} ${dim('(against routes that work for the Aiden)')}`);
const section1 = [];
for (const [id, label] of idVariants) {
  for (const suffix of ['', '/profiles']) {
    const r = await probe(`${HOST}${STAGE}/devices/${id}${suffix}`);
    section1.push({ ...r, label });
  }
}
report(section1);
output.sections.identifierVariants = section1;

// --- 2. other sub-resources under a device -----------------------------------
//
// Run against the Aiden, which we know the app can resolve — so a 404 here means
// "no such sub-resource" rather than "no such device", and the oracle separates
// both of those from "no such route".

console.log(`\n${bold('2. Device sub-resources')} ${dim('(probed on the Aiden, which resolves)')}`);
const subResources = [
  'profiles', 'schedules', 'settings', 'state', 'shadow', 'config', 'configuration',
  'shots', 'brews', 'history', 'stats', 'telemetry', 'commands', 'actions',
  'presets', 'recipes', 'espresso-profiles', 'shot-profiles', 'espresso', 'firmware', 'notifications',
];
const section2 = [];
for (const sub of subResources) {
  section2.push(await probe(`${HOST}${STAGE}/devices/${aiden?.id ?? es1.id}/${sub}`));
}
report(section2);
output.sections.subResources = section2;

// --- 3. top-level collections ------------------------------------------------

console.log(`\n${bold('3. Top-level collections')}`);
const collections = [
  'devices', 'device', 'users', 'users/me', 'me', 'account', 'accounts',
  'profiles', 'espresso-profiles', 'shot-profiles', 'shared', 'drops', 'coffees',
  'espresso', 'es1', 'machines', 'brewers', 'grinders', 'schedules', 'shots', 'firmware',
];
const section3 = [];
for (const c of collections) {
  section3.push(await probe(`${HOST}${STAGE}/${c}`));
}
report(section3);
output.sections.collections = section3;

// --- 4. other stages on the same gateway -------------------------------------
//
// If the ES1 landed on a newer version of the API, this is where it shows up.

console.log(`\n${bold('4. Other API stages')} ${dim('(same gateway host)')}`);
const section4 = [];
for (const stage of ['/v2', '/v3', '/beta', '/espresso/v1']) {
  for (const path of ['/devices?dataType=real', `/devices/${es1.id}`, `/devices/${es1.id}/profiles`]) {
    section4.push(await probe(`${HOST}${stage}${path}`));
  }
}
report(section4);
output.sections.otherStages = section4;

// --- 5. full sweep of any other live stage -----------------------------------
//
// /v2 answered `GET /devices` with the same payload as /v1, so it is a real
// deployed stage — not an alias we can dismiss. It may well carry routes /v1
// never got, which is exactly where a newer product line would land. Sweep it
// the same way rather than assuming it mirrors /v1.

console.log(`\n${bold('5. Other live stages, full surface')}`);
const section5 = [];
for (const stage of ['/v2']) {
  const alive = await probe(`${HOST}${stage}/devices`);
  if (!alive.mapped) {
    console.log(dim(`  ${stage} is not a live stage — skipping`));
    continue;
  }
  for (const sub of subResources) {
    section5.push(await probe(`${HOST}${stage}/devices/${aiden?.id ?? es1.id}/${sub}`));
    section5.push(await probe(`${HOST}${stage}/devices/${es1.id}/${sub}`));
  }
  for (const c of collections) {
    section5.push(await probe(`${HOST}${stage}/${c}`));
  }
}
report(section5.filter((r) => r.mapped));
console.log(dim(`  (${section5.filter((r) => !r.mapped).length} unmapped paths hidden)`));
output.sections.otherStagesFull = section5;

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), 'fellow-discover-output.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));

const hits = [...section1, ...section2, ...section3, ...section4, ...section5].filter((r) => r.mapped && r.status < 300);
console.log(`\n${bold('Reachable:')} ${hits.length ? hits.map((h) => h.url.replace(HOST, '')).join('\n           ') : dim('nothing new')}`);
console.log(dim(`\nFull dump → ${outPath}\n`));
