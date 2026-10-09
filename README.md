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
빌드·출력 검사와 Playwright를 모두 실행합니다. SEO 검사는 12개 HTML 경로의
canonical·고유 메타데이터·PNG 크기·404 전용 noindex를 확인하고 9개 도구의
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
node scripts/generate-og.mjs       # Chromium·시스템 한글 글꼴로 public/og/*.png 12개
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
