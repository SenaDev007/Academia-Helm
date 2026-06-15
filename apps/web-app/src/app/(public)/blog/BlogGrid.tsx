'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  ArrowRight,
  Tag,
  BookOpen,
  Sparkles,
  TrendingUp,
  DollarSign,
  Monitor,
  Users,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PostSummary = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  keywords: string[];
};

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { id: 'all', label: 'Tous les articles', icon: BookOpen },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'pédagogie', label: 'Pédagogie', icon: TrendingUp },
  { id: 'digitalisation', label: 'Digitalisation', icon: Monitor },
  { id: 'rh', label: 'RH', icon: Users },
  { id: 'logiciel', label: 'Logiciel', icon: Sparkles },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

function matchCategory(keywords: string[], catId: CategoryId): boolean {
  if (catId === 'all') return true;
  const joined = keywords.join(' ').toLowerCase();
  const map: Record<string, string[]> = {
    finance: ['finance', 'financière', 'recouvrement', 'impayé', 'trésorerie', 'frais', 'encaissement', 'caisse', 'coût', 'budget', 'roi'],
    pédagogie: ['pédagogie', 'bulletin', 'note', 'compétence', 'examen', 'scolarité', 'élève', 'primaire'],
    digitalisation: ['digitalisation', 'digitale', 'transformation digitale', 'automatisation', 'digital'],
    rh: ['rh', 'ressources humaines', 'personnel', 'turnover', 'présence', 'contrat'],
    logiciel: ['logiciel', 'système', 'plateforme', 'outil', 'comparatif', 'choix'],
  };
  const terms = map[catId] ?? [];
  return terms.some((t) => joined.includes(t));
}

/* ------------------------------------------------------------------ */
/*  Estimated reading time                                             */
/* ------------------------------------------------------------------ */

function readingTime(desc: string): number {
  const words = desc.split(/\s+/).length;
  return Math.max(2, Math.round(words / 50) * 2 + 2);
}

/* ------------------------------------------------------------------ */
/*  Feature image placeholder – deterministic gradient from slug       */
/* ------------------------------------------------------------------ */

function slugToGradient(slug: string): string {
  const hash = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const gradients = [
    'from-[#0b2f73] to-[#1d4fa5]',
    'from-[#0b2f73] to-[#1a3a7a]',
    'from-[#1d4fa5] to-[#0b2f73]',
    'from-[#0b2f73] via-[#143d8a] to-[#1d4fa5]',
    'from-[#122e6b] to-[#1d4fa5]',
    'from-[#1d4fa5] via-[#0b2f73] to-[#143d8a]',
  ];
  return gradients[hash % gradients.length];
}

/* ------------------------------------------------------------------ */
/*  Featured card (first / latest post)                                */
/* ------------------------------------------------------------------ */

