function bytesToBinary(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

export function encodeBase64(value: string, urlSafe = false): string {
  const encoded = btoa(bytesToBinary(new TextEncoder().encode(value)));
  return urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded;
}

export function decodeBase64(value: string): string {
  const compact = value.trim().replace(/\s/g, '');
  if (!compact || !/^[A-Za-z0-9+/_-]*={0,2}$/.test(compact) || compact.length % 4 === 1) {
    throw new Error('유효하지 않은 Base64 문자열입니다.');
  }
  const standard = compact.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('유효하지 않은 Base64 문자열입니다.');
  }
}

export function prettyJson(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? JSON.stringify(parsed, null, 2) : value;
  } catch {
    return value;
  }
}
