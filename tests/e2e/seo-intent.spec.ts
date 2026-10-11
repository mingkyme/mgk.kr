import { expect, test } from '@playwright/test';
import { homeSeo, toolGroups } from '../../src/data/site-seo';
import { toolSlugs } from '../../src/data/tool-catalog';
import { guides } from '../../src/data/tool-guides';

test('homepage task groups and honest benefits are crawlable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveTitle(`${homeSeo.title} · mgk.kr`);
    await expect(page.locator('h1')).toHaveText(homeSeo.h1);
    await expect(page.locator('.hero .lede')).toHaveText(homeSeo.description);
    await expect(page.getByRole('navigation', { name: '도구 종류' }).locator('a')).toHaveCount(toolGroups.length);
    for (const group of toolGroups) {
      await expect(page.locator(`#${group.id} h2`)).toHaveText(group.title);
      await expect(page.locator(`#${group.id} a.tool-card`)).toHaveCount(group.tools.length);
    }
    const hrefs = await page.locator('a.tool-card[href^="/tools/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    expect(hrefs).toEqual(toolGroups.flatMap(group => group.tools.map(key => `/tools/${key}.html`)));
    expect(hrefs).toHaveLength(toolSlugs.length);
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || '{}');
    expect(schema['@graph'][0].name).toBe('mgk.kr');
    expect(schema['@graph'][0].description).toBe(homeSeo.description);
    expect(schema['@graph'][1].itemListElement.map((node: {item: {url: string}}) => node.item.url)).toEqual(hrefs.map(href => `https://mgk.kr${href}`));
  } finally { await context.close(); }
});

test('every tool exposes truthful static use cases, guide links and clean snippet chrome at 320px', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  try {
    const page = await context.newPage();
    for (const key of toolSlugs) {
      await page.goto(`/tools/${key}.html`);
      const guide = guides[key];
      await expect(page.locator('h1')).toHaveText(guide.title);
      await expect(page.locator('.tool-hero .lede')).toHaveText(guide.description);
      await expect(page.locator('#use-cases li')).toHaveText([...guide.useCases]);
      const nav = page.getByRole('navigation', { name: '도구 안내' });
      for (const target of ['use-cases', 'usage', 'examples', 'faq']) {
        await expect(nav.locator(`a[href="#${target}"]`)).toHaveCount(1);
        await expect(page.locator(`#${target}`)).toBeVisible();
      }
      await expect(page.locator('#cookie-banner')).toHaveAttribute('data-nosnippet', '');
      await expect(page.locator('footer.site-footer > div.footer-inner')).toHaveAttribute('data-nosnippet', '');
      await expect(page.locator('footer.site-footer')).not.toHaveAttribute('data-nosnippet');
      await expect(page.locator('[data-nosnippet]')).toHaveCount(2);
      await expect(page.locator('[data-nosnippet]:not(#cookie-banner):not(footer.site-footer > div.footer-inner)')).toHaveCount(0);
      const snippetTagNames = await page.locator('[data-nosnippet]').evaluateAll(nodes => nodes.map(node => node.tagName));
      for (const tagName of snippetTagNames) {
        expect(['SPAN', 'DIV', 'SECTION']).toContain(tagName);
      }
      await expect(nav).not.toHaveAttribute('data-nosnippet', '');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  } finally { await context.close(); }
});
