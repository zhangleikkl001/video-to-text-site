import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  PUBLIC_SITE_URL,
  filterPublicPosts,
  getCategoryStats,
  getTagStats,
  buildAbsolutePostUrl,
  slugify,
} from '../lib/content';

const xmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const GET: APIRoute = async () => {
  const posts = filterPublicPosts(await getCollection('posts'));
  const categories = getCategoryStats(posts);
  const tags = getTagStats(posts);

  const urls: Array<{ loc: string; lastmod?: string }> = [
    { loc: PUBLIC_SITE_URL },
    { loc: `${PUBLIC_SITE_URL}/hot/` },
    { loc: `${PUBLIC_SITE_URL}/categories/` },
    ...categories.map((category) => ({ loc: `${PUBLIC_SITE_URL}/categories/${slugify(category.name)}/` })),
    { loc: `${PUBLIC_SITE_URL}/tags/` },
    ...tags.map((tag) => ({ loc: `${PUBLIC_SITE_URL}/tags/${tag.slug}/` })),
    ...posts.map((post) => ({ loc: buildAbsolutePostUrl(post.slug), lastmod: new Date(post.data.date).toISOString() })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>${url.lastmod ? `
    <lastmod>${xmlEscape(url.lastmod)}</lastmod>` : ''}
  </url>`)
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
