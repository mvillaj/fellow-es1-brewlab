import assert from 'node:assert/strict';
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { isOutOfCredit } from './ai.ts';

/**
 * The risk this guards against is a classifier that never fires: get the check
 * wrong and the friendly message is dead code, discovered the day the credit
 * runs out.
 */
const permissionDenied = (type: 'billing_error' | 'permission_error') =>
  new Anthropic.PermissionDeniedError(403, {}, `403 ${type}`, new Headers(), type);

test('an exhausted balance is recognised', () => {
  assert.equal(isOutOfCredit(permissionDenied('billing_error')), true);
});

test('a 403 that is really a bad key is not mistaken for it', () => {
  // Same status, different meaning: telling someone to top up when the key is
  // wrong sends them to the billing page for nothing.
  assert.equal(isOutOfCredit(permissionDenied('permission_error')), false);
});

test('ordinary failures are left alone', () => {
  assert.equal(isOutOfCredit(new Error('socket hang up')), false);
  assert.equal(isOutOfCredit(null), false);
  assert.equal(isOutOfCredit(undefined), false);
});
