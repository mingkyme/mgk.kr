import { expect, test } from '@playwright/test';
const tools = ['base64', 'large-pdf-to-divided-images', 'remove-duplication', 'securecrt-config-maker', 'sort', 'ssl-checker', 'timer', 'tsv-tool', 'unixtime'];
test('Korean homepage describes the available developer utilities', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/무료 개발자 도구/);
  await expect(page.locator('h1')).toContainText('개발자');
});
test('every tool supplies static usage, examples, limits, FAQs and relevant navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tool of tools) {
    await page.goto(`/tools/${tool}.html`);
    for (const id of ['usage', 'examples', 'limitations', 'faq', 'related-tools']) await expect(page.locator(`#${id}`)).toBeVisible();
    for (const example of await page.locator('#examples pre').all()) await expect(example).not.toBeEmpty();
    await expect(page.locator('#faq h3')).toHaveCount(2);
    const links = await page.locator('#related-tools a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links).not.toContain(`/tools/${tool}.html`);
    const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '');
    expect(data['@graph'][0]['@type']).toBe('WebApplication');
    expect(data['@graph'][0].offers.price).toBe('0');
    expect(data['@graph'][1]['@type']).toBe('BreadcrumbList');
    await expect(page.getByRole('navigation', { name: '현재 위치' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test('all routes share large local PNG cards and only 404 is noindex', async ({ page, request }) => {
  for (const path of ['/', ...tools.map(tool => `/tools/${tool}.html`), '/privacy.html', '/404.html']) {
    await page.goto(path);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /.+/);
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/^https:\/\/mgk.kr\/og\/.+\.png$/);
    const response = await request.get(new URL(image!).pathname);
    expect(response.ok()).toBe(true);
    const bytes = await response.body();
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
    if (path === '/404.html') await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    else await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  }
});
