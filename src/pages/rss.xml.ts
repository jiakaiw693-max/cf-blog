import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { siteConfig } from '../config';
import { getPosts, postHref } from '../lib/posts';

export const GET: APIRoute = async context => rss({
  title: siteConfig.title,
  description: siteConfig.description,
  site: context.site!,
  items: (await getPosts()).map(post => ({ title: post.data.title, description: post.data.description, pubDate: post.data.publishedAt, link: postHref(post) })),
  customData: '<language>zh-CN</language>',
});
