import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
it('qr UI exposes manual generation and explicit download controls', () => {
  const source = readFileSync(new URL('../src/pages/tools/qr-generator.astro', import.meta.url), 'utf8');
  expect(source).toContain('id="qr-generate"');
  expect(source).toContain('id="qr-error"');
  expect(source).toContain('pagehide');
});
import jsQR from 'jsqr';
import { createQr } from '../src/lib/qr';

describe('local QR', () => {
  it('decodes exact UTF-8 Korean payload from real QR pixels', async () => {
    const payload = '안녕하세요 👋 https://example.com/?a=1&b=2';
    const qr = await createQr(payload, { size: 384, ecc: 'M' });
    expect(jsQR(qr.pixels, qr.size, qr.size)?.data).toBe(payload);
    expect(qr.bytes).toBe(new TextEncoder().encode(payload).length);
  });
  it('keeps input markup out of SVG and roundtrips every ECC level', async () => {
    const payload = '<script>alert(1)</script>& 안녕';
    for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
      const qr = await createQr(payload, { ecc });
      expect(qr.svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      expect(qr.svg.trim()).toMatch(/<\/svg>$/);
      expect(qr.svg).not.toContain('<script');
      expect(qr.svg).not.toContain(payload);
      expect(jsQR(qr.pixels, qr.size, qr.size)?.data).toBe(payload);
    }
  });
  it('rejects raster sizes smaller than the symbol plus quiet zone', async () => {
    await expect(createQr('x'.repeat(1000), { size: 128, ecc: 'H' }).then(() => true)).rejects.toThrow(/크기/);
  });
  it('rejects invalid size, ECC, empty payload and byte capacity overflow', async () => {
    await expect(createQr('')).rejects.toThrow(/입력/);
    for (const size of [0, 127, 2049, 200.5, NaN]) await expect(createQr('x', { size })).rejects.toThrow(/128.*2048/);
    await expect(createQr('x', { ecc: 'bad' as never })).rejects.toThrow(/오류 정정/);
    await expect(createQr('가'.repeat(2000), { ecc: 'H' })).rejects.toThrow(/6000.*바이트/);
  });
});
