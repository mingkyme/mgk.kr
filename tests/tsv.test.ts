import { describe, expect, it } from 'vitest';
import { convertCaretTabs } from '../src/lib/tsv';

describe('TSV conversion', () => {
  it('converts cat -T caret tabs to tabs or line breaks without changing other text', () => {
    expect(convertCaretTabs('a^Ib\nc^Id')).toEqual({
      tabs: 'a\tb\nc\td',
      lineBreaks: 'a\nb\nc\nd',
    });
  });
});
