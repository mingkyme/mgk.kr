import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mgk.kr',
  build: { format: 'file' },
  integrations: [sitemap({
    filter: (page) => page !== 'https://mgk.kr/404.html',
    serialize(item) {
      const url = new URL(item.url);
      if (url.pathname !== '/' && !url.pathname.endsWith('.html')) {
        url.pathname = `${url.pathname}.html`;
        item.url = url.href;
      }
      return item;
    },
  })],
});
