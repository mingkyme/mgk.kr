import { describe, expect, it } from 'vitest';
import { buildSecureCrtXml, parseSecureCrtRows } from '../src/lib/securecrt';

describe('SecureCRT utilities', () => {
  it('ignores a trailing blank line and accepts comma or tab delimiters', () => {
    expect(parseSecureCrtRows('prod,server.example.com\ndev\t2001:db8::1\n')).toEqual([
      { folder: 'prod', server: 'server.example.com' },
      { folder: 'dev', server: '2001:db8::1' },
    ]);
  });

  it('rejects malformed lines and invalid ports', () => {
    expect(() => parseSecureCrtRows('missing-server')).toThrow(/1번째 줄/);
    expect(() => buildSecureCrtXml([], 'root', 0, '2026-09-23')).toThrow(/1.*65535/);
    expect(() => buildSecureCrtXml([], 'root', 65536, '2026-09-23')).toThrow(/1.*65535/);
  });

  it('rejects invalid server values and XML-forbidden control characters', () => {
    expect(() => parseSecureCrtRows('prod,server with spaces')).toThrow(/유효한 호스트명/);
    expect(() => parseSecureCrtRows('bad\u0001folder,server.example.com')).toThrow(/XML에서 사용할 수 없는/);
    expect(() => buildSecureCrtXml([{ folder: 'prod', server: 'server with spaces' }], 'admin', 22, '2026-09-23')).toThrow(/유효한 호스트명/);
    expect(() => buildSecureCrtXml([{ folder: 'prod', server: 'server.example.com' }], 'admin\u0001', 22, '2026-09-23')).toThrow(/XML에서 사용할 수 없는/);
  });

  it('escapes XML in folder and username values', () => {
    const xml = buildSecureCrtXml(
      [{ folder: 'R&D "ops"', server: 'host-one.example' }],
      "o'hara&admin",
      22,
      '2026-09-23',
    );
    expect(xml).toContain('name="R&amp;D &quot;ops&quot;"');
    expect(xml).toContain('host-one.example');
    expect(xml).toContain('o&apos;hara&amp;admin');
    expect(xml).not.toContain('R&D "ops"');
  });
});
