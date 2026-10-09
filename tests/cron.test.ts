import { describe, expect, it, vi } from 'vitest';
import { CronExpressionParser } from 'cron-parser';
import { readFileSync } from 'node:fs';
import { explainCron } from '../src/lib/cron';

describe('cron explainer', () => {
  it('renders accessible Korean inputs, explanation, timezone and next instants', () => {
    const source = readFileSync(new URL('../src/pages/tools/cron-explainer.astro', import.meta.url), 'utf8');
    for (const id of ['cron-input', 'cron-timezone', 'cron-explain', 'cron-description', 'cron-next', 'cron-error', 'cron-reference']) expect(source).toContain(`id="${id}"`);
    expect(source).toContain('Asia/Seoul');
    expect(source).toContain('role="alert"');
    expect(source).toContain('explainCron');
  });
  it.each([
    ['0,30 8-10/2 * JUL WED', 'UTC', '2024-07-01T00:00:00Z', ['2024-07-03T08:00:00.000Z', '2024-07-03T08:30:00.000Z', '2024-07-03T10:00:00.000Z', '2024-07-03T10:30:00.000Z', '2024-07-10T08:00:00.000Z']],
    ['30 2 * * *', 'America/New_York', '2024-03-09T00:00:00Z', ['2024-03-09T07:30:00.000Z', '2024-03-10T07:30:00.000Z', '2024-03-11T06:30:00.000Z', '2024-03-12T06:30:00.000Z', '2024-03-13T06:30:00.000Z']],
    ['30 1 * * *', 'America/New_York', '2024-11-02T00:00:00Z', ['2024-11-02T05:30:00.000Z', '2024-11-03T05:30:00.000Z', '2024-11-04T06:30:00.000Z', '2024-11-05T06:30:00.000Z', '2024-11-06T06:30:00.000Z']],
    ['0 0 30 FEB MON', 'UTC', '2024-02-01T00:00:00Z', ['2024-02-05T00:00:00.000Z', '2024-02-12T00:00:00.000Z', '2024-02-19T00:00:00.000Z', '2024-02-26T00:00:00.000Z', '2025-02-03T00:00:00.000Z']],
  ])('matches fixed expectations and real parser for %s in %s', (expression, timezone, reference, expected) => {
    const result = explainCron(expression, timezone, reference);
    expect(result.next.map(item => item.iso)).toEqual(expected);
    expect(result.next.map(item => item.iso)).toEqual(CronExpressionParser.parse(expression, { tz: timezone, currentDate: reference }).take(5).map(date => date.toDate().toISOString()));
  });
  it('treats Sunday 0 and 7 as aliases', () => {
    const zero = explainCron('0 0 * * 0', 'UTC', '2024-01-01T00:00:00Z');
    expect(explainCron('0 0 * * 7', 'UTC', '2024-01-01T00:00:00Z').next).toEqual(zero.next);
    expect(zero.next[0].iso).toBe('2024-01-07T00:00:00.000Z');
  });
  it('accepts explicit offsets as instants, not timezone-local wall times', () => {
    expect(explainCron('0 9 * * *', 'UTC', '2024-01-01T09:00:00+09:00').next[0].iso).toBe('2024-01-01T09:00:00.000Z');
  });
  it('defaults to actual Date now on every calculation', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-01-01T00:00:30Z'));
      expect(explainCron('* * * * *', 'UTC').next[0].iso).toBe('2024-01-01T00:01:00.000Z');
      vi.setSystemTime(new Date('2024-01-01T00:02:30Z'));
      expect(explainCron('* * * * *', 'UTC', '').next[0].iso).toBe('2024-01-01T00:03:00.000Z');
    } finally { vi.useRealTimers(); }
  });
  it('finds leap day schedules with a bounded horizon', () => {
    expect(explainCron('0 0 29 FEB *', 'UTC', '2024-03-01T00:00:00Z').next.map(item => item.iso)).toEqual(['2028-02-29T00:00:00.000Z', '2032-02-29T00:00:00.000Z', '2036-02-29T00:00:00.000Z', '2040-02-29T00:00:00.000Z', '2044-02-29T00:00:00.000Z']);
  });
  it('uses traditional DOM OR DOW and states OR without conflicting AND prose', () => {
    const result = explainCron('0 0 13 * MON', 'UTC', '2024-02-01T00:00:00Z');
    expect(result.next.map(item => item.iso)).toEqual(['2024-02-05T00:00:00.000Z', '2024-02-12T00:00:00.000Z', '2024-02-13T00:00:00.000Z', '2024-02-19T00:00:00.000Z', '2024-02-26T00:00:00.000Z']);
    expect(result.description).toContain('또는');
    expect(result.description).not.toMatch(/그리고|동시에/);
  });
  it('rejects impossible multi-month schedules rather than silently returning fewer dates', () => {
    expect(() => explainCron('0 0 31 FEB,APR *', 'UTC', '2024-01-01T00:00:00Z')).toThrow(/5개|일정/);
  });
  it('rejects impossible February 30 quickly with a Korean schedule error', () => {
    expect(() => explainCron('0 0 30 FEB *', 'UTC', '2024-01-01T00:00:00Z')).toThrow(/실행|일정/);
  });
  it.each(['2024-01-01', '2024-01-01T00:00:00', '2024-02-30T00:00:00Z', '2024-01-01T24:00:00Z', '2024-01-01T00:00:00+25:00'])('rejects ambiguous or invalid reference %s', reference => {
    expect(() => explainCron('0 0 * * *', 'UTC', reference)).toThrow(/기준/);
  });
  it('rejects invalid timezone with a Korean error', () => {
    expect(() => explainCron('0 0 * * *', 'Not/AZone', '2024-01-01T00:00:00Z')).toThrow(/시간대/);
  });
  it.each(['', '* * * *', '0 * * * * *', '0 0 0 * * * 2024', '0 0 L * *', '0 0 1W * *', '0 0 * * 1#2', '0 0 ? * MON', 'H * * * *', '*/0 * * * *', '60 * * * *', '0 24 * * *', '0 0 0 * *', '0 0 * 13 *', '0 0 * * 8', '5-1 * * * *', '1,,2 * * * *', '*/61 * * * *'])('rejects unsupported or invalid expression %s', expression => {
    expect(() => explainCron(expression, 'UTC', '2024-01-01T00:00:00Z')).toThrow(/[가-힣]/);
  });
  it('explains weekdays in Korean and returns exact Seoul instants', () => {
    const result = explainCron('0 9 * * MON-FRI', 'Asia/Seoul', '2024-01-01T00:00:00Z');
    expect(result.description).toMatch(/[가-힣]/);
    expect(result.next.map(item => item.iso)).toEqual([
      '2024-01-02T00:00:00.000Z', '2024-01-03T00:00:00.000Z', '2024-01-04T00:00:00.000Z',
      '2024-01-05T00:00:00.000Z', '2024-01-08T00:00:00.000Z',
    ]);
    expect(result.next[0].local).toContain('09:00:00');
    expect(result.next[0].local).toContain('Asia/Seoul');
    expect(result.next[0].local).toContain('UTC+09:00');
  });
});
