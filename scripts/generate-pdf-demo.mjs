import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';
import { tilePdfToA4, A4_WIDTH as w, A4_HEIGHT as h, planTileOrder } from '../src/lib/pdf.ts';
const doc = await PDFDocument.create();
const epoch = new Date('2000-01-01T00:00:00Z');
doc.setCreationDate(epoch); doc.setModificationDate(epoch); doc.setTitle('mgk.kr 2 by 2 A4 demo poster');
const page = doc.addPage([w * 2, h * 2]);
const font = await doc.embedFont(StandardFonts.Helvetica);
const colors = ['#bfdbfe', '#bbf7d0', '#fde68a', '#fecaca'];
const order = planTileOrder(2, 2, 0);
for (const [i, { row, column }] of order.entries()) {
  const hex = colors[i]; const parts = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
  page.drawRectangle({ x: column * w, y: (1 - row) * h, width: w, height: h, color: rgb(...parts) });
  page.drawText(`TILE ${i + 1}`, { x: column * w + 50, y: (2 - row) * h - 100, font, size: 48 });
}
await mkdir('public/demos', { recursive: true });
const bytes = await doc.save();
await writeFile('public/demos/demo-poster.pdf', bytes);
const result = await PDFDocument.load(await tilePdfToA4(bytes), { updateMetadata: false });
if (result.getPageCount() !== 4 || result.getPages().some(p => p.getWidth() !== w || p.getHeight() !== h)) throw new Error('Demo tiling geometry mismatch');
// Geometry diagrams, not screenshots: same colored cells and TILE labels as the PDF.
const cell = (i, x, y) => `<rect x="${x}" y="${y}" width="119.056" height="168.378" fill="${colors[i]}" stroke="#334155"/><text x="${x + 10}" y="${y + 20}" font-size="10" font-family="sans-serif">TILE ${i + 1}</text>`;
const svg = (title, width, cells) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="380" viewBox="0 0 ${width} 380" role="img"><title>${title}</title><rect width="100%" height="100%" fill="white"/>${cells}</svg>`;
await writeFile('public/demos/pdf-before.svg', svg('Original poster: 2 by 2 A4 regions on one page', 280, order.map(({row,column}, i) => cell(i,20+column*w*.2,20+row*h*.2)).join('')));
await writeFile('public/demos/pdf-after.svg', svg('Four separate A4 pages in reading order', 300, order.map((_,i) => cell(i,10+(i%2)*140,10+Math.floor(i/2)*190)).join('')));
console.log('Demo verified: 1 source page → 4 A4 pages; generated PDF and two geometry guides.');
