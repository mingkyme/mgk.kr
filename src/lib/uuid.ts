import { v4, v7 } from 'uuid';
export interface UuidOptions { version?: 4 | 7; count?: number }
export function generateUuids(options: UuidOptions = {}): string[] {
  const count = options.count ?? 1;
  const version = options.version ?? 4;
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('개수는 1~100 정수여야 합니다.');
  if (version !== 4 && version !== 7) throw new Error('버전은 4 또는 7이어야 합니다.');
  if (!globalThis.crypto?.getRandomValues) throw new Error('Web Crypto를 사용할 수 없습니다.');
  // Explicit browser CSPRNG injection also prevents the Node adapter from obscuring fail-closed tests.
  const rng = () => globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from({ length: count }, () => version === 7 ? v7({ rng }) : v4({ rng }));
}
