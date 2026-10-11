export type Timezone = 'utc' | 'local';

export function parseUnixInput(value: string): { milliseconds: number } {
  if (!/^-?\d+$/.test(value.trim())) {
    throw new Error('Unix 시간은 정수 숫자(초)로 입력해 주세요.');
  }
  const numeric = Number(value);
  const milliseconds = numeric * 1000;
  if (!Number.isSafeInteger(numeric) || !Number.isFinite(new Date(milliseconds).getTime())) {
    throw new Error('표현할 수 없는 날짜입니다.');
  }
  formatDate(milliseconds, 'utc');
  return { milliseconds };
}

export function parseDateInput(value: string, timezone: Timezone = 'local'): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value.trim());
  if (!match) throw new Error('날짜는 YYYY-MM-DD HH:mm:ss 또는 ISO 형식으로 입력해 주세요.');
  const [, y, mo, d, h = '0', mi = '0', s = '0', offset] = match;
  const parts = [y, mo, d, h, mi, s].map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const date = new Date(0);
  const utc = timezone === 'utc' || Boolean(offset);
  if (utc) {
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
  } else {
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, second, 0);
  }
  const actual = utc
    ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  if (year < 1 || parts.some((part, index) => part !== actual[index])) {
    throw new Error('유효한 날짜가 아니거나 해당 시간대에 존재하지 않는 시각입니다.');
  }
  let milliseconds = date.getTime();
  if (offset && offset !== 'Z') {
    const offsetHours = Number(offset.slice(1, 3));
    const offsetMinutes = Number(offset.slice(4));
    if (offsetHours > 23 || offsetMinutes > 59) throw new Error('유효한 날짜 시간대 오프셋이 아닙니다.');
    const minutes = offsetHours * 60 + offsetMinutes;
    milliseconds -= (offset[0] === '+' ? 1 : -1) * minutes * 60000;
  }
  formatDate(milliseconds, 'utc');
  formatDate(milliseconds, timezone);
  return milliseconds;
}

export function toUnix(milliseconds: number): number {
  return Math.floor(milliseconds / 1000);
}

/** Editable wall clock; the selected timezone must be displayed alongside it. */
export function formatDate(milliseconds: number, timezone: Timezone): string {
  const date = new Date(milliseconds);
  const utc = timezone === 'utc';
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  if (!Number.isFinite(date.getTime()) || year < 1 || year > 9999) {
    throw new Error('날짜는 0001년부터 9999년까지 표현할 수 있습니다.');
  }
  const parts = utc
    ? [date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    : [date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  const [month, day, hour, minute, second] = parts.map(part => String(part).padStart(2, '0'));
  return `${String(year).padStart(4, '0')}-${month}-${day} ${hour}:${minute}:${second}`;
}
