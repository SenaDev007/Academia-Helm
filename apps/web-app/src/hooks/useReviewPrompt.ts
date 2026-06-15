'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Tenant, User } from '@/types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RE_REMIND_DAYS = 15; // Re-demander après 15 jours si refusé
const OPEN_DELAY_MS = 4000;

/**
 * Affiche une invite d'avis après 30 jours d'existence du tenant.
 *
 * Logique complète :
 * - Après 30 jours d'utilisation → affiche le popup
 * - Si l'utilisateur refuse → re-demande après 15 jours
 * - Si l'utilisateur a déjà donné son avis → plus jamais de notification
 */
export function useReviewPrompt(
  tenant: Tenant | undefined,
  user: User | undefined,
): { open: boolean; dismiss: () => void } {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !tenant?.id || !tenant.createdAt) {
      return;
    }

    // Si l'utilisateur a déjà donné son avis → jamais de popup
    const submitted = localStorage.getItem('helm_review_submitted');
    if (submitted === 'true') return;

    // Date de création du tenant
    const created = new Date(tenant.createdAt).getTime();
    if (Number.isNaN(created)) return;

    // Le compte doit avoir au moins 30 jours
    const now = Date.now();
    if (now < created + THIRTY_DAYS_MS) return;

    // Vérifier si l'utilisateur a déjà refusé récemment
    const declinedAtStr = localStorage.getItem('helm_review_declined_at');
    if (declinedAtStr) {
      const declinedAt = new Date(declinedAtStr).getTime();
      if (!Number.isNaN(declinedAt)) {
        const daysSinceDecline = (now - declinedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceDecline < RE_REMIND_DAYS) return; // Pas encore 15 jours depuis le refus
      }
    }

    // Vérifier qu'on n'a pas déjà montré le popup dans cette session
    const shownThisSession = sessionStorage.getItem('helm_review_popup_shown');
    if (shownThisSession === 'true') return;

    const t = window.setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem('helm_review_popup_shown', 'true'); } catch {}
    }, OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [tenant?.id, tenant?.createdAt]);

  const dismiss = useCallback(() => {
    // Enregistrer la date de refus pour le re-rappel après 15 jours
    try {
      localStorage.setItem('helm_review_declined_at', new Date().toISOString());
    } catch {}
    setOpen(false);
  }, []);

  return { open, dismiss };
}

export function buildAuthorName(user: User | undefined): string {
  if (!user) return '';
  const fn = user.firstName?.trim() || '';
  const ln = user.lastName?.trim() || '';
  return [fn, ln].filter(Boolean).join(' ');
}
