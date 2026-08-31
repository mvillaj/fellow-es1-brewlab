import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Envelope encryption for credentials we have to keep — currently the Fellow
 * access token.
 *
 * What this protects against: a copy of the database. That is not hypothetical
 * here, because Litestream replicates `brewlab.db` to object storage, so every
 * plaintext credential in it would be duplicated somewhere with a different set
 * of access controls.
 *
 * What it does not protect against: someone who has the app host, since the key
 * is in this process's environment. A KMS would fix that; a Fly secret is the
 * pragmatic version, and the honest description is "a stolen backup is useless,
 * a stolen server is not".
 */
const VERSION = 'v1';
const KEY_BYTES = 32;

function key(): Buffer {
  const raw = process.env.BREWLAB_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      'BREWLAB_ENCRYPTION_KEY is not set, so Fellow credentials cannot be stored. ' +
        'Generate one with `openssl rand -base64 32` and set it — see .env.example.',
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `BREWLAB_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${buf.length}. ` +
        'Generate one with `openssl rand -base64 32`.',
    );
  }
  return buf;
}

export function encryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** `v1:<iv>:<tag>:<ciphertext>`, all base64. Versioned so the scheme can change. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    body.toString('base64'),
  ].join(':');
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, body] = stored.split(':');
  if (version !== VERSION || !iv || !tag || !body) {
    // Most likely a row written before encryption existed. There is nothing to
    // salvage — the value is a credential, not data, and the fix is to reconnect.
    throw new Error('Stored credential is not in the expected encrypted format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(body, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
