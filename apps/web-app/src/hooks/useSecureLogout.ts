/**
 * useSecureLogout Hook
 * 
 * Hook pour gérer le flow de logout sécurisé
 * avec confirmation et progression
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  executeSecureLogoutFlow,
  type LogoutFlowProgress,
  type LogoutFlowResult,
} from '@/lib/logout/secure-logout-flow.service';
import { getMessageText } from '@/lib/messages/system-messages';

export interface UseSecureLogoutReturn {
  isLoggingOut: boolean;
  progress: LogoutFlowProgress | null;
  showConfirmation: boolean;
  startLogout: () => void;
  confirmLogout: () => Promise<void>;
  cancelLogout: () => void;
}

/**
 * Hook pour gérer le logout sécurisé
 * 
 * @example
 * ```tsx
 * const { isLoggingOut, showConfirmation, startLogout, confirmLogout, cancelLogout } = useSecureLogout();
 * 
 * return (
 *   <>
 *     <button onClick={startLogout}>Se déconnecter</button>
 *     <LogoutConfirmationModal
 *       isOpen={showConfirmation}
 *       onConfirm={confirmLogout}
 *       onCancel={cancelLogout}
 *     />
 *     {isLoggingOut && <LogoutLoadingScreen progress={progress} />}
 *   </>
 * );
 * ```
 */
export function useSecureLogout(): UseSecureLogoutReturn {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [progress, setProgress] = useState<LogoutFlowProgress | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const startLogout = useCallback(() => {
    setShowConfirmation(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setShowConfirmation(false);
    setIsLoggingOut(true);
    setProgress(null);

    try {
      const result = await executeSecureLogoutFlow((progressUpdate) => {
        setProgress(progressUpdate);
      });

      if (result.success) {
        // Redirection vers /portal
        router.push('/portal');
      } else {
        // Afficher l'erreur mais rediriger quand même
        console.error('Logout error:', result.error);
        router.push('/portal');
      }
    } catch (error: any) {
      console.error('Logout flow error:', error);
      // Rediriger même en cas d'erreur
      router.push('/portal');
    } finally {
      setIsLoggingOut(false);
      setProgress(null);
    }
  }, [router]);

  const cancelLogout = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  return {
    isLoggingOut,
    progress,
    showConfirmation,
    startLogout,
    confirmLogout,
    cancelLogout,
  };
}
