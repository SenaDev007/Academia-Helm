'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Tenant, User } from '@/types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
const OPEN_DELAY_MS = 4000;

function promptedKey(tenantId: string) {
  return `review_prompted_${tenantId}`;
}

function dismissedAtKey(tenantId: string) {
  return `review_dismissed_at_${tenantId}`;
}

function submittedKey(tenantId: string) {
  return `review_submitted_${tenantId}`;
}

/**
 * Hook de gestion du prompt d'avis :
 *
 * - Après 30 jours d'utilisation du tenant → affiche le prompt
 * - Si l'utilisateur refuse ("Plus tard") → enregistre la date de refus
 *   - 1er refus : rappelle après 15 jours
 *   - 2ème refus et suivants : rappelle après 30 jours
 * - Si l'utilisateur accepte ou soumet un avis → plus jamais de notification
 * - L'avis soumis marque le tenant comme "avis donné" (localStorage)
 */
export function useReviewPrompt(
  tenant: Tenant | undefined,
  user: User | undefined,
): { open: boolean; dismiss: () => void; accept: () => void } {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !tenant?.id || !tenant.createdAt) return;

    // Déjà soumis un avis → jamais de prompt
    if (localStorage.getItem(submittedKey(tenant.id))) return;

    const created = new Date(tenant.createdAt).getTime();
    if (Number.isNaN(created)) return;

    const now = Date.now();
    const tenantAge = now - created;

    // Le tenant n'a pas encore 30 jours → pas de prompt
    if (tenantAge < THIRTY_DAYS_MS) return;

    // Vérifier si on a déjà montré le prompt et quand il a été refusé
    const dismissedAt = localStorage.getItem(dismissedAtKey(tenant.id));
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (!Number.isNaN(dismissedTime)) {
        // Compter le nombre de refus pour adapter le délai
        const promptedCount = parseInt(localStorage.getItem(promptedKey(tenant.id)) || '0', 10);
        const reminderDelay = promptedCount <= 1 ? FIFTEEN_DAYS_MS : THIRTY_DAYS_MS;

        if (now - dismissedTime < reminderDelay) {
          // Pas encore le moment de rappeler
          return;
        }
        // Le délai est passé → on peut re-montrer le prompt
      }
    }

    const t = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [tenant?.id, tenant?.createdAt]);

  const dismiss = useCallback(() => {
    if (!tenant?.id) return;
    // Enregistrer la date de refus et incrémenter le compteur
    const currentCount = parseInt(localStorage.getItem(promptedKey(tenant.id)) || '0', 10);
    localStorage.setItem(promptedKey(tenant.id), String(currentCount + 1));
    localStorage.setItem(dismissedAtKey(tenant.id), String(Date.now()));
    setOpen(false);
  }, [tenant?.id]);

  const accept = useCallback(() => {
    // L'utilisateur accepte → on marque comme "prompted" mais pas "submitted"
    // Le flag "submitted" sera mis quand l'avis sera réellement envoyé
    setOpen(false);
  }, []);

  return { open, dismiss, accept };
}

/**
 * Marque un avis comme soumis pour un tenant donné.
 * À appeler après une soumission réussie du formulaire d'avis.
 */
export function markReviewSubmitted(tenantId: string) {
  if (typeof window === 'undefined' || !tenantId) return;
  localStorage.setItem(submittedKey(tenantId), String(Date.now()));
  // Nettoyer les autres clés
  localStorage.removeItem(promptedKey(tenantId));
  localStorage.removeItem(dismissedAtKey(tenantId));
}

export function buildAuthorName(user: User | undefined): string {
  if (!user) return '';
  const fn = user.firstName?.trim() || '';
  const ln = user.lastName?.trim() || '';
  return [fn, ln].filter(Boolean).join(' ');
}
