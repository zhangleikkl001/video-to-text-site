import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		date: z.date(),
		category: z.string(),
		tags: z.array(z.string()),
		cover_image: z.string(),
		original_video_url: z.string().optional(),
	}),
});

export const collections = { posts };
