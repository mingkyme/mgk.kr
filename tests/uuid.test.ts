import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
it('uuid UI exposes manual generation and explicit download controls', () => {
  const source = readFileSync(new URL('../src/pages/tools/uuid-generator.astro', import.meta.url), 'utf8');
  expect(source).toContain('id="uuid-generate"');
  expect(source).toContain('id="uuid-error"');
  expect(source).toContain('pagehide');
});
import { validate, version } from 'uuid';
import { generateUuids } from '../src/lib/uuid';
it('validates bounds and fails closed without browser crypto', () => {
  for (const count of [0, 101, 1.5, NaN]) expect(() => generateUuids({ count })).toThrow(/1.*100/);
  expect(() => generateUuids({ version: 5 as never })).toThrow(/4.*7/);
  vi.stubGlobal('crypto', undefined);
  try { expect(() => generateUuids()).toThrow(/Crypto/); } finally { vi.unstubAllGlobals(); }
});
it('generates valid unique RFC variant v4 batches by default', () => {
  const values = generateUuids({ count: 100 });
  expect(values).toHaveLength(100);
  expect(new Set(values).size).toBe(100);
  expect(values.every(value => validate(value) && version(value) === 4 && /[89ab]/.test(value[19]!))).toBe(true);
});

it('generates unique v7 with current millisecond timestamp', () => {
  const before = Date.now();
  const values = generateUuids({ version: 7, count: 100 });
  const after = Date.now();
  expect(new Set(values).size).toBe(100);
  expect(values.every(value => { const time = Number.parseInt(value.replaceAll('-', '').slice(0, 12), 16); return validate(value) && version(value) === 7 && time >= before && time <= after; })).toBe(true);
});
