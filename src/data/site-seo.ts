import type { ToolKey } from './tool-guides';

export const homeSeo = {
  title: '무료 개발자 도구 모음 — PDF·QR·정규식·시간 변환',
  h1: '무료 개발자 도구 모음',
  description: 'PDF A4 분할 인쇄, QR 코드·비밀번호·UUID 생성, 정규식 테스트와 Unix 시간 변환을 가입 없이 바로 사용하세요. 파일과 입력값은 브라우저에서 처리합니다.',
};

export const toolGroups = [
  { id: 'text-tools', title: '텍스트·정규식', description: '문자열 변환, 중복 줄 제거, 정렬과 패턴 검사를 바로 처리하세요.', tools: ['base64', 'remove-duplication', 'sort', 'tsv-tool', 'regex-tester'] },
  { id: 'time-tools', title: '시간·스케줄', description: '로컬 날짜와 Unix 초 변환, Cron 실행 시각, 밀리초 시계를 확인하세요.', tools: ['unixtime', 'cron-explainer', 'timer'] },
  { id: 'generators', title: 'QR·UUID·비밀번호 생성', description: '필요한 값과 이미지를 생성하고 직접 복사하거나 다운로드하세요.', tools: ['qr-generator', 'uuid-generator', 'password-generator'] },
  { id: 'file-server-tools', title: 'PDF·서버 설정', description: '큰 PDF를 A4로 나누거나 서버 접속 설정과 인증서 확인 명령을 만드세요.', tools: ['large-pdf-to-divided-images', 'securecrt-config-maker', 'ssl-checker'] },
] as const satisfies readonly { id: string; title: string; description: string; tools: readonly ToolKey[] }[];
