'use client';

import { DM_Sans } from 'next/font/google';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { buildReviewsPublishedUrl } from '@/lib/reviews-api-url';
import {
  HELM_GOLD,
  HELM_GOLD_LIGHT,
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
const NAVY_MID = HELM_NAVY_MID;
const GOLD = HELM_GOLD;
const GOLD_LIGHT = HELM_GOLD_LIGHT;
const SECTION_BG = HELM_SECTION_BG;

/** Couleurs vertes pour badge "École vérifiée" */
const GREEN_BG = '#dcfce7'; // emerald-50
const GREEN_FG = '#15803d'; // green-700

/** Longueur à partir de laquelle on tronque le témoignage */
const COMMENT_COLLAPSED_LIMIT = 180;

type PublishedReview = {
  id: string;
  authorName: string;
  authorRole: string | null;
  schoolName: string;
  city: string;
  photoUrl: string | null;
  /** Logo du tenant (école) — présent uniquement pour les avis déposés
   * depuis l'application par un établissement authentifié. */
  tenantLogoUrl?: string | null;
  tenantId?: string | null;
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

const EMPTY_STATS: Stats = {
  average: 0,
  total: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

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

/** Icône couronne — remplace le "✓" pour le badge "École vérifiée". */
function CrownIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke="none"
      aria-hidden
    >
      <path d="M2.5 6.5l4.5 4L12 4l5 6.5 4.5-4-1.7 11.5H4.2L2.5 6.5zm2 13h15v2h-15v-2z" />
    </svg>
  );
}

/** Icône goupil (localisation) pour afficher la ville sur sa propre ligne. */
function LocationIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
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
  if (avg >= 1.5) return 'Passable';
  return 'Faible';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "Aujourd'hui";
  if (days < 7) return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `Il y a ${w} semaine${w > 1 ? 's' : ''}`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `Il y a ${m} mois`;
  }
  const y = Math.floor(days / 365);
  return `Il y a ${y} an${y > 1 ? 's' : ''}`;
}

/**
 * Avatar : logo école si l'avis provient d'un tenant authentifié,
 * sinon photo fournie par l'utilisateur, sinon initiales colorées.
 */
function Avatar({ r, size = 44 }: { r: PublishedReview; size?: number }) {
  // 1) Avis déposé depuis l'application par une école → logo de l'école
  if (r.tenantId && r.tenantLogoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={r.tenantLogoUrl}
        alt={`Logo ${r.schoolName}`}
        className="rounded-full object-cover"
        style={{
          width: size,
          height: size,
          boxShadow: `0 0 0 2px ${GOLD}`,
        }}
      />
    );
  }
  // 2) Photo fournie par l'utilisateur (parent / enseignant qui a uploadé)
  if (r.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={r.photoUrl}
        alt=""
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  // 3) Fallback : initiales colorées
  const hue = hashHue(r.authorName);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue}, 55%, 42%), hsl(${(hue + 40) % 360}, 50%, 35%))`,
      }}
      aria-hidden
    >
      {initialsFromName(r.authorName)}
    </div>
  );
}

/**
 * Commentaire tronqué avec "Lire plus" / "Lire moins".
 * Garantit des cartes de hauteur uniforme en mode replié.
 */
function ReviewComment({ comment }: { comment: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = comment.length > COMMENT_COLLAPSED_LIMIT;
  const displayed =
    expanded || !isLong
      ? comment
      : comment.slice(0, COMMENT_COLLAPSED_LIMIT).trimEnd() + '…';

  return (
    <div className="mt-3 flex-1">
      <p
        className="text-[14px] leading-relaxed text-slate-700"
        style={{
          fontFamily: 'Georgia, serif',
          textAlign: 'justify',
          hyphens: 'auto',
        }}
      >
        “{displayed}”
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold transition hover:opacity-70"
          style={{ color: NAVY }}
          aria-expanded={expanded}
        >
          {expanded ? 'Lire moins' : 'Lire plus'}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{
              transform: expanded ? 'rotate(-90deg)' : 'rotate(90deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function TrustpilotCard({
  r,
  index,
}: {
  r: PublishedReview;
  index: number;
}) {
  const isSchoolReview = Boolean(r.tenantId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Si l'IntersectionObserver n'est pas disponible, on affiche directement.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="w-full sm:w-[400px]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition:
          'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: `${Math.min(index * 90, 540)}ms`,
      }}
    >
      <article
        className="flex h-full flex-col rounded-2xl bg-white p-5 transition-shadow duration-200 ease-out hover:shadow-xl"
        style={{
          boxShadow: '0 6px 22px rgba(30, 58, 95, 0.07)',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* En-tête : avatar + nom + badge source */}
        <div className="flex items-start gap-3">
          <Avatar r={r} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="truncate text-[14.5px] font-bold"
                style={{ color: NAVY }}
              >
                {r.authorName}
              </p>
              {isSchoolReview ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    background: GREEN_BG,
                    color: GREEN_FG,
                  }}
                  title="Avis vérifié déposé depuis l'application Academia Helm"
                >
                  <CrownIcon size={11} color={GREEN_FG} />
                  École vérifiée
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
                  title="Avis soumis depuis le formulaire public"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  Avis vérifié
                </span>
              )}
            </div>
            {/* Rôle + école sur une ligne, ville sur sa propre ligne */}
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {[r.authorRole, r.schoolName].filter(Boolean).join(' · ')}
            </p>
            {r.city ? (
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <LocationIcon size={11} />
                <span>{r.city}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Étoiles + date */}
        <div className="mt-3 flex items-center justify-between">
          <StarRow rating={r.rating} size={16} />
          <span className="text-[11px] text-slate-400">
            {timeAgo(r.publishedAt ?? r.createdAt)}
          </span>
        </div>

        {/* Commentaire tronqué + Lire plus */}
        <ReviewComment comment={r.comment} />

        {/* Pied : mention "Mis en avant" si featured */}
        {r.featured ? (
          <div
            className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{
              background: `linear-gradient(90deg, ${GOLD}22, ${GOLD}44)`,
              color: NAVY,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={GOLD}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Mis en avant
          </div>
        ) : null}
      </article>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-wrap justify-center gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="w-full animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:w-[400px]"
        >
          <div className="flex gap-3">
            <div className="h-11 w-11 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-1/2 rounded bg-slate-200" />
              <div className="h-3 w-3/4 rounded bg-slate-100" />
            </div>
          </div>
          <div className="mt-3 h-4 w-24 rounded bg-slate-100" />
          <div className="mt-3 h-16 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="mx-auto max-w-xl rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center"
      style={{ boxShadow: '0 6px 22px rgba(30, 58, 95, 0.04)' }}
    >
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)`,
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill={GOLD}
          stroke={NAVY}
          strokeWidth="1.2"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
      <h3
        className="mt-4 text-lg font-bold"
        style={{ color: NAVY }}
      >
        Soyez le premier à laisser un avis
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        Les avis vérifiés des établissements et des utilisateurs Academia Helm
        apparaîtront ici. Aucune donnée fictive n'est affichée — chaque avis
        est publié après modération.
      </p>
      <Link
        href="/avis"
        className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        style={{
          background: `linear-gradient(135deg, ${NAVY}, ${NAVY_MID})`,
        }}
      >
        Laisser un avis →
      </Link>
    </div>
  );
}

