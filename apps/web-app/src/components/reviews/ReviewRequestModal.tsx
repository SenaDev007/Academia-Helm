'use client';

import { useCallback, useState } from 'react';
import { buildReviewsSubmitUrl } from '@/lib/reviews-api-url';
import {
  HELM_GOLD,
  HELM_GOLD_LIGHT,
  HELM_NAVY,
  HELM_NAVY_MID,
  HELM_STAR_EMPTY,
} from '@/lib/helm-colors';

const NAVY = HELM_NAVY;
const GOLD = HELM_GOLD;

export type ReviewRequestModalProps = {
  tenantId?: string;
  schoolName?: string;
  city?: string;
  authorName?: string;
  authorRole?: string;
  onClose: () => void;
  /** Formulaire intégré dans une page (sans overlay plein écran) */
  embedded?: boolean;
};

const RATING_LABELS: Record<number, string> = {
  1: 'Décevant',
  2: 'Passable',
  3: 'Bien',
  4: 'Très bien',
  5: 'Excellent !',
};

function StarButton({
  index,
  active,
  hover,
  onSelect,
  onEnter,
  onLeave,
}: {
  index: number;
  active: boolean;
  hover: number;
  onSelect: (n: number) => void;
  onEnter: (n: number) => void;
  onLeave: () => void;
}) {
  const lit = index <= Math.max(active, hover);
  return (
    <button
      type="button"
      className="p-1 transition-transform duration-150 hover:scale-[1.2]"
      onClick={() => onSelect(index)}
      onMouseEnter={() => onEnter(index)}
      onMouseLeave={onLeave}
      aria-label={`${index} sur 5`}
    >
      <svg
        width={40}
        height={40}
        viewBox="0 0 24 24"
        fill={lit ? GOLD : 'none'}
        stroke={lit ? GOLD : HELM_STAR_EMPTY}
        strokeWidth="1.4"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

function SmallStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill={i < rating ? GOLD : 'none'}
          stroke={i < rating ? GOLD : HELM_STAR_EMPTY}
          strokeWidth="1.4"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewRequestModal({
  tenantId,
  schoolName = '',
  city = '',
  authorName = '',
  authorRole = '',
  onClose,
  embedded = false,
}: ReviewRequestModalProps) {
  const [step, setStep] = useState<'rating' | 'form' | 'success'>('rating');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState(authorName);
  const [role, setRole] = useState(authorRole);
  const [school, setSchool] = useState(schoolName);
  const [cityVal, setCityVal] = useState(city);
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
          tenantId: tenantId || undefined,
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
    } catch {
      setErr('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    role,
    school,
    cityVal,
    rating,
    comment,
    tenantId,
  ]);

  const card = (
    <div
      className={`w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl ${
        embedded ? 'mx-auto' : 'relative z-[1]'
      }`}
      style={
        embedded
          ? { boxShadow: '0 24px 48px -12px rgba(30, 58, 95, 0.1)' }
          : undefined
      }
    >
        {step === 'rating' ? (
          <>
            <h2
              id="review-modal-title"
              className="text-center text-xl font-bold"
              style={{ color: NAVY }}
            >
              Votre avis compte
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              Comment évaluez-vous Academia Helm ?
            </p>
            <div className="mt-8 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <StarButton
                  key={i}
                  index={i}
                  active={rating}
                  hover={hover}
                  onSelect={setRating}
                  onEnter={setHover}
                  onLeave={() => setHover(0)}
                />
              ))}
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
                  background:
                    rating === 0
                      ? '#94a3b8'
                      : `linear-gradient(90deg, ${GOLD}, ${HELM_GOLD_LIGHT})`,
                  color: rating === 0 ? '#fff' : NAVY,
                }}
              >
                Continuer →
              </button>
            </div>
          </>
        ) : null}

        {step === 'form' ? (
          <>
            <button
              type="button"
              className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-800"
              onClick={() => setStep('rating')}
            >
              ← Retour
            </button>
            <div className="mb-4 flex items-center gap-3">
              <SmallStars rating={rating} />
              <span className="text-sm text-slate-600">
                {RATING_LABELS[rating]}
              </span>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Commentaire *
              </span>
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
              <span className="text-sm font-medium text-slate-700">
                Établissement *
              </span>
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
            {err ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {err}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">
              Votre avis sera vérifié avant publication.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={
                  submitting ||
                  !comment.trim() ||
                  !name.trim() ||
                  !school.trim() ||
                  !cityVal.trim()
                }
                onClick={() => void submit()}
                className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: `linear-gradient(90deg, ${GOLD}, ${HELM_GOLD_LIGHT})`,
                  color: NAVY,
                }}
              >
                Soumettre mon avis ✓
              </button>
            </div>
          </>
        ) : null}

        {step === 'success' ? (
          <div className="py-4 text-center">
            <p className="text-4xl" aria-hidden>
              🎉
            </p>
            <h2
              className="mt-4 text-xl font-bold"
              style={{ color: NAVY }}
              id="review-modal-title"
            >
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
        ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div className="w-full" role="region" aria-labelledby="review-modal-title">
        {card}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Fermer"
        onClick={onClose}
      />
      {card}
    </div>
  );
}
