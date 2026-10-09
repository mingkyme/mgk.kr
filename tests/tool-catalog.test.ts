import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { guides } from '../src/data/tool-guides';
const added = ['regex-tester', 'cron-explainer', 'qr-generator', 'uuid-generator', 'password-generator'];
describe('new utility guides', () => {
  it('shares a catalog for homepage, sitemap checks and every guide without omitting new tools', async () => {
    expect(existsSync(fileURLToPath(new URL('../src/data/tool-catalog.ts', import.meta.url)))).toBe(true);
    const { toolCatalog, toolSlugs } = await import('../src/data/tool-catalog');
    expect(toolCatalog).toHaveLength(Object.keys(guides).length);
    expect(new Set(toolSlugs).size).toBe(toolCatalog.length);
    expect([...toolSlugs].sort()).toEqual(Object.keys(guides).sort());
    for (const tool of toolCatalog) {
      expect(tool.href).toBe(`/tools/${tool.key}.html`);
      expect(tool.title && tool.description && tool.tag).toBeTruthy();
    }
  });
  it('provides the five requested tools with truthful static guides and valid related links', () => {
    for (const key of added) {
      expect(guides, key).toHaveProperty(key);
      const guide = guides[key as keyof typeof guides];
      expect(guide.title.length).toBeGreaterThan(0);
      expect(guide.description.length).toBeGreaterThan(0);
      expect(guide.steps.length).toBeGreaterThan(0);
      expect(guide.faq).toHaveLength(2);
      expect(guide.input && guide.output && guide.limits).toBeTruthy();
      expect(guide.related).not.toContain(key);
      for (const related of guide.related) expect(guides).toHaveProperty(related);
    }
  });
});
