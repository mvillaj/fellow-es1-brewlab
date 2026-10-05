import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { AUTH_FILE } from './e2e/constants';

// Locally the Clerk keys live in the repo-root .env, same as for `pnpm dev`. In CI
// they arrive as job env vars, which loadEnvFile would not override anyway.
if (existsSync('.env')) process.loadEnvFile('.env');

// Off the dev ports (4000/5173) so a suite run never collides with, or quietly
// reuses, a `pnpm dev` you already have open against your real database.
const API_PORT = Number(process.env.E2E_API_PORT ?? 4310);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5310);
const E2E_DB = resolve('server/data/e2e.db');

export default defineConfig({
  testDir: './e2e',
  // One worker: every test shares one Clerk user and one database, and the flows
  // are few enough that parallelism would buy flakiness rather than time.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global.setup.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'signed-out', testMatch: /signed-out\/.*\.spec\.ts/, use: devices['Desktop Chrome'] },
    { name: 'auth', testMatch: /auth\.setup\.ts/, use: devices['Desktop Chrome'] },
    {
      name: 'signed-in',
      testMatch: /signed-in\/.*\.spec\.ts/,
      dependencies: ['auth'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
    },
  ],
  webServer: [
    {
      // A fresh database every run. Migrations create the schema on boot, and the
      // test user's bench is provisioned on its first /auth/me, so no seed needed.
      command: `rm -f ${E2E_DB} ${E2E_DB}-wal ${E2E_DB}-shm && pnpm --filter @brewlab/server start`,
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        BREWLAB_DB: E2E_DB,
        FELLOW_MODE: 'mock',
        // Never spend real model calls from a test run: no key, and a config dir
        // with no `ant auth login` credentials in it, so the AI features render
        // in their disabled state.
        ANTHROPIC_API_KEY: '',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_CONFIG_DIR: resolve('e2e/.no-anthropic'),
      },
    },
    {
      command: `pnpm --filter @brewlab/client exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
