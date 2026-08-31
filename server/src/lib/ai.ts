import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

/**
 * The model client, created lazily so the app runs perfectly well without a key
 * -- the two AI features report themselves unavailable and every other route is
 * untouched.
 */
let client: Anthropic | null = null;

/**
 * An unset ANTHROPIC_API_KEY does not by itself mean there are no credentials:
 * the SDK also accepts an auth token, or a profile written by `ant auth login`.
 * Constructing the client is no help here -- it resolves lazily and only fails at
 * request time -- so check the documented sources directly.
 */
export function aiEnabled(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true;
  // `ant auth login` writes credentials/<profile>.json under the config dir. Test
  // for that subdirectory rather than the parent, which survives a logout with
  // only settings in it and would otherwise read as "signed in".
  const configDir =
    process.env.ANTHROPIC_CONFIG_DIR ?? join(homedir(), '.config', 'anthropic');
  return existsSync(join(configDir, 'credentials'));
}

export function aiClient(): Anthropic {
  if (!aiEnabled()) throw new Error('No Anthropic credentials available on the server.');
  client ??= new Anthropic();
  return client;
}

export const AI_MODEL = 'claude-opus-5';

/**
 * An exhausted credit balance arrives as a 403 whose error type is
 * `billing_error` — distinct from `permission_error`, which shares that status.
 * Worth separating, because one means "top up the account" and the other means
 * "the key is wrong", and telling a user the wrong one wastes their afternoon.
 *
 * Without this the raw SDK message reaches the browser as a 502, which reads as
 * "the server is broken" rather than "this feature has no credit behind it".
 */
export function isOutOfCredit(err: unknown): boolean {
  return err instanceof Anthropic.PermissionDeniedError && err.type === 'billing_error';
}

/** Surfaced next to the disabled controls, so the reason is never a mystery. */
export function aiUnavailableReason(): string | undefined {
  return aiEnabled()
    ? undefined
    : 'Set ANTHROPIC_API_KEY on the server and restart it to enable this.';
}
