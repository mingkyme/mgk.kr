import { degrees, PDFDocument, PDFName, type PDFPage } from 'pdf-lib';

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

export type PdfProgress = (completed: number, total: number) => void;

export interface TileCoordinate {
  row: number;
  column: number;
}

function normalizedRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0;
}

export function planTileOrder(columns: number, rows: number, rotation: number): TileCoordinate[] {
  const order: TileCoordinate[] = [];
  const normalized = normalizedRotation(rotation);
  if (normalized === 90 || normalized === 270) {
    const columnOrder = normalized === 90
      ? Array.from({ length: columns }, (_, index) => index)
      : Array.from({ length: columns }, (_, index) => columns - 1 - index);
    const rowOrder = normalized === 90
      ? Array.from({ length: rows }, (_, index) => rows - 1 - index)
      : Array.from({ length: rows }, (_, index) => index);
    for (const column of columnOrder) for (const row of rowOrder) order.push({ row, column });
    return order;
  }
  const rowOrder = normalized === 180
    ? Array.from({ length: rows }, (_, index) => rows - 1 - index)
    : Array.from({ length: rows }, (_, index) => index);
  const columnOrder = normalized === 180
    ? Array.from({ length: columns }, (_, index) => columns - 1 - index)
    : Array.from({ length: columns }, (_, index) => index);
  for (const row of rowOrder) for (const column of columnOrder) order.push({ row, column });
  return order;
}

interface PagePlan {
  page: PDFPage;
  width: number;
  height: number;
  targetWidth: number;
  targetHeight: number;
  fitToPage: boolean;
  hasContents: boolean;
  rotation: number;
  columns: number;
  rows: number;
}

export async function tilePdfToA4(input: Uint8Array | ArrayBuffer, onProgress?: PdfProgress): Promise<Uint8Array> {
  const source = await PDFDocument.load(input);
  const output = await PDFDocument.create();
  const plans: PagePlan[] = source.getPages().map((page) => {
    const { width, height } = page.getSize();
    const landscape = width > height;
    const targetWidth = landscape ? A4_HEIGHT : A4_WIDTH;
    const targetHeight = landscape ? A4_WIDTH : A4_HEIGHT;
    const fitToPage = width <= targetWidth * 1.1 && height <= targetHeight * 1.1;
    return {
      page,
      width,
      height,
      targetWidth,
      targetHeight,
      fitToPage,
      hasContents: Boolean(page.node.get(PDFName.of('Contents'))),
      rotation: page.getRotation().angle,
      columns: fitToPage ? 1 : Math.max(1, Math.ceil(width / targetWidth)),
      rows: fitToPage ? 1 : Math.max(1, Math.ceil(height / targetHeight)),
    };
  });
  const total = plans.reduce((sum, plan) => sum + plan.columns * plan.rows, 0);
  let completed = 0;

  for (const plan of plans) {
    if (plan.fitToPage) {
      const page = output.addPage([plan.targetWidth, plan.targetHeight]);
      page.setRotation(degrees(plan.rotation));
      if (plan.hasContents) {
        const embedded = await output.embedPage(plan.page);
        const scale = Math.min(plan.targetWidth / plan.width, plan.targetHeight / plan.height);
        const drawWidth = plan.width * scale;
        const drawHeight = plan.height * scale;
        page.drawPage(embedded, {
          x: (plan.targetWidth - drawWidth) / 2,
          y: (plan.targetHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      }
      completed += 1;
      onProgress?.(completed, total);
      continue;
    }

    for (const { row, column } of planTileOrder(plan.columns, plan.rows, plan.rotation)) {
      const top = plan.height - row * plan.targetHeight;
      const bottom = Math.max(0, top - plan.targetHeight);
      const left = column * plan.targetWidth;
      const right = Math.min(plan.width, left + plan.targetWidth);
      const page = output.addPage([plan.targetWidth, plan.targetHeight]);
      page.setRotation(degrees(plan.rotation));
      if (plan.hasContents) {
        const embedded = await output.embedPage(plan.page, { left, right, bottom, top });
        page.drawPage(embedded, {
          x: 0,
          y: plan.targetHeight - (top - bottom),
          width: right - left,
          height: top - bottom,
        });
      }
      completed += 1;
      onProgress?.(completed, total);
    }
  }
  return output.save();
}
