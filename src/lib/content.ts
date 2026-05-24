import type { CollectionEntry } from 'astro:content';

export const PUBLIC_SITE_URL = 'https://lifeofcity.com';
export const LANG_SUFFIXES = ['-en', '-es', '-fr', '-de', '-ja'] as const;

export function getLangFromSlug(slug: string) {
	for (const suffix of LANG_SUFFIXES) {
		if (slug.endsWith(suffix)) return suffix.slice(1);
	}
	return 'zh';
}

export function isPublicTranslatedPost(slug: string) {
	return LANG_SUFFIXES.some((suffix) => slug.endsWith(suffix));
}

export function filterPublicPosts(posts: CollectionEntry<'posts'>[]) {
	return posts.filter((post) => isPublicTranslatedPost(post.slug));
}

export function getBaseSlug(slug: string) {
	for (const suffix of LANG_SUFFIXES) {
		if (slug.endsWith(suffix)) return slug.slice(0, -suffix.length);
	}
	return slug;
}

export function deduplicateByBaseSlug(posts: CollectionEntry<'posts'>[]) {
	const seen = new Set<string>();
	const result: CollectionEntry<'posts'>[] = [];

	for (const post of posts) {
		const base = getBaseSlug(post.slug);
		if (!seen.has(base)) {
			seen.add(base);
			result.push(post);
		}
	}

	return result;
}

export function sortLatest(posts: CollectionEntry<'posts'>[]) {
	return [...posts].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function slugify(value: string) {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'untitled';
}

export function excerptFromBody(body?: string, maxLength = 160) {
	if (!body) return '';
	const cleaned = body
		.replace(/\n+/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/\*\*(.*?)\*\*/g, '$1')
		.replace(/\*(.*?)\*/g, '$1')
		.replace(/\[(.*?)\]\((.*?)\)/g, '$1')
		.trim();

	if (cleaned.length <= maxLength) return cleaned;
	return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}

export function normalizeSearchText(value: string) {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^\p{L}\p{N}\s-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function buildAbsolutePostUrl(slug: string) {
	return `${PUBLIC_SITE_URL}/posts/${slug}/`;
}

export function getCategoryStats(posts: CollectionEntry<'posts'>[]) {
	const counts = new Map<string, number>();
	for (const post of deduplicateByBaseSlug(sortLatest(posts))) {
		const category = post.data.category?.trim() || 'Uncategorized';
		counts.set(category, (counts.get(category) || 0) + 1);
	}

	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([name, count]) => ({
			name,
			slug: slugify(name),
			count,
		}));
}

export function getTagStats(posts: CollectionEntry<'posts'>[]) {
	const counts = new Map<string, number>();
	for (const post of deduplicateByBaseSlug(sortLatest(posts))) {
		for (const tag of post.data.tags || []) {
			const normalized = tag.trim();
			if (!normalized) continue;
			counts.set(normalized, (counts.get(normalized) || 0) + 1);
		}
	}

	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([name, count]) => ({
			name,
			slug: slugify(name),
			count,
		}));
}

export function filterPostsByCategory(posts: CollectionEntry<'posts'>[], category: string) {
	return deduplicateByBaseSlug(sortLatest(posts)).filter((post) => post.data.category === category);
}

export function filterPostsByTag(posts: CollectionEntry<'posts'>[], tag: string) {
	return deduplicateByBaseSlug(sortLatest(posts)).filter((post) => (post.data.tags || []).includes(tag));
}

export function getTrendingPosts(posts: CollectionEntry<'posts'>[], limit = 6) {
	const uniquePosts = deduplicateByBaseSlug(sortLatest(posts));
	const now = Date.now();

	return uniquePosts
		.map((post) => {
			const ageDays = Math.max(0, (now - post.data.date.valueOf()) / 86_400_000);
			const tagScore = (post.data.tags || []).length * 4;
			const freshScore = Math.max(0, 120 - ageDays * 2.5);
			const headlineScore = Math.max(0, 24 - post.data.title.length / 3);
			const score = freshScore + tagScore + headlineScore;
			return { post, score };
		})
		.sort((a, b) => b.score - a.score || b.post.data.date.valueOf() - a.post.data.date.valueOf())
		.slice(0, limit)
		.map((entry) => entry.post);
}

export function buildSearchIndex(posts: CollectionEntry<'posts'>[]) {
	return deduplicateByBaseSlug(sortLatest(posts)).map((post) => ({
		title: post.data.title,
		slug: post.slug,
		url: buildAbsolutePostUrl(post.slug),
		category: post.data.category,
		tags: post.data.tags || [],
		lang: getLangFromSlug(post.slug),
		date: post.data.date.toISOString(),
		excerpt: excerptFromBody(post.body, 220),
		coverImage: post.data.cover_image || '',
		searchText: normalizeSearchText([
			post.data.title,
			post.data.category,
			...(post.data.tags || []),
			excerptFromBody(post.body, 600),
		].join(' ')),
	}));
}

export function getShareLinks(url: string, title: string) {
	const encodedUrl = encodeURIComponent(url);
	const encodedTitle = encodeURIComponent(title);
	return {
		x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
		facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
		linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
		telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
		whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
	};
}