export default function ReviewsSection() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => buildReviewsPublishedUrl(), []);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      setError('Configuration API manquante');
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
        }
      } catch {
        if (!cancelled) {
          setError('Impossible de charger les avis pour le moment.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const stats = data?.stats ?? EMPTY_STATS;
  const reviews = data?.reviews ?? [];
  const hasReviews = reviews.length > 0;

  return (
    <section
      className={`${dmSans.className} py-14 md:py-20`}
      style={{ background: SECTION_BG }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto mb-10 max-w-3xl text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{
              background: `linear-gradient(90deg, ${GOLD}33, ${GOLD}55)`,
              color: NAVY,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={GOLD}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Avis vérifiés
          </span>
          <h2
            className="mt-4 text-2xl font-extrabold tracking-tight md:text-3xl"
            style={{ color: NAVY }}
          >
            Ce que disent nos établissements
          </h2>
          <p className="mt-2 text-base" style={{ color: HELM_TEXT_MUTED }}>
            Directeurs, enseignants, parents et élèves partagent leur expérience
            avec Academia Helm.
          </p>
        </header>

        {loading ? (
          <SkeletonCards />
        ) : hasReviews ? (
          <>
            {/* Bandeau résumé compact façon Trustpilot */}
            <div
              className="mb-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
              style={{ boxShadow: '0 8px 28px rgba(30, 58, 95, 0.05)' }}
            >
              <div className="flex flex-col md:flex-row md:items-stretch">
                {/* Score compact à gauche */}
                <div
                  className="flex items-center gap-4 px-5 py-4 md:w-[300px] md:shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${NAVY}, ${NAVY_MID})`,
                    color: '#fff',
                  }}
                >
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold tabular-nums md:text-4xl">
                      {stats.average.toFixed(1)}
                    </span>
                    <span className="pb-1 text-sm opacity-80">/ 5</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <StarRow
                      rating={Math.round(stats.average)}
                      size={15}
                      gold={GOLD_LIGHT}
                    />
                    <p className="text-[11px] font-medium opacity-90">
                      {scoreLabel(stats.average)}
                    </p>
                    <p className="text-[11px] opacity-75">
                      {stats.total} avis vérifié{stats.total > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Répartition compacte à droite */}
                <div className="flex-1 px-5 py-4">
                  <p
                    className="mb-2 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: NAVY }}
                  >
                    Répartition des notes
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const pct =
                        stats.distribution[star as 1 | 2 | 3 | 4 | 5] ?? 0;
                      return (
                        <div
                          key={star}
                          className="flex items-center gap-2 text-xs text-slate-600"
                        >
                          <span className="w-8 text-right font-medium">
                            {star}★
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
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
                </div>
              </div>
            </div>

            {/* Grille des avis — flexbox centrée pour 1, 2 ou 3+ cartes */}
            <div className="flex flex-wrap justify-center gap-5">
              {reviews.map((r, i) => (
                <TrustpilotCard key={r.id} r={r} index={i} />
              ))}
            </div>

            {/* Appel à l'action — laisser un avis */}
            <div className="mt-10 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-slate-600">
                Vous utilisez Academia Helm ? Partagez votre expérience.
              </p>
              <Link
                href="/avis"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, ${NAVY_MID})`,
                }}
              >
                Laisser un avis
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <p className="text-xs text-slate-400">
                Avis collectés directement auprès des utilisateurs d'Academia
                Helm.
              </p>
            </div>
          </>
        ) : (
          <EmptyState />
        )}

        {error && !hasReviews && !loading ? (
          <p className="mt-8 text-center text-sm text-slate-500">{error}</p>
        ) : null}
      </div>
    </section>
  );
}
