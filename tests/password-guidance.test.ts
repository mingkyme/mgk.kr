import { expect, it } from 'vitest';
import { guides } from '../src/data/tool-guides';
import { toolCatalog } from '../src/data/tool-catalog';
it('password guidance describes ranges, visibility defaults and the require-each rule', () => {
  const guide = guides['password-generator'];
  expect(guide.description).toContain('최소·최대');
  expect(guide.steps.join(' ')).toContain('기본');
  expect(guide.steps.join(' ')).toContain('표시');
  expect(guide.limits).toContain('최대');
  expect(guide.limits).toContain('최소 1개');
  expect(toolCatalog.find(tool => tool.key === 'password-generator')?.description).toBe(guide.description);
});
