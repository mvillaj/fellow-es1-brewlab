import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('add a coffee, land on its page, and find it on the shelf', async ({ page }) => {
  // Unique per run: the Clerk user persists between runs even though the
  // database does not, and a fixed name would hide a stale-data bug.
  const name = `E2E Guji ${Date.now()}`;

  await page.goto('/coffees');
  await page.getByRole('button', { name: 'Add coffee' }).click();

  const dialog = page.getByRole('dialog', { name: 'Add coffee' });
  await dialog.getByPlaceholder('Guji Uraga').fill(name);
  await dialog.getByPlaceholder('Onyx Coffee Lab').fill('E2E Roasters');
  await dialog.getByRole('button', { name: 'Add coffee' }).click();

  // Saving opens the new coffee's own page.
  await expect(page).toHaveURL(/\/coffees\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  // Back on the shelf after a full load, so it reached the API and not just
  // local state.
  await page.goto('/coffees');
  await expect(page.getByRole('link', { name })).toBeVisible();
});
