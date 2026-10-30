import type { MetadataRoute } from 'next';
import { DEMO } from '@/lib/env';
import { PUBLIC_ROUTES, SITE_URL, siteUrl } from '@/lib/site';
export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  if (DEMO || !SITE_URL) return [];
  return PUBLIC_ROUTES.map((path) => ({ url: siteUrl(path), changeFrequency: path === '/' || path === '/events' ? 'weekly' : 'monthly', priority: path === '/' ? 1 : 0.7 }));
}
