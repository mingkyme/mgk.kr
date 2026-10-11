import { expect, test } from '@playwright/test';

test.describe('browser-local Unix seconds', () => {
  test.use({ timezoneId: 'Asia/Seoul' });
  test('now produces integer seconds and explicit offsets override the mode', async ({ page }) => {
    await page.goto('/tools/unixtime.html');
    const before = await page.evaluate(() => Math.floor(Date.now() / 1000));
    await page.locator('#time-now').click();
    const after = await page.evaluate(() => Math.floor(Date.now() / 1000));
    const value = await page.locator('#unix-input').inputValue();
    expect(value).toMatch(/^\d+$/);
    expect(Number(value)).toBeGreaterThanOrEqual(before);
    expect(Number(value)).toBeLessThanOrEqual(after);
    await expect(page.locator('#date-input')).toHaveValue(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    await expect(page.locator('#time-error')).toBeEmpty();
    for (const [input, expected] of [['1970-01-01T00:00:00Z', '0'], ['1970-01-01T09:00:00+09:00', '0'], ['1970-01-01', '-32400']]) {
      await page.locator('#date-input').fill(input);
      await page.locator('#date-to-unix').click();
      await expect(page.locator('#unix-input')).toHaveValue(expected);
    }
    await page.locator('#timezone').selectOption('utc');
    await page.locator('#date-input').fill('1970-01-01');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#unix-input')).toHaveValue('0');
  });
  test('mobile converter has no removed unit UI or horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tools/unixtime.html');
    await expect(page.locator('#unix-unit, #output-unit')).toHaveCount(0);
    await expect(page.locator('main .form-grid').first()).not.toContainText(/밀리초|자동 감지/);
    const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  });
  test('invalid input clears stale conversion outputs', async ({ page }) => {
    await page.goto('/tools/unixtime.html');
    for (const input of ['0.5', '0.0', 'invalid', '253402300800', '253402300799']) {
      await page.locator('#time-now').click();
      await page.locator('#unix-input').fill(input);
      await page.locator('#unix-to-date').click();
      await expect(page.locator('#time-error')).not.toBeEmpty();
      await expect(page.locator('#date-input')).toBeEmpty();
      await expect(page.locator('#time-detected')).toBeEmpty();
    }
    for (const input of ['2024-02-30', '2024-01-01T00:00:00.1Z', '2024-01-01T24:00', '01/02/2024', '0000-01-01']) {
      await page.locator('#time-now').click();
      await page.locator('#date-input').fill(input);
      await page.locator('#date-to-unix').click();
      await expect(page.locator('#time-error')).not.toBeEmpty();
      await expect(page.locator('#unix-input')).toBeEmpty();
      await expect(page.locator('#time-detected')).toBeEmpty();
    }
  });
  test('timezone changes preserve the edited instant and recover from invalid edits', async ({ page }) => {
    await page.goto('/tools/unixtime.html');
    await page.locator('#unix-input').fill('0');
    await page.locator('#unix-to-date').click();
    await page.locator('#date-input').fill('1970-01-01 10:00');
    await page.locator('#timezone').selectOption('utc');
    await expect(page.locator('#date-input')).toHaveValue('1970-01-01 01:00:00');
    await expect(page.locator('#unix-input')).toHaveValue('3600');
    await page.locator('#date-input').fill('2024-02-30');
    await page.locator('#timezone').selectOption('local');
    await expect(page.locator('#timezone')).toHaveValue('utc');
    await expect(page.locator('#date-input')).toHaveValue('2024-02-30');
    await expect(page.locator('#time-error')).not.toBeEmpty();
    await expect(page.locator('#unix-input')).toBeEmpty();
    await expect(page.locator('#time-detected')).toBeEmpty();
    await page.locator('#date-input').fill('1970-01-01 02:00');
    await page.locator('#timezone').selectOption('local');
    await expect(page.locator('#date-input')).toHaveValue('1970-01-01 11:00:00');
    await expect(page.locator('#unix-input')).toHaveValue('7200');
    await expect(page.locator('#time-error')).toBeEmpty();
  });
  test('defaults to local seconds with an explicit zone and round-trips epoch', async ({ page }) => {
    await page.goto('/tools/unixtime.html');
    await expect(page.locator('#timezone')).toHaveValue('local');
    await expect(page.locator('#unix-unit, #output-unit')).toHaveCount(0);
    await page.locator('#unix-input').fill('0');
    await page.locator('#unix-to-date').click();
    await expect(page.locator('#date-input')).toHaveValue('1970-01-01 09:00:00');
    await expect(page.locator('#time-zone')).toContainText('Asia/Seoul · UTC+09:00');
    await expect(page.locator('#time-detected')).toContainText('1970-01-01 00:00:00 UTC');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#unix-input')).toHaveValue('0');
    await page.locator('#timezone').selectOption('utc');
    await expect(page.locator('#date-input')).toHaveValue('1970-01-01 00:00:00');
    await expect(page.locator('#time-zone')).toContainText('UTC · UTC+00:00');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#unix-input')).toHaveValue('0');
  });
});


test.describe('UTC browser timezone', () => {
  test.use({ timezoneId: 'UTC' });
  test('local mode uses the actual UTC browser zone', async ({ page }) => {
    await page.goto('/tools/unixtime.html');
    await page.locator('#unix-input').fill('0');
    await page.locator('#unix-to-date').click();
    await expect(page.locator('#date-input')).toHaveValue('1970-01-01 00:00:00');
    await expect(page.locator('#time-zone')).toContainText('UTC · UTC+00:00');
  });
});

test.describe('DST browser timezone', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('an unchanged generated DST overlap date preserves the original later instant', async ({ page }) => {
    await page.goto('/tools/unixtime.html');
    await page.locator('#date-input').fill('2024-11-03T06:30:00Z');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#unix-input')).toHaveValue('1730615400');
    await expect(page.locator('#date-input')).toHaveValue('2024-11-03 01:30:00');
    await expect(page.locator('#time-zone')).toContainText('UTC-05:00');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#unix-input')).toHaveValue('1730615400');
    await page.locator('#timezone').selectOption('utc');
    await expect(page.locator('#date-input')).toHaveValue('2024-11-03 06:30:00');
    await page.locator('#timezone').selectOption('local');
    await page.locator('#date-input').fill('2024-11-03 01:30');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#unix-input')).toHaveValue('1730611800');
  });
  test('rejects DST gaps and shows the represented dates seasonal offset', async ({ page }) => {
    await page.goto('/tools/unixtime.html');
    await page.locator('#date-input').fill('2024-03-10 02:30');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#time-error')).not.toBeEmpty();
    await expect(page.locator('#unix-input')).toBeEmpty();
    await page.locator('#date-input').fill('2024-01-01 00:00');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#time-zone')).toContainText('America/New_York · UTC-05:00');
    await page.locator('#date-input').fill('2024-07-01 00:00');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#time-zone')).toContainText('America/New_York · UTC-04:00');
    await page.locator('#date-input').fill('2024-11-03 01:30');
    await page.locator('#date-to-unix').click();
    await expect(page.locator('#unix-input')).toHaveValue('1730611800');
    await expect(page.locator('#time-zone')).toContainText('UTC-04:00');
  });
});
