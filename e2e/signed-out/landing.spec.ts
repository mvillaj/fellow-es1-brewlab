import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('visitors get the landing page with a way in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dial in espresso');
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
});

test('sign in opens the Clerk form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).first().click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByLabel(/email/i)).toBeVisible();
});
