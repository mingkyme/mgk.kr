import type { ToolKey } from './tool-guides';
const entries = [
  { key: 'securecrt-config-maker', title: 'SecureCRT 세션 생성기 — 서버 목록을 XML로', description: 'SecureCRT 서버 목록을 폴더별 세션 XML로 생성하고 다운로드하세요. 쉼표·탭 구분 입력과 공통 SSH 포트·사용자 이름을 지원하며 XML 특수문자를 처리합니다.', tag: 'XML · SSH' },
  { key: 'ssl-checker', title: 'SSL 인증서 확인 명령어 — OpenSSL 만료일·체인', description: 'SSL 인증서 만료일과 체인 개수 확인용 OpenSSL 명령어를 생성하세요. IP·호스트와 SNI 도메인 조합을 복사해 터미널에서 실행하며 사이트는 서버에 연결하지 않습니다.', tag: 'TLS · OpenSSL' },
  { key: 'remove-duplication', title: '중복 줄 제거 — 순서 유지·빈 줄 정리', description: '중복 줄과 빈 줄을 제거해 처음 등장한 순서대로 목록을 정리하세요. 입력·출력·제거 개수를 확인하고 결과를 복사할 수 있으며 공백과 대소문자는 구분합니다.', tag: 'TEXT' },
  { key: 'sort', title: '텍스트 정렬 — 한글·숫자 오름차순·내림차순', description: '텍스트 목록을 한글·숫자 인식 기준으로 오름차순 또는 내림차순 정렬하세요. 항목2·항목10을 자연스럽게 배열하고 빈 줄을 제외한 결과를 복사할 수 있습니다.', tag: 'TEXT · KO' },
  { key: 'unixtime', title: 'Unix 타임스탬프 변환 — 초·로컬 날짜·UTC', description: 'Unix 타임스탬프 정수 초와 날짜를 양방향으로 변환하세요. 브라우저 로컬 시간 또는 UTC를 선택하고 시간대 이름과 날짜별 UTC 오프셋을 확인할 수 있습니다.', tag: 'TIME' },
  { key: 'large-pdf-to-divided-images', title: 'PDF A4 분할 — 큰 PDF 나눠 인쇄, 업로드 없이', description: '큰 PDF를 A4 여러 장으로 나눠 인쇄할 수 있는 타일 PDF로 만드세요. 파일 업로드 없이 브라우저에서 처리하고 샘플로 분할을 체험한 뒤 결과 PDF를 다운로드할 수 있습니다.', tag: 'LOCAL · PDF' },
  { key: 'tsv-tool', title: 'TSV 탭 변환기 — ^I를 탭·줄바꿈으로', description: 'TSV 텍스트의 ^I 표시를 실제 탭 또는 줄바꿈으로 변환하세요. cat -T 출력을 스프레드시트에 붙일 표나 줄 단위 목록으로 정리하고 결과를 복사할 수 있습니다.', tag: 'TEXT · TSV' },
  { key: 'base64', title: 'Base64 인코딩·디코딩 — 한글·URL-safe 변환', description: 'Base64로 한글·이모지 텍스트를 인코딩하거나 원문으로 디코딩하세요. URL-safe 변환과 JSON 들여쓰기를 지원하며 브라우저에서 결과를 복사할 수 있습니다.', tag: 'UTF-8 · JSON' },
  { key: 'timer', title: '현재 시간 밀리초 시계', description: '현재 시간을 밀리초 자릿수까지 표시하는 시계입니다. 전체화면으로 기기 시각을 확인하고 경과 시간·60초 순환 카운터를 함께 보며 일시정지·재개와 리셋을 사용할 수 있습니다.', tag: 'TIMER' },
  { key: 'regex-tester', title: '정규식 테스트 — JavaScript 매칭·치환 확인', description: 'JavaScript 정규식의 매칭 위치·캡처 그룹·치환 결과를 확인하세요. 패턴과 플래그를 브라우저에서 테스트하며 오래 걸리는 패턴은 별도 Worker에서 중단합니다.', tag: 'TEXT · REGEXP' },
  { key: 'cron-explainer', title: 'Cron 표현식 해석 — 한국어 설명·다음 실행 시간', description: 'Cron 5필드 표현식을 한국어로 해석하고 다음 실행 시간을 확인하세요. 시간대와 기준 시각을 선택해 범위·목록·간격을 검증하며 실제 예약 작업은 실행하지 않습니다.', tag: 'TIME · CRON' },
  { key: 'qr-generator', title: 'QR 코드 생성기 — 무료 PNG·SVG 다운로드', description: '텍스트·URL·한글을 QR 코드로 만들고 무료 PNG·SVG 파일로 다운로드하세요. 이미지 크기와 오류 정정 수준을 선택할 수 있으며 입력은 외부 서비스로 전송하지 않습니다.', tag: 'QR · PNG · SVG' },
  { key: 'uuid-generator', title: 'UUID 생성기 — v4·v7 일괄 생성·복사', description: 'UUID v4·v7을 한 번에 1–100개 생성하고 복사하거나 텍스트로 다운로드하세요. 브라우저에서 난수 기반 v4와 생성 시각을 포함한 v7을 선택하며 결과는 자동 저장하지 않습니다.', tag: 'UUID · v4 · v7' },
  { key: 'password-generator', title: '비밀번호 생성기 — 길이·문자 옵션, 저장 없이 생성', description: '비밀번호를 Web Crypto 난수로 생성하세요. 길이·개수와 문자 종류별 최소·최대 개수, 비슷한 문자 제외를 설정하며 결과는 자동 저장하거나 서버로 전송하지 않습니다.', tag: 'LOCAL · CSPRNG' },
] as const satisfies readonly { key: ToolKey; title: string; description: string; tag: string }[];
export const toolCatalog = entries.map(tool => ({ ...tool, href: `/tools/${tool.key}.html` }));
export const toolSlugs = entries.map(tool => tool.key);
