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

test('first-time visitors get light, even when the system prefers dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('a saved dark choice survives a reload', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('brewlab.theme', 'dark'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('the hero pull links each stage to its section', async ({ page }) => {
  await page.goto('/');
  const stages = page.getByRole('navigation', { name: 'What Mousetail does' });
  await stages.getByRole('link', { name: /Infusion/ }).click();
  await expect(page).toHaveURL(/#coach$/);
  await expect(
    page.getByRole('heading', { name: 'One change at a time.', exact: true }),
  ).toBeInViewport();
});
