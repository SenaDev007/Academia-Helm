/**
 * LoadingScreen Component
 * 
 * Composant de chargement global professionnel
 * Plein écran avec animation et messages dynamiques
 * Adaptatif desktop/mobile
 */

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LoadingMessage, LoadingStep } from '@/lib/loading/loading-messages';

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
        'fixed inset-0 z-50 flex items-center justify-center',
        variants[variant],
        className
      )}
    >
      <div className={cn(containerClass, 'text-center')}>
        {/* Logo Academia Helm */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <img 
              src="/images/logo-Academia Hub.png" 
              alt="Academia Helm" 
              className="h-20 w-20 object-contain animate-pulse"
            />
          </div>
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
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            {progress > 0 && (
              <p className="text-xs text-gray-500 mt-2">{Math.round(displayProgress)}%</p>
            )}
          </div>
        )}

        {/* Indicateur de chargement animé */}
        <div className="flex justify-center space-x-1 mt-6">
          <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
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
