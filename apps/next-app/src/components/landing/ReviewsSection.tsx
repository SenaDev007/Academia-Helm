'use client';

import { DM_Sans } from 'next/font/google';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildReviewsPublishedUrl, buildReviewsSubmitUrl } from '@/lib/reviews-api-url';
import {
  HELM_GOLD,
  HELM_NAVY,
  HELM_NAVY_MID,
  HELM_SECTION_BG,
  HELM_STAR_EMPTY,
  HELM_TEXT_MUTED,
  HELM_GOLD_LIGHT,
} from '@/lib/helm-colors';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const NAVY = HELM_NAVY;
const GOLD = HELM_GOLD;

/* ─── Types ──────────────────────────────────────────────────────────────── */

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

/* ─── Helpers ────────────────────────────────────────────────────────────── */

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

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ─── Star Components ────────────────────────────────────────────────────── */

function StarRow({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i < rating ? GOLD : 'none'}
          stroke={i < rating ? GOLD : HELM_STAR_EMPTY}
          strokeWidth="1.5" className="shrink-0"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

/* ─── Trustpilot-Style Review Card ───────────────────────────────────────── */

function TrustpilotReviewCard({ r }: { r: PublishedReview }) {
  const hue = hashHue(r.authorName);
  return (
    <article
      className="rounded-xl bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      style={{
        boxShadow: '0 2px 12px rgba(30, 58, 95, 0.06)',
        border: '1px solid #E8ECF2',
      }}
    >
      {/* Header : avatar + name + date */}
      <div className="flex items-center gap-3">
        {r.photoUrl ? (
          <img src={r.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{
              background: `linear-gradient(135deg, hsl(${hue}, 55%, 42%), hsl(${(hue + 40) % 360}, 50%, 35%))`,
            }}
            aria-hidden
          >
            {initialsFromName(r.authorName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: NAVY }}>
            {r.authorName}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {[r.authorRole, r.schoolName, r.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        {r.featured && (
          <span
            className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: `${GOLD}22`, color: NAVY }}
          >
            Mis en avant
          </span>
        )}
      </div>

      {/* Stars */}
      <div className="mt-3">
        <StarRow rating={r.rating} size={16} />
      </div>

      {/* Comment */}
      <p className="mt-2 text-sm leading-relaxed text-slate-700 line-clamp-4">
        {r.comment}
      </p>

      {/* Date */}
      {(r.publishedAt || r.createdAt) && (
        <p className="mt-3 text-[11px] text-slate-400">
          {formatDate(r.publishedAt || r.createdAt)}
        </p>
      )}
    </article>
  );
}

/* ─── Review Modal (Trustpilot-style) ────────────────────────────────────── */

const RATING_LABELS: Record<number, string> = {
  1: 'Décevant',
  2: 'Passable',
  3: 'Bien',
  4: 'Très bien',
  5: 'Excellent !',
};

function ReviewModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<'rating' | 'form' | 'success'>('rating');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [school, setSchool] = useState('');
  const [cityVal, setCityVal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const postUrl = buildReviewsSubmitUrl();
    if (!postUrl) {
      setErr('API non configurée.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: name.trim(),
          authorRole: role.trim() || undefined,
          schoolName: school.trim(),
          city: cityVal.trim(),
          rating,
          comment: comment.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(
          typeof body?.message === 'string'
            ? body.message
            : 'Envoi impossible. Réessayez plus tard.',
        );
        return;
      }
      setStep('success');
      onSuccess();
    } catch {
      setErr('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setSubmitting(false);
    }
  }, [name, role, school, cityVal, rating, comment, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Fermer"
        onClick={onClose}
      />

      {/* Card */}
      <div
        className="relative z-[1] w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200"
      >
        {step === 'rating' && (
          <>
            <h2 className="text-center text-xl font-bold" style={{ color: NAVY }}>
              Votre avis compte
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              Comment évaluez-vous Academia Helm ?
            </p>
            <div className="mt-8 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => {
                const lit = i <= Math.max(rating, hover);
                return (
                  <button
                    key={i}
                    type="button"
                    className="p-1 transition-transform duration-150 hover:scale-[1.2]"
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(0)}
                    aria-label={`${i} sur 5`}
                  >
                    <svg width={40} height={40} viewBox="0 0 24 24"
                      fill={lit ? GOLD : 'none'}
                      stroke={lit ? GOLD : HELM_STAR_EMPTY}
                      strokeWidth="1.4"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                );
              })}
            </div>
            <p
              className="mt-4 min-h-[1.5rem] text-center text-sm font-medium"
              style={{ color: rating ? NAVY : '#94a3b8' }}
            >
              {rating ? RATING_LABELS[rating] : 'Sélectionnez une note'}
            </p>
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                disabled={rating === 0}
                onClick={() => setStep('form')}
                className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: rating === 0 ? '#94a3b8' : `linear-gradient(90deg, ${GOLD}, ${HELM_GOLD_LIGHT})`,
                  color: rating === 0 ? '#fff' : NAVY,
                }}
              >
                Continuer
              </button>
            </div>
          </>
        )}

        {step === 'form' && (
          <>
            <button
              type="button"
              className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-800"
              onClick={() => setStep('rating')}
            >
              ← Retour
            </button>
            <div className="mb-4 flex items-center gap-3">
              <StarRow rating={rating} size={16} />
              <span className="text-sm text-slate-600">{RATING_LABELS[rating]}</span>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Commentaire *</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/40"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700">Nom *</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/40"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700">Rôle</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/40"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700">Établissement *</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/40"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700">Ville *</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/40"
                value={cityVal}
                onChange={(e) => setCityVal(e.target.value)}
              />
            </label>
            {err && (
              <p className="mt-3 text-sm text-red-600" role="alert">{err}</p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Votre avis sera vérifié avant publication.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={submitting || !comment.trim() || !name.trim() || !school.trim() || !cityVal.trim()}
                onClick={() => void submit()}
                className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: `linear-gradient(90deg, ${GOLD}, ${HELM_GOLD_LIGHT})`,
                  color: NAVY,
                }}
              >
                {submitting ? 'Envoi en cours...' : 'Soumettre mon avis'}
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${GOLD}22` }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill={GOLD} stroke={GOLD} strokeWidth="1.5">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold" style={{ color: NAVY }}>
              Merci pour votre avis !
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Notre équipe le traitera sous peu. Vous contribuez à améliorer
              Academia Helm pour tous les établissements.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 w-full rounded-xl px-6 py-3 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(145deg, ${NAVY}, ${HELM_NAVY_MID})`,
              }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-slate-200" />
              <div className="h-2 w-3/4 rounded bg-slate-100" />
            </div>
          </div>
          <div className="mt-3 flex gap-0.5">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-4 w-4 rounded bg-slate-200" />
            ))}
          </div>
          <div className="mt-3 h-16 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* ─── Main Section ───────────────────────────────────────────────────────── */

