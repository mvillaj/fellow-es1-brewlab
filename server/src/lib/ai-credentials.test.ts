import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { test } from 'node:test';
import { credentialSource, flyFederatedClient } from './ai.ts';
import { FLY_API_SOCKET } from './fly-oidc.ts';

/**
 * Getting detection wrong fails quietly in both directions: AI features that
 * render disabled on a server that could run them, or enabled ones that 401 on
 * first use. So pin down every source, and the order they win in.
 */
const CONFIG_DIR = '/cfg';
const FEDERATION = {
  ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
  ANTHROPIC_ORGANIZATION_ID: '00000000-0000-0000-0000-000000000000',
  ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test',
};
const onFly = (path: string) => path === FLY_API_SOCKET;
const nowhere = () => false;

test('no credentials anywhere is null', () => {
  assert.equal(credentialSource({ ANTHROPIC_CONFIG_DIR: CONFIG_DIR }, nowhere), null);
});

test('a key or auth token wins over everything', () => {
  // The SDK lets a stray ANTHROPIC_API_KEY shadow federation, so we must too,
  // or we'd build a federated client the SDK then ignores.
  assert.equal(credentialSource({ ...FEDERATION, ANTHROPIC_API_KEY: 'sk' }, onFly), 'key');
  assert.equal(credentialSource({ ANTHROPIC_AUTH_TOKEN: 'tok' }, nowhere), 'key');
});

test('on Fly, the federation IDs alone are enough', () => {
  assert.equal(
    credentialSource({ ...FEDERATION, ANTHROPIC_CONFIG_DIR: CONFIG_DIR }, onFly),
    'fly-federation',
  );
});

test('off Fly, the federation IDs alone are not', () => {
  // Locally there is no socket to mint a token from; claiming otherwise would
  // light up the AI features and then fail every request.
  assert.equal(
    credentialSource({ ...FEDERATION, ANTHROPIC_CONFIG_DIR: CONFIG_DIR }, nowhere),
    null,
  );
});

test("an identity token in the environment is left to the SDK's own federation", () => {
  assert.equal(
    credentialSource({ ...FEDERATION, ANTHROPIC_IDENTITY_TOKEN_FILE: '/t' }, onFly),
    'federation',
  );
});

test('federation needs all three IDs', () => {
  const { ANTHROPIC_SERVICE_ACCOUNT_ID: _, ...partial } = FEDERATION;
  assert.equal(credentialSource({ ...partial, ANTHROPIC_CONFIG_DIR: CONFIG_DIR }, onFly), null);
});

test('an `ant auth login` profile still counts', () => {
  const credentials = join(CONFIG_DIR, 'credentials');
  assert.equal(
    credentialSource({ ANTHROPIC_CONFIG_DIR: CONFIG_DIR }, (p) => p === credentials),
    'profile',
  );
});

test('the Fly client exchanges a Fly token and calls the API with the result', async () => {
  // A fake Anthropic: one token exchange, then one model call that must carry
  // the token the exchange handed out.
  const seen: { exchange?: Record<string, string>; authorization?: string } = {};
  const api = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/v1/oauth/token') {
        seen.exchange = JSON.parse(body);
        res.end(JSON.stringify({ access_token: 'sk-ant-oat01-minted', expires_in: 600 }));
      } else {
        seen.authorization = req.headers.authorization;
        res.end(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-opus-5',
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        );
      }
    });
  });
  await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
  const { port } = api.address() as AddressInfo;

  try {
    const client = flyFederatedClient(
      { ...FEDERATION, ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}` },
      async () => 'fly.jwt.here',
    );
    await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'hi' }],
    });

    assert.equal(seen.exchange?.assertion, 'fly.jwt.here');
    assert.equal(seen.exchange?.federation_rule_id, FEDERATION.ANTHROPIC_FEDERATION_RULE_ID);
    assert.equal(seen.exchange?.organization_id, FEDERATION.ANTHROPIC_ORGANIZATION_ID);
    assert.equal(seen.exchange?.service_account_id, FEDERATION.ANTHROPIC_SERVICE_ACCOUNT_ID);
    assert.equal(seen.authorization, 'Bearer sk-ant-oat01-minted');
  } finally {
    api.close();
  }
});
