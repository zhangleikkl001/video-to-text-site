import type { CollectionEntry } from 'astro:content';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

export function getLocalizedPostSlug(posts: CollectionEntry<'posts'>[], slug: string, lang: string) {
	const baseSlug = getBaseSlug(slug);
	const sameBasePosts = posts.filter((post) => getBaseSlug(post.slug) === baseSlug);
	const localized = sameBasePosts.find((post) => getLangFromSlug(post.slug) === lang);
	return localized?.slug || sameBasePosts[0]?.slug || slug;
}

export function getLocalizedPostEntry(posts: CollectionEntry<'posts'>[], slug: string, lang: string) {
	const localizedSlug = getLocalizedPostSlug(posts, slug, lang);
	return posts.find((post) => post.slug === localizedSlug);
}

export function getLocalizedPostUrl(posts: CollectionEntry<'posts'>[], slug: string, lang: string) {
	return buildAbsolutePostUrl(getLocalizedPostSlug(posts, slug, lang));
}

export function deduplicateByBaseSlugPreferLang(posts: CollectionEntry<'posts'>[], preferredLang = 'en') {
	const deduped = deduplicateByBaseSlug(sortLatest(posts));
	return deduped.map((post) => getLocalizedPostEntry(posts, post.slug, preferredLang) || post);
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

export function extractImageUrls(body?: string) {
	if (!body) return [];

	const urls = [...body.matchAll(/!\[[^\]]*\]\(\s*<?([^>\s)]+)>?(?:\s+"[^"]*")?\s*\)/g)]
		.map((match) => match[1].trim())
		.filter(Boolean);

	return [...new Set(urls)];
}

type ImageDimensions = { width: number; height: number };

const thumbnailCache = new Map<string, string>();
const imageSizeCache = new Map<string, ImageDimensions | null>();

function getLocalAssetPath(src: string) {
	if (!src.startsWith('/')) return null;
	const filePath = join(process.cwd(), 'public', src.slice(1));
	return existsSync(filePath) ? filePath : null;
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
	let offset = 2;
	while (offset + 9 < buffer.length) {
		if (buffer[offset] !== 0xff) return null;
		const marker = buffer[offset + 1];
		offset += 2;

		if (marker === 0xd8 || marker === 0xd9) continue;
		const size = buffer.readUInt16BE(offset);
		if (size < 2 || offset + size > buffer.length) return null;

		if (
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf)
		) {
			return {
				height: buffer.readUInt16BE(offset + 3),
				width: buffer.readUInt16BE(offset + 5),
			};
		}

		offset += size;
	}

	return null;
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
	if (buffer.length < 24) return null;
	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
	};
}

function readGifDimensions(buffer: Buffer): ImageDimensions | null {
	if (buffer.length < 10) return null;
	return {
		width: buffer.readUInt16LE(6),
		height: buffer.readUInt16LE(8),
	};
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
	if (buffer.length < 30) return null;
	const chunkHeader = buffer.toString('ascii', 12, 16);

	if (chunkHeader === 'VP8X' && buffer.length >= 30) {
		return {
			width: 1 + buffer.readUIntLE(24, 3),
			height: 1 + buffer.readUIntLE(27, 3),
		};
	}

	if (chunkHeader === 'VP8 ' && buffer.length >= 30) {
		return {
			width: buffer.readUInt16LE(26) & 0x3fff,
			height: buffer.readUInt16LE(28) & 0x3fff,
		};
	}

	if (chunkHeader === 'VP8L' && buffer.length >= 25) {
		const bits = buffer.readUInt32LE(21);
		return {
			width: (bits & 0x3fff) + 1,
			height: ((bits >> 14) & 0x3fff) + 1,
		};
	}

	return null;
}

function getImageDimensions(filePath: string) {
	const cached = imageSizeCache.get(filePath);
	if (cached !== undefined) return cached;

	try {
		const buffer = readFileSync(filePath);
		let dimensions: ImageDimensions | null = null;

		if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) dimensions = readJpegDimensions(buffer);
		else if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) dimensions = readPngDimensions(buffer);
		else if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') dimensions = readGifDimensions(buffer);
		else if (buffer.length >= 16 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') dimensions = readWebpDimensions(buffer);

		imageSizeCache.set(filePath, dimensions);
		return dimensions;
	} catch {
		imageSizeCache.set(filePath, null);
		return null;
	}
}

function scoreThumbnailCandidate(src: string, isPrimary = false) {
	if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return isPrimary ? 1.1 : 0.9;

	const filePath = getLocalAssetPath(src);
	if (!filePath) return isPrimary ? 0.4 : 0.1;

	const dimensions = getImageDimensions(filePath);
	if (!dimensions) return isPrimary ? 0.45 : 0.2;

	const { width, height } = dimensions;
	const ratio = width / height;
	const areaScore = Math.min((width * height) / 1000000, 1.8);

	let ratioScore = 1;
	if (ratio < 0.85) ratioScore = 0.35;
	else if (ratio < 1.15) ratioScore = 1;
	else if (ratio < 2.2) ratioScore = 1.25;
	else if (ratio < 3.2) ratioScore = 0.85;
	else ratioScore = 0.55;

	let sizeScore = 1;
	if (width < 500 || height < 300) sizeScore = 0.25;
	else if (width < 800 || height < 400) sizeScore = 0.7;

	const primaryBonus = isPrimary ? 1.12 : 1;
	return areaScore * ratioScore * sizeScore * primaryBonus;
}

export function resolvePostThumbnail(post: CollectionEntry<'posts'>) {
	const cached = thumbnailCache.get(post.slug);
	if (cached !== undefined) return cached;

	const candidates = [...new Set([post.data.cover_image, ...extractImageUrls(post.body)])]
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value));

	let bestCandidate = '';
	let bestScore = 0;

	for (const candidate of candidates) {
		const score = scoreThumbnailCandidate(candidate, candidate === post.data.cover_image);
		if (score > bestScore) {
			bestCandidate = candidate;
			bestScore = score;
		}
	}

	thumbnailCache.set(post.slug, bestCandidate);
	return bestCandidate;
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
		coverImage: resolvePostThumbnail(post),
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
