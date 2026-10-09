import type { ToolKey } from './tool-guides';
const entries = [
  { key: 'securecrt-config-maker', title: 'SecureCRT 세션 XML 생성기', description: '서버 목록을 검증해 SecureCRT 세션 XML로 만듭니다.', tag: 'XML · SSH' },
  { key: 'ssl-checker', title: 'SSL 명령어 생성기', description: '인증서 만료일과 체인 확인용 OpenSSL 명령을 안전하게 생성합니다.', tag: 'TLS · OpenSSL' },
  { key: 'remove-duplication', title: '중복 라인 제거', description: '첫 등장 순서를 유지하며 빈 줄과 중복 항목을 정리합니다.', tag: 'TEXT' },
  { key: 'sort', title: '라인 정렬', description: '한글과 숫자를 자연스럽게 인식해 오름차순 또는 내림차순으로 정렬합니다.', tag: 'TEXT · KO' },
  { key: 'unixtime', title: 'Unix Time 변환', description: '초·밀리초 Unix 시간과 ISO/로컬 날짜를 양방향으로 변환합니다.', tag: 'TIME' },
  { key: 'large-pdf-to-divided-images', title: 'PDF A4 분할', description: '파일을 업로드하지 않고 브라우저에서 큰 PDF 페이지를 A4로 분할합니다.', tag: 'LOCAL · PDF' },
  { key: 'tsv-tool', title: 'TSV 탭 변환기', description: 'cat -T의 ^I 표시를 실제 탭 또는 줄바꿈으로 변환합니다.', tag: 'TEXT · TSV' },
  { key: 'base64', title: 'Base64 인코더', description: 'Unicode 텍스트를 표준·URL-safe Base64로 인코딩하고 디코딩합니다.', tag: 'UTF-8 · JSON' },
  { key: 'timer', title: 'LL-HLS 타이머', description: '밀리초 벽시계와 경과 시간으로 스트리밍 지연을 측정합니다.', tag: 'TIMER' },
  { key: 'regex-tester', title: '정규식 테스트', description: '매치·캡처 그룹·치환 결과를 확인하고 오래 걸리는 패턴은 자동 중단합니다.', tag: 'TEXT · REGEXP' },
  { key: 'cron-explainer', title: 'Cron 설명', description: '5필드 cron을 한국어로 설명하고 시간대별 다음 실행 시각을 확인합니다.', tag: 'TIME · CRON' },
  { key: 'qr-generator', title: 'QR 코드 생성', description: '텍스트·URL을 로컬 QR로 만들고 PNG 또는 SVG로 다운로드합니다.', tag: 'QR · PNG · SVG' },
  { key: 'uuid-generator', title: 'UUID 생성', description: '난수 기반 v4와 시각 기반 v7 UUID를 한 번에 생성하고 복사합니다.', tag: 'UUID · v4 · v7' },
  { key: 'password-generator', title: '패스워드 생성기', description: '길이·문자 옵션을 선택해 Web Crypto 난수로 비밀번호를 생성합니다.', tag: 'LOCAL · CSPRNG' },
] as const satisfies readonly { key: ToolKey; title: string; description: string; tag: string }[];
export const toolCatalog = entries.map(tool => ({ ...tool, href: `/tools/${tool.key}.html` }));
export const toolSlugs = entries.map(tool => tool.key);
