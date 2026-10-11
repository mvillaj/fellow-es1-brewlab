import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

// Never gets as far as connecting: that would send credentials to Fellow's real
// API. The opt-in itself is entirely ours, so it is what this covers.
test('the Fellow integration stays off until the warning is accepted', async ({ page }) => {
  // A cold deep link on purpose: it used to land before the bench loaded, find
  // no /fellow route mounted, and bounce to the dashboard.
  await page.goto('/fellow');

  await expect(page.getByRole('heading', { name: /read before turning on/i })).toBeVisible();
  await expect(page.getByLabel('Fellow email')).toHaveCount(0);

  const enable = page.getByRole('button', { name: 'Turn on the Fellow integration' });
  await expect(enable).toBeDisabled();
  await page.getByRole('checkbox', { name: /at my own risk/i }).check();
  await enable.click();

  await expect(page.getByLabel('Fellow email')).toBeVisible();
  await expect(page.getByText('Experimental', { exact: true })).toBeVisible();

  // Off again, so the next run starts from the same place.
  await page.getByRole('button', { name: 'Turn off', exact: true }).click();
  await expect(page.getByRole('heading', { name: /read before turning on/i })).toBeVisible();
  await expect(page.getByLabel('Fellow email')).toHaveCount(0);
});
