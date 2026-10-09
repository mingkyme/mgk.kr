import QRCode from 'qrcode';
export type QrEcc = 'L' | 'M' | 'Q' | 'H';
export interface QrOptions { size?: number; ecc?: QrEcc }
export async function createQr(payload: string, options: QrOptions = {}) {
  const size = options.size ?? 384;
  const ecc = options.ecc ?? 'M';
  if (!payload) throw new Error('텍스트 또는 URL을 입력하세요.');
  if (!Number.isInteger(size) || size < 128 || size > 2048) throw new Error('크기는 128~2048 픽셀 정수여야 합니다.');
  if (!['L', 'M', 'Q', 'H'].includes(ecc)) throw new Error('오류 정정 수준은 L/M/Q/H 중 선택하세요.');
  const bytes = new TextEncoder().encode(payload).length;
  // Forced byte mode keeps the byte limit and UTF-8 representation explicit.
  const capacity = { L: 2953, M: 2331, Q: 1663, H: 1273 }[ecc];
  if (bytes > capacity) throw new Error(`${bytes} 바이트: ${ecc} 수준 최대 ${capacity} 바이트를 초과했습니다. 입력을 줄이세요.`);
  const segments: QRCode.QRCodeSegment[] = [{ data: new TextEncoder().encode(payload), mode: 'byte' }];
  const qr = QRCode.create(segments, { errorCorrectionLevel: ecc });
  const modules = qr.modules.size;
  if (size < modules + 8) throw new Error(`입력에 비해 이미지 크기가 작습니다. 최소 ${modules + 8} 픽셀 이상으로 늘리세요.`);
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const mx = Math.floor(x * (modules + 8) / size) - 4;
    const my = Math.floor(y * (modules + 8) / size) - 4;
    const black = mx >= 0 && my >= 0 && mx < modules && my < modules && qr.modules.get(my, mx);
    const offset = (y * size + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = black ? 0 : 255;
    pixels[offset + 3] = 255;
  }
  const svg = await QRCode.toString(segments, { type: 'svg', errorCorrectionLevel: ecc, width: size, margin: 4 });
  return { size, pixels, svg, bytes };
}
