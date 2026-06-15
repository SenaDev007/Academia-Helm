'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { Tenant, User } from '@/types';
import { buildAuthorName, useReviewPrompt } from '@/hooks/useReviewPrompt';

const ReviewRequestModal = dynamic(
  () => import('@/components/reviews/ReviewRequestModal'),
  { ssr: false },
);

type ReviewContextValue = {
  /** Ouvre manuellement le modal de review (depuis le header, etc.) */
  openReview: () => void;
};

const ReviewContext = createContext<ReviewContextValue>({ openReview: () => {} });

export function useReviewContext() {
  return useContext(ReviewContext);
}

type Props = {
  user: User;
  tenant: Tenant;
  children?: ReactNode;
};

/**
 * Host du système d'avis in-app :
 * - Affiche automatiquement le prompt après 30 jours d'utilisation
 * - Si l'utilisateur refuse, rappelle après 15 jours
 * - Si l'utilisateur accepte ou clique le bouton étoile, ouvre le modal
 * - Une fois l'avis soumis, plus aucune notification
 * - Expose `openReview()` via contexte pour le bouton dans le header
 */
export function ReviewPromptHost({ user, tenant, children }: Props) {
  const { open: autoOpen, dismiss, accept } = useReviewPrompt(tenant, user);
  const [manualOpen, setManualOpen] = useState(false);

  // Le modal est visible si :
  // - Le prompt automatique s'est déclenché (autoOpen) → on montre d'abord la confirmation
  // - L'utilisateur a cliqué le bouton étoile (manualOpen) → on va direct au formulaire
  const showConfirmDialog = autoOpen && !manualOpen;
  const showReviewModal = manualOpen;

  const openReview = useCallback(() => {
    setManualOpen(true);
    // Si le prompt auto était visible, le fermer
    if (autoOpen) dismiss();
  }, [autoOpen, dismiss]);

  const handleAcceptFromPrompt = useCallback(() => {
    // L'utilisateur accepte depuis le prompt auto → ouvrir le modal de review
    accept();
    setManualOpen(true);
  }, [accept]);

  const handleDismissPrompt = useCallback(() => {
    // L'utilisateur refuse → on enregistre le refus pour rappel ultérieur
    dismiss();
  }, [dismiss]);

  const handleCloseModal = useCallback(() => {
    setManualOpen(false);
  }, []);

  return (
    <ReviewContext.Provider value={{ openReview }}>
      {children}

      {/* Dialogue de confirmation automatique (après 30 jours) */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            aria-label="Fermer"
            onClick={handleDismissPrompt}
          />
          <div className="relative z-[1] w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="text-center">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: '#C9A84C22' }}
              >
                <svg width={32} height={32} viewBox="0 0 24 24" fill="#C9A84C" stroke="#C9A84C" strokeWidth="1.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold" style={{ color: '#1E3A5F' }}>
                Votre avis compte !
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Vous utilisez Academia Helm depuis plus de 30 jours. Partagez votre expérience
                pour aider d&apos;autres établissements à découvrir la plateforme.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleAcceptFromPrompt}
                  className="w-full rounded-xl px-6 py-3 text-sm font-semibold transition hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(90deg, #C9A84C, #e4c978)',
                    color: '#1E3A5F',
                  }}
                >
                  Donner mon avis
                </button>
                <button
                  type="button"
                  onClick={handleDismissPrompt}
                  className="w-full rounded-xl px-6 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 transition"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de review (formulaire complet) */}
      {showReviewModal && (
        <ReviewRequestModal
          tenantId={tenant.id}
          schoolName={tenant.name}
          authorName={buildAuthorName(user)}
          authorRole={
            user.role === 'director' || user.role === 'SUPER_DIRECTOR'
              ? 'Direction'
              : user.role === 'admin'
                ? 'Administration'
                : undefined
          }
          onClose={handleCloseModal}
        />
      )}
    </ReviewContext.Provider>
  );
}
