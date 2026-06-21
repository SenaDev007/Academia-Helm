'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import InAppReviewModal from './InAppReviewModal';

interface ReviewAutoPopupProps {
  /** Date de création du compte ou premier login (ISO string) */
  accountCreatedAt?: string;
  authorName?: string;
  authorRole?: string;
  schoolName?: string;
  city?: string;
  tenantId?: string;
}

/**
 * Composant invisible qui affiche automatiquement une demande d'avis
 * après 30 jours d'utilisation.
 *
 * Logique :
 * - Après 30 jours d'utilisation → affiche le popup
 * - Si l'utilisateur refuse → re-demande après 15-30 jours
 * - Si l'utilisateur a déjà donné son avis → plus jamais de notification
 *
 * IMPORTANT : la vérification "avis déjà soumis" est double :
 *  1. localStorage (rapide)
 *  2. Backend `/api/public/reviews/check-tenant/:tenantId` (source de vérité,
 *     persiste entre navigateurs/appareils)
 *
 * Sans la vérification backend, le popup réapparaît à chaque changement de
 * navigateur ou vidage de cache, même si l'utilisateur a déjà soumis un avis.
 */
export default function ReviewAutoPopup({
  accountCreatedAt,
  authorName,
  authorRole,
  schoolName,
  city,
  tenantId,
}: ReviewAutoPopupProps) {
  const [showModal, setShowModal] = useState(false);
  const [checked, setChecked] = useState(false);
  const cancelledRef = useRef(false);

  const shouldShowPopup = useCallback(async (): Promise<boolean> => {
    try {
      // 1) Vérifier localStorage en premier (rapide)
      const localSubmitted = localStorage.getItem('helm_review_submitted');
      if (localSubmitted === 'true') return false;

      // 2) Vérifier côté backend (source de vérité)
      if (tenantId) {
        try {
          const checkUrl = `/api/public/reviews/check-tenant/${encodeURIComponent(tenantId)}`;
          const res = await fetch(checkUrl, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data?.hasReview === true) {
              // Le tenant a déjà soumis un avis — on marque localStorage
              // pour éviter les futures requêtes réseau.
              try {
                localStorage.setItem('helm_review_submitted', 'true');
                localStorage.setItem(
                  'helm_review_submitted_at',
                  new Date().toISOString(),
                );
              } catch {}
              return false;
            }
          }
          // Si la requête échoue, on continue avec la logique locale
        } catch {
          // ignore réseau errors
        }
      }

      // 3) Date de création du compte
      const createdAt = accountCreatedAt ? new Date(accountCreatedAt) : null;

      // 4) Date du dernier refus
      const declinedAtStr = localStorage.getItem('helm_review_declined_at');
      const declinedAt = declinedAtStr ? new Date(declinedAtStr) : null;

      const now = new Date();

      // Si l'utilisateur a déjà refusé
      if (declinedAt) {
        const daysSinceDecline =
          (now.getTime() - declinedAt.getTime()) / (1000 * 60 * 60 * 24);
        // Re-demander après 15 jours
        if (daysSinceDecline < 15) return false;
        // Mais il faut aussi que le compte ait au moins 30 jours
        if (createdAt) {
          const daysSinceCreation =
            (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceCreation < 30) return false;
        }
        return true;
      }

      // Si on n'a pas la date de création, on ne peut pas déterminer
      if (!createdAt) return false;

      const daysSinceCreation =
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation >= 30;
    } catch {
      return false;
    }
  }, [accountCreatedAt, tenantId]);

  useEffect(() => {
    if (checked) return;
    cancelledRef.current = false;

    // Vérifier après un court délai pour ne pas bloquer le rendu initial
    const timer = setTimeout(async () => {
      if (cancelledRef.current) return;
      const should = await shouldShowPopup();
      if (cancelledRef.current) return;

      if (should) {
        // Vérifier qu'on n'a pas déjà montré le popup dans cette session
        const shownThisSession = sessionStorage.getItem('helm_review_popup_shown');
        if (shownThisSession !== 'true') {
          setShowModal(true);
          try {
            sessionStorage.setItem('helm_review_popup_shown', 'true');
          } catch {}
        }
      }
      setChecked(true);
    }, 3000); // 3 secondes après le chargement de la page

    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
    };
  }, [checked, shouldShowPopup]);

  const handleClose = () => {
    setShowModal(false);
  };

  return (
    <InAppReviewModal
      isOpen={showModal}
      onClose={handleClose}
      authorName={authorName}
      authorRole={authorRole}
      schoolName={schoolName}
      city={city}
      tenantId={tenantId}
    />
  );
}
