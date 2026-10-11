import { request } from 'node:http';

/** Where Fly exposes its Machines API inside every Machine. */
export const FLY_API_SOCKET = '/.fly/api';

/**
 * The `aud` we ask Fly to stamp on the token. The federation rule in the Claude
 * Console matches on this exact value, so the two must change together.
 */
export const FEDERATION_AUDIENCE = 'https://api.anthropic.com';

/**
 * Mints a fresh Fly OIDC token proving this Machine belongs to our app.
 *
 * Fresh on every call is the point: Fly tokens live about ten minutes and
 * Anthropic accepts each one (by its `jti`) only once, so the SDK must never be
 * handed a token it has already exchanged. That rules out writing one to a file
 * at boot and pointing ANTHROPIC_IDENTITY_TOKEN_FILE at it.
 */
export function flyIdentityToken(
  socketPath = FLY_API_SOCKET,
  audience = FEDERATION_AUDIENCE,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path: '/v1/tokens/oidc',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        timeout: 5_000,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const token = body.trim();
          if (res.statusCode !== 200) {
            reject(new Error(`Fly OIDC token request failed (${res.statusCode}): ${token}`));
          } else if (token.split('.').length !== 3) {
            // Never echo the body here: if it is a token after all, it belongs
            // nowhere near a log line.
            reject(new Error('Fly OIDC token endpoint returned something other than a JWT'));
          } else {
            resolve(token);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Fly OIDC token request timed out')));
    req.on('error', reject);
    req.end(JSON.stringify({ aud: audience }));
  });
}
