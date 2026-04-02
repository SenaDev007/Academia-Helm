import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import PremiumHeader from '@/components/layout/PremiumHeader';
import InstitutionalFooter from '@/components/public/InstitutionalFooter';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import CTA from '@/components/seo/CTA';
import JsonLd from '@/components/seo/JsonLd';
import { ArticleLayout } from '@/components/articles/ArticleLayout';
import { generateSEOMetadata } from '@/lib/seo';
import { buildFaqJsonLd } from '@/lib/seo/faq-jsonld';
import { BLOG_POSTS, getBlogPost } from '@/content/blog/posts';
import { getAllBlogSlugs, getBlogPostBySlug, renderBlogMdx } from '@/lib/blog/mdx';
import LeadMagnet from '@/components/LeadMagnet';
import StickyCTA from '@/components/StickyCTA';
import { extractFaqFromMdx } from '@/lib/blog/faq-from-mdx';
import { ctaLabelForVariant, getAbVariant } from '@/lib/seo/ab-testing';
import type { Article } from '@/types/article';
import { BLOG_DEFAULT_COVER, DEFAULT_ARTICLE_AUTHOR_AVATAR } from '@/data/articles';
import { ArticleFaq, ArticleSection } from '@/components/articles/blocks/ArticleBlocks';

export async function generateStaticParams() {
  const mdxSlugs = await getAllBlogSlugs();
  const merged = new Set<string>([...mdxSlugs, ...BLOG_POSTS.map((p) => p.slug)]);
  return Array.from(merged).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).replace(/\/+$/, '');
  const mdx = await getBlogPostBySlug(slug);
  if (mdx) {
    return generateSEOMetadata({
      title: mdx.frontmatter.title,
      description: mdx.frontmatter.description,
      keywords: mdx.frontmatter.keywords ?? [],
      path: `/blog/${slug}`,
    });
  }
  const post = getBlogPost(slug);
  if (!post) return {};
  return generateSEOMetadata({ title: post.title, description: post.description, keywords: post.keywords, path: `/blog/${post.slug}` });
}

function toURLSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const sp = new URLSearchParams();
  if (!searchParams) return sp;
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) sp.set(k, v[0] ?? '');
    else sp.set(k, v);
  }
  return sp;
}

