import { expect, test, type Page } from '@playwright/test';

type SmokeControlMessage = Record<string, unknown> & { type?: string };

declare global {
  interface Window {
    __simpleRpgSmoke: {
      messages: unknown[];
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: 'tests/smoke/mock-runtime.js' });
});

const sentControlMessages = async (page: Page, type: string): Promise<SmokeControlMessage[]> => page.evaluate((messageType) => {
  const runtime = window.__simpleRpgSmoke;
  return runtime.messages
    .map((message) => {
      try {
        return JSON.parse(String(message));
      } catch {
        return null;
      }
    })
    .filter((message): message is SmokeControlMessage => Boolean(message && message.type === messageType));
}, type);

test('routes from the main menu and switches language in the settings overlay', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('button', { name: 'Polish' }).click();

  await expect(page.getByRole('button', { name: 'Polski' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Muzyka' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Ustawienia' })).toBeHidden();

  await page.getByRole('button', { name: 'Graj' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: /lobby/i })).toBeVisible();
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

  await page.getByRole('button', { name: 'Load Save' }).click();
  await page.getByRole('button', { name: /Smoke Save/ }).click();
  await page.getByRole('button', { name: 'Create Lobby' }).click();
  await expect.poll(() => sentControlMessages(page, 'create_lobby')).toContainEqual(
    expect.objectContaining({ mode: 'load_save', saveId: 'save-smoke' }),
  );
  await expect(page.getByRole('heading', { name: 'War Table' })).toBeVisible();
  await expect(page.locator('aside').getByText('Loaded Save')).toBeVisible();
  await expect(page.locator('aside').getByText('Smoke Save')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();

  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByText('Loading World')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Loading World')).toBeHidden();

  await page.getByRole('button', { name: 'Game Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Game Menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Save Game' }).click();
  await expect.poll(() => sentControlMessages(page, 'save_game')).toContainEqual(
    expect.objectContaining({ type: 'save_game' }),
  );
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: 'Game Menu' })).toBeHidden();
});
