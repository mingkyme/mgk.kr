import { isEndpoint } from './ssl';

export interface SecureCrtRow {
  folder: string;
  server: string;
}

function assertXmlText(value: string, field: string): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const valid = codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (!valid) throw new Error(`${field}에 XML에서 사용할 수 없는 문자가 있습니다.`);
  }
}

export function parseSecureCrtRows(input: string): SecureCrtRow[] {
  const rows: SecureCrtRow[] = [];
  input.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return;
    const delimiter = raw.includes('\t') ? '\t' : raw.includes(',') ? ',' : null;
    if (!delimiter) throw new Error(`${index + 1}번째 줄: 쉼표 또는 탭 구분자가 필요합니다.`);
    const parts = raw.split(delimiter);
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      throw new Error(`${index + 1}번째 줄: 폴더와 서버를 각각 하나씩 입력해 주세요.`);
    }
    const folder = parts[0].trim();
    const server = parts[1].trim();
    assertXmlText(folder, `${index + 1}번째 줄의 폴더`);
    assertXmlText(server, `${index + 1}번째 줄의 서버`);
    if (!isEndpoint(server)) throw new Error(`${index + 1}번째 줄: 유효한 호스트명 또는 IP 주소를 입력해 주세요.`);
    rows.push({ folder, server });
  });
  return rows;
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;',
  })[char]!);
}

export function buildSecureCrtXml(rows: SecureCrtRow[], username: string, port: number, date: string): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('포트는 1–65535 사이의 정수여야 합니다.');
  }
  if (!username.trim()) throw new Error('사용자 이름을 입력해 주세요.');
  assertXmlText(username.trim(), '사용자 이름');
  assertXmlText(date, '날짜');
  const folders = new Map<string, string[]>();
  for (const row of rows) {
    assertXmlText(row.folder, '폴더 이름');
    assertXmlText(row.server, '서버 주소');
    if (!isEndpoint(row.server)) throw new Error('유효한 호스트명 또는 IP 주소를 입력해 주세요.');
    const servers = folders.get(row.folder) ?? [];
    servers.push(row.server);
    folders.set(row.folder, servers);
  }
  const body = [...folders.entries()].map(([folder, servers]) => {
    const sessions = servers.map((server) => `        <key name="${escapeXml(server)} ${escapeXml(folder)}">
          <string name="Hostname">${escapeXml(server)}</string>
          <dword name="[SSH2] Port">${port}</dword>
          <string name="Username">${escapeXml(username.trim())}</string>
          <string name="Color Scheme">Desert</string>
        </key>`).join('\n');
    return `      <key name="${escapeXml(folder)}">\n${sessions}\n      </key>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<VanDyke version="3.0">
  <key name="Sessions">
    <key name="${escapeXml(date)}">
${body}
    </key>
  </key>
</VanDyke>`;
}
