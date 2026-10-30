import type { MetadataRoute } from 'next';
import { BASE_PATH, DEMO } from '@/lib/env';
import { SITE_URL } from '@/lib/site';
export const dynamic = 'force-static';
export default function robots(): MetadataRoute.Robots {
  if (DEMO || !SITE_URL) return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: BASE_PATH + '/', disallow: ['/portal/', '/login/', '/auth/', '/tickets/', '/orders/', '/join/status/', '/xaccess/'].map((p) => BASE_PATH + p) }, sitemap: SITE_URL + '/sitemap.xml' };
}
