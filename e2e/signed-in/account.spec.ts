import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

// Writes to the shared Clerk test user, so it changes only the last name (the
// sign-in setup greets by first name) and always puts it back.
test('renaming on the account page reaches Clerk and the sidebar', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible();

  const last = page.getByLabel('Last name');
  const save = page.getByRole('button', { name: 'Save changes' });
  const original = await last.inputValue();
  const renamed = `Tester ${Date.now().toString(36)}`;

  try {
    await last.fill(renamed);
    await save.click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.locator('.sidebar .account-name')).toContainText(renamed);

    // A fresh load reads it back from Clerk, not from the form's own state.
    await page.reload();
    await expect(page.getByLabel('Last name')).toHaveValue(renamed);
  } finally {
    await page.getByLabel('Last name').fill(original);
    if (await save.isEnabled()) {
      await save.click();
      await expect(page.getByText('Saved.')).toBeVisible();
    }
  }
});
