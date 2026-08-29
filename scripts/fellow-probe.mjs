#!/usr/bin/env node
/**
 * Fellow cloud API probe — zero dependencies, read-only.
 *
 *   node scripts/fellow-probe.mjs you@example.com 'your-password'
 *   FELLOW_EMAIL=… FELLOW_PASSWORD=… node scripts/fellow-probe.mjs
 *
 * Logs in, lists devices, and dumps every profile and schedule the account has,
 * then prints an inferred field-by-field schema for the espresso device's
 * profiles. Everything lands in fellow-probe-output.json next to this script.
 *
 * It never writes to the API — no POST, PATCH or DELETE. The one job here is to
 * find out what the ES1 profile object actually looks like so we can stop
 * guessing at it in server/src/fellow/live.ts.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.FELLOW_API_BASE ?? 'https://l8qtmnc692.execute-api.us-west-2.amazonaws.com/v1';
const USER_AGENT = process.env.FELLOW_USER_AGENT ?? 'Fellow/5 CFNetwork/1568.300.101 Darwin/24.2.0';

const email = process.argv[2] ?? process.env.FELLOW_EMAIL;
const password = process.argv[3] ?? process.env.FELLOW_PASSWORD;

if (!email || !password) {
  console.error('Usage: node scripts/fellow-probe.mjs <email> <password>');
  console.error('   or: FELLOW_EMAIL=… FELLOW_PASSWORD=… node scripts/fellow-probe.mjs');
  process.exit(1);
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const amber = (s) => `\x1b[33m${s}\x1b[0m`;

let token = null;

async function call(path, { method = 'GET' } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

/** Describe a value the way a schema would: type, and the range we actually saw. */
function describe(values) {
  const types = new Set(values.map((v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)));
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  const type = [...types].join(' | ');

  if (nonNull.every((v) => typeof v === 'number') && nonNull.length) {
    return `${type}  range ${Math.min(...nonNull)} … ${Math.max(...nonNull)}`;
  }
  const samples = [...new Set(nonNull.map((v) => JSON.stringify(v)))].slice(0, 6);
  return `${type}  ${samples.join(', ')}${samples.length === 6 ? ' …' : ''}`;
}

/** Union every key across a list of objects, so an optional field is not missed. */
function inferSchema(objects, prefix = '') {
  const keys = [...new Set(objects.flatMap((o) => Object.keys(o ?? {})))].sort();
  const lines = [];
  for (const key of keys) {
    const values = objects.map((o) => o?.[key]).filter((v) => v !== undefined);
    const nested = values.filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    lines.push(`  ${(prefix + key).padEnd(28)} ${describe(values)}`);
    if (nested.length === values.length && nested.length) {
      lines.push(...inferSchema(nested, `${prefix}${key}.`));
    }
    // Arrays of objects are where the phase definitions will live.
    const arrays = values.filter(Array.isArray).flat();
    if (arrays.length && arrays.every((v) => v && typeof v === 'object')) {
      lines.push(...inferSchema(arrays, `${prefix}${key}[].`));
    }
  }
  return lines;
}

function classify(raw) {
  const id = String(raw.id ?? '');
  const sku = String(raw.sku ?? '');
  const name = String(raw.displayName ?? '');
  const espresso =
    Number(id.startsWith('FS_')) +
    Number(/^1SSE/i.test(sku)) +
    Number(raw.deviceType === 'Solo') +
    Number(/espresso|series\s*1/i.test(name));
  const brewer = Number(id.startsWith('FB_')) + Number(/^EBRWS/i.test(sku)) + Number(/aiden/i.test(name));
  if (espresso >= 2) return 'espresso';
  if (brewer >= 2) return 'brewer';
  return 'unknown';
}

const output = { probedAt: new Date().toISOString(), devices: [] };

console.log(dim(`\n→ ${BASE_URL}`));

