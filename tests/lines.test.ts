import { describe, expect, it } from 'vitest';
import { deduplicateLines } from '../src/lib/lines';

describe('line deduplication', () => {
  it('preserves first occurrence and order, drops blanks, and reports accurate counts', () => {
    expect(deduplicateLines('alpha\n\nbeta\nalpha\n  \nbeta\ngamma\n')).toEqual({
      inputCount: 5,
      outputCount: 3,
      removedCount: 2,
      lines: ['alpha', 'beta', 'gamma'],
      text: 'alpha\nbeta\ngamma',
    });
  });

  it('returns zero counts for blank input', () => {
    expect(deduplicateLines('\n \n')).toMatchObject({ inputCount: 0, outputCount: 0, removedCount: 0 });
  });
});
