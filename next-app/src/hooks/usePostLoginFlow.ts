/**
 * usePostLoginFlow Hook
 * 
 * Hook pour orchestrer le flow post-login complet
 * avec gestion d'état et callbacks.
 * 
 * IMPORTANT: N'exécute le flow qu'une seule fois par session navigateur.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  executePostLoginFlow,
  type PostLoginFlowResult,
  type PostLoginFlowProgress,
} from '@/lib/loading/post-login-flow.service';
import { getLoadingMessage, type LoadingStep } from '@/lib/loading/loading-messages';

const SESSION_KEY = 'academia_post_login_done';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

export interface UsePostLoginFlowReturn {
  isLoading: boolean;
  progress: PostLoginFlowProgress | null;
  result: PostLoginFlowResult | null;
  error: PostLoginFlowResult['error'] | null;
  execute: () => Promise<void>;
}

/**
 * Hook pour gérer le flow post-login
 * 
 * @example
 * ```tsx
 * const { isLoading, progress, result, execute } = usePostLoginFlow();
 * 
 * useEffect(() => {
 *   execute();
 * }, []);
 * 
 * if (isLoading) {
 *   return <LoadingScreen message={progress?.message} progress={progress?.progress} />;
 * }
 * ```
 */
export function usePostLoginFlow(): UsePostLoginFlowReturn {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<PostLoginFlowProgress | null>(null);
  const [result, setResult] = useState<PostLoginFlowResult | null>(null);
  const [error, setError] = useState<PostLoginFlowResult['error'] | null>(null);
  const hasExecutedRef = useRef(false);

  const execute = useCallback(async () => {
    // Ne pas ré-exécuter si déjà fait dans cette session
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    // Vérifier si le flow a déjà été complété dans cette session navigateur
    // Utilise localStorage (partagé entre sous-domaines) au lieu de sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const { ts } = JSON.parse(raw);
          if (Date.now() - ts <= SESSION_TTL_MS) {
            // Flow déjà fait — simuler un résultat réussi sans appeler le service
            setResult({
              success: true,
              user: null as any,
              tenant: null as any,
              academicYear: null,
              permissions: [],
              offlineStatus: { isOnline: true, pendingOperations: 0, syncRequired: false },
              orionAlerts: [],
            });
            return;
          }
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {}
    }

    setIsLoading(true);
    setProgress(null);
    setResult(null);
    setError(null);

    try {
      const flowResult = await executePostLoginFlow((progressUpdate) => {
        setProgress(progressUpdate);
      });

      setResult(flowResult);

      if (!flowResult.success && flowResult.error) {
        setError(flowResult.error);

        // Gérer les erreurs critiques
        // IMPORTANT: Toujours utiliser window.location.href (rechargement complet)
        // pour les redirections critiques, jamais router.push() qui peut causer
        // une page blanche sur les sous-domaines tenant (race condition RSC/cookies).
        if (flowResult.error.code === 'AUTH_ERROR') {
          window.location.href = '/login';
          return;
        }

        if (flowResult.error.code === 'TENANT_NOT_FOUND' || flowResult.error.code === 'TENANT_SUSPENDED') {
          window.location.href = '/tenant-not-found';
          return;
        }

        if (flowResult.error.code === 'NO_ACADEMIC_YEAR') {
          // Afficher un message d'erreur mais continuer
          console.error('No academic year found');
        }
      }
    } catch (err: any) {
      console.error('Post-login flow error:', err);
      setError({
        step: 'INIT_SECURE_CONTEXT',
        message: 'Erreur lors de l\'initialisation',
        code: 'UNKNOWN_ERROR',
      });
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return {
    isLoading,
    progress,
    result,
    error,
    execute,
  };
}
