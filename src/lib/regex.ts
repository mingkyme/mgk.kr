export interface RegexRequest { pattern: string; flags: string; input: string; replacement: string; }
export interface RegexMatch { text: string; start: number; end: number; captures: (string | null)[]; groups: Record<string, string | null>; }
export interface RegexResult { matches: RegexMatch[]; output: string; truncated: boolean; }
export const REGEX_LIMITS = { input: 100_000, pattern: 2_000, replacement: 10_000, matches: 500, captures: 100, captureText: 2_048, serializedText: 200_000, output: 200_000, timeout: 1_000 } as const;
export type RegexReply = { id: number; ok: true; result: RegexResult } | { id: number; ok: false; error: string };
export interface RegexWorkerPort {
  postMessage(message: { id: number; request: RegexRequest }): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<RegexReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}
export function createRegexRunner(factory: () => RegexWorkerPort, deliver: (reply: RegexReply) => void) {
  let serial = 0;
  let worker: RegexWorkerPort | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { serial++; if (timer !== undefined) clearTimeout(timer); worker?.terminate(); worker = null; timer = undefined; };
  const run = (request: RegexRequest) => {
    cancel();
    const id = serial;
    try {
      validateRegexRequest(request);
      worker = factory();
      worker.onmessage = event => { if (serial !== id || event.data.id !== id) return; cancel(); deliver(event.data); };
      worker.onerror = () => { if (serial !== id) return; cancel(); deliver({ id, ok: false, error: '작업자를 실행하지 못했습니다. 다시 실행해 주세요.' }); };
      timer = setTimeout(() => { if (serial !== id) return; cancel(); deliver({ id, ok: false, error: '시간 제한(1초)을 초과했습니다. 패턴이나 입력을 줄여 다시 실행해 주세요.' }); }, REGEX_LIMITS.timeout);
      worker.postMessage({ id, request });
    } catch (error) {
      cancel(); deliver({ id, ok: false, error: error instanceof Error ? error.message : '실행 오류' });
    }
  };
  return { run, cancel };
}
export function highlightSegments(input: string, matches: RegexMatch[]): { text: string; matched: boolean }[] {
  const segments: { text: string; matched: boolean }[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) segments.push({ text: input.slice(cursor, match.start), matched: false });
    segments.push({ text: input.slice(match.start, match.end), matched: true });
    cursor = match.end;
  }
  if (cursor < input.length) segments.push({ text: input.slice(cursor), matched: false });
  return segments;
}
export function advanceStringIndex(input: string, index: number, unicode: boolean): number {
  return index + (unicode && (input.codePointAt(index) ?? 0) > 0xffff ? 2 : 1);
}
export function validateRegexRequest(request: RegexRequest): void {
  const seen = new Set<string>();
  for (const flag of request.flags) {
    if (!'dgimsuvy'.includes(flag)) throw new Error(`지원하지 않는 플래그: ${flag}`);
    if (seen.has(flag)) throw new Error(`중복 플래그: ${flag}`);
    seen.add(flag);
  }
  if (seen.has('u') && seen.has('v')) throw new Error('u와 v 플래그는 동시에 사용할 수 없습니다.');
  for (const [key, label] of [['input', '입력'], ['pattern', '패턴'], ['replacement', '치환 문자열']] as const) {
    if (request[key].length > REGEX_LIMITS[key]) throw new Error(`${label} 길이 제한: ${REGEX_LIMITS[key]} UTF-16 코드 단위`);
  }
}
/** Worker-only engine. Never call on the browser's main thread. Offsets are UTF-16. */
export function executeRegex(request: RegexRequest): RegexResult {
  validateRegexRequest(request);
  const regex = new RegExp(request.pattern, request.flags);
  const matches: RegexMatch[] = [];
  let truncated = false, serialized = 0, output = '', cursor = 0, matchLimited = false;
  const serialize = (value: string | undefined): string | null => {
    if (value === undefined) return null;
    const size = Math.min(value.length, REGEX_LIMITS.captureText, Math.max(0, REGEX_LIMITS.serializedText - serialized));
    if (size < value.length) truncated = true;
    serialized += size;
    return value.slice(0, size);
  };
  const append = (value: string): boolean => {
    const remaining = REGEX_LIMITS.output - output.length;
    output += value.slice(0, remaining);
    if (value.length > remaining) { truncated = true; return false; }
    return true;
  };
  const replacement = (match: RegExpExecArray): void => {
    const text = request.replacement;
    for (let i = 0; i < text.length; i++) {
      let value = text[i];
      if (value === '$' && i + 1 < text.length) {
        const next = text[i + 1];
        if (next === '$') { value = '$'; i++; }
        else if (next === '&') { value = match[0]; i++; }
        else if (next === '`') { value = request.input.slice(0, match.index); i++; }
        else if (next === "'") { value = request.input.slice(match.index + match[0].length); i++; }
        else if (next === '<' && match.groups) {
          const end = text.indexOf('>', i + 2);
          if (end !== -1) { value = match.groups[text.slice(i + 2, end)] ?? ''; i = end; }
        } else if (next >= '0' && next <= '9') {
          const second = text[i + 2];
          const two = second >= '0' && second <= '9' ? Number(next + second) : 0;
          const one = Number(next);
          if (two > 0 && two < match.length) { value = match[two] ?? ''; i += 2; }
          else if (one > 0 && one < match.length) { value = match[one] ?? ''; i++; }
        }
      }
      if (!append(value)) break;
    }
  };
  let match: RegExpExecArray | null;
  while ((match = regex.exec(request.input))) {
    if (matches.length === REGEX_LIMITS.matches) { truncated = true; matchLimited = true; break; }
    const groups: Record<string, string | null> = Object.create(null);
    let groupCount = 0;
    for (const key in match.groups) {
      if (groupCount++ === REGEX_LIMITS.captures) { truncated = true; break; }
      groups[key] = serialize(match.groups![key]);
    }
    if (match.length - 1 > REGEX_LIMITS.captures) truncated = true;
    matches.push({ text: serialize(match[0])!, start: match.index, end: match.index + match[0].length,
      captures: match.slice(1, REGEX_LIMITS.captures + 1).map(serialize), groups });
    append(request.input.slice(cursor, match.index));
    replacement(match);
    cursor = match.index + match[0].length;
    if (!regex.global) break;
    if (match[0] === '') regex.lastIndex = advanceStringIndex(request.input, regex.lastIndex, regex.unicode || request.flags.includes('v'));
  }
  if (!matchLimited) append(request.input.slice(cursor));
  return { matches, output, truncated };
}
