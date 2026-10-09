import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { toolSlugs } from '../src/data/tool-catalog.ts';

const root = resolve('dist');
const expected = [
  'index.html', ...toolSlugs.map(name => `tools/${name}.html`),
  'privacy.html', '404.html', 'CNAME', 'robots.txt', 'sitemap-index.xml',
];
const missing = expected.filter((path) => !existsSync(join(root, path)));
const walk = (directory) => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const broken = [];
for (const html of walk(root).filter((path) => path.endsWith('.html'))) {
  const source = readFileSync(html, 'utf8');
  const links = [...source.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(?:https?:|mailto:|data:|blob:|#)/.test(link)) continue;
    const pathname = link.split(/[?#]/, 1)[0];
    if (!pathname) continue;
    let target = pathname.startsWith('/')
      ? join(root, pathname === '/' ? 'index.html' : pathname.slice(1))
      : resolve(dirname(html), pathname);
    if (pathname.endsWith('/') && pathname !== '/') target = join(target, 'index.html');
    if (!existsSync(target)) broken.push(`${relative(root, html)} → ${link}`);
  }
}
const sitemap = readFileSync(join(root, 'sitemap-0.xml'), 'utf8');
const urls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
const toolNames = toolSlugs;
const requiredUrls = new Set(['https://mgk.kr/', 'https://mgk.kr/privacy.html', ...toolNames.map((name) => `https://mgk.kr/tools/${name}.html`)]);
const sitemapMissing = [...requiredUrls].filter((url) => !urls.has(url));
const lastmodCount = (sitemap.match(/<lastmod>/g) ?? []).length;
console.log(`expected_outputs=${expected.length} missing=${missing.length}`);
console.log(`internal_links_broken=${broken.length}`);
console.log(`sitemap_urls=${urls.size} required_missing=${sitemapMissing.length} lastmod_elements=${lastmodCount}`);
if (missing.length || broken.length || sitemapMissing.length || lastmodCount) {
  console.error({ missing, broken, sitemapMissing, lastmodCount });
  process.exit(1);
}

const seoErrors = [];
const assert = (condition, message) => { if (!condition) seoErrors.push(message); };
const titles = new Set();
const descriptions = new Set();
for (const file of expected.filter(p => p.endsWith('.html'))) {
  const source = readFileSync(join(root, file), 'utf8');
  const meta = (name) => {
    const tag = [...source.matchAll(/<meta\s+[^>]*>/g)].map(m => m[0]).find(t => t.includes(`name="${name}"`) || t.includes(`property="${name}"`));
    return tag?.match(/content="([^"]*)"/)?.[1];
  };
  const title = source.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = meta('description');
  assert(title && !titles.has(title), `${file}: missing/duplicate title`); titles.add(title);
  assert(description && !descriptions.has(description), `${file}: missing/duplicate description`); descriptions.add(description);
  assert(file === '404.html' ? meta('robots') === 'noindex' : !meta('robots')?.includes('noindex'), `${file}: robots`);
  const canonical = `https://mgk.kr/${file === 'index.html' ? '' : file}`;
  assert(source.includes(`rel="canonical" href="${canonical}"`), `${file}: canonical`);
  assert(meta('twitter:card') === 'summary_large_image' && meta('og:image:width') === '1200' && meta('og:image:height') === '630' && meta('og:image:alt'), `${file}: social metadata`);
  try {
    const image = new URL(meta('og:image'));
    assert(image.origin === 'https://mgk.kr' && image.pathname.endsWith('.png'), `${file}: local PNG`);
    const bytes = readFileSync(join(root, image.pathname));
    assert(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.readUInt32BE(16) === 1200 && bytes.readUInt32BE(20) === 630, `${file}: PNG dimensions`);
  } catch { seoErrors.push(`${file}: missing OG asset`); }
  const schema = [...source.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
  if (file.startsWith('tools/')) {
    for (const id of ['usage', 'examples', 'limitations', 'faq', 'related-tools']) assert(source.includes(`id="${id}"`), `${file}: ${id}`);
    const app = schema[0]?.['@graph']?.find(n => n['@type'] === 'WebApplication');
    const crumbs = schema[0]?.['@graph']?.find(n => n['@type'] === 'BreadcrumbList');
    assert(app?.url === canonical && app.name && app.description && app.offers?.price === '0' && app.offers?.priceCurrency === 'KRW' && !app.aggregateRating, `${file}: WebApplication`);
    assert(crumbs?.itemListElement?.length === 2 && crumbs.itemListElement[1].item === canonical && source.includes('aria-label="현재 위치"'), `${file}: breadcrumb`);
    assert(!source.includes('FAQPage'), `${file}: no FAQ rich-result claims`);
  } else if (file === 'index.html') assert(schema[0]?.['@graph']?.[0]?.['@type'] === 'WebSite' && schema[0]?.['@graph']?.[1]?.numberOfItems === toolSlugs.length, 'home schema');
}
assert(!/^Disallow:\s*\//m.test(readFileSync(join(root, 'robots.txt'), 'utf8')), 'robots must allow crawling');
const pdfPage = readFileSync(join(root, 'tools/large-pdf-to-divided-images.html'), 'utf8');
assert(pdfPage.includes('id="pdf-demo"') && pdfPage.includes('/demos/demo-poster.pdf') && pdfPage.includes('id="pdf-visual-guide"'), 'PDF demo markup');
assert(readFileSync(join(root, 'demos/demo-poster.pdf')).subarray(0, 5).toString() === '%PDF-', 'real demo PDF');
console.log(`seo_routes=${expected.filter(p => p.endsWith('.html')).length} seo_errors=${seoErrors.length}`);
if (seoErrors.length) { console.error(seoErrors); process.exit(1); }
