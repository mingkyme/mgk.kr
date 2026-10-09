export interface PasswordOptions {
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
