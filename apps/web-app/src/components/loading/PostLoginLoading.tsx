/**
 * PostLoginLoading Component — v3 Real Progress
 *
 * Composant de chargement post-login qui affiche la PROGRESSION RÉELLE
 * du flow d'initialisation. Chaque étape complétée fait avancer
 * la barre de progression de manière concrète.
 *
 * 6 étapes réelles = progression réelle :
 * - INIT_SECURE_CONTEXT    → 0-17%
 * - VERIFY_ACADEMIC_YEAR   → 17-33%
 * - LOAD_ROLES_PERMISSIONS → 33-50%
 * - CHECK_OFFLINE_STATUS   → 50-67%
 * - INIT_ORION             → 67-83%
 * - PRELOAD_UI             → 83-100%
 */

'use client';

import { useEffect } from 'react';
import { usePostLoginFlow } from '@/hooks/usePostLoginFlow';
import { LoadingScreen } from './LoadingScreen';
import { getLoadingMessage, type LoadingStep } from '@/lib/loading/loading-messages';

export interface PostLoginLoadingProps {
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

/**
 * Map chaque étape vers un pourcentage réel de progression
 */
const STEP_PROGRESS: Record<LoadingStep, number> = {
  INIT_SECURE_CONTEXT: 17,
  VERIFY_ACADEMIC_YEAR: 33,
  LOAD_ROLES_PERMISSIONS: 50,
  CHECK_OFFLINE_STATUS: 67,
  INIT_ORION: 83,
  PRELOAD_UI: 100,
};

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

  if (!isLoading && result) {
    return null;
  }

  // Calculer la progression RÉELLE à partir de l'étape en cours
  const currentStep = progress?.step || 'INIT_SECURE_CONTEXT';
  const realProgress = progress?.progress ?? STEP_PROGRESS[currentStep] ?? 0;

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
      progress={realProgress}
      showProgress={true}
      variant="default"
    />
  );
}
