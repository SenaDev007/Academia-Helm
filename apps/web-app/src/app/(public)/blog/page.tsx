import type { Metadata } from 'next';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { generateSEOMetadata } from '@/lib/seo';
import { BLOG_POSTS } from '@/content/blog/posts';
import { getAllBlogSlugs, getBlogPostBySlug } from '@/lib/blog/mdx';
import BlogGrid from './BlogGrid';
import NewsletterForm from './NewsletterForm';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Blog — Gestion scolaire, digitalisation et logiciel d\u2019école en Afrique',
  description:
    'Articles pratiques sur la gestion scolaire en Afrique : finance, recouvrement, examens, digitalisation, choix de logiciel et pilotage. Guides actionnables pour directeurs d\u2019école.',
  keywords: ['blog gestion scolaire', 'logiciel gestion \u00e9cole', 'digitalisation \u00e9cole Afrique', 'pilotage \u00e9ducatif'],
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
    <>
      <Header />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION — Navy gradient with gold accents
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b2f73] via-[#0f3a8a] to-[#1d4fa5]">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#f5b335]/5" />
          <div className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-white/[0.03]" />
          <div className="absolute right-1/4 top-1/3 h-[200px] w-[200px] rounded-full bg-[#f5b335]/5" />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8">
          {/* Breadcrumbs — light-on-dark override */}
          <div className="mb-5 [&_a]:text-white/60 [&_a]:hover:text-white [&_span]:text-white/40 [&_span[aria-current]]:text-white/80">
            <Breadcrumbs
              items={[
                { label: 'Accueil', href: '/' },
                { label: 'Blog' },
              ]}
            />
          </div>

          <div className="max-w-3xl">
            {/* Gold accent bar */}
            <div className="mb-6 flex items-center gap-3">
              <div className="h-1 w-12 rounded-full bg-[#f5b335]" />
              <span className="text-sm font-semibold uppercase tracking-widest text-[#f5b335]">
                Blog Academia Helm
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Des insights pour
              <span className="relative ml-3 inline-block">
                <span className="relative z-10 text-[#f5b335]">piloter</span>
                <span className="absolute bottom-1 left-0 z-0 h-3 w-full bg-[#f5b335]/20" />
              </span>
              {' '}votre école
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
              Guides concrets, méthodes éprouvées et retours terrain pour
              directeurs et fondateurs d&apos;écoles en Afrique. Finance,
              pédagogie, digitalisation, RH — tout ce qu&apos;il faut pour
              transformer votre établissement.
            </p>

            {/* Stats row */}
            <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-white/10 pt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5b335]/15">
                  <svg className="h-5 w-5 text-[#f5b335]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{posts.length}+</p>
                  <p className="text-xs text-white/50">Articles experts</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5b335]/15">
                  <svg className="h-5 w-5 text-[#f5b335]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">100%</p>
                  <p className="text-xs text-white/50">Actionnable</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5b335]/15">
                  <svg className="h-5 w-5 text-[#f5b335]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">Afrique</p>
                  <p className="text-xs text-white/50">Contexte local</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wave / gold accent line */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="h-1 bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          BLOG GRID SECTION
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50/80">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <BlogGrid posts={posts} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          NEWSLETTER SECTION
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white">
        {/* Decorative elements */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 top-10 h-60 w-60 rounded-full bg-[#f5b335]/5" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#0b2f73]/5" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-[#0b2f73] to-[#1d4fa5] p-8 shadow-2xl sm:p-12 lg:p-16">
            {/* Decorative elements inside card */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#f5b335]/10" />
            <div className="pointer-events-none absolute -bottom-6 left-12 h-24 w-24 rounded-full bg-white/5" />

            <div className="relative text-center">
              {/* Icon */}
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5b335]/15">
                <svg className="h-7 w-7 text-[#f5b335]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <h2 className="text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                Recevez nos meilleurs articles
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/60 sm:text-lg">
                Chaque semaine, un guide actionnable pour améliorer la gestion
                de votre école. Finance, pédagogie, digitalisation — directement
                dans votre boîte mail.
              </p>

              {/* Subscription form — client component */}
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#08255a] border-t border-amber-400/20">
        <Footer2 />
      </div>
    </>
  );
}
