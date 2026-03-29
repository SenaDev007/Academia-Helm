import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/seo';

type SitemapEntry = MetadataRoute.Sitemap[number];

const now = () => new Date();

function entry(path: string, opts: Omit<SitemapEntry, 'url'>): SitemapEntry {
  const base = getPublicSiteUrl();
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  return {
    url: `${base}${pathPart === '/' ? '' : pathPart}` || base,
    ...opts,
  };
}

/**
 * Pages publiques à indexer (hors flux onboarding, auth, app).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    entry('/', { lastModified: now(), changeFrequency: 'weekly', priority: 1 }),
    entry('/en', { lastModified: now(), changeFrequency: 'monthly', priority: 0.85 }),
    entry('/pricing', { lastModified: now(), changeFrequency: 'weekly', priority: 0.95 }),
    entry('/modules', { lastModified: now(), changeFrequency: 'monthly', priority: 0.9 }),
    entry('/signup', { lastModified: now(), changeFrequency: 'monthly', priority: 0.9 }),
    entry('/tarification', { lastModified: now(), changeFrequency: 'monthly', priority: 0.85 }),
    entry('/orion', { lastModified: now(), changeFrequency: 'monthly', priority: 0.85 }),
    entry('/patronat-examens', { lastModified: now(), changeFrequency: 'monthly', priority: 0.8 }),
    entry('/securite', { lastModified: now(), changeFrequency: 'monthly', priority: 0.8 }),
    entry('/contact', { lastModified: now(), changeFrequency: 'monthly', priority: 0.75 }),
    entry('/testimonials', { lastModified: now(), changeFrequency: 'monthly', priority: 0.65 }),
    entry('/legal/cgu', { lastModified: now(), changeFrequency: 'yearly', priority: 0.35 }),
    entry('/legal/cgv', { lastModified: now(), changeFrequency: 'yearly', priority: 0.35 }),
    entry('/legal/privacy', { lastModified: now(), changeFrequency: 'yearly', priority: 0.35 }),
    entry('/legal/mentions', { lastModified: now(), changeFrequency: 'yearly', priority: 0.35 }),
  ];
}
