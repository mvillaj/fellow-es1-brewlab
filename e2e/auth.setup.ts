import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE, E2E_EMAIL } from './constants';

// Sign in once and save the session; every signed-in spec starts from it.
setup('sign in', async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: E2E_EMAIL });
  await page.goto('/');

  // A fresh database makes this a brand-new user: empty bench, sent to getting
  // started. Go through it with the gear the other specs rely on (the ES1's
  // profile studio and Fellow page, a grinder for the shot form).
  await expect(page).toHaveURL(/\/getting-started/);
  await page.getByRole('button', { name: /I've pulled shots/ }).click();
  await page.getByRole('button', { name: /Yes, I have one/ }).click();
  await page.getByLabel('Machine').selectOption({ label: 'Fellow Espresso Series 1' });
  await page.getByLabel('Grinder').selectOption({ label: 'Fellow Opus 2' });
  await page.getByRole('button', { name: 'Add to my bench' }).click();
  await page.getByRole('button', { name: "I'll log it later" }).click();

  // The dashboard greets by first name.
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
