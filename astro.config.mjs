import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { getSiteUrl } from './scripts/site-url.mjs';

export default defineConfig({
  site: getSiteUrl(),
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap({
    filter: (page) => !page.endsWith('/404/') && !page.endsWith('/search/'),
  })],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
