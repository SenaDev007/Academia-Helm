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
    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem(SESSION_KEY) === '1') {
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
        if (flowResult.error.code === 'AUTH_ERROR') {
          router.push('/login');
          return;
        }

        if (flowResult.error.code === 'TENANT_NOT_FOUND' || flowResult.error.code === 'TENANT_SUSPENDED') {
          router.push('/tenant-not-found');
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
