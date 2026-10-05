import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE, E2E_EMAIL } from './constants';

// Sign in once and save the session; every signed-in spec starts from it.
setup('sign in', async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: E2E_EMAIL });
  await page.goto('/');
  // The dashboard greets by first name once /auth/me has provisioned the bench.
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
