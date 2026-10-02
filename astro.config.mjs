import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { getSiteUrl } from './scripts/site-url.mjs';

export default defineConfig({
  site: getSiteUrl(),
  output: 'static',
  trailingSlash: 'always',
  prerenderConflictBehavior: 'error',
  integrations: [sitemap({
    filter: (page) => !['/404/', '/search/', '/reading-list/'].some(path => page.endsWith(path)),
  })],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
