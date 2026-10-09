import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';
import 'cronstrue/locales/ko.js';

export function explainCron(expression: string, timezone: string, reference?: string) {
  const fields = expression.trim().toUpperCase().split(/\s+/);
  if (!expression.trim() || fields.length !== 5) throw new Error('분 시 일 월 요일의 5개 필드만 지원합니다. 초·연도·Quartz 6/7필드는 지원하지 않습니다.');
  const limits = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  const names = [[], [], [], ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']];
  fields.forEach((field, index) => {
    const [min, max] = limits[index];
    const numeric = field.replace(/[A-Z]+/g, alias => {
      const position = names[index].indexOf(alias);
      if (position < 0) throw new Error('지원하지 않는 문법입니다. *, 목록(,), 범위(-), 간격(/), JAN–DEC 및 SUN–SAT만 지원합니다. L/W/#/?/H는 지원하지 않습니다.');
      return String(position + (index === 3 ? 1 : 0));
    });
    numeric.split(',').forEach(part => {
      const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
      if (!match) throw new Error('지원하지 않는 문법입니다. *, 목록(,), 범위(-), 간격(/)만 지원합니다. L/W/#/?/H는 지원하지 않습니다.');
      const bounds = match[1] === '*' ? [min, max] : match[1].split('-').map(Number);
      if (bounds.some(value => !Number.isSafeInteger(value) || value < min || value > max) || (bounds.length === 2 && bounds[0] > bounds[1])) throw new Error(`${index + 1}번째 필드 범위는 ${min}–${max}입니다. 오름차순 범위를 입력하세요.`);
      if (match[2] && (!Number.isSafeInteger(Number(match[2])) || Number(match[2]) < 1 || Number(match[2]) > max - min + 1)) throw new Error(`간격은 1–${max - min + 1}의 정수여야 합니다.`);
    });
    fields[index] = numeric;
  });
  expression = fields.join(' ');
  reference = reference?.trim();
  if (reference) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(reference);
    const badReference = () => { throw new Error('기준 시각은 실제 날짜의 ISO 8601 형식과 Z 또는 UTC 오프셋을 포함해야 합니다. 예: 2024-01-01T00:00:00Z'); };
    if (!match) badReference();
    const [, year, month, day, hour, minute, second, zone] = match!;
    const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) || !Number.isFinite(Date.parse(reference))) badReference();
  }
  try { new Intl.DateTimeFormat('ko-KR', { timeZone: timezone }).format(); }
  catch { throw new Error('유효한 IANA 시간대를 선택하세요.'); }
  const currentDate = reference ? new Date(reference) : new Date();
  const endDate = new Date(currentDate);
  endDate.setUTCFullYear(endDate.getUTCFullYear() + 40);
  const options = { currentDate, endDate, tz: timezone, strict: false };
  const describe = (value: string) => cronstrue.toString(value, { locale: 'ko', use24HourTimeFormat: true, logicalAndDayFields: false });
  let description: string;
  let dates;
  try {
    const interval = CronExpressionParser.parse(expression, options);
    dates = interval.take(5);
    // take() intentionally swallows iteration errors and can return a partial list.
    if (dates.length !== 5) throw new Error('실행 시각 5개를 찾지 못했습니다.');
    description = !interval.fields.dayOfMonth.isWildcard && !interval.fields.dayOfWeek.isWildcard
      ? `${describe([fields[0], fields[1], fields[2], fields[3], '*'].join(' '))} 또는 ${describe([fields[0], fields[1], '*', fields[3], fields[4]].join(' '))} (일/요일 OR: 둘 중 하나가 맞으면 실행)`
      : describe(expression);
  } catch { throw new Error('실행 가능한 일정이 없거나 기준 시각 이후 40년 안에 실행 시각 5개를 찾을 수 없습니다.'); }
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const next = dates.map(date => {
    const offset = date.getUTCOffset();
    const pad = (value: number) => String(value).padStart(2, '0');
    return { iso: date.toDate().toISOString(), local: `${formatter.format(date.toDate())} · ${timezone} · UTC${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}` };
  });
  return { description, next, reference: currentDate.toISOString() };
}