// Login is the one call that carries a body, so it bypasses call().
const loginRes = await fetch(`${BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
  body: JSON.stringify({ email, password }),
});
const loginBody = await loginRes.json().catch(() => null);

if (!loginRes.ok || !loginBody?.accessToken) {
  console.error(`\n✗ Login failed (${loginRes.status}):`, JSON.stringify(loginBody, null, 2));
  process.exit(1);
}
token = loginBody.accessToken;
console.log(`✓ Signed in as ${bold(email)}`);
console.log(dim(`  token fields: ${Object.keys(loginBody).join(', ')}`));

const devices = await call('/devices?dataType=real');
if (!devices.ok || !Array.isArray(devices.body)) {
  console.error(`\n✗ Could not list devices (${devices.status}):`, devices.body);
  process.exit(1);
}

console.log(`\n${bold('Devices')}`);
for (const raw of devices.body) {
  const family = classify(raw);
  console.log(
    `  ${family === 'espresso' ? amber('●') : '○'} ${String(raw.displayName).padEnd(22)} ` +
      dim(`${family}  sku=${raw.sku}  fw=${raw.firmwareVersion}  ${raw.id}`),
  );

  const entry = { id: raw.id, displayName: raw.displayName, family, device: raw };

  for (const [label, path] of [
    ['profiles', `/devices/${raw.id}/profiles`],
    ['schedules', `/devices/${raw.id}/schedules`],
  ]) {
    const res = await call(path);
    entry[label] = { status: res.status, body: res.body };
    const count = Array.isArray(res.body) ? `${res.body.length} item(s)` : res.ok ? 'object' : 'failed';
    console.log(dim(`      ${label.padEnd(10)} ${res.status}  ${count}`));
  }

  output.devices.push(entry);
}

/**
 * Route matrix.
 *
 * `POST /devices/<FS_…>/profiles` comes back 404 "Device could not be found"
 * even though the same token just listed that device. So the question is not
 * "is the payload wrong" — the request never reaches profile validation. This
 * walks the neighbouring routes to find where the espresso device IS known.
 *
 * Read-only: every call below is a GET.
 */
async function routeMatrix(entry) {
  const id = entry.id;
  const bare = id.replace(/^[A-Z]{2}_/, '');
  const active = entry.device?.activeProfileId ?? entry.device?.ibSelectedProfileId;
  const candidates = [
    [`/devices/${id}`, 'device itself'],
    [`/devices/${id}?dataType=real`, 'device + dataType'],
    [`/devices/${id}/profiles`, 'profiles (the failing one)'],
    [`/devices/${id}/profiles?dataType=real`, 'profiles + dataType'],
    [`/devices/${bare}/profiles`, 'profiles, prefix stripped'],
    [`/devices/${id}/settings`, 'settings'],
    [`/devices/${id}/schedules`, 'schedules'],
    [`/devices/${id}/espresso-profiles`, 'espresso-profiles'],
    [`/devices/${id}/shot-profiles`, 'shot-profiles'],
    [`/devices/${id}/recipes`, 'recipes'],
    [`/espresso-devices/${id}/profiles`, 'espresso-devices collection'],
    [`/profiles?deviceId=${id}`, 'top-level profiles, filtered'],
    ...(active ? [[`/profiles/${active}`, `active profile ${active}`]] : []),
  ];

  console.log(`\n${bold(`Route matrix — ${entry.displayName}`)} ${dim(`(${entry.family})`)}`);
  const rows = [];
  for (const [path, label] of candidates) {
    const res = await call(path);
    const note =
      res.ok
        ? Array.isArray(res.body)
          ? `${res.body.length} item(s)`
          : 'object'
        : typeof res.body?.message === 'string'
          ? res.body.message
          : String(res.body).slice(0, 60);
    const mark = res.ok ? amber('✓') : ' ';
    console.log(`  ${mark} ${String(res.status).padEnd(4)} ${label.padEnd(28)} ${dim(note)}`);
    rows.push({ path, label, status: res.status, body: res.body });
  }
  entry.routeMatrix = rows;
}

for (const entry of output.devices) {
  await routeMatrix(entry);
}

// The point of the whole exercise.
for (const entry of output.devices) {
  const profiles = Array.isArray(entry.profiles?.body) ? entry.profiles.body : [];
  if (!profiles.length) continue;
  console.log(`\n${bold(`Inferred profile schema — ${entry.displayName}`)} ${dim(`(${entry.family})`)}`);
  console.log(inferSchema(profiles).join('\n'));
  if (entry.family === 'espresso') {
    console.log(`\n${amber('↑ This is the schema to encode in packages/shared/src/es1.ts')}`);
    console.log(dim('  and to map to in toEs1Payload() in server/src/fellow/live.ts.'));
  }
}

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), 'fellow-probe-output.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\n${dim(`Full dump → ${outPath}`)}\n`);
