import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import { keyByUserOrIp } from './limits.ts';

// A real Express app with the same trust setting as index.ts, so req.ip is
// derived the way it is in production rather than stubbed.
let base = '';
let close: () => void;

before(async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.get('/key', (req, res) => {
    const userId = req.get('x-test-user');
    if (userId) Object.assign(req, { userId });
    res.json({ key: keyByUserOrIp(req) });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

after(() => close());

async function keyFor(headers: Record<string, string>): Promise<string> {
  const res = await fetch(`${base}/key`, { headers });
  return ((await res.json()) as { key: string }).key;
}

test('keys on Fly-Client-IP, not the last forwarded hop', async () => {
  // req.ip would be the last hop, 198.51.100.1.
  const key = await keyFor({
    'x-forwarded-for': '203.0.113.7, 198.51.100.1',
    'fly-client-ip': '203.0.113.7',
  });
  assert.equal(key, '203.0.113.7');
});

test('two visitors behind the same edge get separate buckets', async () => {
  const edge = '198.51.100.1';
  const a = await keyFor({ 'x-forwarded-for': edge, 'fly-client-ip': '203.0.113.7' });
  const b = await keyFor({ 'x-forwarded-for': edge, 'fly-client-ip': '203.0.113.8' });
  assert.notEqual(a, b);
});

test('behind Cloudflare, keys on CF-Connecting-IP', async () => {
  const edge = '172.70.1.1';
  const a = await keyFor({ 'fly-client-ip': edge, 'cf-connecting-ip': '203.0.113.7' });
  const b = await keyFor({ 'fly-client-ip': edge, 'cf-connecting-ip': '203.0.113.8' });
  assert.equal(a, '203.0.113.7');
  assert.notEqual(a, b);
});

test('CF-Connecting-IP from a non-Cloudflare address is ignored', async () => {
  // Someone hitting fly.dev directly, rotating the header to dodge the limit.
  const key = await keyFor({ 'fly-client-ip': '203.0.113.50', 'cf-connecting-ip': '192.0.2.1' });
  assert.equal(key, '203.0.113.50');
});

test('Cloudflare IPv6 edges are recognised', async () => {
  const key = await keyFor({
    'fly-client-ip': '2a06:98c1:3120::3',
    'cf-connecting-ip': '203.0.113.7',
  });
  assert.equal(key, '203.0.113.7');
});

test('falls back to req.ip when Fly-Client-IP is absent', async () => {
  assert.equal(await keyFor({ 'x-forwarded-for': '203.0.113.9' }), '203.0.113.9');
});

test('IPv6 clients are grouped by /56', async () => {
  const a = await keyFor({ 'fly-client-ip': '2001:db8:1:2::1' });
  const b = await keyFor({ 'fly-client-ip': '2001:db8:1:ff:ffff::9' });
  assert.equal(a, b);
  assert.match(a, /\/56$/);
});

test('a signed-in user is keyed by account, not address', async () => {
  assert.equal(
    await keyFor({ 'fly-client-ip': '203.0.113.7', 'x-test-user': 'usr_1' }),
    'user:usr_1',
  );
});
