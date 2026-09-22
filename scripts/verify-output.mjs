import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve('dist');
const expected = [
  'index.html', 'tools/securecrt-config-maker.html', 'tools/ssl-checker.html',
  'tools/remove-duplication.html', 'tools/sort.html', 'tools/unixtime.html',
  'tools/large-pdf-to-divided-images.html', 'tools/tsv-tool.html',
  'tools/base64.html', 'tools/timer.html', 'privacy.html', '404.html',
  'CNAME', 'robots.txt', 'sitemap-index.xml',
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
const toolNames = ['securecrt-config-maker', 'ssl-checker', 'remove-duplication', 'sort', 'unixtime', 'large-pdf-to-divided-images', 'tsv-tool', 'base64', 'timer'];
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
