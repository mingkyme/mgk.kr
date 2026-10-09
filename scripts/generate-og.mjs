import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
// Uses the already installed Chromium and system Korean fonts; no network assets.
const guides = await import('../src/data/tool-guides.ts');
const titles = { index: '무료 개발자 도구\n텍스트 · 시간 · PDF', privacy: '개인정보 처리방침', '404': '페이지를 찾을 수 없음', ...Object.fromEntries(Object.entries(guides.guides).map(([key, value]) => [key, value.title])) };
await mkdir('public/og', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const [key, title] of Object.entries(titles)) {
    await page.setContent(`<html lang="ko"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#101827;color:#fff;padding:76px;font-family:-apple-system,BlinkMacSystemFont,sans-serif}p{color:#93c5fd;font-size:28px}h1{font-size:58px;line-height:1.35;word-break:keep-all;white-space:pre-line;margin:32px 0}footer{position:absolute;bottom:64px;font-size:25px;color:#cbd5e1}</style><p>mgk.kr / 브라우저 유틸리티</p><h1></h1><footer>무료 · 회원가입 없이 · 로컬 처리</footer></html>`);
    await page.locator('h1').evaluate((node, text) => { node.textContent = text; }, title);
    await page.screenshot({ path: `public/og/${key}.png` });
  }
} finally { await browser.close(); }
console.log(`Generated ${Object.keys(titles).length} local 1200×630 PNG cards.`);
