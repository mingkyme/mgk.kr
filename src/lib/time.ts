export type UnixUnit = 'auto' | 'seconds' | 'milliseconds';

export function parseUnixInput(value: string, unit: UnixUnit): { milliseconds: number; detectedUnit: Exclude<UnixUnit, 'auto'> } {
  if (!value.trim() || !/^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    throw new Error('Unix 시간은 숫자로 입력해 주세요.');
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error('Unix 시간은 유효한 숫자여야 합니다.');
  const detectedUnit = unit === 'auto'
    ? (Math.abs(numeric) >= 100_000_000_000 ? 'milliseconds' : 'seconds')
    : unit;
  const milliseconds = detectedUnit === 'seconds' ? numeric * 1000 : numeric;
  if (!Number.isFinite(new Date(milliseconds).getTime())) throw new Error('표현할 수 없는 날짜입니다.');
  return { milliseconds, detectedUnit };
}

export function parseDateInput(value: string): number {
  if (!value.trim()) throw new Error('날짜를 입력해 주세요.');
  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) throw new Error('유효한 날짜 또는 ISO 형식이 아닙니다.');
  return milliseconds;
}

export function toUnix(milliseconds: number, unit: Exclude<UnixUnit, 'auto'>): number {
  return unit === 'seconds' ? Math.floor(milliseconds / 1000) : Math.floor(milliseconds);
}

export function formatDate(milliseconds: number, timezone: 'utc' | 'local'): string {
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw new Error('유효한 날짜가 아닙니다.');
  if (timezone === 'utc') return date.toISOString();
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${offset}`;
}
