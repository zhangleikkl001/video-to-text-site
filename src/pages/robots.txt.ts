import type { APIRoute } from 'astro';
import { PUBLIC_SITE_URL } from '../lib/content';

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /
Sitemap: ${PUBLIC_SITE_URL}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
