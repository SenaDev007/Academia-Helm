/**
 * PostLoginFlowWrapper Component
 *
 * Wrapper client pour gérer le flow post-login.
 * S'affiche automatiquement après l'authentification.
 *
 * IMPORTANT: Le flow ne s'exécute qu'une seule fois par session navigateur.
 * Les navigations ultérieures entre modules/onglets n'affichent PAS le loading.
 *
 * FIX: Quand un fresh_login est détecté (flag sessionStorage positionné par
 * la page de login/portal avant la redirection), le loading screen s'affiche
 * TOUJOURS avec progression réelle, même si la session serveur est valide.
 * Cela garantit une UX professionnelle après authentification.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { PostLoginLoading } from './PostLoginLoading';
import type { PostLoginFlowResult } from '@/lib/loading/post-login-flow.service';

export interface PostLoginFlowWrapperProps {
  children: React.ReactNode;
  user: any;
  tenant: any;
}

const SESSION_KEY = 'academia_post_login_done';
const FRESH_LOGIN_KEY = 'academia_fresh_login';
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
 * Vérifie si l'utilisateur vient de se connecter (fresh login).
 * Le flag est positionné par la page de login/portal AVANT la redirection.
 * Il est nettoyé après l'affichage du loading screen.
 */
function isFreshLogin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(FRESH_LOGIN_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Nettoie le flag fresh login après usage.
 */
function clearFreshLoginFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(FRESH_LOGIN_KEY);
  } catch { /* ignore */ }
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
 * Affiche le loading screen avec progression réelle pendant l'initialisation,
 * puis affiche le contenu une fois le flow terminé.
 *
 * Comportement :
 * - Fresh login → TOUJOURS afficher le loading screen avec progression réelle
 * - Navigation intra-app (pas de fresh login, déjà fait) → afficher directement le contenu
 */
export function PostLoginFlowWrapper({
  children,
  user,
  tenant,
}: PostLoginFlowWrapperProps) {
  // Vérifier immédiatement si le flow a déjà été fait (pas de loading flash)
  const alreadyDone = wasFlowCompletedThisSession() || moduleLevelFlowDone;

  // Fresh login : l'utilisateur vient de s'authentifier → afficher le loading
  const freshLogin = isFreshLogin();

  // Si ce n'est PAS un fresh login ET que le flow a déjà été complété,
  // on affiche directement le contenu (navigation intra-app)
  const shouldSkipLoading = !freshLogin && alreadyDone;

  const [flowResult, setFlowResult] = useState<PostLoginFlowResult | null>(
    shouldSkipLoading
      ? { success: true, user, tenant, academicYear: null, permissions: [], offlineStatus: { isOnline: true, pendingOperations: 0, syncRequired: false }, orionAlerts: [] }
      : null
  );
  const [error, setError] = useState<any>(null);
  const hasRunRef = useRef(false);

  // Nettoyer le flag fresh login et marquer le flow comme complété si on skip
  useEffect(() => {
    if (shouldSkipLoading) {
      clearFreshLoginFlag();
      if (!moduleLevelFlowDone) {
        markFlowCompleted();
        moduleLevelFlowDone = true;
      }
    }
  }, [shouldSkipLoading]);

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
    clearFreshLoginFlag();

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
    clearFreshLoginFlag();
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
  if (flowResult) {
    return <>{children}</>;
  }

  // Sinon, exécuter le flow post-login (une seule fois) avec loading screen
  if (!hasRunRef.current) {
    hasRunRef.current = true;
  }

  return (
    <PostLoginLoading onComplete={handleComplete} onError={handleError} />
  );
}
