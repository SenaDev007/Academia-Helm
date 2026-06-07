/**
 * ============================================================================
 * USE IDLE TIMEOUT - DÉCONNEXION AUTOMATIQUE APRÈS INACTIVITÉ
 * ============================================================================
 *
 * Surveille l'activité utilisateur (mouse, keyboard, touch, scroll, click).
 * Après 15 minutes d'inactivité, déconnecte automatiquement l'utilisateur
 * et redirige vers la page de login avec pré-remplissage du tenant et de
 * l'identifiant (mais PAS du mot de passe).
 *
 * Le minuteur se réinitialise à chaque activité détectée.
 * ============================================================================
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clearClientSessionSync } from '@/lib/auth/client-access-token';
import { saveEmailForTenant } from '@/lib/auth/saved-email';

/** Durée d'inactivité avant déconnexion automatique (15 minutes en ms) */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Intervalle de vérification (toutes les 30 secondes) */
const CHECK_INTERVAL_MS = 30 * 1000;

/** Clé localStorage pour le timestamp de dernière activité */
const LAST_ACTIVITY_KEY = 'academia_helm_last_activity';

/**
 * Événements DOM qui indiquent une activité utilisateur.
 * On utilise { passive: true } pour ne pas bloquer le thread principal.
 */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

interface UseIdleTimeoutOptions {
  /** Délai en ms avant déconnexion (défaut : 15 min) */
  timeoutMs?: number;
  /** Email de l'utilisateur courant (pour pré-remplissage) */
  userEmail?: string;
  /** Identifiant du tenant courant (pour pré-remplissage) */
  tenantId?: string;
  /** Slug du tenant (pour URL de redirection) */
  tenantSlug?: string;
}

export function useIdleTimeout({
  timeoutMs = IDLE_TIMEOUT_MS,
  userEmail,
  tenantId,
  tenantSlug,
}: UseIdleTimeoutOptions) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggingOutRef = useRef(false);

  /** Enregistre le timestamp de dernière activité */
  const recordActivity = useCallback(() => {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {
      // localStorage indisponible (mode privé, etc.)
    }
  }, []);

  /** Déconnecte l'utilisateur et redirige vers login avec pré-remplissage */
  const performLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      // Sauvegarder l'email pour le tenant avant de nettoyer la session
      if (userEmail && tenantId) {
        saveEmailForTenant(userEmail, tenantId);
      }

      // Appeler l'API de logout côté serveur (supprime les cookies httpOnly)
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {
        // Même si l'API échoue, on nettoie côté client
      });

      // Nettoyer les tokens localStorage
      clearClientSessionSync();

      // Construire l'URL de login avec pré-remplissage
      const params = new URLSearchParams();
      if (tenantSlug) {
        params.set('tenant', tenantSlug);
      } else if (tenantId) {
        params.set('tenant_id', tenantId);
      }
      // Indiquer la raison de la déconnexion pour afficher un message
      params.set('reason', 'idle_timeout');

      const loginUrl = `/login?${params.toString()}`;

      // Redirection complète (pas router.push) pour nettoyer tout l'état
      window.location.href = loginUrl;
    } catch (error) {
      console.error('[IdleTimeout] Error during idle logout:', error);
      // Fallback : rediriger quand même
      window.location.href = '/login?reason=idle_timeout';
    }
  }, [userEmail, tenantId, tenantSlug]);

  /** Vérifie si le délai d'inactivité est dépassé */
  const checkIdle = useCallback(() => {
    try {
      const lastActivityStr = localStorage.getItem(LAST_ACTIVITY_KEY);
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= timeoutMs) {
        performLogout();
      }
    } catch {
      // Si localStorage est indisponible, on ne déconnecte pas
    }
  }, [timeoutMs, performLogout]);

  useEffect(() => {
    // Enregistrer l'activité initiale
    recordActivity();

    // Attacher les écouteurs d'événements (passifs pour performance)
    const handleActivity = () => {
      recordActivity();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Lancer l'intervalle de vérification
    timerRef.current = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      // Nettoyer les écouteurs et l'intervalle
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [recordActivity, checkIdle]);

  // Pas besoin de retourner quoi que ce soit — c'est un hook "fire-and-forget"
}
