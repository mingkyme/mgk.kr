import { expect, test } from '@playwright/test';

const paths = [
  '/',
  '/tools/securecrt-config-maker.html',
  '/tools/ssl-checker.html',
  '/tools/remove-duplication.html',
  '/tools/sort.html',
  '/tools/unixtime.html',
  '/tools/large-pdf-to-divided-images.html',
  '/tools/tsv-tool.html',
  '/tools/base64.html',
  '/tools/timer.html',
  '/privacy.html',
];

test('all public pages have landmarks and unique SEO metadata', async ({ page }) => {
  const titles = new Set<string>();
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.ok(), path).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://mgk.kr${path}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
    titles.add(await page.title());
  }
  expect(titles.size).toBe(paths.length);
});

test('homepage has trusted structured data and keeps analytics off until consent', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '');
  expect(data['@graph'][0]['@type']).toBe('WebSite');
  expect(data['@graph'][1]['@type']).toBe('ItemList');
  await page.getByRole('button', { name: '동의' }).click();
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(1);
  await page.getByRole('button', { name: '쿠키 설정 초기화' }).click();
  await expect(page.getByRole('dialog', { name: '분석 쿠키 설정' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['ga-disable-G-3XBQJZ5SYY'])).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { dataLayer: Array<[string, string, Record<string, string>]> }).dataLayer.filter((entry) => entry[0] === 'consent').at(-1)?.[2]?.analytics_storage)).toBe('denied');
  await page.getByRole('button', { name: '동의' }).click();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['ga-disable-G-3XBQJZ5SYY'])).toBe(false);
  expect(await page.evaluate(() => (window as unknown as { dataLayer: Array<[string, string, Record<string, string>]> }).dataLayer.filter((entry) => entry[0] === 'consent').at(-1)?.[2]?.analytics_storage)).toBe('granted');
});

test('mobile homepage is single-column without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    columns: getComputedStyle(document.querySelector('.grid')!).gridTemplateColumns.split(' ').length,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.columns).toBe(1);
  for (const card of await page.locator('.tool-card').all()) {
    expect((await card.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('SecureCRT flow handles trailing blanks and XML escaping', async ({ page }) => {
  await page.goto('/tools/securecrt-config-maker.html');
  await page.locator('#securecrt-input').fill('R&D,host-one.example\n');
  await page.locator('#securecrt-username').fill("o'hara&admin");
  await page.getByRole('button', { name: 'XML 생성' }).click();
  await expect(page.locator('#securecrt-output')).toHaveValue(/R&amp;D/);
  await expect(page.locator('#securecrt-output')).toHaveValue(/host-one\.example/);
  await expect(page.locator('#securecrt-error')).toBeEmpty();
});

test('SSL, dedupe, sort, Base64, and Unix regressions work in built pages', async ({ page }) => {
  await page.goto('/tools/ssl-checker.html');
  await page.locator('#ssl-endpoints').fill('1.1.1.1\n');
  await page.locator('#ssl-domains').fill('example.com\n\n');
  await page.getByRole('button', { name: '명령어 생성' }).click();
  await expect(page.locator('#ssl-expiry')).toHaveValue(/-servername 'example\.com'/);
  await expect(page.locator('#ssl-error')).toBeEmpty();

  await page.goto('/tools/remove-duplication.html');
  await page.locator('#dedupe-input').fill('a\n\nb\na\n');
  await page.getByRole('button', { name: '중복 제거' }).click();
  await expect(page.locator('#dedupe-output')).toHaveValue('a\nb');
  await expect(page.locator('#dedupe-stats')).toContainText('입력 3 · 출력 2 · 제거 1');

  await page.goto('/tools/sort.html');
  await page.locator('#sort-input').fill('항목10\n\n항목2');
  await page.getByRole('button', { name: '오름차순' }).click();
  await expect(page.locator('#sort-output')).toHaveValue('항목2\n항목10');

  await page.goto('/tools/base64.html');
  await page.locator('#base64-input').fill('안녕하세요 👋');
  await expect(page.locator('#base64-output')).not.toHaveValue('');
  const encoded = await page.locator('#base64-output').inputValue();
  await page.getByRole('button', { name: '디코드 모드' }).click();
  await page.locator('#base64-input').fill(encoded);
  await expect(page.locator('#base64-output')).toHaveValue('안녕하세요 👋');

  await page.goto('/tools/unixtime.html');
  await page.locator('#unix-input').fill('invalid');
  await page.getByRole('button', { name: 'Unix → 날짜' }).click();
  await expect(page.locator('#time-error')).toContainText('숫자');
});
