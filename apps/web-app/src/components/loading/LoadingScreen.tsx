/**
 * LoadingScreen Component
 * 
 * Composant de chargement global professionnel
 * Plein écran avec animation et messages dynamiques
 * Adaptatif desktop/mobile
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LoadingMessage, LoadingStep } from '@/lib/loading/loading-messages';
import { getMotionDuration } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';

export interface LoadingScreenProps {
  message?: LoadingMessage;
  step?: LoadingStep;
  progress?: number; // 0-100
  showProgress?: boolean;
  variant?: 'default' | 'minimal' | 'orion';
  className?: string;
}

export function LoadingScreen({
  message,
  step,
  progress = 0,
  showProgress = true,
  variant = 'default',
  className,
}: LoadingScreenProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const { shouldReduceMotion } = useMotionBudget();

  // Détecter mobile
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Animation fluide de la barre de progression
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < progress) {
          return Math.min(prev + 2, progress);
        }
        return prev;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [progress]);

  const variants = {
    default: 'bg-white',
    minimal: 'bg-gray-50',
    orion: 'bg-gradient-to-br from-blue-50 to-indigo-50',
  };

  // Utiliser un layout plus compact sur mobile
  const containerClass = isMobile 
    ? 'w-full max-w-sm px-4' 
    : 'w-full max-w-md px-6';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center overflow-hidden',
        variants[variant],
        className
      )}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={shouldReduceMotion ? { opacity: 0.2 } : { opacity: [0.18, 0.28, 0.18] }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute -top-20 -left-12 w-72 h-72 bg-[#f5b335]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-14 w-80 h-80 bg-[#1d4fa5]/22 rounded-full blur-3xl" />
      </motion.div>
      <div className={cn(containerClass, 'text-center')}>
        {/* Logo Academia Helm */}
        <div className="mb-8 flex justify-center">
          <motion.div
            className="relative"
            animate={shouldReduceMotion ? { y: 0, scale: 1 } : { y: [0, -4, 0], scale: [1, 1.03, 1] }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src="/images/logo-Academia Hub.png" 
              alt="Academia Helm" 
              className="h-20 w-20 object-contain animate-pulse"
            />
          </motion.div>
        </div>

        {/* Message principal */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {message?.title || 'Chargement…'}
        </h2>

        {/* Sous-titre */}
        {message?.subtitle && (
          <p className="text-sm text-gray-600 mb-6">{message.subtitle}</p>
        )}

        {/* Barre de progression */}
        {showProgress && (
          <div className="mb-4">
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#0b2f73] via-[#1d4fa5] to-[#f5b335] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${displayProgress}%` }}
                animate={shouldReduceMotion ? { filter: 'brightness(1)' } : { filter: ['brightness(1)', 'brightness(1.12)', 'brightness(1)'] }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            {progress > 0 && (
              <p className="text-xs text-gray-500 mt-2">{Math.round(displayProgress)}%</p>
            )}
          </div>
        )}

        {/* Indicateur de chargement animé */}
        <div className="flex justify-center space-x-1 mt-6">
          <motion.div
            className="h-2 w-2 rounded-full bg-[#0b2f73]"
            animate={shouldReduceMotion ? { y: 0 } : { y: [0, -5, 0] }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: getMotionDuration(false, 'slow'), repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="h-2 w-2 rounded-full bg-[#1d4fa5]"
            animate={shouldReduceMotion ? { y: 0 } : { y: [0, -5, 0] }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: getMotionDuration(false, 'slow'), repeat: Infinity, delay: 0.15 }}
          />
          <motion.div
            className="h-2 w-2 rounded-full bg-[#f5b335]"
            animate={shouldReduceMotion ? { y: 0 } : { y: [0, -5, 0] }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: getMotionDuration(false, 'slow'), repeat: Infinity, delay: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * LoadingScreen minimal pour les transitions rapides
 */
export function MinimalLoadingScreen({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        {message && <p className="text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
