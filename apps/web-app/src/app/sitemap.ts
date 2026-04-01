import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/seo';
import { BLOG_POSTS } from '@/content/blog/posts';
import { getAllBlogSlugs, getBlogPostBySlug } from '@/lib/blog/mdx';

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
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
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

  const pillarEntries: MetadataRoute.Sitemap = [
    entry('/gestion-scolaire', { lastModified: now(), changeFrequency: 'weekly', priority: 0.95 }),
    entry('/logiciel-gestion-ecole', { lastModified: now(), changeFrequency: 'weekly', priority: 0.95 }),
    entry('/logiciel-ecole-afrique', { lastModified: now(), changeFrequency: 'weekly', priority: 0.95 }),
    entry('/gestion-etablissement-scolaire', { lastModified: now(), changeFrequency: 'weekly', priority: 0.95 }),
  ];

  const blogIndexEntry: MetadataRoute.Sitemap = [
    entry('/blog', { lastModified: now(), changeFrequency: 'weekly', priority: 0.85 }),
  ];

  const mdxSlugs = await getAllBlogSlugs();
  const mdxPosts = await Promise.all(mdxSlugs.map((s) => getBlogPostBySlug(s)));
  const mdxEntries: MetadataRoute.Sitemap = mdxPosts
    .filter(Boolean)
    .map((p) =>
      entry(`/blog/${p!.slug}`, {
        lastModified: p!.frontmatter.updatedAt ? new Date(p!.frontmatter.updatedAt) : new Date(p!.frontmatter.publishedAt),
        changeFrequency: 'monthly',
        priority: 0.7,
      }),
    );

  const fallbackEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((p) =>
    entry(`/blog/${p.slug}`, {
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(p.publishedAt),
      changeFrequency: 'monthly',
      priority: 0.7,
    }),
  );

  const blogPostEntries = mdxEntries.length ? mdxEntries : fallbackEntries;

  return [...staticEntries, ...pillarEntries, ...blogIndexEntry, ...blogPostEntries];
}
