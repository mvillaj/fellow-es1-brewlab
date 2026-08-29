#!/usr/bin/env node
/**
 * HAR analyser for captured Fellow app traffic — zero dependencies, offline.
 *
 *   node scripts/fellow-har.mjs ~/Desktop/fellow-capture.har
 *
 * Point a proxy (Proxyman, Charles, mitmproxy) at the Fellow mobile app, create
 * or edit a custom profile on the ES1, export the session as HAR, then run this.
 *
 * It answers, in order:
 *   1. Which hosts does the app actually talk to?  (is there a second backend?)
 *   2. Which requests mention the ES1 at all?
 *   3. Of those, which ones carry a profile-shaped body?
 *   4. What is that body's schema?
 *
 * Authorization headers and anything token-shaped are redacted on the way out,
 * so the report is safe to paste into a chat or commit to the repo.
 */

import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/fellow-har.mjs <capture.har>');
  process.exit(1);
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const amber = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

const har = JSON.parse(readFileSync(file, 'utf8'));
const entries = har?.log?.entries ?? [];
if (!entries.length) {
  console.error('No entries in that HAR.');
  process.exit(1);
}

/** Strip anything that looks like a credential before it reaches stdout. */
function redact(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/("(?:accessToken|refreshToken|idToken|password|Authorization)"\s*:\s*")[^"]*/gi, '$1<redacted>')
    .replace(/(Bearer\s+)[\w.\-]+/gi, '$1<redacted>')
    .replace(/(eyJ[\w-]{10,}\.[\w-]{10,})\.[\w-]+/g, '<jwt>');
}

function parseBody(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const KNOWN_GATEWAY = 'l8qtmnc692.execute-api.us-west-2.amazonaws.com';

const rows = entries.map((e) => {
  const url = new URL(e.request.url);
  const reqBody = parseBody(e.request.postData?.text);
  const resBody = parseBody(e.response?.content?.text);
  const blob = `${e.request.url} ${e.request.postData?.text ?? ''} ${e.response?.content?.text ?? ''}`;
  return {
    method: e.request.method,
    host: url.host,
    path: url.pathname + url.search,
    status: e.response?.status,
    reqBody,
    resBody,
    rawReq: e.request.postData?.text,
    rawRes: e.response?.content?.text,
    mentionsEs1: /FS_[0-9a-f-]{8,}/i.test(blob),
    mentionsEspresso: /espresso|1SSE|preinfus|pressure|portafilter|\bshot\b/i.test(blob),
    profileShaped: /profile/i.test(blob),
  };
});

// --- 1. hosts ----------------------------------------------------------------

console.log(`\n${bold('1. Hosts the app talked to')}`);
const byHost = new Map();
for (const r of rows) byHost.set(r.host, (byHost.get(r.host) ?? 0) + 1);
for (const [host, n] of [...byHost].sort((a, b) => b[1] - a[1])) {
  const tag = host === KNOWN_GATEWAY ? dim('(the gateway we already mapped)') : amber('← new');
  console.log(`  ${String(n).padStart(4)}  ${host.padEnd(56)} ${tag}`);
}
if (byHost.size === 1 && byHost.has(KNOWN_GATEWAY)) {
  console.log(dim('\n  Only the known gateway. If a profile save happened during this capture and'));
  console.log(dim('  produced no request, the ES1 is not driven over HTTPS — look for a WebSocket'));
  console.log(dim('  (MQTT over WSS to *-ats.iot.<region>.amazonaws.com) or a BLE transport.'));
}

// --- 2. anything naming the ES1 ---------------------------------------------

console.log(`\n${bold('2. Requests naming the ES1')} ${dim('(FS_ id anywhere in url or body)')}`);
const es1Rows = rows.filter((r) => r.mentionsEs1);
if (!es1Rows.length) console.log(dim('  none'));
for (const r of es1Rows) {
  console.log(`  ${r.method.padEnd(6)} ${String(r.status).padEnd(4)} ${r.host}${r.path}`);
}

// --- 3. writes ---------------------------------------------------------------

console.log(`\n${bold('3. Writes')} ${dim('(POST/PUT/PATCH — where a profile upload would live)')}`);
const writes = rows.filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method));
for (const r of writes) {
  const flag = r.mentionsEs1 || r.mentionsEspresso ? amber('●') : ' ';
  console.log(`  ${flag} ${r.method.padEnd(6)} ${String(r.status).padEnd(4)} ${r.host}${r.path}`);
}
if (!writes.length) console.log(dim('  none'));

