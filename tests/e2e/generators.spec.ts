import { expect, test, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';

// Keep generator artifacts off; password tests use synthetic entropy only.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function downloadedBytes(download: Download) {
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!);
}

test('QR downloads decode the same Korean payload, SVG is valid XML, and failures clear output', async ({ page }) => {
  await page.addInitScript(() => {
    const original = URL.revokeObjectURL.bind(URL);
    let revoked = 0;
    URL.revokeObjectURL = value => { revoked++; original(value); };
    Object.defineProperty(window, '__qrRevoked', { get: () => revoked });
  });
  await page.goto('/tools/qr-generator.html');
  await expect(page.locator('#qr-canvas')).toBeHidden();
  await expect(page.locator('#qr-png-download')).toBeDisabled();
  await expect(page.locator('#qr-ecc')).toHaveValue('M');
  const payload = '안녕하세요 👋 <script>alert(1)</script> https://example.invalid/?a=1&b=2';
  let requests = 0;
  page.on('request', request => { if (!request.url().startsWith('blob:')) requests++; });
  await page.locator('#qr-input').fill(payload);
  await page.locator('#qr-size').fill('512');
  await page.locator('#qr-ecc').selectOption('Q');
  await page.locator('#qr-generate').click();
  await expect(page.locator('#qr-png-download')).toBeEnabled();
  for (const format of ['png', 'svg'] as const) {
    const promise = page.waitForEvent('download');
    await page.locator(`#qr-${format}-download`).click();
    const download = await promise;
    expect(download.suggestedFilename()).toBe(`qr.${format}`);
    const bytes = await downloadedBytes(download);
    if (format === 'svg') {
      const svg = bytes.toString('utf8');
      expect(await page.evaluate(source => {
        const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
        return !xml.querySelector('parsererror, script, foreignObject') && xml.documentElement.localName === 'svg' && [...xml.querySelectorAll('*')].every(node => ['svg', 'path'].includes(node.localName));
      }, svg)).toBe(true);
    } else {
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
    const raster = await page.evaluate(async ({ bytes, format }) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: format === 'svg' ? 'image/svg+xml' : 'image/png' });
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
        return { data: [...context.getImageData(0, 0, canvas.width, canvas.height).data], width: canvas.width, height: canvas.height };
      } finally { URL.revokeObjectURL(url); }
    }, { bytes: [...bytes], format });
    expect(jsQR(new Uint8ClampedArray(raster.data), raster.width, raster.height)?.data).toBe(payload);
  }
  expect(requests).toBe(0);
  const before = await page.evaluate(() => (window as unknown as { __qrRevoked: number }).__qrRevoked);
  await page.locator('#qr-generate').click();
  await expect(page.locator('#qr-png-download')).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { __qrRevoked: number }).__qrRevoked)).toBeGreaterThanOrEqual(before + 2);
  await page.locator('#qr-input').fill('가'.repeat(2000));
  await page.locator('#qr-generate').click();
  await expect(page.locator('#qr-error')).toContainText('6000');
  await expect(page.locator('#qr-canvas')).toBeHidden();
  await expect(page.locator('#qr-svg-download')).toBeDisabled();
  await page.locator('#qr-input').fill('복구');
  await page.locator('#qr-generate').click();
  await expect(page.locator('#qr-error')).toBeEmpty();
  await expect(page.locator('#qr-canvas')).toBeVisible();
});

