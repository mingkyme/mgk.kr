import { beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
beforeAll(() => {
  const result = spawnSync('npm', ['run', 'build'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
}, 120_000);
describe('built SEO verifier detects damaged output', () => {
  it('accepts healthy output for the expanded tool catalog', () => {
    const result = spawnSync(process.execPath, [resolve('scripts/verify-output.mjs')], { encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('seo_routes=17 seo_errors=0');
  });
  for (const [name, file, damage] of [
    ['missing application schema', 'tools/base64.html', (s: string) => s.replaceAll('WebApplication', 'Thing')],
    ['indexable 404', '404.html', (s: string) => s.replace('content="noindex"', 'content="index"')],
    ['noindex tool', 'tools/sort.html', (s: string) => s.replace('</head>', '<meta name="robots" content="noindex"></head>')],
    ['wrong OG dimensions', 'tools/tsv-tool.html', (s: string) => s.replace('content="1200"', 'content="800"')],
    ['missing usage', 'tools/timer.html', (s: string) => s.replace('id="usage"', 'id="removed"')],
    ['missing demo', 'tools/large-pdf-to-divided-images.html', (s: string) => s.replaceAll('/demos/demo-poster.pdf', '/missing-demo.pdf')],
  ] as const) it(name, () => {
    const dir = mkdtempSync(join(tmpdir(), 'mgk-seo-'));
    try {
      cpSync(resolve('dist'), join(dir, 'dist'), { recursive: true });
      const target = join(dir, 'dist', file);
      writeFileSync(target, damage(readFileSync(target, 'utf8')));
      const result = spawnSync(process.execPath, [resolve('scripts/verify-output.mjs')], { cwd: dir, encoding: 'utf8' });
      expect(result.status, result.stdout + result.stderr).toBe(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
