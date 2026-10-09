import { test, expect } from '@playwright/test';

test('Cron: Korean weekdays and five exact real instants', async ({ page }) => {
  await page.goto('/tools/cron-explainer.html');
  await page.locator('#cron-reference').fill('2024-01-01T00:00:00Z');
  await page.locator('#cron-input').fill('0 9 * * MON-FRI');
  await page.locator('#cron-explain').click();
  await expect(page.locator('#cron-error')).toBeEmpty();
  await expect(page.locator('#cron-description')).toContainText('09:00');
  await expect(page.locator('#cron-description')).toContainText('월요일');
  await expect(page.locator('#cron-next li')).toHaveCount(5);
  await expect(page.locator('#cron-next code')).toHaveText([
    '2024-01-02T00:00:00.000Z', '2024-01-03T00:00:00.000Z', '2024-01-04T00:00:00.000Z',
    '2024-01-05T00:00:00.000Z', '2024-01-08T00:00:00.000Z',
  ]);
  await expect(page.locator('#cron-next time').first()).toHaveAttribute('datetime', '2024-01-02T00:00:00.000Z');
  await expect(page.locator('#cron-next time').first()).toContainText('Asia/Seoul');
  await expect(page.locator('#cron-next time').first()).toContainText('UTC+09:00');
  await page.locator('#cron-timezone').selectOption('UTC');
  await page.locator('#cron-explain').click();
  await expect(page.locator('#cron-next code').first()).toHaveText('2024-01-01T09:00:00.000Z');
});

test('Cron: unsupported syntax clears stale results and recovers', async ({ page }) => {
  await page.goto('/tools/cron-explainer.html');
  await page.locator('#cron-reference').fill('2024-01-01T00:00:00Z');
  await page.locator('#cron-explain').click();
  await expect(page.locator('#cron-next li')).toHaveCount(5);
  for (const expression of ['0 0 9 * * MON', '0 0 L * *', '0 0 * * 1#2', '*/0 * * * *', '0 0 30 FEB *']) {
    await page.locator('#cron-input').fill(expression);
    await page.locator('#cron-explain').click();
    await expect(page.locator('#cron-error')).not.toBeEmpty();
    await expect(page.locator('#cron-next li')).toHaveCount(0);
    await expect(page.locator('#cron-description')).toBeEmpty();
  }
  await page.locator('#cron-input').fill('0,30 8-10/2 * JUL WED');
  await page.locator('#cron-timezone').selectOption('UTC');
  await page.locator('#cron-reference').fill('2024-07-01T00:00:00Z');
  await page.locator('#cron-explain').click();
  await expect(page.locator('#cron-error')).toBeEmpty();
  await expect(page.locator('#cron-next li')).toHaveCount(5);
  await expect(page.locator('#cron-next code').first()).toHaveText('2024-07-03T08:00:00.000Z');
});

test('Cron: mobile form and long local/ISO output do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/tools/cron-explainer.html');
  await page.locator('#cron-timezone').selectOption('America/New_York');
  await page.locator('#cron-input').fill('30 2 * * *');
  await page.locator('#cron-reference').fill('2024-03-09T00:00:00Z');
  await page.locator('#cron-explain').click();
  await expect(page.locator('#cron-next li')).toHaveCount(5);
  await expect(page.locator('#cron-next time').nth(1)).toContainText('03:30:00');
  await page.locator('details summary').click();
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
});
