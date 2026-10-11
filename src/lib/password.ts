export type PasswordCategory = 'uppercase' | 'lowercase' | 'digits' | 'symbols';
export interface PasswordOptions {
  ranges?: Partial<Record<PasswordCategory, { min?: number; max?: number }>>;
  length?: number; count?: number; uppercase?: boolean; lowercase?: boolean;
  digits?: boolean; symbols?: boolean; excludeSimilar?: boolean; requireEach?: boolean;
}
const categories = { uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lowercase: 'abcdefghijklmnopqrstuvwxyz', digits: '0123456789', symbols: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' };
export function generatePasswords(options: PasswordOptions = {}, fill: RandomFill = secureFill): string[] {
  const length = options.length ?? 20;
  const count = options.count ?? 1;
  if (!Number.isInteger(length) || length < 8 || length > 128) throw new Error('길이는 8~128 정수여야 합니다.');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('개수는 1~100 정수여야 합니다.');
  const pools = Object.entries(categories).filter(([key]) => options[key as keyof typeof categories] ?? true).map(([, value]) => options.excludeSimilar ? value.replace(/[Il1O0o|`'"]/g, '') : value);
  if (!pools.length || pools.some(pool => !pool.length)) throw new Error('문자 종류를 하나 이상 선택하세요.');
  if ((options.requireEach ?? true) && length < pools.length) throw new Error('길이가 선택한 문자 종류 수보다 작습니다.');
  if (options.ranges !== undefined) {
    const keys = (Object.keys(categories) as PasswordCategory[]).filter(key => options[key] ?? true);
    const bounds = keys.map(key => {
      const range = options.ranges?.[key];
      const min = range?.min === undefined ? 0 : range.min;
      const max = range?.max === undefined ? length : range.max;
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0 || min > 128 || max > 128) {
        throw new Error('문자 종류별 최소·최대 개수는 0~128 정수여야 합니다.');
      }
      if (min > max) throw new Error('문자 종류별 최소 개수는 최대 개수보다 클 수 없습니다.');
      if (min > length) throw new Error('문자 종류별 최소 개수는 길이보다 클 수 없습니다.');
      return { min: Math.max((options.requireEach ?? true) ? 1 : 0, min), max: Math.min(length, max) };
    });
    if (bounds.some(({ min, max }) => min > max)
      || bounds.reduce((sum, { min }) => sum + min, 0) > length
      || bounds.reduce((sum, { max }) => sum + max, 0) < length) {
      throw new Error('문자 종류별 최소·최대 개수로 지정한 길이를 만들 수 없습니다.');
    }
    return constrainedPasswords(pools, bounds, length, count, fill);
  }
  const pool = pools.join('');
  const result: string[] = [];
  while (result.length < count) {
    let candidate = '';
    for (let i = 0; i < length; i++) candidate += pool[uniformIndex(pool.length, fill)];
    if ((options.requireEach ?? true) && !pools.every(chars => [...candidate].some(char => chars.includes(char)))) continue;
    result.push(candidate);
  }
  return result;
}
// Only combinatorial constants are retained; entropy and generated strings are never cached.
const binomials: bigint[][] = [[1n]];
const powers = new Map<number, bigint[]>();
function countingTables(length: number, sizes: number[]): bigint[][] {
  for (let n = binomials.length; n <= length; n++) {
    const previous = binomials[n - 1]!;
    binomials.push(Array.from({ length: n + 1 }, (_, k) => k === 0 || k === n ? 1n : previous[k - 1]! + previous[k]!));
  }
  return sizes.map(size => {
    const table = powers.get(size) ?? [1n];
    for (let k = table.length; k <= length; k++) table.push(table[k - 1]! * BigInt(size));
    powers.set(size, table);
    return table;
  });
}
function randomBelow(bound: bigint, fill: RandomFill): bigint {
  const bits = bound.toString(2).length;
  const buffer = new Uint32Array(Math.ceil(bits / 32));
  const mask = 0xffffffff >>> (32 - ((bits - 1) % 32 + 1));
  let value: bigint;
  do {
    // Even a degenerate bound consumes entropy, so missing Web Crypto fails closed.
    fill(buffer);
    buffer[0] = buffer[0]! & mask;
    value = 0n;
    for (const word of buffer) value = (value << 32n) | BigInt(word >>> 0);
  } while (value >= bound);
  return value;
}
function constrainedPasswords(pools: string[], bounds: { min: number; max: number }[], length: number, count: number, fill: RandomFill): string[] {
  const poolPowers = countingTables(length, pools.map(pool => pool.length));
  const ways = Array.from({ length: pools.length + 1 }, () => Array<bigint>(length + 1).fill(0n));
  ways[pools.length]![0] = 1n;
  const weight = (i: number, remaining: number, k: number) => binomials[remaining]![k]! * poolPowers[i]![k]! * ways[i + 1]![remaining - k]!;
  for (let i = pools.length - 1; i >= 0; i--) {
    for (let remaining = 0; remaining <= length; remaining++) {
      for (let k = bounds[i]!.min; k <= Math.min(bounds[i]!.max, remaining); k++) ways[i]![remaining] = ways[i]![remaining]! + weight(i, remaining, k);
    }
  }
  const result: string[] = [];
  for (let batch = 0; batch < count; batch++) {
    let remaining = length;
    const chars: string[] = [];
    for (let i = 0; i < pools.length; i++) {
      let ticket = randomBelow(ways[i]![remaining]!, fill);
      for (let k = bounds[i]!.min; k <= Math.min(bounds[i]!.max, remaining); k++) {
        const allocationWeight = weight(i, remaining, k);
        if (ticket >= allocationWeight) { ticket -= allocationWeight; continue; }
        for (let j = 0; j < k; j++) chars.push(pools[i]![uniformIndex(pools[i]!.length, fill)]!);
        remaining -= k;
        break;
      }
    }
    // Allocation weights include the multinomial arrangement count. Uniform characters
    // and Fisher–Yates then give every valid string exactly the same probability.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = uniformIndex(i + 1, fill);
      [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }
    result.push(chars.join(''));
  }
  return result;
}
export type RandomFill = (buffer: Uint32Array) => void;
const secureFill: RandomFill = buffer => {
  if (!globalThis.crypto?.getRandomValues) throw new Error('안전한 난수 생성(Web Crypto)을 사용할 수 없습니다.');
  globalThis.crypto.getRandomValues(buffer);
};
export function uniformIndex(bound: number, fill: RandomFill = secureFill): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x100000000) throw new Error('잘못된 난수 범위입니다.');
  const limit = Math.floor(0x100000000 / bound) * bound;
  const buffer = new Uint32Array(1);
  do { fill(buffer); } while (buffer[0]! >= limit);
  return buffer[0]! % bound;
}
