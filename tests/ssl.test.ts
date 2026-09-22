import { describe, expect, it } from 'vitest';
import { buildSslCommands, parseSslInputs } from '../src/lib/ssl';

describe('SSL command utilities', () => {
  it('filters blank endpoint and SNI lines', () => {
    expect(parseSslInputs('1.1.1.1\n\n2001:db8::1\n', 'example.com\n \n*.example.org')).toEqual({
      endpoints: ['1.1.1.1', '2001:db8::1'],
      domains: ['example.com', '*.example.org'],
    });
  });

  it('rejects malformed hosts, domains, and shell metacharacters', () => {
    expect(() => parseSslInputs('host;cat /etc/passwd', 'example.com')).toThrow(/엔드포인트/);
    expect(() => parseSslInputs('1.1.1.999', 'example.com')).toThrow(/엔드포인트/);
    expect(() => parseSslInputs('example.com', 'bad_domain.com')).toThrow(/SNI/);
  });

  it('quotes validated values, brackets IPv6 endpoints, and concretizes wildcard SNI', () => {
    const result = buildSslCommands(['2001:db8::1', 'edge.example.com'], ['*.example.com']);
    expect(result.expiry).toContain("-connect '[2001:db8::1]:443' -servername 'wildcard-check.example.com'");
    expect(result.expiry).not.toContain("-servername '*.example.com'");
    expect(result.expiry).toContain("-connect 'edge.example.com:443'");
    expect(result.chain).toContain('-showcerts');
    expect(result.expiry).not.toContain('undefined');
  });
});
