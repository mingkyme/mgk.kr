import { describe, expect, it } from 'vitest';
import { sortLines } from '../src/lib/lines';

describe('line sorting', () => {
  it('removes blanks and performs Korean locale/numeric ascending sorting', () => {
    expect(sortLines('항목10\n\n가나다\n항목2\n나무\n', 'asc')).toEqual({
      inputCount: 4,
      outputCount: 4,
      lines: ['가나다', '나무', '항목2', '항목10'],
      text: '가나다\n나무\n항목2\n항목10',
    });
  });

  it('supports descending order', () => {
    expect(sortLines('item2\nitem10\nitem1', 'desc').lines).toEqual(['item10', 'item2', 'item1']);
  });
});
