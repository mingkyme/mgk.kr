import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
it('password UI exposes manual generation and explicit download controls', () => {
  const source = readFileSync(new URL('../src/pages/tools/password-generator.astro', import.meta.url), 'utf8');
  expect(source).toContain('id="password-generate"');
  expect(source).toContain('id="password-error"');
  expect(source).toContain('pagehide');
});
import { generatePasswords, uniformIndex, type RandomFill } from '../src/lib/password';
// Synthetic deterministic stream only: never generate actual secrets in tests.
function syntheticStream(): RandomFill {
  let state = 123456;
  return buffer => { for (let i = 0; i < buffer.length; i++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; buffer[i] = state; } };
}
it('generates defaults with all selected categories using synthetic entropy', () => {
  const result = generatePasswords({}, syntheticStream());
  expect(result).toHaveLength(1);
  expect(result.every(value => value.length === 20 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value))).toBe(true);
});
it('rejects invalid options before touching entropy', () => {
  const forbidden: RandomFill = () => { throw new Error('entropy touched'); };
  for (const length of [7, 129, NaN, 8.5]) expect(() => generatePasswords({ length }, forbidden)).toThrow(/8.*128/);
  for (const count of [0, 101, NaN, 1.5]) expect(() => generatePasswords({ count }, forbidden)).toThrow(/1.*100/);
  expect(() => generatePasswords({ uppercase: false, lowercase: false, digits: false, symbols: false }, forbidden)).toThrow(/종류/);
});
it('excludes ambiguous glyphs and honors single-category batches', () => {
  const result = generatePasswords({ length: 128, count: 100, uppercase: false, lowercase: false, symbols: false, excludeSimilar: true }, syntheticStream());
  expect(result.length === 100 && result.every(value => /^[2-9]{128}$/.test(value))).toBe(true);
});
it('fails closed without Web Crypto, never calling a random fallback', () => {
  vi.stubGlobal('crypto', undefined);
  try { expect(() => generatePasswords()).toThrow(/Crypto/); } finally { vi.unstubAllGlobals(); }
});
it('rejects entire candidates that miss required categories without fixed positions', () => {
  let calls = 0;
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
  const candidate = 'aA2!aaaa';
  const fill: RandomFill = buffer => { buffer[0] = calls++ < 8 ? 0 : pool.indexOf(candidate[(calls - 9) % 8]!); };
  const values = generatePasswords({ length: 8 }, fill);
  expect(values.every(value => value === candidate)).toBe(true);
  expect(calls).toBe(16);
});
it('uses rejection sampling rather than biased modulo reduction', () => {
  const stream = [0xffffffff, 5];
  let calls = 0;
  expect(uniformIndex(10, buffer => { buffer[0] = stream[calls++]!; })).toBe(5);
  expect(calls).toBe(2);
});
