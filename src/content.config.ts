import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string().min(1)).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    example: z.boolean().default(false),
  }).refine((data) => !data.updatedAt || data.updatedAt >= data.publishedAt, {
    message: '更新时间不能早于发布日期',
    path: ['updatedAt'],
  }),
});

export const collections = { blog };
