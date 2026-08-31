import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

// Set before importing: the module reads the key lazily, inside each call, so a
// test can install one without the import order mattering.
process.env.BREWLAB_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const { decryptSecret, encryptSecret, encryptionConfigured } = await import('./crypto.ts');

const TOKEN = 'fellow_access_token_abc123.def456';

test('a token survives the round trip', () => {
  assert.equal(decryptSecret(encryptSecret(TOKEN)), TOKEN);
});

test('the ciphertext never contains the plaintext', () => {
  assert.ok(!encryptSecret(TOKEN).includes(TOKEN));
});

test('encrypting twice gives different ciphertext', () => {
  // A fresh IV each time. Without this, identical tokens would be visibly
  // identical at rest, which leaks that two accounts share a credential.
  assert.notEqual(encryptSecret(TOKEN), encryptSecret(TOKEN));
});

test('tampering is detected rather than silently decrypted', () => {
  const [version, iv, tag, body] = encryptSecret(TOKEN).split(':');
  const flipped = Buffer.from(body, 'base64');
  flipped[0] ^= 0xff;
  assert.throws(() => decryptSecret([version, iv, tag, flipped.toString('base64')].join(':')));
});

test('a plaintext value from before encryption is rejected, not returned', () => {
  // The failure mode that matters: rows written before this existed must not be
  // handed back as if they were fine.
  assert.throws(() => decryptSecret('fellow_plaintext_token'), /expected encrypted format/);
});

test('a value encrypted under a different key does not decrypt', () => {
  const sealed = encryptSecret(TOKEN);
  const original = process.env.BREWLAB_ENCRYPTION_KEY;
  process.env.BREWLAB_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  assert.throws(() => decryptSecret(sealed));
  process.env.BREWLAB_ENCRYPTION_KEY = original;
});

test('a missing or malformed key is reported, not defaulted around', () => {
  const original = process.env.BREWLAB_ENCRYPTION_KEY;

  delete process.env.BREWLAB_ENCRYPTION_KEY;
  assert.equal(encryptionConfigured(), false);
  assert.throws(() => encryptSecret(TOKEN), /BREWLAB_ENCRYPTION_KEY is not set/);

  process.env.BREWLAB_ENCRYPTION_KEY = Buffer.from('too short').toString('base64');
  assert.equal(encryptionConfigured(), false);
  assert.throws(() => encryptSecret(TOKEN), /must decode to 32 bytes/);

  process.env.BREWLAB_ENCRYPTION_KEY = original;
  assert.equal(encryptionConfigured(), true);
});
