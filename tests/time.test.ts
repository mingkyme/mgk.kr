import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const originalTimezone = process.env.TZ;
beforeEach(() => { process.env.TZ = 'Asia/Seoul'; });
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});
import { parseDateInput, parseUnixInput, toUnix, formatDate } from '../src/lib/time';

describe('selected timezone date input', () => {
  it('rejects explicit offsets that move the represented instant outside the supported years', () => {
    expect(() => parseDateInput('0001-01-01T00:00:00+09:00', 'utc')).toThrow();
    expect(() => parseDateInput('9999-12-31T23:59:59-01:00', 'local')).toThrow();
  });
  it('rejects calendar rollover and nonexistent DST wall times', () => {
    for (const input of ['2024-02-30', '2023-02-29', '0000-01-01', '10000-01-01', '2024-13-01', '2024-01-00', '2024-01-01 24:00', '2024-01-01 00:60', '2024-01-01 00:00:60', '2024-01-01T00:00:00.000Z', '01/02/2024', '2024-01-01T00:00+24:00', '2024-01-01T00:00+09:60']) {
      expect(() => parseDateInput(input, 'utc'), input).toThrow();
    }
    expect(parseDateInput('0001-01-01', 'utc')).toBe(-62135596800000);
    expect(parseDateInput('2024-02-29', 'utc')).toBe(1709164800000);
    process.env.TZ = 'America/New_York';
    expect(() => parseDateInput('2024-03-10 02:30', 'local')).toThrow();
    expect(parseDateInput('2024-03-10T02:30:00-05:00', 'local')).toBe(1710055800000);
  });
  it('interprets convenient wall clock and date-only input in the selected mode', () => {
    expect(parseDateInput('1970-01-01 09:00:00', 'local')).toBe(0);
    expect(parseDateInput('1970-01-01T09:00', 'local')).toBe(0);
    expect(parseDateInput('1970-01-01 00:00:00', 'utc')).toBe(0);
    expect(parseDateInput('1970-01-01', 'utc')).toBe(0);
    expect(parseDateInput('1970-01-01', 'local')).toBe(-32400000);
    expect(parseDateInput('1970-01-01T09:00:00+09:00', 'utc')).toBe(0);
    expect(parseDateInput('1970-01-01T00:00:00Z', 'local')).toBe(0);
  });
});

describe('second-precision wall clock output', () => {
  it('formats editable dates without fractions or implicit offsets', () => {
    expect(formatDate(0, 'local')).toBe('1970-01-01 09:00:00');
    expect(formatDate(0, 'utc')).toBe('1970-01-01 00:00:00');
    expect(formatDate(-62135596800000, 'utc')).toBe('0001-01-01 00:00:00');
    expect(formatDate(253402300799000, 'utc')).toBe('9999-12-31 23:59:59');
    for (const milliseconds of [NaN, -62135596801000, 253402300800000]) {
      expect(() => formatDate(milliseconds, 'utc')).toThrow();
    }
    expect(() => formatDate(253402300799000, 'local')).toThrow();
    expect(() => parseUnixInput('253402300800')).toThrow();
  });
});

describe('integer Unix seconds', () => {
  it('uses seconds only and rejects fractional input', () => {
    expect(parseUnixInput('1704067200')).toEqual({ milliseconds: 1704067200000 });
    expect(toUnix(1704067200999)).toBe(1704067200);
    expect(toUnix(-1)).toBe(-1);
    for (const input of ['1.5', '1.0', 'abc', '', '1e3']) {
      expect(() => parseUnixInput(input)).toThrow();
    }
  });
});
