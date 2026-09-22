import { describe, expect, it } from 'vitest';
import { parseDateInput, parseUnixInput, toUnix } from '../src/lib/time';

describe('time conversion utilities', () => {
  it('auto-detects Unix seconds and milliseconds', () => {
    expect(parseUnixInput('1704067200', 'auto')).toEqual({ milliseconds: 1704067200000, detectedUnit: 'seconds' });
    expect(parseUnixInput('1704067200000', 'auto')).toEqual({ milliseconds: 1704067200000, detectedUnit: 'milliseconds' });
  });

  it('honors explicitly selected units', () => {
    expect(parseUnixInput('1234', 'milliseconds').milliseconds).toBe(1234);
    expect(parseUnixInput('1234', 'seconds').milliseconds).toBe(1234000);
  });

  it('returns clear invalid-input errors instead of an invalid date', () => {
    expect(() => parseUnixInput('abc', 'auto')).toThrow(/숫자/);
    expect(() => parseDateInput('not-a-date')).toThrow(/날짜/);
  });

  it('accepts ISO date input and converts to either Unix unit', () => {
    const milliseconds = parseDateInput('2024-01-01T00:00:00.000Z');
    expect(milliseconds).toBe(1704067200000);
    expect(toUnix(milliseconds, 'seconds')).toBe(1704067200);
    expect(toUnix(milliseconds, 'milliseconds')).toBe(1704067200000);
  });
});
