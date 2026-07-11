import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  PUBLIC_SITE_URL,
  filterPublicPosts,
  getCategoryStats,
  getTagStats,
  buildAbsolutePostUrl,
  getLanguageAlternates,
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
  const siteLastmod = posts.length
    ? new Date(Math.max(...posts.map((post) => post.data.date.valueOf()))).toISOString()
    : new Date().toISOString();

  const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string; alternates?: Array<{ lang: string; href: string }> }> = [
    { loc: PUBLIC_SITE_URL, lastmod: siteLastmod, changefreq: 'daily', priority: '1.0' },
    { loc: `${PUBLIC_SITE_URL}/hot/`, lastmod: siteLastmod, changefreq: 'daily', priority: '0.8' },
    { loc: `${PUBLIC_SITE_URL}/categories/`, lastmod: siteLastmod, changefreq: 'weekly', priority: '0.7' },
    ...categories.map((category) => ({ loc: `${PUBLIC_SITE_URL}/categories/${slugify(category.name)}/`, lastmod: siteLastmod, changefreq: 'weekly', priority: '0.6' })),
    { loc: `${PUBLIC_SITE_URL}/tags/`, lastmod: siteLastmod, changefreq: 'weekly', priority: '0.7' },
    ...tags.map((tag) => ({ loc: `${PUBLIC_SITE_URL}/tags/${tag.slug}/`, lastmod: siteLastmod, changefreq: 'weekly', priority: '0.6' })),
    ...posts.map((post) => ({
      loc: buildAbsolutePostUrl(post.slug),
      lastmod: new Date(post.data.date).toISOString(),
      changefreq: 'monthly',
      priority: '0.9',
      alternates: getLanguageAlternates(posts, post.slug),
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map((url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>${url.lastmod ? `
    <lastmod>${xmlEscape(url.lastmod)}</lastmod>` : ''}${url.changefreq ? `
    <changefreq>${xmlEscape(url.changefreq)}</changefreq>` : ''}${url.priority ? `
    <priority>${xmlEscape(url.priority)}</priority>` : ''}${url.alternates ? `
${url.alternates.map((alternate) => `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alternate.lang)}" href="${xmlEscape(alternate.href)}" />`).join('\n')}` : ''}
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