test('UUID manually generates both versions, copies and downloads valid batches', async ({ page }) => {
  await page.addInitScript(() => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { copied = value; } } });
    Object.defineProperty(window, '__uuidCopiedMatches', { get: () => copied === (document.querySelector('#uuid-output') as HTMLTextAreaElement)?.value });
  });
  await page.goto('/tools/uuid-generator.html');
  await expect(page.locator('#uuid-output')).toHaveValue('');
  await expect(page.locator('#uuid-version')).toHaveValue('4');
  for (const version of ['4', '7']) {
    await page.locator('#uuid-version').selectOption(version);
    await page.locator('#uuid-count').fill('100');
    await page.locator('#uuid-generate').click();
    expect(await page.evaluate(version => {
      const values = (document.querySelector('#uuid-output') as HTMLTextAreaElement).value.split('\n');
      const pattern = new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${version}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`);
      return values.length === 100 && new Set(values).size === 100 && values.every(value => pattern.test(value));
    }, version)).toBe(true);
    await page.locator('#uuid-copy').click();
    expect(await page.evaluate(() => (window as unknown as { __uuidCopiedMatches: boolean }).__uuidCopiedMatches)).toBe(true);
    const pending = page.waitForEvent('download'); await page.locator('#uuid-download').click();
    const download = await pending;
    const bytes = await downloadedBytes(download);
    expect(download.suggestedFilename()).toBe('uuids.txt');
    expect(bytes.toString('utf8')).toBe(await page.locator('#uuid-output').inputValue());
  }
  await page.locator('#uuid-count').fill('101'); await page.locator('#uuid-generate').click();
  await expect(page.locator('#uuid-error')).toContainText('1~100');
  await expect(page.locator('#uuid-output')).toHaveValue('');
  await expect(page.locator('#uuid-copy')).toBeDisabled();
  await page.locator('#uuid-count').fill('1'); await page.locator('#uuid-generate').click();
  await expect(page.locator('#uuid-error')).toBeEmpty();
});

test.describe('synthetic password browser assertions only', () => {
  // No genuine passwords: deterministic browser entropy installed before any app script.
  // Disable capture artifacts even for failed runs. Evaluate only booleans, never output values.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      let state = 123456; let draws = 0; let copied = ''; let blob: Blob | undefined;
      Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: (array: Uint32Array) => {
        draws++;
        for (let i = 0; i < array.length; i++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; array[i] = state; }
        return array;
      } });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { copied = value; } } });
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = value => { if (value instanceof Blob) blob = value; return create(value); };
      const baseline = JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href });
      Object.defineProperty(window, '__passwordChecks', { value: {
        noDraws: () => draws === 0,
        copied: () => copied === (document.querySelector('#password-output') as HTMLTextAreaElement).value,
        downloaded: async () => Boolean(blob && await blob.text() === (document.querySelector('#password-output') as HTMLTextAreaElement).value),
        noTelemetry: () => { const value = (document.querySelector('#password-output') as HTMLTextAreaElement).value; return Boolean(value) && !JSON.stringify((window as unknown as { dataLayer?: unknown }).dataLayer ?? []).includes(value); },
        noLeaks: () => baseline === JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }),
      } });
    });
  });
  test('defaults/options, visibility, copy/download, validation recovery and no state/network leaks', async ({ page }) => {
    await page.goto('/tools/password-generator.html');
    await page.waitForLoadState('networkidle');
    let requests = 0;
    page.on('request', () => { requests++; });
    expect(await page.evaluate(() => (window as unknown as { __passwordChecks: { noDraws(): boolean } }).__passwordChecks.noDraws())).toBe(true);
    expect(await page.evaluate(() => (document.querySelector('#password-output') as HTMLTextAreaElement).value === '')).toBe(true);
    await expect(page.locator('#password-length')).toHaveValue('20');
    await expect(page.locator('#password-count')).toHaveValue('1');
    for (const id of ['uppercase', 'lowercase', 'digits', 'symbols', 'require-each']) await expect(page.locator(`#password-${id}`)).toBeChecked();
    await page.locator('#password-generate').click();
    expect(await page.evaluate(() => {
      const value = (document.querySelector('#password-output') as HTMLTextAreaElement).value;
      return value.length === 20 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
    })).toBe(true);
    await expect(page.locator('#password-output')).toBeHidden();
    await page.locator('#password-visible').check(); await expect(page.locator('#password-output')).toBeVisible();
    await page.locator('#password-visible').uncheck();
    await page.locator('#password-copy').click();
    expect(await page.evaluate(() => (window as unknown as { __passwordChecks: { copied(): boolean } }).__passwordChecks.copied())).toBe(true);
    const pending = page.waitForEvent('download'); await page.locator('#password-download').click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('passwords.txt'); expect(await download.failure()).toBeNull();
    expect(await page.evaluate(() => (window as unknown as { __passwordChecks: { downloaded(): Promise<boolean> } }).__passwordChecks.downloaded())).toBe(true);
    // Synthetic plaintext download is deleted, not read back into the agent/test reporter.
    await download.delete();
    for (const id of ['uppercase', 'lowercase', 'symbols']) await page.locator(`#password-${id}`).uncheck();
    await page.locator('#password-exclude-similar').check();
    await page.locator('#password-count').fill('3'); await page.locator('#password-length').fill('8');
    await page.locator('#password-generate').click();
    expect(await page.evaluate(() => {
      const values = (document.querySelector('#password-output') as HTMLTextAreaElement).value.split('\n');
      return values.length === 3 && values.every(value => /^[2-9]{8}$/.test(value));
    })).toBe(true);
    await page.locator('#password-length').fill('7'); await page.locator('#password-generate').click();
    await expect(page.locator('#password-error')).toContainText('8~128');
    expect(await page.evaluate(() => (document.querySelector('#password-output') as HTMLTextAreaElement).value === '')).toBe(true);
    await expect(page.locator('#password-copy')).toBeDisabled();
    await page.locator('#password-length').fill('8'); await page.locator('#password-digits').uncheck();
    await page.locator('#password-generate').click(); await expect(page.locator('#password-error')).toContainText('종류');
    await page.locator('#password-reset').click(); await page.locator('#password-generate').click();
    await expect(page.locator('#password-error')).toBeEmpty();
    expect(await page.evaluate(() => (window as unknown as { __passwordChecks: { noTelemetry(): boolean } }).__passwordChecks.noTelemetry())).toBe(true);
    await page.locator('#password-clear').click();
    expect(await page.evaluate(() => (document.querySelector('#password-output') as HTMLTextAreaElement).value === '')).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __passwordChecks: { noLeaks(): boolean } }).__passwordChecks.noLeaks())).toBe(true);
    expect(requests).toBe(0);
  });
  test('Web Crypto unavailable clears output and fails closed', async ({ page }) => {
    await page.goto('/tools/password-generator.html');
    await page.locator('#password-generate').click();
    await expect(page.locator('#password-copy')).toBeEnabled();
    await page.evaluate(() => { Object.defineProperty(crypto, 'getRandomValues', { value: undefined }); });
    await page.locator('#password-generate').click();
    await expect(page.locator('#password-error')).toContainText('Crypto');
    expect(await page.evaluate(() => (document.querySelector('#password-output') as HTMLTextAreaElement).value === '')).toBe(true);
    await expect(page.locator('#password-copy')).toBeDisabled();
    await expect(page.locator('#password-download')).toBeDisabled();
  });
});

for (const kind of ['qr', 'uuid', 'password']) {
  test(`${kind} mobile page has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tools/${kind}-generator.html`);
    if (kind === 'qr') { await page.locator('#qr-input').fill('모바일'); await page.locator('#qr-size').fill('2048'); await page.locator('#qr-generate').click(); await expect(page.locator('#qr-canvas')).toBeVisible(); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