export default async function BlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).replace(/\/+$/, '');
  const mdxPost = await getBlogPostBySlug(slug);
  const fallbackPost = getBlogPost(slug);
  if (!mdxPost && !fallbackPost) notFound();

  const title = mdxPost?.frontmatter.title ?? fallbackPost!.title;
  const description = mdxPost?.frontmatter.description ?? fallbackPost!.description;
  const publishedAt = mdxPost?.frontmatter.publishedAt ?? fallbackPost!.publishedAt;
  const updatedAt = mdxPost?.frontmatter.updatedAt ?? fallbackPost!.updatedAt;
  const keywords = mdxPost?.frontmatter.keywords ?? fallbackPost!.keywords;

  const coverImageUrl = BLOG_DEFAULT_COVER;

  function estimateReadingTimeMinutes(text: string) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(3, Math.round(words / 200));
  }

  const readingTime = mdxPost
    ? estimateReadingTimeMinutes(mdxPost.content)
    : estimateReadingTimeMinutes(
        [fallbackPost!.h1, ...fallbackPost!.sections.flatMap((s) => [s.heading, ...s.paragraphs])]
          .filter(Boolean)
          .join(' '),
      );

  const article: Article = {
    id: `blog-${slug}`,
    slug: `blog/${slug}`,
    title,
    description,
    content: mdxPost?.content,
    coverImage: {
      url: coverImageUrl,
      alt: title,
      credit: 'Academia Helm',
    },
    author: {
      name: 'Équipe Academia Helm',
      role: 'Rédaction & expertise gestion scolaire',
      avatar: DEFAULT_ARTICLE_AUTHOR_AVATAR,
    },
    category: 'Blog',
    tags: (keywords ?? []).slice(0, 12),
    publishedAt,
    updatedAt: updatedAt ?? publishedAt,
    readingTime,
    status: 'published',
    seo: {
      title,
      description,
      canonical: `https://academiahelm.com/blog/${slug}`,
      ogImage: coverImageUrl,
    },
  };

  const faqFromMdx = mdxPost ? extractFaqFromMdx(mdxPost.content) : [];
  const faqForJson =
    faqFromMdx.length > 0
      ? faqFromMdx
      : fallbackPost
        ? fallbackPost.faq
        : [
            {
              question: 'Comment tester Academia Helm gratuitement ?',
              answer: 'Cliquez sur “Tester gratuitement Academia Helm” pour démarrer la création de votre établissement.',
            },
          ];

  const faqJsonLd = buildFaqJsonLd(faqForJson);
  const mdxContent = mdxPost ? await renderBlogMdx(mdxPost.content) : null;

  const h = await headers();
  const resolvedSearchParams = (await Promise.resolve(searchParams ?? {})) as Record<
    string,
    string | string[] | undefined
  >;
  const variant = getAbVariant(toURLSearchParams(resolvedSearchParams), h.get('cookie'));
  const ctaLabel = ctaLabelForVariant(variant);

  return (
    <>
      <PremiumHeader />
      <JsonLd data={faqJsonLd} />
      <ArticleLayout article={article}>
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Blog', href: '/blog' }, { label: title }]} />

        {mdxContent ? (
          <>{mdxContent}</>
        ) : (
          <>
            {fallbackPost!.sections.map((s) => (
              <ArticleSection key={s.heading} title={s.heading}>
                {s.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </ArticleSection>
            ))}

            <ArticleFaq title="FAQ" items={fallbackPost!.faq} />
          </>
        )}

        <ArticleSection eyebrow="Ressources" title="Ressources liées">
          <p>
            Pages piliers :{' '}
            <Link href="/gestion-scolaire" className="font-semibold text-blue-700 hover:underline">
              gestion scolaire
            </Link>
            ,{' '}
            <Link href="/logiciel-gestion-ecole" className="font-semibold text-blue-700 hover:underline">
              logiciel de gestion d’école
            </Link>
            ,{' '}
            <Link href="/logiciel-ecole-afrique" className="font-semibold text-blue-700 hover:underline">
              logiciel école Afrique
            </Link>
            ,{' '}
            <Link href="/gestion-etablissement-scolaire" className="font-semibold text-blue-700 hover:underline">
              gestion d’établissement scolaire
            </Link>
            .
          </p>
          <p>
            Le produit :{' '}
            <Link href="/modules" className="font-semibold text-blue-700 hover:underline">
              modules
            </Link>{' '}
            ·{' '}
            <Link href="/tarification" className="font-semibold text-blue-700 hover:underline">
              tarification
            </Link>{' '}
            ·{' '}
            <Link href="/contact" className="font-semibold text-blue-700 hover:underline">
              contact
            </Link>
            .
          </p>
        </ArticleSection>

        <ArticleSection eyebrow="Démo" title="Tester Academia Helm">
          <p>
            Si vous cherchez un logiciel de gestion scolaire adapté à l’Afrique (finance, scolarité, examens, RH),
            Academia Helm est conçu pour passer du “papier/Excel” à un pilotage clair.
          </p>
        </ArticleSection>

        <LeadMagnet sourceSlug={slug} keywords={keywords ?? []} ctaLabel={ctaLabel} />
        <CTA />
        <StickyCTA ctaLabel={ctaLabel} />

        <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Explorer d’autres articles</h2>
          <p className="mt-2 text-gray-700">
            Retour au{' '}
            <Link href="/blog" className="text-blue-700 hover:underline">
              blog
            </Link>
            .
          </p>
        </section>
      </ArticleLayout>
      <div className="bg-[#08255a] border-t border-amber-400/20">
        <InstitutionalFooter />
      </div>
    </>
  );
}

