/**
 * SEO — Sitemap.xml dynamique par tenant
 * Next.js App Router sitemap pattern (export default function sitemap)
 */

import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
  const parts = host.split(':').length > 1 ? host.split(':')[0].split('.') : host.split('.');

  // Si pas un sous-domaine d'école, retourner un sitemap minimal pour le domaine principal
  if (parts.length < 3) {
    return [
      {
        url: 'https://academiahelm.com',
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
      },
    ];
  }

  const slug = parts[0];
  const baseUrl = `https://${slug}.academiahelm.com`;

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/#presentation`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#actualites`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#agenda`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/#galerie`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/#contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  // Récupérer les actualités publiées pour le sitemap
  try {
    const API_URL = getApiBaseUrlForRoutes();
    const res = await fetch(`${API_URL}/tenant-website/public/${slug}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.newsArticles) {
        for (const article of data.newsArticles) {
          if (article.status === 'PUBLISHED' && article.slug) {
            entries.push({
              url: `${baseUrl}/actualites/${article.slug}`,
              lastModified: new Date(article.updatedAt || article.publishedAt || new Date()),
              changeFrequency: 'monthly',
              priority: 0.6,
            });
          }
        }
      }
    }
  } catch {}

  return entries;
}
