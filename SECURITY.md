# Security

Mousetail is a hobby project run by one person, but it holds other people's
credentials, so security reports are taken seriously.

## Reporting a vulnerability

Please report it privately through
[GitHub's private vulnerability reporting](https://github.com/mvillaj/mousetail-web/security/advisories/new)
rather than in a public issue. I'll acknowledge it within a week and keep you
posted while it's fixed. Credit in the release notes is yours if you want it.

Only the deployed app and the `main` branch are supported. There are no older
release lines to patch.

## What the app protects, and how

- **Sign-in** is delegated to [Clerk](https://clerk.com). The app stores no
  passwords, and the API verifies a Clerk session token on every request
  except the health check.
- **Fellow access tokens** are encrypted at rest with AES-256-GCM
  (`server/src/lib/crypto.ts`). That protects a copied database or backup, not
  a compromised host, because the key lives in the app's environment.
- **Model spend** is capped per user and globally, and the API is rate limited
  (`server/src/lib/limits.ts`). CORS is restricted to the app's own origin.
- **Model credentials** on Fly come from workload identity federation, so no
  long-lived Anthropic key is stored there.
- **Dependencies** are kept current by Dependabot, and CodeQL scans every pull
  request.

## Out of scope

- Fellow's own API, which this project uses unofficially. Report issues with
  it to Fellow.
- Findings that need a compromised device or a malicious browser extension.
- Volumetric denial of service against the hosted instance.
