import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: 'tests/smoke/mock-runtime.js' });
});

test('routes from the main menu and switches language in the settings overlay', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('button', { name: 'Polish' }).click();

  await expect(page.getByRole('button', { name: 'Polski' })).toHaveAttribute('aria-pressed', 'true');
});

test('redirects the legacy game route into the play shell lobby phase', async ({ page }) => {
  await page.goto('/game');

  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: 'Lobby Browser' })).toBeVisible();
  await expect(page.getByText('No Lobbies Available')).toBeVisible();
});

test('hosts a mocked lobby and advances through loading into the gameplay shell', async ({ page }) => {
  await page.goto('/play');

  await page.getByRole('button', { name: 'Host the First Lobby' }).click();
  await expect(page.getByRole('dialog', { name: 'Host A Lobby' })).toBeVisible();

  await page.getByRole('button', { name: 'Create Lobby' }).click();
  await expect(page.getByRole('heading', { name: 'War Table' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();

  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByText('Loading World')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Loading World')).toBeHidden();

  await page.getByRole('button', { name: 'Game Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Game Menu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});
