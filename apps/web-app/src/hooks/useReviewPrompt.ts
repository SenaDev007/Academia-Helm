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
 *
 * IMPORTANT : la vérification "avis déjà soumis" est double :
 *  1. localStorage (rapide, évite une requête réseau à chaque chargement)
 *  2. Backend `/api/public/reviews/check-tenant/:tenantId` (source de vérité,
 *     persiste même si l'utilisateur change de navigateur, vide son cache,
 *     ou se connecte depuis un autre appareil)
 *
 * C'est la vérification backend qui corrige le bug "le popup s'affiche à
 * chaque connexion même après avis soumis" — localStorage seul n'est pas
 * fiable car il est spécifique au navigateur.
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

    // Vérifier qu'on n'a pas déjà montré le popup dans cette session
    // (évite de re-popuper si l'utilisateur navigue entre les pages)
    const shownThisSession = sessionStorage.getItem('helm_review_popup_shown');
    if (shownThisSession === 'true') return;

    let cancelled = false;

    const run = async () => {
      // 1) Vérifier localStorage en premier (rapide)
      const localSubmitted = localStorage.getItem('helm_review_submitted');
      if (localSubmitted === 'true') {
        return; // déjà soumis selon localStorage → pas de popup
      }

      // 2) Vérifier côté backend (source de vérité, marche même en cas de
      //    changement de navigateur, de cache vidé, etc.)
      try {
        const checkUrl = `/api/public/reviews/check-tenant/${encodeURIComponent(tenant.id)}`;
        const res = await fetch(checkUrl, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.hasReview === true) {
            // Le tenant a déjà soumis un avis côté backend — on marque
            // aussi localStorage pour éviter les futures requêtes.
            try {
              localStorage.setItem('helm_review_submitted', 'true');
              localStorage.setItem(
                'helm_review_submitted_at',
                new Date().toISOString(),
              );
            } catch {}
            return; // pas de popup
          }
        }
        // Si la requête échoue (502, 404, etc.), on continue avec la
        // logique locale — ne pas bloquer le popup juste parce que le
        // backend est temporairement indisponible.
      } catch {
        // ignore réseau errors
      }

      // 3) Date de création du tenant
      const created = new Date(tenant.createdAt as unknown as string).getTime();
      if (Number.isNaN(created)) return;

      // Le compte doit avoir au moins 30 jours
      const now = Date.now();
      if (now < created + THIRTY_DAYS_MS) return;

      // 4) Vérifier si l'utilisateur a déjà refusé récemment
      const declinedAtStr = localStorage.getItem('helm_review_declined_at');
      if (declinedAtStr) {
        const declinedAt = new Date(declinedAtStr).getTime();
        if (!Number.isNaN(declinedAt)) {
          const daysSinceDecline = (now - declinedAt) / (1000 * 60 * 60 * 24);
          if (daysSinceDecline < RE_REMIND_DAYS) return; // Pas encore 15 jours depuis le refus
        }
      }

      // 5) Afficher le popup après un court délai
      if (cancelled) return;
      const t = window.setTimeout(() => {
        if (cancelled) return;
        setOpen(true);
        try {
          sessionStorage.setItem('helm_review_popup_shown', 'true');
        } catch {}
      }, OPEN_DELAY_MS);
      // Note : on ne peut pas retourner de cleanup depuis une fonction async,
      // donc on stocke le timer pour le nettoyer manuellement.
      (run as any).__timer = t;
    };

    run();

    return () => {
      cancelled = true;
      const t = (run as any).__timer as number | undefined;
      if (t) clearTimeout(t);
    };
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
