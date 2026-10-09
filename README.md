# mgk.kr

브라우저 안에서 빠르고 안전하게 동작하는 무료 개발자 유틸리티 모음입니다. Astro 정적 사이트로 빌드되며 GitHub Pages의 `mgk.kr` 커스텀 도메인에 배포됩니다.

## 주요 원칙

- 기존 `.html` 공개 URL 유지
- 텍스트 및 PDF 입력은 가능한 한 브라우저 로컬에서만 처리
- 분석 동의 전 Google 태그 네트워크 요청 없음
- 외부 UI·폰트·광고·상담 위젯 없음
- 키보드 탐색, 44px 터치 타깃, 명확한 포커스 상태 지원

## 개발

Node.js 24 LTS를 권장합니다.

```bash
npm install
npm run dev
```

## 검증

```bash
npm test          # Vitest 순수 로직 테스트
npm run check     # Astro/TypeScript 검사
npm run build         # 정적 사이트 빌드
npm run verify:output # 공개 URL, 내부 링크, sitemap 검증
npm run test:e2e      # 빌드 결과 Playwright 흐름 테스트
npm run validate      # 위 검증 전체 실행
```

Playwright Chromium이 없다면 최초 한 번 설치합니다.

```bash
npx playwright install chromium
```

## 구조

- `src/pages/` — 홈페이지, 개인정보, 404, 도구 페이지
- `src/layouts/` — 공통 메타데이터, 헤더·푸터, 동의 UI
- `src/lib/` — Vitest로 검증되는 순수 로직
- `tests/` — 단위 및 Playwright 회귀 테스트
- `public/` — CNAME, robots.txt, favicon

## 배포

`main` 브랜치 push 시 `.github/workflows/deploy.yml`이 단위 테스트, 타입 검사, 빌드 산출물 검증을 통과한 뒤 공식 Astro Pages 액션으로 배포합니다.

## SEO 및 데모 검증

`npm run validate`는 순수 로직, 정적 SEO 산출물 손상 감지 테스트, Astro 검사,
빌드·출력 검사와 Playwright를 모두 실행합니다. SEO 검사는 17개 HTML 경로의
canonical·고유 메타데이터·PNG 크기·404 전용 noindex를 확인하고 14개 도구의
WebApplication/BreadcrumbList·정적 사용 안내를 검사합니다. 내부 링크와
sitemap에는 기존 `.html` 주소가 유지되며 임의 lastmod는 생성하지 않습니다.

Playwright는 모바일 가로 넘침, 안내·FAQ·연관 링크, 쿠키 동의 이전 GA 미로딩,
PDF 초기 번들의 지연 로딩, 실제 데모·결과 PDF 다운로드, 네트워크 오류·손상 PDF
복구 및 실행 중 중복 방지를 확인합니다. PDF 출력은 이미지가 아닌 벡터 PDF이며
샘플 1페이지가 A4 4페이지로 나오는 것은 실제 분할 로직으로 검증합니다.

정적 자산은 다음 명령으로 다시 생성할 수 있습니다. 프로젝트 의존성만 사용하며
외부 CDN·폰트·서비스를 요청하지 않습니다. 스크립트의 TypeScript 직접 import는
Node 24 LTS 이상의 내장 타입 제거 기능을 사용합니다.

```bash
node scripts/generate-og.mjs       # Chromium·시스템 한글 글꼴로 public/og/*.png 17개
node scripts/generate-pdf-demo.mjs # public/demos/demo-poster.pdf 및 전후 크기 관계 SVG
```

OG PNG는 1200×630이며 운영체제 글꼴에 따라 픽셀은 달라질 수 있습니다.
PDF 데모는 고정 치수·색·문구·메타데이터 날짜로 생성됩니다. 전후 SVG는 같은
데이터의 크기 관계도이며 실제 PDF 렌더링 캡처로 표기하지 않습니다.

### Search Console 외부 작업 체크리스트 (코드 변경과 별개)

