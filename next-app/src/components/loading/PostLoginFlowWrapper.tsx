/**
 * PostLoginFlowWrapper Component
 * 
 * Wrapper client pour gérer le flow post-login.
 * S'affiche automatiquement après l'authentification.
 * 
 * IMPORTANT: Le flow ne s'exécute qu'une seule fois par session navigateur.
 * Les navigations ultérieures entre modules/onglets n'affichent PAS le loading.
 *
 * FIX: Utilise localStorage (partagé entre sous-domaines si même origine de base)
 * au lieu de sessionStorage (isolé par sous-domaine) pour le flag de complétion.
 * De plus, quand le layout serveur a déjà validé la session (user + tenant fournis),
 * on saute le checkAuth() redondant du flow post-login.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { MinDurationScreen } from './MinDurationScreen';
import { PostLoginLoading } from './PostLoginLoading';
import type { PostLoginFlowResult } from '@/lib/loading/post-login-flow.service';

export interface PostLoginFlowWrapperProps {
  children: React.ReactNode;
  user: any;
  tenant: any;
}

const SESSION_KEY = 'academia_post_login_done';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

/**
 * Vérifie si le flow post-login a déjà été complété dans cette session.
 * Utilise localStorage au lieu de sessionStorage pour être partagé
 * entre les sous-domaines (même origine de base).
 */
function wasFlowCompletedThisSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    // Expiré ?
    if (Date.now() - ts > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Marque le flow post-login comme complété pour cette session.
 */
function markFlowCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }));
  } catch {
    // localStorage indisponible (mode privé, quota, etc.)
  }
}

// Variable module-level comme fallback si localStorage est indisponible
let moduleLevelFlowDone = false;

/**
 * Wrapper pour gérer le flow post-login
 * 
 * Affiche le loading screen pendant l'initialisation,
 * puis affiche le contenu une fois le flow terminé.
 * Le flow ne s'exécute qu'une seule fois par session navigateur.
 */
export function PostLoginFlowWrapper({
  children,
  user,
  tenant,
}: PostLoginFlowWrapperProps) {
  // Vérifier immédiatement si le flow a déjà été fait (pas de loading flash)
  const alreadyDone = wasFlowCompletedThisSession() || moduleLevelFlowDone;

  // FIX: Si le layout serveur a déjà validé la session (user + tenant fournis),
  // on peut court-circuiter le flow post-login directement.
  // Le checkAuth() du flow est redondant car le layout a déjà appelé getServerSession().
  const hasValidServerSession = !!(user?.id && tenant?.id);

  const [flowResult, setFlowResult] = useState<PostLoginFlowResult | null>(
    alreadyDone || hasValidServerSession
      ? { success: true, user, tenant, academicYear: null, permissions: [], offlineStatus: { isOnline: true, pendingOperations: 0, syncRequired: false }, orionAlerts: [] }
      : null
  );
  const [error, setError] = useState<any>(null);
  const hasRunRef = useRef(false);

  // Marquer le flow comme complété si on a court-circuité grâce à la session serveur
  useEffect(() => {
    if (hasValidServerSession && !moduleLevelFlowDone) {
      markFlowCompleted();
      moduleLevelFlowDone = true;
    }
  }, [hasValidServerSession]);

  // Réinitialiser le flag module-level lors du logout
  useEffect(() => {
    const handleReset = () => {
      moduleLevelFlowDone = false;
      try { localStorage.removeItem(SESSION_KEY); } catch {}
    };
    window.addEventListener('user-context-reset', handleReset);
    return () => window.removeEventListener('user-context-reset', handleReset);
  }, []);

  const handleComplete = (result: PostLoginFlowResult) => {
    setFlowResult(result);
    markFlowCompleted();
    moduleLevelFlowDone = true;

    // Stocker les résultats dans le contexte global si nécessaire
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('post-login-complete', { detail: result })
      );
    }
  };

  const handleError = (err: any) => {
    setError(err);
    console.error('Post-login flow error:', err);

    // Gérer les erreurs critiques
    // IMPORTANT: Toujours utiliser window.location.href (rechargement complet)
    // pour les redirections critiques, jamais router.push() qui peut causer
    // une page blanche sur les sous-domaines tenant (race condition RSC/cookies).
    if (err.code === 'AUTH_ERROR') {
      window.location.href = '/login';
      return;
    }

    if (err.code === 'TENANT_NOT_FOUND' || err.code === 'TENANT_SUSPENDED') {
      window.location.href = '/tenant-not-found';
      return;
    }

    // Pour les autres erreurs, continuer quand même
    markFlowCompleted();
    moduleLevelFlowDone = true;
    setFlowResult({
      success: false,
      user,
      tenant,
      academicYear: null,
      permissions: [],
      offlineStatus: { isOnline: true, pendingOperations: 0, syncRequired: false },
      orionAlerts: [],
      error: { step: err.step || 'INIT_SECURE_CONTEXT', message: err.message || 'Erreur', code: err.code || 'UNKNOWN_ERROR' },
    });
  };

  // Si le flow a déjà été complété dans cette session, afficher directement le contenu
  // mais en garantissant un minimum de 15 secondes de loading pour la première visite
  if (flowResult) {
    return (
      <MinDurationScreen ready={true}>
        {children}
      </MinDurationScreen>
    );
  }

  // Sinon, exécuter le flow post-login (une seule fois)
  if (!hasRunRef.current) {
    hasRunRef.current = true;
  }

  return (
    <PostLoginLoading onComplete={handleComplete} onError={handleError} />
  );
}
