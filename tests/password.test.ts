import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
it('password UI exposes manual generation and explicit download controls', () => {
  const source = readFileSync(new URL('../src/pages/tools/password-generator.astro', import.meta.url), 'utf8');
  expect(source).toContain('id="password-generate"');
  expect(source).toContain('id="password-error"');
  expect(source).toContain('pagehide');
});
import { generatePasswords, uniformIndex, type PasswordOptions, type PasswordCategory, type RandomFill } from '../src/lib/password';
// Synthetic deterministic stream only: never generate actual secrets in tests.
function syntheticStream(): RandomFill {
  let state = 123456;
  return buffer => { for (let i = 0; i < buffer.length; i++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; buffer[i] = state; } };
}
function syntheticWideStream(): RandomFill {
  // Mix all word bits; the legacy LCG's alternating low bit can lock multiword
  // rejection into one parity when each draw consumes an even number of words.
  let state = 0x12345678;
  return buffer => {
    for (let i = 0; i < buffer.length; i++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      buffer[i] = state >>> 0;
    }
  };
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
it('honors exact category counts in synthetic batches', () => {
  const ranges: Partial<Record<PasswordCategory, { min?: number; max?: number }>> = {
    uppercase: { min: 2, max: 2 }, lowercase: { min: 3, max: 3 },
    digits: { min: 2, max: 2 }, symbols: { min: 1, max: 1 },
  };
  const values = generatePasswords({ length: 8, count: 20, ranges }, syntheticStream());
  expect(values.every(value => categoryCounts(value).join(',') === '2,3,2,1')).toBe(true);
});
function categoryCounts(value: string): number[] {
  return [/[A-Z]/g, /[a-z]/g, /[0-9]/g, /[^A-Za-z0-9]/g].map(pattern => (value.match(pattern) ?? []).length);
}
it('rejects malformed or infeasible selected ranges before entropy', () => {
  const forbidden = vi.fn<RandomFill>(() => { throw new Error('entropy touched'); });
  const invalid: PasswordOptions[] = [];
  for (const bound of [-1, 129, NaN, Infinity, 1.5]) {
    invalid.push({ ranges: { uppercase: { min: bound } } }, { ranges: { uppercase: { max: bound } } });
  }
  invalid.push(
    { length: 8, ranges: { uppercase: { min: 9 } } },
    { length: 8, ranges: { uppercase: { min: 12, max: 10 } } },
    { length: 8, ranges: { uppercase: { min: 5 }, lowercase: { min: 4 } } },
    { length: 8, ranges: { uppercase: { max: 1 }, lowercase: { max: 1 }, digits: { max: 1 }, symbols: { max: 1 } } },
    { ranges: { uppercase: { max: 0 } } },
    { requireEach: false, ranges: { uppercase: { max: 0 }, lowercase: { max: 0 }, digits: { max: 0 }, symbols: { max: 0 } } },
    // Empty form fields are omitted by the UI, not coerced by the library.
    { ranges: { uppercase: { max: '' as unknown as number } } },
  );
  for (const options of invalid) expect(() => generatePasswords(options, forbidden)).toThrow(/[가-힣]/);
  expect(forbidden).not.toHaveBeenCalled();
});
it('covers varied feasible ranges and omitted bounds in synthetic batches', () => {
  const keys: PasswordCategory[] = ['uppercase', 'lowercase', 'digits', 'symbols'];
  const cases: PasswordOptions[] = [
    { length: 17, count: 100, ranges: { uppercase: { min: 2, max: 5 }, lowercase: { min: 3, max: 7 }, digits: { min: 4, max: 6 }, symbols: { min: 1, max: 4 } } },
    { length: 8, count: 30, ranges: {} },
    { length: 8, count: 30, requireEach: false, ranges: { uppercase: { max: 0 }, lowercase: { max: 0 }, digits: { min: 8 }, symbols: { max: 0 } } },
    { length: 8, count: 30, ranges: { uppercase: { min: 0, max: 128 }, digits: { min: 3 } } },
    { length: 128, count: 100, ranges: {} },
    { length: 128, count: 100, ranges: { uppercase: { min: 32, max: 32 }, lowercase: { min: 32, max: 32 }, digits: { min: 32, max: 32 }, symbols: { min: 32, max: 32 } } },
  ];
  for (const options of cases) {
    let calls = 0;
    const stream = syntheticWideStream();
    const values = generatePasswords(options, buffer => {
      if (++calls > 100000) throw new Error(`Synthetic entropy budget exceeded in case ${cases.indexOf(options)}`);
      stream(buffer);
    });
    expect(values).toHaveLength(options.count!);
    expect(values.every(value => value.length === options.length && categoryCounts(value).every((n, i) => {
      const range = options.ranges?.[keys[i]!];
      return n >= Math.max(options.requireEach === false ? 0 : 1, range?.min ?? 0) && n <= Math.min(options.length!, range?.max ?? options.length!);
    }))).toBe(true);
  }
});
it('ignores saved invalid ranges on disabled categories and excludes similar glyphs', () => {
  const values = generatePasswords({
    length: 128, count: 100, uppercase: false, lowercase: false, symbols: false, excludeSimilar: true,
    ranges: { uppercase: { min: NaN, max: -1 }, lowercase: { min: 129 }, symbols: { max: 0.5 }, digits: { min: 128, max: 128 } },
  }, syntheticWideStream());
  expect(values.length === 100 && values.every(value => /^[2-9]{128}$/.test(value))).toBe(true);
  const mixed = generatePasswords({ length: 64, count: 100, excludeSimilar: true, ranges: {} }, syntheticWideStream());
  expect(mixed.every(value => !/[Il1O0o|`'\"]/.test(value) && categoryCounts(value).every(n => n >= 1))).toBe(true);
});
it('efficiently handles rare exact 127 digit plus one letter constraints at batch limits', () => {
  let calls = 0;
  const stream = syntheticWideStream();
  const start = performance.now();
  const values = generatePasswords({
    length: 128, count: 100, lowercase: false, symbols: false,
    ranges: { uppercase: { min: 1, max: 1 }, digits: { min: 127, max: 127 } },
  }, buffer => { calls++; stream(buffer); });
  const elapsed = performance.now() - start;
  expect(values.length === 100 && values.every(value => value.length === 128 && categoryCounts(value).join(',') === '1,0,127,0')).toBe(true);
  expect(calls).toBeLessThan(100000);
  expect(elapsed).toBeLessThan(2000);
});
it('weights count allocations by arrangements and pool sizes with multiword rejection', () => {
  const boundary = 8n * 26n ** 7n * 10n;
  const total = boundary + 26n ** 8n;
  for (const ticket of [boundary - 1n, boundary]) {
    let calls = 0;
    const fill: RandomFill = buffer => {
      const value = calls === 0 ? total : calls === 1 ? ticket : 0n;
      if (calls < 2) expect(buffer.length).toBeGreaterThan(1);
      for (let i = buffer.length - 1, rest = value; i >= 0; i--, rest >>= 32n) buffer[i] = Number(rest & 0xffffffffn);
      calls++;
    };
    const values = generatePasswords({ length: 8, lowercase: false, symbols: false, requireEach: false, ranges: { uppercase: { min: 7, max: 8 } } }, fill);
    expect(categoryCounts(values[0]!)[0] === (ticket < boundary ? 7 : 8)).toBe(true);
    expect(calls).toBe(18); // rejected allocation + two accepted allocations + eight characters + seven swaps
  }
});
it('constrained sampling fails closed without crypto, including degenerate index bounds', () => {
  vi.stubGlobal('crypto', undefined);
  const fallback = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('fallback called'); });
  try {
    expect(() => generatePasswords({ ranges: {} })).toThrow(/Crypto/);
    expect(() => uniformIndex(1)).toThrow(/Crypto/);
    expect(fallback).not.toHaveBeenCalled();
  } finally { fallback.mockRestore(); vi.unstubAllGlobals(); }
});
it('uses rejection sampling rather than biased modulo reduction', () => {
  const stream = [0xffffffff, 5];
  let calls = 0;
  expect(uniformIndex(10, buffer => { buffer[0] = stream[calls++]!; })).toBe(5);
  expect(calls).toBe(2);
});
