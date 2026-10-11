import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { FEDERATION_AUDIENCE, flyIdentityToken } from './fly-oidc.ts';

/**
 * A stand-in for Fly's Machines API, listening on a unix socket the way the real
 * one does at /.fly/api. Each test swaps in the response it needs.
 */
let respond: (req: IncomingMessage, body: string, res: ServerResponse) => void;
const dir = mkdtempSync(join(tmpdir(), 'fly-oidc-'));
const socket = join(dir, 'api.sock');
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => respond(req, body, res));
});

before(() => new Promise<void>((resolve) => server.listen(socket, resolve)));
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvcmc6YXBwOm1hY2hpbmUifQ.c2ln';

test('asks the OIDC endpoint for a token with our audience', async () => {
  let seen: { method?: string; url?: string; body?: string } = {};
  respond = (req, body, res) => {
    seen = { method: req.method, url: req.url, body };
    res.end(`${JWT}\n`);
  };
  assert.equal(await flyIdentityToken(socket), JWT);
  assert.equal(seen.method, 'POST');
  assert.equal(seen.url, '/v1/tokens/oidc');
  // The federation rule matches this audience exactly; drift here and every
  // exchange fails with a rule mismatch.
  assert.deepEqual(JSON.parse(seen.body!), { aud: FEDERATION_AUDIENCE });
});

test('mints a new token on every call', async () => {
  // Anthropic rejects a re-presented jti, so caching here would break the
  // second refresh, ten minutes after boot.
  let calls = 0;
  respond = (_req, _body, res) => res.end(`${JWT}${++calls}`);
  const first = await flyIdentityToken(socket);
  const second = await flyIdentityToken(socket);
  assert.notEqual(first, second);
  assert.equal(calls, 2);
});

test('a refusal from Fly surfaces with its status', async () => {
  respond = (_req, _body, res) => {
    res.statusCode = 403;
    res.end('forbidden');
  };
  await assert.rejects(flyIdentityToken(socket), /\(403\): forbidden/);
});

test('a body that is not a JWT is rejected without being echoed', async () => {
  respond = (_req, _body, res) => res.end('{"surprise":"secret-ish"}');
  await assert.rejects(flyIdentityToken(socket), (err: Error) => {
    assert.match(err.message, /other than a JWT/);
    assert.doesNotMatch(err.message, /secret-ish/);
    return true;
  });
});

test('off Fly, the missing socket is an error rather than a hang', async () => {
  await assert.rejects(flyIdentityToken(join(dir, 'nope.sock')), /ENOENT/);
});
