import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    slug: z.string().regex(/^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u, 'slug 只能使用文字、数字、短横线、下划线，以及分隔层级的斜线').optional(),
    publishedAt: z.union([z.string().trim().min(1), z.date()]).pipe(z.coerce.date()),
    updatedAt: z.union([z.string().trim().min(1), z.date()]).pipe(z.coerce.date()).optional(),
    tags: z.array(z.string().trim().min(1)).default([]).transform(tags => [...new Set(tags)]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    example: z.boolean().default(false),
  }).refine((data) => !data.updatedAt || data.updatedAt >= data.publishedAt, {
    message: '更新时间不能早于发布日期',
    path: ['updatedAt'],
  }),
});

export const collections = { blog };
