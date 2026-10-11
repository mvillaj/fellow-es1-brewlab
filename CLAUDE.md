# CLAUDE.md

## Testing

When adding or changing code, add or update the tests that apply to it in the same change. Use the existing suite for that layer:

- **Shared** (`packages/shared/src`): `node:test`, colocated as `*.test.ts`. Run with `pnpm test:shared`.
- **Server** (`server/src`): `node:test`, colocated as `*.test.ts`. Run with `pnpm test:server`.
- **Client** (`client/src`): Vitest and Testing Library, colocated as `*.test.ts(x)`. Run with `pnpm test:client`.
- **End-to-end** (`e2e/`): Playwright, split into `signed-in/` and `signed-out/`. Run with `pnpm test:e2e`. Add or update a spec when a user-facing flow changes.

Run the relevant suites before you call the work done. Skip tests only when nothing meaningful can be tested (copy, styling, config). If you skip them, say so.

## Lint and format

CI runs `pnpm lint` (ESLint) and `pnpm format:check` (Prettier). Run `pnpm format` and `pnpm lint` before you call the work done.