이 저장소는 Search Console 등록·인증·색인 요청이 완료되었다고 주장하지 않습니다.
사이트 소유자가 실제 계정과 권한으로 다음 작업을 수행해야 합니다.

- Google Search Console에 로그인하고 `mgk.kr` 도메인 속성 소유권을 DNS 등 공식 절차로 인증합니다.
- 실제 배포 후 `https://mgk.kr/sitemap-index.xml`을 제출합니다.
- 홈 및 주요 도구의 URL 검사에서 실제 canonical, 크롤링 허용, 렌더링과 색인 상태를 확인합니다.
- 404의 noindex, robots.txt와 sitemap의 공개 경로를 확인합니다.
- 페이지 색인·검색 실적·Core Web Vitals 보고서를 모니터링합니다.
- Lighthouse/구조화 데이터 검증 결과는 기술 점검이지 검색 순위나 리치 결과 노출 보장이 아닙니다.

인증 토큰·가짜 리뷰·FAQPage 리치 결과 주장은 추가하지 않습니다.

## 로컬 생성·검사 도구

- `/tools/regex-tester.html`: JavaScript 정규식 매치, 번호·이름 캡처, 치환 및 리터럴 하이라이트. 모든 매칭은 별도 Worker에서 수행하며 시작 시간을 포함한 약 1초 제한 후 종료합니다. 입력 100,000 UTF-16 코드 단위, 패턴 2,000, 매치 500개, 치환 출력 200,000 제한을 적용합니다. 일부 결과가 잘린 경우 완전한 결과로 사용하면 안 됩니다.
- `/tools/cron-explainer.html`: 표준 Unix 5필드 설명과 IANA 시간대별 다음 실행 5개. 일·요일은 OR 조건이며 기준 시각은 포함하지 않습니다. Quartz 6/7필드·특수 문법은 거부합니다. 40년 탐색 범위와 라이브러리 반복 제한을 사용하며 DST 처리 결과는 서버 스케줄러와 다를 수 있습니다.
- `/tools/qr-generator.html`: UTF-8 텍스트를 외부 요청 없이 QR로 생성하고 PNG·SVG를 다운로드합니다. 크기 128–2048, ECC L/M/Q/H를 지원하며 바이트 용량·모듈당 픽셀 수를 검증합니다. QR은 암호화가 아니며 입력 URL에 접속하지 않습니다.
- `/tools/uuid-generator.html`: CSPRNG를 사용하는 UUID v4·v7을 1–100개 생성합니다. v7은 생성 시각을 포함하며 UUID는 인증 토큰이나 비밀번호의 대체품이 아닙니다.
- `/tools/password-generator.html`: Web Crypto의 편향 없는 난수 샘플링으로 길이 8–128, 개수 1–100의 비밀번호를 생성합니다. 기본 길이 20, 문자 종류 포함·유사 문자 제외·결과 표시/지우기를 지원합니다. 자동 저장·전송·URL 기록은 하지 않으며 **기존 분석 동의가 있어도 이 페이지에서는 GA를 로드하지 않고 외부 스크립트/분석 연결을 CSP로 차단합니다.** 복사·다운로드는 사용자가 명시적으로 선택하며 평문 파일과 클립보드는 직접 관리해야 합니다. JavaScript 문자열의 완전한 메모리 소거는 보장할 수 없습니다.

`src/data/tool-catalog.ts`는 홈 목록·구조화 데이터·산출물 검사·브라우저 SEO 검사에서 공유하는 도구 레지스트리입니다. 도구를 추가할 때 가이드와 레지스트리를 함께 등록하고 OG 자산을 생성하세요.

새 브라우저 검증에는 실제 QR PNG 디코딩, SVG XML 검사, UUID 형식·버전·파일 결과, 정규식 백트래킹 중단·복구, Cron의 OR·DST·시간대, 패스워드의 무저장·무전송·분석 차단이 포함됩니다. 패스워드 테스트는 합성 난수 스트림만 사용하며 실사용 비밀번호를 생성하거나 출력하지 않습니다. 해당 테스트의 trace·screenshot·video도 비활성화합니다.
