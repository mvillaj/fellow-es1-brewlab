import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

// The setup user already went through the "I have a machine" path, so this
// replays the page from the nav and takes the other one: a beginner with no
// machine yet. Nothing here writes to the bench.
test('a beginner without a machine gets the basics, a shopping guide and the walkthrough', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Getting started' }).first().click();
  await expect(page).toHaveURL(/\/getting-started/);

  await page.getByRole('button', { name: /I'm new to it/ }).click();
  await expect(page.getByRole('heading', { name: 'Espresso in four ideas' })).toBeVisible();
  await page.getByRole('button', { name: /Got it/ }).click();

  // The bench already has the ES1, so the gear step says so; the guide is
  // still there for anyone thinking about an upgrade.
  await expect(page.getByRole('heading', { name: "You're set up" })).toBeVisible();
  await page.getByRole('button', { name: 'Browse the buying guide' }).click();

  const machines = page
    .getByRole('region', { name: 'Machines' })
    .getByRole('heading', { level: 3 });
  await expect(machines.first()).toHaveText('Gaggia Classic Pro');
  await page.getByRole('button', { name: 'High to low' }).click();
  await expect(machines.first()).toHaveText('Lelit Bianca');

  await page.getByRole('button', { name: /How a first shot goes/ }).click();
  await expect(page.getByRole('heading', { name: 'Your first shot' })).toBeVisible();
  await page.getByRole('button', { name: "I'll log it later" }).click();

  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
});
