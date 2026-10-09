import { expect, test } from '@playwright/test';
import { toolCatalog } from '../../src/data/tool-catalog';
test('homepage offers every catalog entry and its actual ItemList matches the visible tools', async ({ page }) => {
  await page.goto('/');
  for (const tool of toolCatalog) await expect(page.locator(`a.tool-card[href="${tool.href}"]`)).toHaveCount(1);
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '');
  const list = data['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'ItemList');
  expect(list.numberOfItems).toBe(toolCatalog.length);
  expect(list.itemListElement.map((item: {item: {url: string}}) => item.item.url)).toEqual(toolCatalog.map(tool => `https://mgk.kr${tool.href}`));
});
