import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { executeRegex } from '../src/lib/regex';

describe('regex worker engine', () => {
  it('preserves native substitution semantics during bounded-output refactoring', () => {
    const cases = [
      { pattern: '(?<name>a)(b)?', flags: 'g', input: 'a ab', replacement: "[$$][$&][$`][$'][$1][$2][$01][$12][$99][$<name>][$<missing>]" },
      { pattern: '(a)', flags: '', input: 'ba', replacement: '$<missing>:$0:$01:$10:$99' },
      { pattern: '(?:)', flags: 'gu', input: '😀x', replacement: '$`/$&/$\'' },
      { pattern: 'a', flags: 'y', input: 'ba', replacement: 'b' },
      { pattern: 'A.', flags: 'is', input: 'a\nx', replacement: 'OK' },
    ];
    for (const request of cases) expect(executeRegex(request).output).toBe(request.input.replace(new RegExp(request.pattern, request.flags), request.replacement));
  });
  it('wires the Korean UI to a public compiled worker and literal DOM rendering', () => {
    const source = readFileSync(new URL('../src/pages/tools/regex-tester.astro', import.meta.url), 'utf8');
    for (const id of ['pattern', 'flags', 'input', 'replacement', 'run', 'status', 'error', 'matches', 'output']) expect(source).toContain(`id="regex-${id}"`);
    expect(source).toContain("new Worker(new URL('../../workers/regex.ts', import.meta.url)");
    expect(source).toContain('createDocumentFragment');
    expect(source).toContain('textContent');
    expect(source).not.toContain('innerHTML');
    expect(source).not.toContain('executeRegex(');
    expect(source).toContain('100,000');
  });
  it('worker replies with the job ID and contains syntax errors without losing recovery', async () => {
    const replies: any[] = [];
    const scope: { onmessage?: (event: any) => void; postMessage: (value: any) => void } = { postMessage: value => replies.push(value) };
    vi.stubGlobal('self', scope);
    try {
      await import('../src/workers/regex');
      scope.onmessage!({ data: { id: 42, request: { pattern: '[', flags: 'g', input: 'a', replacement: 'b' } } });
      expect(replies[0]).toMatchObject({ id: 42, ok: false });
      scope.onmessage!({ data: { id: 43, request: { pattern: 'a', flags: 'g', input: 'a', replacement: 'b' } } });
      expect(replies[1]).toMatchObject({ id: 43, ok: true, result: { output: 'b' } });
    } finally { vi.unstubAllGlobals(); }
  });
  it('splits highlighting into literal text segments without interpreting HTML', async () => {
    const engine = await import('../src/lib/regex');
    expect(typeof engine.highlightSegments).toBe('function');
    if (!engine.highlightSegments) return;
    const input = '<img src=x onerror=alert(1)> OK';
    const match = { text: 'OK', start: input.indexOf('OK'), end: input.length, captures: [], groups: {} };
    expect(engine.highlightSegments(input, [match])).toEqual([
      { text: '<img src=x onerror=alert(1)> ', matched: false }, { text: 'OK', matched: true },
    ]);
    expect(engine.highlightSegments('x', [{ ...match, start: 0, end: 0, text: '' }])).toEqual([
      { text: '', matched: true }, { text: 'x', matched: false },
    ]);
  });
  it('terminates previous runs and ignores stale, mismatched and cancelled messages', async () => {
    const { createRegexRunner } = await import('../src/lib/regex');
    const workers: any[] = [], results: any[] = [];
    const runner = createRegexRunner(() => {
      const worker = { onmessage: null, onerror: null, terminate: vi.fn(), postMessage: vi.fn() };
      workers.push(worker); return worker;
    }, result => results.push(result));
    const request = { pattern: 'a', flags: 'g', input: 'a', replacement: 'b' };
    runner.run(request);
    const oldHandler = workers[0].onmessage;
    runner.run(request);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    oldHandler({ data: { id: 1, ok: true, result: executeRegex(request) } });
    workers[1].onmessage({ data: { id: 1, ok: true, result: executeRegex(request) } });
    expect(results).toEqual([]);
    expect(workers[1].terminate).not.toHaveBeenCalled();
    const handler = workers[1].onmessage;
    runner.cancel();
    handler({ data: { id: 2, ok: true, result: executeRegex(request) } });
    expect(results).toEqual([]);
  });
  it('terminates disposable worker on deadline then accepts a recovery job', async () => {
    const engine = await import('../src/lib/regex');
    expect(typeof engine.createRegexRunner).toBe('function');
    if (!engine.createRegexRunner) return;
    vi.useFakeTimers();
    try {
      const workers: any[] = [];
      const results: any[] = [];
      const runner = engine.createRegexRunner(() => {
        const worker = { onmessage: null, onerror: null, terminate: vi.fn(), postMessage: vi.fn() };
        workers.push(worker); return worker;
      }, result => results.push(result));
      const request = { pattern: 'a', flags: 'g', input: 'a', replacement: 'b' };
      runner.run(request);
      vi.advanceTimersByTime(1000);
      expect(workers[0].terminate).toHaveBeenCalledOnce();
      expect(results[0].error).toContain('시간 제한');
      runner.run(request);
      const { id } = workers[1].postMessage.mock.calls[0][0];
      workers[1].onmessage({ data: { id, ok: true, result: executeRegex(request) } });
      expect(results[1].result.output).toBe('b');
      expect(workers[1].terminate).toHaveBeenCalledOnce();
      runner.cancel();
    } finally { vi.useRealTimers(); }
  });
  it('rejects invalid flags with actionable Korean errors and recovers after invalid syntax', () => {
    const base = { pattern: 'a', flags: 'gg', input: 'a', replacement: 'b' };
    expect(() => executeRegex(base)).toThrow(/중복 플래그/);
    expect(() => executeRegex({ ...base, flags: 'z' })).toThrow(/지원하지 않는 플래그/);
    expect(() => executeRegex({ ...base, flags: 'uv' })).toThrow(/동시에/);
    expect(() => executeRegex({ ...base, pattern: '[', flags: '' })).toThrow();
    expect(executeRegex({ ...base, flags: 'g' }).output).toBe('b');
  });
  it('bounds request, match, capture and replacement output sizes', async () => {
    const engine = await import('../src/lib/regex');
    expect(engine.REGEX_LIMITS?.input).toBe(100_000);
    if (!engine.REGEX_LIMITS) return;
    expect(() => executeRegex({ pattern: '.', flags: '', input: 'a'.repeat(100_001), replacement: '' })).toThrow(/입력/);
    const many = executeRegex({ pattern: '.', flags: 'g', input: 'a'.repeat(600), replacement: '' });
    expect(many.matches).toHaveLength(500);
    expect(many.truncated).toBe(true);
    const capture = executeRegex({ pattern: '(a+)', flags: '', input: 'a'.repeat(3000), replacement: '' });
    expect(capture.matches[0].captures[0]?.length).toBe(2048);
    const output = executeRegex({ pattern: 'a', flags: 'g', input: 'a'.repeat(100), replacement: 'b'.repeat(10000) });
    expect(output.output.length).toBe(200_000);
    expect(output.truncated).toBe(true);
  });
  it('advances empty matches by Unicode code point', async () => {
    const engine = await import('../src/lib/regex');
    expect(engine.advanceStringIndex?.('😀x', 0, true)).toBe(2);
    expect(engine.advanceStringIndex?.('😀x', 0, false)).toBe(1);
    expect(executeRegex({ pattern: '(?:)', flags: 'gu', input: '😀x', replacement: '-' }).matches.map(m => m.start)).toEqual([0, 2, 3]);
  });
  it('uses JavaScript replacement tokens and respects global versus first-match flags', () => {
    const request = { pattern: '(?<word>[a-z]+)-(\\d+)', flags: 'g', input: 'ab-12 cd-3', replacement: '$<word>:$2:$$:$&' };
    expect(executeRegex(request).output).toBe('ab:12:$:ab-12 cd:3:$:cd-3');
    expect(executeRegex({ ...request, flags: '' }).output).toBe('ab:12:$:ab-12 cd-3');
  });
  it('returns UTF-16 offsets with indexed and named captures', () => {
    const result = executeRegex({ pattern: '(?<word>[a-z]+)-(\\d+)', flags: 'g', input: '😀 ab-12 cd-3', replacement: '' });
    expect(result.matches).toEqual([
      { text: 'ab-12', start: 3, end: 8, captures: ['ab', '12'], groups: { word: 'ab' } },
      { text: 'cd-3', start: 9, end: 13, captures: ['cd', '3'], groups: { word: 'cd' } },
    ]);
  });
});
