/**
 * PostLoginFlowWrapper Component
 * 
 * Wrapper client pour gérer le flow post-login
 * S'affiche automatiquement après l'authentification
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PostLoginLoading } from './PostLoginLoading';
import { LoadingScreen } from './LoadingScreen';
import { getLoadingMessage } from '@/lib/loading/loading-messages';
import type { PostLoginFlowResult } from '@/lib/loading/post-login-flow.service';
import { getPageSlideMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';

export interface PostLoginFlowWrapperProps {
  children: React.ReactNode;
  user: any;
  tenant: any;
}

/**
 * Wrapper pour gérer le flow post-login
 * 
 * Affiche le loading screen pendant l'initialisation
 * puis affiche le contenu une fois le flow terminé
 */
export function PostLoginFlowWrapper({
  children,
  user,
  tenant,
}: PostLoginFlowWrapperProps) {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [flowResult, setFlowResult] = useState<PostLoginFlowResult | null>(null);
  const [error, setError] = useState<any>(null);
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion);

  useEffect(() => {
    // Le flow sera exécuté par PostLoginLoading
    // On attend juste que le composant soit monté
    setIsInitialized(true);
  }, []);

  const handleComplete = (result: PostLoginFlowResult) => {
    setFlowResult(result);
    setIsInitialized(true);

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
      router.push('/login');
      return;
    }

    if (err.code === 'TENANT_NOT_FOUND' || err.code === 'TENANT_SUSPENDED') {
      router.push('/tenant-not-found');
      return;
    }

    // Pour les autres erreurs, continuer quand même
    setIsInitialized(true);
  };

  // Afficher le loading pendant l'initialisation
  if (!isInitialized || !flowResult) {
    return (
      <PostLoginLoading onComplete={handleComplete} onError={handleError} />
    );
  }

  // Afficher le contenu une fois initialisé
  return (
    <motion.div
      initial={pageMotion.initial}
      animate={pageMotion.animate}
      transition={pageMotion.transition}
    >
      {children}
    </motion.div>
  );
}
