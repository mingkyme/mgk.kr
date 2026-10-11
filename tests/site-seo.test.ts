import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { toolSlugs } from '../src/data/tool-catalog';
import { guides } from '../src/data/tool-guides';
it('share-card titles use the same homepage and tool titles as search metadata', async () => {
  expect(existsSync(fileURLToPath(new URL('../src/data/social-titles.ts', import.meta.url)))).toBe(true);
  const { socialTitles } = await import('../src/data/social-titles');
  const { homeSeo } = await import('../src/data/site-seo');
  expect(socialTitles.index).toBe(homeSeo.title);
  expect(Object.keys(socialTitles).length).toBe(toolSlugs.length + 3);
  for (const key of toolSlugs) expect(socialTitles[key]).toBe(guides[key].title);
});
it('has shared homepage metadata and static task groups covering every tool once', async () => {
  expect(existsSync(fileURLToPath(new URL('../src/data/site-seo.ts', import.meta.url)))).toBe(true);
  const { homeSeo, toolGroups } = await import('../src/data/site-seo');
  const keys = toolGroups.flatMap(group => [...group.tools]);
  expect([...keys].sort()).toEqual([...toolSlugs].sort());
  expect(new Set(keys).size).toBe(keys.length);
  expect(new Set(toolGroups.map(group => group.id)).size).toBe(toolGroups.length);
  expect(homeSeo.title).toContain('무료 개발자 도구');
  expect(homeSeo.description).toContain('가입 없이');
  expect(homeSeo.description).toContain('브라우저');
  expect(homeSeo.h1).toBe('무료 개발자 도구 모음');
});
