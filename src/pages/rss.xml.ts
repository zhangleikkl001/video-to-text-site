import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  PUBLIC_SITE_URL,
  buildAbsolutePostUrl,
  filterPublicPosts,
  getPostCategory,
  getPostDescription,
  resolveAbsoluteUrl,
  resolvePostThumbnail,
  sortLatest,
} from '../lib/content';

const xmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const cdata = (value: string) => `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;

const imageMimeType = (url: string) => {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.gif')) return 'image/gif';
  return 'image/webp';
};

export const GET: APIRoute = async () => {
  const posts = sortLatest(filterPublicPosts(await getCollection('posts'))).slice(0, 100);
  const lastBuildDate = posts[0]?.data.date || new Date();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GlobalFeed</title>
    <link>${PUBLIC_SITE_URL}/</link>
    <description>Multilingual travel, culture, food, and city stories from China.</description>
    <language>en</language>
    <lastBuildDate>${new Date(lastBuildDate).toUTCString()}</lastBuildDate>
    <atom:link href="${PUBLIC_SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${posts
  .map((post) => {
    const url = buildAbsolutePostUrl(post.slug);
    const thumbnail = resolveAbsoluteUrl(resolvePostThumbnail(post));
    const category = getPostCategory(post);
    return `    <item>
      <title>${cdata(post.data.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <description>${cdata(getPostDescription(post, 240))}</description>
      <pubDate>${new Date(post.data.date).toUTCString()}</pubDate>
      <category>${cdata(category)}</category>${thumbnail ? `
      <enclosure url="${xmlEscape(thumbnail)}" type="${imageMimeType(thumbnail)}" />` : ''}
    </item>`;
  })
  .join('\n')}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
