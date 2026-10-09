import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
const path = '/tools/large-pdf-to-divided-images.html';
test('PDF demo remains lazy, runs locally, and downloads four actual A4 pages', async ({ page, request }) => {
  const scripts: string[] = [];
  page.on('request', req => { if (req.resourceType() === 'script') scripts.push(req.url()); });
  await page.goto(path);
  await page.getByRole('button', { name: '거부', exact: true }).click();
  await expect(page.locator('#pdf-download')).toBeHidden();
  const initial = [...scripts];
  for (const script of initial) {
    const text = await (await request.get(script)).text();
    expect(text).not.toContain('PDFDocument');
  }
  await expect(page.locator('#pdf-visual-guide')).toBeVisible();
  await expect(page.locator('#pdf-visual-guide img')).toHaveCount(2);
  const sample = await request.get('/demos/demo-poster.pdf');
  expect(sample.ok()).toBe(true);
  expect((await PDFDocument.load(await sample.body())).getPageCount()).toBe(1);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#pdf-demo-download').click();
  expect((await downloadEvent).suggestedFilename()).toBe('demo-poster.pdf');
  await page.locator('#pdf-demo').click();
  await expect(page.locator('#pdf-download')).toBeVisible();
  expect(scripts.length).toBeGreaterThan(initial.length);
  const resultEvent = page.waitForEvent('download');
  await page.locator('#pdf-download').click();
  const result = await resultEvent;
  expect(result.suggestedFilename()).toBe('a4-tiled.pdf');
  const output = await PDFDocument.load(await readFile((await result.path())!));
  expect(output.getPageCount()).toBe(4);
  for (const p of output.getPages()) { expect(p.getWidth()).toBeCloseTo(595.28); expect(p.getHeight()).toBeCloseTo(841.89); }
});
test('PDF demo network failure and invalid PDF recover without concurrent processing', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button', { name: '거부', exact: true }).click();
  await page.route('**/demos/demo-poster.pdf', async route => { await new Promise(resolve => setTimeout(resolve, 150)); await route.fulfill({ status: 503, body: 'unavailable' }); });
  await page.locator('#pdf-demo').click();
  await expect(page.locator('#pdf-process')).toBeDisabled();
  await expect(page.locator('#pdf-demo')).toBeDisabled();
  await expect(page.locator('#pdf-error')).toContainText('503');
  await expect(page.locator('#pdf-demo')).toBeEnabled();
  await page.locator('#pdf-file').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') });
  await page.locator('#pdf-process').click();
  await expect(page.locator('#pdf-error')).toContainText('PDF 처리 실패');
  await expect(page.locator('#pdf-download')).toBeHidden();
  await expect(page.locator('#pdf-process')).toBeEnabled();
  await page.unroute('**/demos/demo-poster.pdf');
  await page.locator('#pdf-demo').click();
  await expect(page.locator('#pdf-download')).toBeVisible();
});

test('uploaded sample follows the same lazy PDF execution path', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button', { name: '거부', exact: true }).click();
  await expect(page.locator('#pdf-download')).toBeHidden();
  await page.locator('#pdf-file').setInputFiles('public/demos/demo-poster.pdf');
  await page.locator('#pdf-process').click();
  await expect(page.locator('#pdf-download')).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.locator('#pdf-download').click();
  const download = await pending;
  const result = await PDFDocument.load(await readFile((await download.path())!));
  expect(result.getPageCount()).toBe(4);
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
});
