import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('a signed-in brewer lands on their dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shot log' }).first()).toBeVisible();
});

test('a new bench comes with the default grinder and machine', async ({ page }) => {
  await page.goto('/grinders');
  await expect(page.getByText('Opus 2').first()).toBeVisible();
  await page.goto('/machines');
  await expect(page.getByText(/ES1|Espresso Series 1/).first()).toBeVisible();
});
