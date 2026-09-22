import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64, prettyJson } from '../src/lib/base64';

describe('Base64 utilities', () => {
  it('round trips Unicode using UTF-8', () => {
    const source = '안녕하세요 👋 café';
    expect(decodeBase64(encodeBase64(source))).toBe(source);
  });

  it('decodes URL-safe Base64 without padding', () => {
    expect(decodeBase64('7ZWc6riA8J-Yig')).toBe('한글😊');
  });

  it('rejects malformed Base64', () => {
    expect(() => decodeBase64('not base64!')).toThrow(/Base64/);
  });

  it('pretty prints JSON objects and leaves non-JSON unchanged', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyJson('hello')).toBe('hello');
  });
});
