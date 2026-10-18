import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { guides } from '../src/data/tool-guides';
import { toolCatalog } from '../src/data/tool-catalog';
import { toolGroups } from '../src/data/site-seo';
it('registers sigh competition once with honest privacy and safety guidance', () => {
  const guide = Object.entries(guides).find(([key]) => key === 'sigh-meter')?.[1];
  expect(guide).toBeDefined();
  if (!guide) throw new Error('Missing sigh guide');
  expect(guide.title).toContain('한숨 측정기');
  expect(guide.useCases).toHaveLength(2);
  expect(guide.limits).toContain('의학');
  expect(guide.limits).toContain('말소리');
  expect(guide.limits).toContain('같은 기기');
  const entries = toolCatalog.filter(tool => (tool.key as string) === 'sigh-meter');
  expect(entries).toHaveLength(1);
  expect(entries[0].description).toBe(guide.description);
  expect(toolGroups.flatMap(group => [...group.tools]).filter(key => (key as string) === 'sigh-meter')).toHaveLength(1);
});
it('treats microphone content as private and documents the audio lifetime', () => {
  const base = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
  const policy = readFileSync('src/pages/privacy.astro', 'utf8');
  expect(base).toContain("'/tools/sigh-meter.html'");
  expect(policy).toContain('마이크');
  expect(policy).toContain('녹음 파일');
});
