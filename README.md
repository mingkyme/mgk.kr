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
