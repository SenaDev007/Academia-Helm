'use client';

import { DM_Sans } from 'next/font/google';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { buildReviewsPublishedUrl } from '@/lib/reviews-api-url';
import { HELM_LANDING_REVIEWS } from '@/data/helm-reviews';
import {
  HELM_GOLD,
  HELM_NAVY,
  HELM_NAVY_MID,
  HELM_SECTION_BG,
  HELM_STAR_EMPTY,
  HELM_TEXT_MUTED,
} from '@/lib/helm-colors';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const NAVY = HELM_NAVY;
const GOLD = HELM_GOLD;
const SECTION_BG = HELM_SECTION_BG;

type PublishedReview = {
  id: string;
  authorName: string;
  authorRole: string | null;
  schoolName: string;
  city: string;
  photoUrl: string | null;
  rating: number;
  comment: string;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
};

type Stats = {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

type ApiResponse = {
  reviews: PublishedReview[];
  stats: Stats;
};

function buildFallbackReviews(): PublishedReview[] {
  return HELM_LANDING_REVIEWS.map((r) => ({
    id: `demo-${r.id}`,
    authorName: r.author,
    authorRole: r.role,
    schoolName: r.org,
    city: '',
    photoUrl: null,
    rating: r.rating,
    comment: r.quote,
    featured: false,
    publishedAt: null,
    createdAt: new Date().toISOString(),
  }));
}

function buildFallbackStats(): Stats {
  const list = HELM_LANDING_REVIEWS;
  const total = list.length;
  const sum = list.reduce((s, x) => s + x.rating, 0);
  const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 5;
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const x of list) {
    const star = x.rating as 1 | 2 | 3 | 4 | 5;
    if (star >= 1 && star <= 5) counts[star] += 1;
  }
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (let star = 1 as const; star <= 5; star++) {
    distribution[star] =
      total > 0 ? Math.round((counts[star] / total) * 1000) / 10 : 0;
  }
  return { average, total, distribution };
}

function StarRow({
  rating,
  size = 18,
  gold = GOLD,
}: {
  rating: number;
  size?: number;
  gold?: string;
}) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i < rating ? gold : 'none'}
          stroke={i < rating ? gold : HELM_STAR_EMPTY}
          strokeWidth="1.5"
          className="shrink-0"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

function scoreLabel(avg: number): string {
  if (avg >= 4.5) return 'Excellent';
  if (avg >= 3.5) return 'Très bien';
  if (avg >= 2.5) return 'Bien';
  return 'Moyen';
}

