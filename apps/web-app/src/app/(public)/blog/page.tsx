import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { generateSEOMetadata } from '@/lib/seo';
import { BLOG_POSTS } from '@/content/blog/posts';
import { getAllBlogSlugs, getBlogPostBySlug } from '@/lib/blog/mdx';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Blog — Gestion scolaire, digitalisation et logiciel d’école en Afrique',
  description:
    'Articles pratiques sur la gestion scolaire en Afrique : finance, recouvrement, examens, digitalisation, choix de logiciel et pilotage. Guides actionnables pour directeurs d’école.',
  keywords: ['blog gestion scolaire', 'logiciel gestion école', 'digitalisation école Afrique', 'pilotage éducatif'],
  path: '/blog',
});

export default async function BlogIndexPage() {
  const mdxSlugs = await getAllBlogSlugs();
  const mdxPosts = await Promise.all(mdxSlugs.map((slug) => getBlogPostBySlug(slug)));
  const mdxIndex = mdxPosts
    .filter(Boolean)
    .map((p) => ({
      slug: p!.slug,
      title: p!.frontmatter.title,
      description: p!.frontmatter.description,
      publishedAt: p!.frontmatter.publishedAt,
      keywords: p!.frontmatter.keywords ?? [],
    }));

  const fallbackIndex = [...BLOG_POSTS].map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    publishedAt: p.publishedAt,
    keywords: p.keywords,
  }));

  const posts = (mdxIndex.length ? mdxIndex : fallbackIndex).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Blog' }]} />
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Blog — Gestion scolaire & digitalisation en Afrique
        </h1>
        <p className="mt-3 text-lg text-gray-700">
          Guides concrets pour directeurs et fondateurs d’écoles : organisation, finances, examens, RH, choix de logiciel
          et transformation digitale.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6">
        {posts.map((p) => (
          <article key={p.slug} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500">{new Date(p.publishedAt).toLocaleDateString('fr-FR')}</p>
              <h2 className="text-xl font-semibold text-gray-900">
                <Link href={`/blog/${p.slug}`} className="hover:underline">
                  {p.title}
                </Link>
              </h2>
              <p className="text-gray-700">{p.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.keywords.slice(0, 4).map((k: string) => (
                  <span key={k} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {k}
                  </span>
                ))}
              </div>
              <div className="mt-4">
                <Link
                  href={`/blog/${p.slug}`}
                  className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                  Lire l’article →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