export default function ReviewsSection() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLiveReviews, setHasLiveReviews] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const url = useMemo(() => buildReviewsPublishedUrl(), []);

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false);
      setError('Configuration API manquante');
      setHasLiveReviews(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
      setHasLiveReviews(Boolean(json?.stats?.total && json.stats.total > 0));
    } catch {
      setError('Impossible de charger les avis pour le moment.');
      setData(null);
      setHasLiveReviews(false);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleReviewSuccess = useCallback(() => {
    // Rafraîchir les données après soumission réussie
    setRefreshKey((k) => k + 1);
  }, []);

  const stats = hasLiveReviews && data?.stats ? data.stats : null;
  const reviews = hasLiveReviews && data?.reviews?.length ? data.reviews : [];

  return (
    <section
      className={`${dmSans.className} py-16 md:py-24`}
      style={{ background: HELM_SECTION_BG }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Header (Trustpilot style) ────────────────────────────── */}
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <h2
            className="text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ color: NAVY }}
          >
            Ce que disent nos établissements
          </h2>
          <p className="mt-3 text-lg" style={{ color: HELM_TEXT_MUTED }}>
            Des directeurs et fondateurs qui font confiance à Academia Helm
          </p>
        </header>

        {loading ? (
          <SkeletonCards />
        ) : !hasLiveReviews ? (
          /* ── État vide : aucun avis en base ──────────────────────── */
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl" style={{ background: `${NAVY}0A` }}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold" style={{ color: NAVY }}>
              Aucun avis pour le moment
            </h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Soyez le premier à partager votre expérience avec Academia Helm.
              Votre avis aidera d&apos;autres établissements à prendre une décision éclairée.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:scale-[1.02]"
              style={{
                background: `linear-gradient(90deg, ${GOLD}, ${HELM_GOLD_LIGHT})`,
                color: NAVY,
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill={NAVY} stroke={NAVY} strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Laisser un avis
            </button>
          </div>
        ) : (
          <>
            {/* ── Trustpilot-Style Score Panel ────────────────────────── */}
            <div
              className="mb-10 rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8"
              style={{ boxShadow: '0 4px 24px rgba(30, 58, 95, 0.05)' }}
            >
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12">
                {/* Score principal */}
                {stats && (
                  <div className="flex items-center gap-4 md:gap-6">
                    <div
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold text-white md:h-24 md:w-24 md:text-3xl"
                      style={{
                        background: `linear-gradient(145deg, ${NAVY}, ${HELM_NAVY_MID})`,
                      }}
                    >
                      {stats.average.toFixed(1)}
                    </div>
                    <div>
                      <StarRow rating={Math.round(stats.average)} size={22} />
                      <p className="mt-1 text-sm font-semibold" style={{ color: NAVY }}>
                        {scoreLabel(stats.average)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Basé sur {stats.total} avis vérifié{stats.total > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Distribution */}
                {stats && (
                  <div className="flex-1">
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const pct = stats.distribution[star as 1 | 2 | 3 | 4 | 5] ?? 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-sm">
                            <span className="w-4 text-right font-medium text-slate-600">{star}</span>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill={GOLD} className="shrink-0">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  background: `linear-gradient(90deg, ${GOLD}, ${HELM_GOLD_LIGHT})`,
                                }}
                              />
                            </div>
                            <span className="w-10 text-right tabular-nums text-xs text-slate-500">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CTA : Laisser un avis */}
                <div className="flex flex-col items-center justify-center md:min-w-[180px]">
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:scale-[1.02] hover:shadow-md"
                    style={{
                      background: `linear-gradient(90deg, ${GOLD}, ${HELM_GOLD_LIGHT})`,
                      color: NAVY,
                    }}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill={NAVY} stroke={NAVY} strokeWidth="1.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Laisser un avis
                  </button>
                  <p className="mt-2 text-[11px] text-slate-400 text-center">
                    Avis vérifiés par notre équipe
                  </p>
                </div>
              </div>
            </div>

            {/* ── Reviews Grid ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <TrustpilotReviewCard key={r.id} r={r} />
              ))}
            </div>

            {/* ── Footer ────────────────────────────────────────────── */}
            <p className="mt-10 text-center text-xs text-slate-400">
              Avis collectés directement auprès des établissements utilisant Academia Helm ·
              Chaque avis est vérifié avant publication
            </p>
          </>
        )}
      </div>

      {/* ── Modal de soumission d'avis ─────────────────────────────── */}
      {showModal && (
        <ReviewModal
          onClose={() => setShowModal(false)}
          onSuccess={handleReviewSuccess}
        />
      )}
    </section>
  );
}
