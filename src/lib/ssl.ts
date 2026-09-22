export interface SslInputs {
  endpoints: string[];
  domains: string[];
}

const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isIpv6(value: string): boolean {
  if (!/^[0-9a-f:]+$/i.test(value) || !value.includes(':')) return false;
  try {
    const url = new URL(`https://[${value}]/`);
    return url.hostname.startsWith('[') && url.hostname.endsWith(']');
  } catch {
    return false;
  }
}

export function isEndpoint(value: string): boolean {
  if (/^\d+(?:\.\d+){3}$/.test(value)) return isIpv4(value);
  return isIpv6(value) || hostnamePattern.test(value);
}

export function isSniDomain(value: string): boolean {
  const plain = value.startsWith('*.') ? value.slice(2) : value;
  return plain.includes('.') && hostnamePattern.test(plain);
}

function nonBlankLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function parseSslInputs(endpointText: string, domainText: string): SslInputs {
  const endpoints = nonBlankLines(endpointText);
  const domains = nonBlankLines(domainText);
  if (endpoints.length === 0) throw new Error('엔드포인트를 한 개 이상 입력해 주세요.');
  if (domains.length === 0) throw new Error('SNI 도메인을 한 개 이상 입력해 주세요.');
  const badEndpoint = endpoints.find((value) => !isEndpoint(value));
  if (badEndpoint) throw new Error(`유효하지 않은 엔드포인트: ${badEndpoint}`);
  const badDomain = domains.find((value) => !isSniDomain(value));
  if (badDomain) throw new Error(`유효하지 않은 SNI 도메인: ${badDomain}`);
  return { endpoints, domains };
}

function shellQuote(value: string): string {
  return `'${value}'`;
}

export function buildSslCommands(endpoints: string[], domains: string[]): { expiry: string; chain: string } {
  const expiry: string[] = [];
  const chain: string[] = [];
  for (const domain of domains) {
    for (const endpoint of endpoints) {
      if (!isEndpoint(endpoint) || !isSniDomain(domain)) throw new Error('검증되지 않은 입력입니다.');
      const address = isIpv6(endpoint) ? `[${endpoint}]:443` : `${endpoint}:443`;
      expiry.push(`openssl s_client -connect ${shellQuote(address)} -servername ${shellQuote(domain)} </dev/null 2>/dev/null | openssl x509 -noout -dates | grep 'notAfter'`);
      chain.push(`openssl s_client -connect ${shellQuote(address)} -servername ${shellQuote(domain)} -showcerts </dev/null 2>/dev/null | grep 'BEGIN CERTIFICATE' | wc -l`);
    }
  }
  return { expiry: expiry.join('\n'), chain: chain.join('\n') };
}
