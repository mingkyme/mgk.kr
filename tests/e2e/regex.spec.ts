import { expect, test, type Page } from '@playwright/test';

async function setRequest(page: Page, pattern: string, input: string, replacement = '', flags = 'g') {
  await page.locator('#regex-pattern').fill(pattern);
  await page.locator('#regex-flags').fill(flags);
  await page.locator('#regex-input').fill(input);
  await page.locator('#regex-replacement').fill(replacement);
  await page.locator('#regex-run').click();
}

test.beforeEach(async ({ page }) => { await page.goto('/tools/regex-tester.html'); });

test('matches show UTF-16 offsets, indexed and named captures, and replacement output', async ({ page }) => {
  await setRequest(page, '(?<word>[a-z]+)-(\\d+)', '😀 ab-12 cd-3', '$<word>:$2');
  await expect(page.locator('#regex-status')).toContainText('2개 일치');
  await expect(page.locator('#regex-error')).toBeEmpty();
  await expect(page.locator('#regex-matches')).toContainText('[3, 8)');
  await expect(page.locator('#regex-matches')).toContainText('$1 = "ab"');
  await expect(page.locator('#regex-matches')).toContainText('$2 = "12"');
  await expect(page.locator('#regex-matches')).toContainText('$<word> = "ab"');
  await expect(page.locator('#regex-output')).toHaveValue('😀 ab:12 cd:3');
  await page.locator('#regex-example').click();
  await expect(page.locator('#regex-output')).toHaveValue('apple:12 banana:3');
});

test('invalid syntax and flags recover on the next run', async ({ page }) => {
  await setRequest(page, '[', 'abc');
  await expect(page.locator('#regex-error')).toContainText('정규식 실행 오류');
  await setRequest(page, 'a', 'abc', 'A', 'gg');
  await expect(page.locator('#regex-error')).toContainText('중복 플래그');
  await setRequest(page, 'a', 'abc', 'A');
  await expect(page.locator('#regex-output')).toHaveValue('Abc');
  await expect(page.locator('#regex-error')).toBeEmpty();
});

test('catastrophic backtracking times out off-thread and a subsequent job succeeds', async ({ page }) => {
  await setRequest(page, '(a+)+$', 'a'.repeat(80) + '!', '', '');
  // A main-thread heartbeat must remain responsive while the worker is busy.
  await expect.poll(() => page.evaluate(() => new Promise<number>(resolve => setTimeout(() => resolve(1), 20)))) .toBe(1);
  await expect(page.locator('#regex-error')).toContainText('시간 제한', { timeout: 6000 });
  await setRequest(page, 'a+', 'aaa', 'OK');
  await expect(page.locator('#regex-output')).toHaveValue('OK');
  await expect(page.locator('#regex-error')).toBeEmpty();
});

test('new run cancels a dangerous job and cannot be overwritten by stale results', async ({ page }) => {
  await setRequest(page, '(a+)+$', 'a'.repeat(80) + '!', '', '');
  await setRequest(page, 'b', 'b', 'recovered');
  await expect(page.locator('#regex-output')).toHaveValue('recovered');
  await page.waitForTimeout(1200);
  await expect(page.locator('#regex-output')).toHaveValue('recovered');
  await expect(page.locator('#regex-error')).toBeEmpty();
});

test('input HTML is only literal text and never executable nodes', async ({ page }) => {
  const input = '<img src=x onerror="window.__regexXss=1"><script>window.__regexXss=2</script>';
  await setRequest(page, '.+', input, '$&');
  await expect(page.locator('#regex-output')).toHaveValue(input);
  await expect(page.locator('#regex-highlight')).toHaveText(input);
  await expect(page.locator('#regex-highlight img, #regex-highlight script, #regex-matches img, #regex-matches script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__regexXss)).toBeUndefined();
});

test('zero-length Unicode global matches advance and mobile has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setRequest(page, '(?:)', '😀x', '-', 'gu');
  await expect(page.locator('#regex-status')).toContainText('3개 일치');
  await expect(page.locator('#regex-output')).toHaveValue('-😀-x-');
  await setRequest(page, '(?<word>.+)', 'x'.repeat(3000), '$<word>');
  await expect(page.locator('#regex-status')).toContainText('제한');
  const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
});
