import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OPT_IN_REQUIRED, fellowOptInGate } from './fellow-opt-in.ts';

/**
 * The gate is what stands between a user who never saw the warning and a write
 * to their machine, so the failure worth catching is one that lets them through.
 */
function run(gate: ReturnType<typeof fellowOptInGate>, userId?: string) {
  let status: number | undefined;
  let body: unknown;
  let passed = false;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };
  gate({ userId } as any, res as any, () => {
    passed = true;
  });
  return { status, body, passed };
}

test('an opted-in user goes through', () => {
  const out = run(
    fellowOptInGate((id) => id === 'usr_in'),
    'usr_in',
  );
  assert.equal(out.passed, true);
  assert.equal(out.status, undefined);
});

test('a user who has not opted in is refused with 403', () => {
  const out = run(
    fellowOptInGate(() => false),
    'usr_out',
  );
  assert.equal(out.passed, false);
  assert.equal(out.status, 403);
  assert.deepEqual(out.body, { error: OPT_IN_REQUIRED });
});

test('a request with no user is refused without asking the lookup', () => {
  let asked = false;
  const out = run(
    fellowOptInGate(() => {
      asked = true;
      return true;
    }),
  );
  assert.equal(out.passed, false);
  assert.equal(out.status, 403);
  assert.equal(asked, false);
});