function FeaturedCard({ post }: { post: PostSummary }) {
  const gradient = slugToGradient(post.slug);
  const readMin = readingTime(post.description);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative block overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:shadow-2xl hover:ring-[#f5b335]/40 lg:grid lg:grid-cols-2"
    >
      {/* Image placeholder */}
      <div
        className={cn(
          'relative flex min-h-[260px] items-center justify-center bg-gradient-to-br lg:min-h-[420px]',
          gradient,
        )}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-6 left-8 h-32 w-32 rounded-full bg-[#f5b335]/10" />
        <div className="pointer-events-none absolute bottom-12 right-16 h-20 w-20 rounded-full bg-white/5" />

        {/* Gold badge */}
        <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-[#f5b335] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0b2f73] shadow-md">
          <Sparkles className="h-3.5 w-3.5" />
          Article à la une
        </div>

        <BookOpen className="h-20 w-20 text-white/20 transition-transform duration-300 group-hover:scale-110" />
      </div>

      {/* Content */}
      <div className="flex flex-col justify-center p-6 lg:p-10">
        {/* Date + read time */}
        <div className="mb-4 flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[#f5b335]" />
            {new Date(post.publishedAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-[#f5b335]" />
            {readMin} min de lecture
          </span>
        </div>

        {/* Title */}
        <h2 className="mb-3 text-2xl font-bold leading-tight text-[#0b2f73] transition-colors duration-200 group-hover:text-[#1d4fa5] lg:text-3xl">
          {post.title}
        </h2>

        {/* Excerpt */}
        <p className="mb-5 line-clamp-3 text-gray-600 leading-relaxed">
          {post.description}
        </p>

        {/* Keywords */}
        <div className="mb-6 flex flex-wrap gap-2">
          {post.keywords.slice(0, 4).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-full bg-[#0b2f73]/5 px-3 py-1 text-xs font-medium text-[#0b2f73] transition-colors duration-200 group-hover:bg-[#0b2f73]/10"
            >
              <Tag className="h-3 w-3" />
              {k}
            </span>
          ))}
        </div>

        {/* CTA */}
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d4fa5] transition-all duration-200 group-hover:gap-3 group-hover:text-[#0b2f73]">
          Lire l&apos;article complet
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Standard card                                                      */
/* ------------------------------------------------------------------ */

function BlogCard({ post, index }: { post: PostSummary; index: number }) {
  const gradient = slugToGradient(post.slug);
  const readMin = readingTime(post.description);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-[#f5b335]/40"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Image placeholder */}
      <div
        className={cn(
          'relative flex h-48 items-center justify-center bg-gradient-to-br',
          gradient,
        )}
      >
        {/* Decorative */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-4 left-4 h-16 w-16 rounded-full bg-[#f5b335]/10" />

        {/* Date badge */}
        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#0b2f73] shadow-sm backdrop-blur-sm">
          <Calendar className="h-3.5 w-3.5 text-[#f5b335]" />
          {new Date(post.publishedAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </div>

        <BookOpen className="h-12 w-12 text-white/20 transition-transform duration-300 group-hover:scale-110" />

        {/* Gold bottom accent */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#f5b335] to-[#f5b335]/0 transition-all duration-300 group-hover:from-[#f5b335] group-hover:to-[#f5b335]" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        {/* Read time */}
        <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          {readMin} min de lecture
        </div>

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-lg font-bold leading-snug text-[#0b2f73] transition-colors duration-200 group-hover:text-[#1d4fa5]">
          {post.title}
        </h3>

        {/* Excerpt */}
        <p className="mb-4 line-clamp-2 flex-1 text-sm text-gray-500 leading-relaxed">
          {post.description}
        </p>

        {/* Keywords */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {post.keywords.slice(0, 3).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-full bg-[#0b2f73]/5 px-2.5 py-0.5 text-[11px] font-medium text-[#0b2f73]/70 transition-colors duration-200 group-hover:bg-[#0b2f73]/10 group-hover:text-[#0b2f73]"
            >
              <Tag className="h-2.5 w-2.5" />
              {k}
            </span>
          ))}
        </div>

        {/* CTA */}
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1d4fa5] transition-all duration-200 group-hover:gap-2.5 group-hover:text-[#0b2f73]">
          Lire l&apos;article
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main grid component                                                */
/* ------------------------------------------------------------------ */

export default function BlogGrid({ posts }: { posts: PostSummary[] }) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');

  const filtered = posts.filter((p) => matchCategory(p.keywords, activeCategory));
  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <>
      {/* ── Category pills ── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const isActive = activeCategory === id;
          return (
            <button
              key={id}
              onClick={() => setActiveCategory(id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[#0b2f73] text-white shadow-md shadow-[#0b2f73]/20'
                  : 'bg-white text-[#0b2f73]/70 ring-1 ring-[#0b2f73]/10 hover:bg-[#0b2f73]/5 hover:text-[#0b2f73] hover:ring-[#0b2f73]/20',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Results count ── */}
      <p className="mb-4 text-sm text-gray-400">
        {filtered.length} article{filtered.length !== 1 ? 's' : ''}{' '}
        {activeCategory !== 'all' && (
          <span>
            dans{' '}
            <span className="font-medium text-[#f5b335]">
              {CATEGORIES.find((c) => c.id === activeCategory)?.label}
            </span>
          </span>
        )}
      </p>

      {/* ── Featured + grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#0b2f73]/10 py-20 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-[#0b2f73]/20" />
          <p className="text-lg font-medium text-[#0b2f73]/40">
            Aucun article dans cette catégorie
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Essayez une autre catégorie ou consultez tous les articles
          </p>
        </div>
      ) : (
        <>
          {/* Featured post */}
          {featured && <FeaturedCard post={featured} />}

          {/* Remaining posts grid */}
          {rest.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post, i) => (
                <BlogCard key={post.slug} post={post} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
