import { test, expect } from '@playwright/test';

test('auth gate allows access with token', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('CCP_AUTH_TOKEN').fill(process.env.CCP_AUTH_TOKEN || 'test-token');
  await page.getByRole('button', { name: 'Connect' }).click();

  await expect(page.locator('.terminal-panel')).toBeVisible();
});
