import { describe, expect, it } from 'vitest';
import { degrees, PDFDocument } from 'pdf-lib';
import { A4_HEIGHT, A4_WIDTH, planTileOrder, tilePdfToA4 } from '../src/lib/pdf';

describe('local PDF A4 tiling', () => {
  it('orders rotated tiles in visible top-left to bottom-right order', () => {
    expect(planTileOrder(2, 3, 0)).toEqual([
      { row: 0, column: 0 }, { row: 0, column: 1 },
      { row: 1, column: 0 }, { row: 1, column: 1 },
      { row: 2, column: 0 }, { row: 2, column: 1 },
    ]);
    expect(planTileOrder(2, 3, 90)).toEqual([
      { row: 2, column: 0 }, { row: 1, column: 0 }, { row: 0, column: 0 },
      { row: 2, column: 1 }, { row: 1, column: 1 }, { row: 0, column: 1 },
    ]);
    expect(planTileOrder(2, 3, 180)).toEqual([
      { row: 2, column: 1 }, { row: 2, column: 0 },
      { row: 1, column: 1 }, { row: 1, column: 0 },
      { row: 0, column: 1 }, { row: 0, column: 0 },
    ]);
    expect(planTileOrder(2, 3, 270)).toEqual([
      { row: 0, column: 1 }, { row: 1, column: 1 }, { row: 2, column: 1 },
      { row: 0, column: 0 }, { row: 1, column: 0 }, { row: 2, column: 0 },
    ]);
  });

  it('produces a parseable four-page PDF from a synthetic 2×2 A4 page', async () => {
    const source = await PDFDocument.create();
    const oversized = source.addPage([A4_WIDTH * 2, A4_HEIGHT * 2]);
    oversized.drawText('synthetic oversized PDF', { x: 24, y: 24 });
    const sourceBytes = await source.save();

    const outputBytes = await tilePdfToA4(sourceBytes);
    const output = await PDFDocument.load(outputBytes);

    expect(output.getPageCount()).toBe(4);
    for (const page of output.getPages()) {
      expect(page.getWidth()).toBeCloseTo(A4_WIDTH, 1);
      expect(page.getHeight()).toBeCloseTo(A4_HEIGHT, 1);
    }
  });

  it('preserves a normal A4 page as one A4 output page', async () => {
    const source = await PDFDocument.create();
    const a4 = source.addPage([A4_WIDTH, A4_HEIGHT]);
    a4.drawText('synthetic A4 PDF', { x: 24, y: 24 });
    const output = await PDFDocument.load(await tilePdfToA4(await source.save()));
    expect(output.getPageCount()).toBe(1);
  });

  it('preserves a blank page that has no Contents stream', async () => {
    const source = await PDFDocument.create();
    source.addPage([A4_WIDTH, A4_HEIGHT]);
    const output = await PDFDocument.load(await tilePdfToA4(await source.save()));
    expect(output.getPageCount()).toBe(1);
    expect(output.getPage(0).getWidth()).toBeCloseTo(A4_WIDTH, 1);
  });

  it('preserves page rotation metadata', async () => {
    const source = await PDFDocument.create();
    const rotated = source.addPage([A4_WIDTH, A4_HEIGHT]);
    rotated.drawText('rotated source', { x: 24, y: 24 });
    rotated.setRotation(degrees(90));
    const output = await PDFDocument.load(await tilePdfToA4(await source.save()));
    expect(output.getPageCount()).toBe(1);
    expect(output.getPage(0).getRotation().angle).toBe(90);
  });

  it('uses an A4 landscape canvas for a normal landscape page', async () => {
    const source = await PDFDocument.create();
    const landscape = source.addPage([A4_HEIGHT, A4_WIDTH]);
    landscape.drawText('landscape', { x: 24, y: 24 });
    const output = await PDFDocument.load(await tilePdfToA4(await source.save()));
    expect(output.getPageCount()).toBe(1);
    expect(output.getPage(0).getWidth()).toBeCloseTo(A4_HEIGHT, 1);
    expect(output.getPage(0).getHeight()).toBeCloseTo(A4_WIDTH, 1);
  });

  it('scales a near-A4 US Letter page to one output page', async () => {
    const source = await PDFDocument.create();
    const letter = source.addPage([612, 792]);
    letter.drawText('letter', { x: 24, y: 24 });
    const output = await PDFDocument.load(await tilePdfToA4(await source.save()));
    expect(output.getPageCount()).toBe(1);
    expect(output.getPage(0).getWidth()).toBeCloseTo(A4_WIDTH, 1);
    expect(output.getPage(0).getHeight()).toBeCloseTo(A4_HEIGHT, 1);
  });
});
