/**
 * PostLoginFlowWrapper Component
 * 
 * Wrapper client pour gérer le flow post-login.
 * S'affiche automatiquement après l'authentification.
 * 
 * IMPORTANT: Le flow ne s'exécute qu'une seule fois par session navigateur.
 * Les navigations ultérieures entre modules/onglets n'affichent PAS le loading.
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

/**
 * Vérifie si le flow post-login a déjà été complété dans cette session.
 */
function wasFlowCompletedThisSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
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
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // sessionStorage indisponible (mode privé, quota, etc.)
  }
}

// Variable module-level comme fallback si sessionStorage est indisponible
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

  const [flowResult, setFlowResult] = useState<PostLoginFlowResult | null>(
    alreadyDone ? { success: true, user, tenant, academicYear: null, permissions: [], offlineStatus: { isOnline: true, pendingOperations: 0, syncRequired: false }, orionAlerts: [] } : null
  );
  const [error, setError] = useState<any>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasRunRef = useRef(false);

  // Réinitialiser le flag module-level lors du logout
  useEffect(() => {
    const handleReset = () => {
      moduleLevelFlowDone = false;
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
    if (err.code === 'AUTH_ERROR') {
      // IMPORTANT: Utiliser window.location.href au lieu de router.push
      // pour forcer un rechargement complet de la page, ce qui garantit
      // que les cookies sont correctement traités sur mobile.
      setIsRedirecting(true);
      window.location.href = '/login';
      return;
    }

    if (err.code === 'TENANT_NOT_FOUND' || err.code === 'TENANT_SUSPENDED') {
      setIsRedirecting(true);
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
  if (flowResult) {
    return <>{children}</>;
  }

  // Si on est en train de rediriger (erreur critique), afficher un message de transition
  // au lieu d'une page blanche pendant que la redirection s'effectue
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="text-center px-4">
          <div className="w-12 h-12 border-4 border-[#0b2f73] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-600">Redirection en cours...</p>
        </div>
      </div>
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