function ReviewCard({ r }: { r: PublishedReview }) {
  const featured = r.featured;
  const hue = hashHue(r.authorName);
  return (
    <article
      className="relative rounded-2xl bg-white p-6 transition-all duration-200 ease-out hover:-translate-y-[3px]"
      style={{
        boxShadow: featured
          ? '0 12px 40px rgba(201, 168, 76, 0.25)'
          : '0 8px 28px rgba(30, 58, 95, 0.08)',
        border: featured ? `2px solid ${GOLD}` : '1px solid #E2E8F0',
      }}
    >
      <span
        className="pointer-events-none absolute left-5 top-4 font-serif text-6xl leading-none text-slate-200"
        style={{ fontFamily: 'Georgia, serif' }}
        aria-hidden
      >
        &ldquo;
      </span>
      {featured ? (
        <span
          className="mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `linear-gradient(90deg, ${GOLD}22, ${GOLD}44)`, color: NAVY }}
        >
          ✦ Mis en avant
        </span>
      ) : null}
      <p
        className="relative z-[1] mt-2 min-h-[4.5rem] text-[15px] italic leading-relaxed text-slate-700"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {r.comment}
      </p>
      <div className="relative z-[1] mt-4">
        <StarRow rating={r.rating} />
      </div>
      <div className="relative z-[1] mt-5 flex items-start gap-3 border-t border-slate-100 pt-4">
        {r.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URLs externes non configurées dans next.config
          <img
            src={r.photoUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{
              background: `linear-gradient(135deg, hsl(${hue}, 55%, 42%), hsl(${(hue + 40) % 360}, 50%, 35%))`,
            }}
            aria-hidden
          >
            {initialsFromName(r.authorName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: NAVY }}>
            {r.authorName}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {[r.authorRole, r.schoolName, r.city].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
    </article>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="mt-4 h-20 rounded bg-slate-100" />
          <div className="mt-4 flex gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-1/2 rounded bg-slate-200" />
              <div className="h-3 w-3/4 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** true = au moins un avis APPROVED côté API */
  const [hasLiveReviews, setHasLiveReviews] = useState(false);

  const url = useMemo(() => buildReviewsPublishedUrl(), []);

  const fallbackReviews = useMemo(() => buildFallbackReviews(), []);
  const fallbackStats = useMemo(() => buildFallbackStats(), []);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      setError('Configuration API manquante');
      setHasLiveReviews(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
          setHasLiveReviews(
            Boolean(json?.stats?.total && json.stats.total > 0),
          );
        }
      } catch {
        if (!cancelled) {
          setError('Impossible de charger les avis pour le moment.');
          setData(null);
          setHasLiveReviews(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const stats = hasLiveReviews && data?.stats ? data.stats : fallbackStats;
  const reviews =
    hasLiveReviews && data?.reviews?.length
      ? data.reviews
      : fallbackReviews;
  const showDemoRibbon = !loading && !hasLiveReviews;

  return (
    <section
      className={`${dmSans.className} py-16 md:py-24`}
      style={{ background: SECTION_BG }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto mb-12 max-w-3xl text-center">
          <span
            className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{
              background: `linear-gradient(90deg, ${GOLD}33, ${GOLD}55)`,
              color: NAVY,
            }}
          >
            ✦ Avis vérifiés
          </span>
          <h2
            className="mt-5 text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ color: NAVY }}
          >
            Ce que disent nos établissements
          </h2>
          <p className="mt-3 text-lg" style={{ color: HELM_TEXT_MUTED }}>
            Des directeurs et fondateurs qui font confiance à Academia Helm.
          </p>
          <p className="mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-600">
            <Link
              href="/avis"
              className="font-semibold underline decoration-[#C9A84C] decoration-2 underline-offset-2"
              style={{ color: NAVY }}
            >
              Laisser un avis
            </Link>{' '}
            sur la page dédiée. Les utilisateurs connectés au portail reçoivent
            aussi une invitation dans l’application après environ 30 jours
            d’utilisation.
          </p>
        </header>

        {loading ? (
          <SkeletonCards />
        ) : stats ? (
          <>
            {showDemoRibbon ? (
              <p className="mb-6 rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-center text-sm text-amber-950">
                {error ? (
                  <>
                    <span className="font-semibold">Aperçu éditorial.</span>{' '}
                    {error} Les témoignages ci-dessous illustrent le rendu
                    jusqu’à publication des avis vérifiés en base.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">Exemples de présentation.</span>{' '}
                    Les avis vérifiés apparaîtront ici dès qu’ils seront
                    approuvés dans l’administration.
                  </>
                )}
              </p>
            ) : null}
            <div
              className="mb-12 flex flex-col gap-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-stretch md:gap-0 md:p-8"
              style={{ boxShadow: '0 12px 40px rgba(30, 58, 95, 0.06)' }}
            >
              <div className="flex flex-1 flex-col justify-center md:pr-8">
                <div className="flex flex-wrap items-end gap-3">
                  <span
                    className="text-5xl font-bold tabular-nums md:text-6xl"
                    style={{ color: NAVY }}
                  >
                    {stats.average.toFixed(1)}
                  </span>
                  <div className="pb-1">
                    <StarRow
                      rating={Math.round(stats.average)}
                      size={22}
                    />
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      {scoreLabel(stats.average)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {stats.total} avis vérifiés
                </p>
              </div>

              <div
                className="hidden w-px shrink-0 bg-slate-200 md:block"
                aria-hidden
              />

              <div className="flex flex-1 flex-col justify-center gap-3 md:px-8">
                {[5, 4, 3, 2, 1].map((star) => {
                  const pct =
                    stats.distribution[star as 1 | 2 | 3 | 4 | 5] ?? 0;
                  return (
                    <div
                      key={star}
                      className="flex items-center gap-3 text-sm text-slate-600"
                    >
                      <span className="w-8 text-right font-medium">
                        {star}★
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: `linear-gradient(90deg, ${GOLD}, ${NAVY})`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right tabular-nums text-slate-500">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                className="hidden w-px shrink-0 bg-slate-200 md:block"
                aria-hidden
              />

              <div className="flex flex-1 items-center justify-center md:pl-4">
                <div
                  className="rounded-2xl px-8 py-6 text-center text-white shadow-lg"
                  style={{
                    background: `linear-gradient(145deg, ${NAVY}, ${HELM_NAVY_MID})`,
                    minWidth: 200,
                  }}
                >
                  <p className="text-lg font-bold tracking-wide">★ PREMIUM</p>
                  <p className="mt-1 text-sm opacity-90">Academia Helm</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <ReviewCard key={r.id} r={r} />
              ))}
            </div>

            <p className="mt-12 text-center text-sm text-slate-500">
              {hasLiveReviews
                ? 'Avis collectés directement auprès des établissements utilisant Academia Helm'
                : 'Textes d’illustration — les avis publiés remplaceront cet aperçu automatiquement.'}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
