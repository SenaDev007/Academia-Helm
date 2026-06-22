'use client';

import { useCallback, useRef, useState } from 'react';
import { buildReviewsSubmitUrl } from '@/lib/reviews-api-url';
import { compressImageFileToDataUrl } from '@/lib/media';
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

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

function StarButton({
  index,
  active,
  hover,
  onSelect,
  onEnter,
  onLeave,
}: {
  index: number;
  active: number;
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /** L'utilisateur dépose depuis l'app (tenantId fourni) → on n'affiche pas
   * l'upload de photo : le logo de l'école sera automatiquement utilisé. */
  const isSchoolContext = Boolean(tenantId);

  const handlePhotoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setPhotoError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        setPhotoError('Format non supporté. Utilisez JPG, PNG, WebP ou AVIF.');
        return;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        setPhotoError('Le fichier dépasse 2 Mo. Choisissez une image plus légère.');
        return;
      }
      // Aperçu local immédiat
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
      setPhotoUploading(true);
      try {
        // Pattern data URL : compresser côté navigateur et envoyer en JSON
        const photoDataUrl = await compressImageFileToDataUrl(file, {
          maxEdge: 512,
          quality: 0.85,
          mimeType: 'image/jpeg',
        });
        const res = await fetch(buildReviewsSubmitUrl('/upload-photo'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoDataUrl }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body?.message === 'string'
              ? body.message
              : `Upload impossible (HTTP ${res.status}).`,
          );
        }
        const { url } = (await res.json()) as { url: string };
        setPhotoUrl(url);
      } catch (error) {
        setPhotoError(
          error instanceof Error ? error.message : 'Upload impossible.',
        );
        setPhotoUrl(null);
        setPhotoPreview(null);
      } finally {
        setPhotoUploading(false);
      }
    },
    [],
  );

  const removePhoto = useCallback(() => {
    setPhotoUrl(null);
    setPhotoPreview(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

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
          photoUrl: photoUrl || undefined,
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
      // Marquer l'avis comme donné pour stopper les futures notifications auto
      try {
        localStorage.setItem('helm_review_submitted', 'true');
        localStorage.setItem('helm_review_submitted_at', new Date().toISOString());
      } catch {}
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
    photoUrl,
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
            <span className="text-sm font-medium text-slate-700">Votre profil *</span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/40 bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Sélectionnez votre profil</option>
              <option value="Directeur">Directeur / Directrice</option>
              <option value="Promoteur">Promoteur / Promotrice</option>
              <option value="Enseignant">Enseignant(e)</option>
              <option value="Parent">Parent d'élève</option>
              <option value="Élève">Élève / Étudiant(e)</option>
              <option value="Comptable">Comptable</option>
              <option value="Autre">Autre</option>
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-medium text-slate-700">
              Établissement (ou école de votre enfant)
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

          {/* Upload photo — uniquement pour les avis publics (hors app tenant) */}
          {!isSchoolContext ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Aperçu"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={NAVY}
                      strokeWidth="1.6"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    Photo (optionnel)
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Sans photo, vos initiales seront affichées. JPG, PNG, WebP — 2 Mo max.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={(e) => void handlePhotoChange(e)}
                      className="hidden"
                      id="review-photo-input"
                    />
                    <label
                      htmlFor="review-photo-input"
                      className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#C9A84C] hover:text-[#1E3A5F]"
                    >
                      {photoUploading
                        ? 'Chargement…'
                        : photoUrl
                          ? 'Changer'
                          : 'Ajouter une photo'}
                    </label>
                    {photoUrl ? (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:underline"
                      >
                        Retirer
                      </button>
                    ) : null}
                  </div>
                  {photoError ? (
                    <p className="mt-2 text-xs text-red-600">{photoError}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
              ✓ Votre avis sera publié avec le logo de votre établissement comme
              photo. Aucune photo personnelle n'est requise.
            </p>
          )}

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
              {submitting ? 'Envoi…' : 'Soumettre mon avis ✓'}
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
            {isSchoolContext
              ? "Votre témoignage a été publié sur la page d'accueil avec le logo de votre établissement."
              : 'Notre équipe le traitera sous peu. Vous contribuez à améliorer Academia Helm pour tous les utilisateurs — directeurs, enseignants, parents et élèves.'}
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
        onClick={() => {
          // Si l'utilisateur ferme au stade rating, c'est un refus → enregistrer pour re-rappel
          if (step === 'rating') {
            try {
              localStorage.setItem('helm_review_declined_at', new Date().toISOString());
            } catch {}
          }
          onClose();
        }}
      />
      {card}
    </div>
  );
}
