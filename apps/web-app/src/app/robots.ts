import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/seo';

/**
 * robots.txt généré dynamiquement (URL sitemap = NEXT_PUBLIC_APP_URL).
 */
export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/app/',
          '/api/',
          '/auth/',
          '/dashboard/',
          '/verify/',
          '/forgot-password',
          '/tenant-not-found',
          '/onboarding-error',
          '/onboarding/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
