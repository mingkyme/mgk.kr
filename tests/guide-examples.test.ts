import { expect, it } from 'vitest';
import { guides } from '../src/data/tool-guides';
import { encodeBase64, decodeBase64 } from '../src/lib/base64';
import { deduplicateLines, sortLines } from '../src/lib/lines';
import { convertCaretTabs } from '../src/lib/tsv';
import { formatDate, parseUnixInput, parseDateInput, toUnix } from '../src/lib/time';
import { buildSslCommands } from '../src/lib/ssl';
import { buildSecureCrtXml, parseSecureCrtRows } from '../src/lib/securecrt';
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { tilePdfToA4 } from '../src/lib/pdf';
it('published text examples are actual runnable outputs', () => {
  expect(encodeBase64(guides.base64.input)).toBe(guides.base64.output);
  expect(decodeBase64(guides.base64.output)).toBe(guides.base64.input);
  expect(deduplicateLines(guides['remove-duplication'].input).text).toBe(guides['remove-duplication'].output);
  expect(sortLines(guides.sort.input, 'asc').text).toBe(guides.sort.output);
  expect(convertCaretTabs(guides['tsv-tool'].input).tabs).toBe(guides['tsv-tool'].output);
});
it('published Unix example round trips', () => {
  expect(formatDate(parseUnixInput('1704067200', 'seconds').milliseconds, 'utc')).toBe(guides.unixtime.output);
  expect(toUnix(parseDateInput(guides.unixtime.output), 'seconds')).toBe(1704067200);
});
it('published command and XML excerpts are real generator output', () => {
  expect(buildSslCommands(['1.1.1.1'], ['example.com']).expiry).toBe(guides['ssl-checker'].output);
  const xml = buildSecureCrtXml(parseSecureCrtRows('production,server.example.com'), 'root', 22, '2000-01-01');
  for (const line of guides['securecrt-config-maker'].output.split('\n')) expect(xml).toContain(line);
});
it('downloadable poster produces the described four A4 tiles using the real algorithm', async () => {
  const bytes = readFileSync('public/demos/demo-poster.pdf');
  const input = await PDFDocument.load(bytes);
  expect(input.getPageCount()).toBe(1);
  expect(input.getPage(0).getSize()).toEqual({ width: 1190.56, height: 1683.78 });
  const output = await PDFDocument.load(await tilePdfToA4(bytes));
  expect(output.getPageCount()).toBe(4);
  for (const p of output.getPages()) expect(p.getSize()).toEqual({ width: 595.28, height: 841.89 });
});
