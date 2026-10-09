import { expect, test } from '@playwright/test';
test('password page does not load third-party analytics even with prior accepted consent', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://www.googletagmanager.com/**', async route => {
    requests.push(new URL(route.request().url()).origin);
    await route.fulfill({ contentType: 'application/javascript', body: '/* test-only empty analytics */' });
  });
  await page.addInitScript(() => localStorage.setItem('mgk-analytics-consent', 'accepted'));
  await page.goto('/tools/password-generator.html');
  await page.waitForFunction(() => Array.isArray((window as unknown as {dataLayer: unknown[]}).dataLayer));
  await expect(page.locator('script[data-ga-id]')).toHaveCount(0);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).not.toHaveAttribute('content', /googletagmanager|google-analytics/);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('mgk-analytics-consent'))).toBe('accepted');
});
