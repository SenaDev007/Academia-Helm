/**
 * PostLoginLoading Component
 * 
 * Composant de chargement post-login qui orchestre le flow complet
 * Affiche le LoadingScreen avec les messages dynamiques
 */

'use client';

import { useEffect } from 'react';
import { usePostLoginFlow } from '@/hooks/usePostLoginFlow';
import { LoadingScreen } from './LoadingScreen';
import { getLoadingMessage } from '@/lib/loading/loading-messages';

export interface PostLoginLoadingProps {
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

/**
 * Composant de chargement post-login
 * 
 * Exécute automatiquement le flow et affiche les messages dynamiques
 * 
 * @example
 * ```tsx
 * <PostLoginLoading
 *   onComplete={(result) => {
 *     // Rediriger vers le dashboard
 *   }}
 *   onError={(error) => {
 *     // Gérer l'erreur
 *   }}
 * />
 * ```
 */
export function PostLoginLoading({ onComplete, onError }: PostLoginLoadingProps) {
  const { isLoading, progress, result, error, execute } = usePostLoginFlow();

  useEffect(() => {
    execute();
  }, [execute]);

  useEffect(() => {
    if (result && !isLoading) {
      if (result.success) {
        onComplete?.(result);
      } else if (result.error) {
        onError?.(result.error);
      }
    }
  }, [result, isLoading, onComplete, onError]);

  // Quand le flow est terminé (succès ou erreur), afficher le loading screen
  // jusqu'à ce que le composant parent gère la transition.
  // NE JAMAIS retourner null — cela causerait une page blanche sur mobile.
  if (!isLoading && result) {
    if (result.success) {
      // Succès : afficher un court message de transition
      return (
        <LoadingScreen
          message={{ title: 'Prêt !', subtitle: 'Chargement de l\'application...' }}
          step="PRELOAD_UI"
          progress={100}
          showProgress={true}
          variant="default"
        />
      );
    }
    // Erreur : afficher un message d'erreur au lieu d'une page blanche
    // Le parent (PostLoginFlowWrapper) gère la redirection
    return (
      <LoadingScreen
        message={{ title: 'Redirection...', subtitle: result.error?.message || 'Une erreur est survenue' }}
        step="PRELOAD_UI"
        progress={100}
        showProgress={false}
        variant="default"
      />
    );
  }

  const message = progress
    ? {
        title: progress.message,
        subtitle: progress.subtitle,
      }
    : getLoadingMessage('INIT_SECURE_CONTEXT');

  return (
    <LoadingScreen
      message={message}
      step={progress?.step}
      progress={progress?.progress}
      showProgress={true}
      variant="default"
    />
  );
}
