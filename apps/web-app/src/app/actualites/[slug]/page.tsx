/**
 * ============================================================================
 * Page détail d'un article d'actualité — /actualites/[slug]
 * ============================================================================
 *
 * Route dynamique publique (sous-domaine d'école).
 * Récupère l'article via GET /api/tenant-website/public/{slug}/news/{articleSlug}.
 *
 * Génère aussi les métadonnées SEO (Open Graph, Twitter Card) à partir de
 * l'article (titre, description, image de couverture).
 * ============================================================================
 */

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import type { Metadata } from 'next';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { extractTenantSlug } from '@/lib/tenant/constants';
import InstitutionalFooter from '@/components/public/InstitutionalFooter';

export const dynamic = 'force-dynamic';

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  category?: string | null;
  status: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ─── Helper : résoudre le slug tenant depuis le host ─────────────────────

async function getTenantSlug(): Promise<string | null> {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
  return extractTenantSlug(host);
}

// ─── generateMetadata : SEO dynamique par article ────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: articleSlug } = await params;
  const tenantSlug = await getTenantSlug();
  if (!tenantSlug) return { title: 'Article introuvable' };

  try {
    const API_URL = getApiBaseUrlForRoutes();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `${API_URL}/tenant-website/public/${tenantSlug}/news/${encodeURIComponent(articleSlug)}`,
      { cache: 'no-store', signal: controller.signal },
    );
    clearTimeout(timeoutId);

    if (!res.ok) return { title: 'Article introuvable' };

    const article: NewsArticle = await res.json();

    const title = article.seoTitle || article.title;
    const description = article.seoDescription || article.excerpt || '';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        publishedTime: article.publishedAt || article.createdAt,
        modifiedTime: article.updatedAt,
        images: article.coverImageUrl ? [{ url: article.coverImageUrl }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: article.coverImageUrl ? [article.coverImageUrl] : undefined,
      },
    };
  } catch {
    return { title: 'Article introuvable' };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug: articleSlug } = await params;
  const tenantSlug = await getTenantSlug();

  if (!tenantSlug) {
    notFound();
  }

  let article: NewsArticle | null = null;

  try {
    const API_URL = getApiBaseUrlForRoutes();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `${API_URL}/tenant-website/public/${tenantSlug}/news/${encodeURIComponent(articleSlug)}`,
      { cache: 'no-store', signal: controller.signal },
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      article = await res.json();
    }
  } catch (err) {
    console.error('[actualites/[slug]] Failed to fetch article:', err);
  }

  if (!article) {
    notFound();
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const publishedDate = article.publishedAt || article.createdAt;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Article header ── */}
      <article className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Link>

        {/* Category badge */}
        {article.category && (
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wide mb-3">
            {article.category}
          </span>
        )}

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4">
          {article.title}
        </h1>

        {/* Meta (date, views) */}
        <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {formatDate(publishedDate)}
          </span>
          {typeof article.viewCount === 'number' && article.viewCount > 0 && (
            <span>{article.viewCount} vue{article.viewCount > 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Cover image */}
        {article.coverImageUrl && (
          <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-8 bg-slate-100">
            <Image
              src={article.coverImageUrl}
              alt={article.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}

        {/* Excerpt (lead) */}
        {article.excerpt && (
          <p className="text-lg text-slate-600 font-medium leading-relaxed mb-6">
            {article.excerpt}
          </p>
        )}

        {/* Content */}
        <div className="prose prose-slate max-w-none">
          {article.content.split('\n').map((paragraph, i) => (
            paragraph.trim() ? (
              <p key={i} className="text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap">
                {paragraph}
              </p>
            ) : null
          ))}
        </div>

        {/* Footer meta */}
        <div className="mt-12 pt-6 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux actualités
          </Link>
          <span className="text-xs text-slate-400">
            Publié le {formatDate(publishedDate)}
          </span>
        </div>
      </article>

      {/* ── Footer ── */}
      <InstitutionalFooter />
    </div>
  );
}
