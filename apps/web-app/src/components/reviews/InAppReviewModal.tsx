'use client';

import { useState } from 'react';
import { Star, X, CheckCircle, MessageSquare } from 'lucide-react';
import { buildReviewsSubmitUrl } from '@/lib/reviews-api-url';

interface InAppReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pré-rempli si l'utilisateur est connecté */
  authorName?: string;
  authorRole?: string;
  schoolName?: string;
  city?: string;
  tenantId?: string;
}

type Step = 'rating' | 'form' | 'success';

export default function InAppReviewModal({
  isOpen,
  onClose,
  authorName = '',
  authorRole = '',
  schoolName = '',
  city = '',
  tenantId,
}: InAppReviewModalProps) {
  const [step, setStep] = useState<Step>('rating');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [form, setForm] = useState({
    authorName,
    authorRole,
    schoolName,
    city,
    comment: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleRatingSelect = (value: number) => {
    setRating(value);
    setStep('form');
  };

  const handleSubmit = async () => {
    if (rating === 0 || !form.authorName.trim() || !form.schoolName.trim() || !form.comment.trim()) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        authorName: form.authorName.trim(),
        authorRole: form.authorRole.trim() || undefined,
        schoolName: form.schoolName.trim(),
        city: form.city.trim() || 'Non spécifié',
        rating,
        comment: form.comment.trim(),
      };
      if (tenantId) payload.tenantId = tenantId;

      const res = await fetch(buildReviewsSubmitUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Erreur réseau');

      // Marquer l'avis comme donné dans localStorage
      try {
        localStorage.setItem('helm_review_submitted', 'true');
        localStorage.setItem('helm_review_submitted_at', new Date().toISOString());
      } catch {}

      setStep('success');
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === 'rating') {
      // L'utilisateur a refusé de donner son avis
      try {
        const declinedAt = new Date().toISOString();
        localStorage.setItem('helm_review_declined_at', declinedAt);
      } catch {}
    }
    setStep('rating');
    setRating(0);
    setHoverRating(0);
    setError('');
    onClose();
  };

  const NAVY = '#1E3A5F';
  const GOLD = '#C9A84C';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4" style={{ background: `linear-gradient(135deg, ${NAVY}, #2D5A8E)` }}>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, #E8C84C)` }}>
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Votre avis compte</h3>
              <p className="text-white/70 text-sm">Partagez votre expérience avec Academia Helm</p>
            </div>
          </div>
        </div>

        {/* Step: Rating */}
        {step === 'rating' && (
          <div className="p-6 text-center">
            <p className="text-gray-700 mb-4 text-sm">Comment évaluez-vous Academia Helm ?</p>
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRatingSelect(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                  aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                >
                  <Star
                    size={40}
                    fill={star <= (hoverRating || rating) ? GOLD : 'none'}
                    stroke={star <= (hoverRating || rating) ? GOLD : '#D1D5DB'}
                    strokeWidth={1.5}
                    className="transition-colors duration-150"
                  />
                </button>
              ))}
            </div>
            <p className="text-gray-400 text-xs">Cliquez sur une étoile pour continuer</p>
          </div>
        )}

        {/* Step: Form */}
        {step === 'form' && (
          <div className="p-6 space-y-4">
            {/* Selected rating display */}
            <div className="flex items-center gap-1 justify-center mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={24}
                  fill={star <= rating ? GOLD : 'none'}
                  stroke={star <= rating ? GOLD : '#D1D5DB'}
                  strokeWidth={1.5}
                />
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Votre nom *</label>
              <input
                type="text"
                value={form.authorName}
                onChange={(e) => setForm(f => ({ ...f, authorName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Ex: M. Agossa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Votre profil</label>
              <select
                value={form.authorRole}
                onChange={(e) => setForm(f => ({ ...f, authorRole: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">École (ou école de votre enfant) *</label>
                <input
                  type="text"
                  value={form.schoolName}
                  onChange={(e) => setForm(f => ({ ...f, schoolName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Nom de l'école"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Ville"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Votre témoignage *</label>
              <textarea
                value={form.comment}
                onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                placeholder="Décrivez votre expérience avec Academia Helm..."
              />
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${NAVY}, #2D5A8E)`,
              }}
            >
              {submitting ? 'Envoi en cours...' : 'Envoyer mon avis'}
            </button>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="p-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#ECFDF5' }}>
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">Merci pour votre avis !</h4>
            <p className="text-gray-600 text-sm mb-4">
              Votre témoignage a été publié sur la page d'accueil avec le logo
              de votre établissement. Il est désormais visible publiquement.
            </p>
            <button
              onClick={() => { setStep('rating'); setRating(0); onClose(); }}
              className="px-6 py-2 rounded-lg text-white font-semibold text-sm"
              style={{ background: `linear-gradient(135deg, ${NAVY}, #2D5A8E)` }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
