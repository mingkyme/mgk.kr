export interface LineResult {
  inputCount: number;
  outputCount: number;
  removedCount: number;
  lines: string[];
  text: string;
}

export function nonBlankLines(input: string): string[] {
  return input.split(/\r?\n/).filter((line) => line.trim() !== '');
}

export function deduplicateLines(input: string): LineResult {
  const source = nonBlankLines(input);
  const lines = [...new Set(source)];
  return {
    inputCount: source.length,
    outputCount: lines.length,
    removedCount: source.length - lines.length,
    lines,
    text: lines.join('\n'),
  };
}

export function sortLines(input: string, direction: 'asc' | 'desc'): Omit<LineResult, 'removedCount'> {
  const lines = nonBlankLines(input);
  const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  lines.sort((a, b) => collator.compare(a, b) * (direction === 'asc' ? 1 : -1));
  return {
    inputCount: lines.length,
    outputCount: lines.length,
    lines,
    text: lines.join('\n'),
  };
}
