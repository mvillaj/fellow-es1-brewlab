import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test("the grind setting is held to the default grinder's dial", async ({ page }) => {
  await page.goto('/shots');
  await page.getByRole('button', { name: 'Log a shot' }).click();

  // Getting started put the Opus 2 on the bench: a stepless 0-10 dial.
  const grind = page.getByLabel(/Grind setting/);
  await grind.fill('12');
  await expect(page.getByText('Fellow Opus 2 goes from 0 to 10')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log shot' })).toBeDisabled();

  await grind.fill('1');
  await expect(page.getByText(/≈ 300 µm/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log shot' })).toBeEnabled();
});
