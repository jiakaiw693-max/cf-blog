import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export async function getPosts(): Promise<Post[]> {
  return (await getCollection('blog', ({ data }) => !data.draft && data.publishedAt <= new Date()))
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime() || a.id.localeCompare(b.id));
}

export const postHref = (post: Post) => `/posts/${post.id.split('/').map(encodeURIComponent).join('/')}/`;
export const tagHref = (tag: string) => `/tags/${encodeURIComponent(tag)}/`;

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' })
    .format(date).replaceAll('/', '.');
}

export function readingMinutes(post: Post): number {
  const body = post.body ?? '';
  const chinese = (body.match(/[\p{Script=Han}]/gu) ?? []).length;
  const words = (body.match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.ceil(chinese / 350 + words / 220));
}

export function getTags(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of new Set(post.data.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}
