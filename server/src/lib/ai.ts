import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';
import { FLY_API_SOCKET, flyIdentityToken } from './fly-oidc.ts';

/**
 * The model client, created lazily so the app runs perfectly well without a key
 * -- the two AI features report themselves unavailable and every other route is
 * untouched.
 */
let client: Anthropic | null = null;

type Env = Record<string, string | undefined>;

/**
 * How the server will authenticate to the model, or null when it can't.
 *
 * An unset ANTHROPIC_API_KEY does not by itself mean there are no credentials:
 * the SDK also accepts an auth token, workload identity federation, or a profile
 * written by `ant auth login`. Constructing the client is no help here -- it
 * resolves lazily and only fails at request time -- so check the documented
 * sources directly, in the SDK's own precedence order.
 *
 * `fly-federation` is ours rather than the SDK's: on Fly the identity token comes
 * from the Machine's API socket, which the SDK has no way of knowing about. The
 * SDK's own federation env path needs a token file, which Fly can't keep fresh.
 */
export type CredentialSource = 'key' | 'federation' | 'fly-federation' | 'profile';

export function credentialSource(
  env: Env = process.env,
  exists: (path: string) => boolean = existsSync,
): CredentialSource | null {
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) return 'key';
  if (
    env.ANTHROPIC_FEDERATION_RULE_ID &&
    env.ANTHROPIC_ORGANIZATION_ID &&
    env.ANTHROPIC_SERVICE_ACCOUNT_ID
  ) {
    if (env.ANTHROPIC_IDENTITY_TOKEN_FILE || env.ANTHROPIC_IDENTITY_TOKEN) return 'federation';
    if (exists(FLY_API_SOCKET)) return 'fly-federation';
  }
  // `ant auth login` writes credentials/<profile>.json under the config dir. Test
  // for that subdirectory rather than the parent, which survives a logout with
  // only settings in it and would otherwise read as "signed in".
  const configDir = env.ANTHROPIC_CONFIG_DIR ?? join(homedir(), '.config', 'anthropic');
  return exists(join(configDir, 'credentials')) ? 'profile' : null;
}

export function aiEnabled(): boolean {
  return credentialSource() !== null;
}

/** Federation against Fly's OIDC issuer, minting a fresh Fly token per exchange. */
export function flyFederatedClient(
  env: Env = process.env,
  identityToken: () => Promise<string> = () => flyIdentityToken(),
): Anthropic {
  const baseURL = env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
  return new Anthropic({
    baseURL,
    // Only built when no key is set, but say so: the SDK would otherwise read
    // ANTHROPIC_API_KEY from the environment and quietly ignore `credentials`.
    apiKey: null,
    authToken: null,
    credentials: oidcFederationProvider({
      identityTokenProvider: identityToken,
      federationRuleId: env.ANTHROPIC_FEDERATION_RULE_ID!,
      organizationId: env.ANTHROPIC_ORGANIZATION_ID!,
      serviceAccountId: env.ANTHROPIC_SERVICE_ACCOUNT_ID,
      workspaceId: env.ANTHROPIC_WORKSPACE_ID,
      baseURL,
      fetch,
    }),
  });
}

export function aiClient(): Anthropic {
  const source = credentialSource();
  if (!source) throw new Error('No Anthropic credentials available on the server.');
  client ??= source === 'fly-federation' ? flyFederatedClient() : new Anthropic();
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
    : 'Set ANTHROPIC_API_KEY (or workload identity federation) on the server and restart it to enable this.';
}