// --- 4. the payload ----------------------------------------------------------

const candidates = writes.filter((r) => (r.mentionsEs1 || r.mentionsEspresso) && r.reqBody);
console.log(`\n${bold('4. Candidate profile payloads')}`);
if (!candidates.length) {
  console.log(dim('  none — widen the capture, or the transport is not HTTPS'));
}
for (const r of candidates) {
  console.log(`\n${green(`${r.method} ${r.host}${r.path}`)} ${dim(`→ ${r.status}`)}`);
  console.log(dim('  request:'));
  console.log(redact(JSON.stringify(r.reqBody, null, 2)).split('\n').map((l) => `    ${l}`).join('\n'));
  if (r.resBody) {
    console.log(dim('  response:'));
    console.log(redact(JSON.stringify(r.resBody, null, 2)).split('\n').slice(0, 60).map((l) => `    ${l}`).join('\n'));
  }
}

// --- 5. schema ---------------------------------------------------------------
// Same inference as fellow-probe.mjs, so a captured ES1 profile can be read the
// same way we read the Aiden's.

function describe(values) {
  const types = new Set(values.map((v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)));
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  const type = [...types].join(' | ');
  if (nonNull.length && nonNull.every((v) => typeof v === 'number')) {
    return `${type}  range ${Math.min(...nonNull)} … ${Math.max(...nonNull)}`;
  }
  const samples = [...new Set(nonNull.map((v) => JSON.stringify(v)))].slice(0, 6);
  return `${type}  ${samples.join(', ')}`;
}

function inferSchema(objects, prefix = '') {
  const keys = [...new Set(objects.flatMap((o) => Object.keys(o ?? {})))].sort();
  const lines = [];
  for (const key of keys) {
    const values = objects.map((o) => o?.[key]).filter((v) => v !== undefined);
    lines.push(`  ${(prefix + key).padEnd(30)} ${describe(values)}`);
    const nested = values.filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (nested.length === values.length && nested.length) lines.push(...inferSchema(nested, `${prefix}${key}.`));
    const arrayed = values.filter(Array.isArray).flat();
    if (arrayed.length && arrayed.every((v) => v && typeof v === 'object')) {
      lines.push(...inferSchema(arrayed, `${prefix}${key}[].`));
    }
  }
  return lines;
}

const payloads = candidates.map((r) => r.reqBody).filter((b) => b && typeof b === 'object' && !Array.isArray(b));
if (payloads.length) {
  console.log(`\n${bold('5. Inferred ES1 profile schema')}`);
  console.log(inferSchema(payloads).join('\n'));
  console.log(`\n${amber('↑ Encode this in packages/shared/src/es1.ts and map to it in toEs1Payload().')}`);
}

// --- 6. websockets -----------------------------------------------------------
// If profiles move over MQTT-over-WSS rather than REST, this is where it shows.

const ws = entries.filter((e) => e._webSocketMessages || /^wss?:/.test(e.request.url));
if (ws.length) {
  console.log(`\n${bold('6. WebSocket traffic')} ${dim('(MQTT over WSS would land here)')}`);
  for (const e of ws) {
    console.log(`  ${e.request.url}  ${dim(`${e._webSocketMessages?.length ?? 0} frame(s)`)}`);
    for (const m of (e._webSocketMessages ?? []).slice(0, 10)) {
      console.log(dim(`    ${m.type}: ${redact(String(m.data)).slice(0, 200)}`));
    }
  }
}

console.log();
