/**
 * LoadingScreenMobile Component
 * 
 * Composant de chargement optimisé pour mobile/PWA
 * - Aucun écran blanc
 * - Loaders adaptés à l'écran réduit
 * - Skeleton loaders priorisés
 * - Durée minimale d'affichage : 15 secondes (configurable)
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LoadingMessage } from '@/lib/loading/loading-messages';
import { getMessageText } from '@/lib/messages/system-messages';
import { LoadingScreen } from './LoadingScreen';

/** Durée minimale par défaut (ms) */
const DEFAULT_MIN_DURATION_MS = 10000;

export interface LoadingScreenMobileProps {
  message?: LoadingMessage;
  progress?: number;
  showProgress?: boolean;
  variant?: 'default' | 'pwa';
  className?: string;
  /** Durée minimale d'affichage en ms (défaut: 5000). Mettre 0 pour désactiver. */
  minDuration?: number;
}

/**
 * Écran de chargement optimisé pour mobile
 * 
 * Garantit une durée minimale d'affichage de 15 secondes par défaut.
 * La barre de progression anime de 0% à 85% pendant la durée minimale,
 * puis monte à 100% quand le contenu est prêt.
 */
export function LoadingScreenMobile({
  message,
  progress = 0,
  showProgress = true,
  variant = 'default',
  className,
  minDuration = DEFAULT_MIN_DURATION_MS,
}: LoadingScreenMobileProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isPWA, setIsPWA] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    // Détecter si l'app est installée en PWA
    if (typeof window !== 'undefined') {
      const isStandalone = (window.navigator as any).standalone || 
                          window.matchMedia('(display-mode: standalone)').matches;
      setIsPWA(isStandalone);
    }
  }, []);

  // Timer pour la durée minimale de 15 secondes
  useEffect(() => {
    if (minDuration <= 0) {
      setMinElapsed(true);
      return;
    }

    startTimeRef.current = Date.now();

    const totalSteps = 85;
    const stepDuration = minDuration / totalSteps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const elapsed = Date.now() - startTimeRef.current;

      if (elapsed >= minDuration) {
        setMinElapsed(true);
        setDisplayProgress(85);
        clearInterval(interval);
      } else {
        const baseProgress = (currentStep / totalSteps) * 85;
        setDisplayProgress(Math.min(Math.round(baseProgress), 85));
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [minDuration]);

  // Quand le contenu est prêt ET la durée minimale écoulée, monter à 100%
  useEffect(() => {
    if (minElapsed && progress >= 100) {
      setDisplayProgress(100);
    }
  }, [minElapsed, progress]);

  const variants = {
    default: 'bg-white',
    pwa: 'bg-gradient-to-br from-blue-50 to-indigo-50',
  };

  const pwaMessage = isPWA ? getMessageText('loading.preparing_app') : undefined;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'safe-area-inset-top safe-area-inset-bottom',
        variants[variant],
        className
      )}
    >
      <div className="w-full max-w-sm px-6 text-center">
        {/* Logo compact pour mobile */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <img 
              src="/images/logo-Academia Hub.png" 
              alt="Academia Helm" 
              className="h-16 w-16 object-contain animate-pulse"
            />
          </div>
        </div>

        {/* Message principal */}
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {pwaMessage || message?.title || 'Chargement…'}
        </h2>

        {/* Sous-titre (optionnel, plus court sur mobile) */}
        {message?.subtitle && !isPWA && (
          <p className="text-xs text-gray-600 mb-4">{message.subtitle}</p>
        )}

        {/* Barre de progression compacte */}
        {showProgress && (
          <div className="mb-4">
            <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{Math.round(displayProgress)}%</p>
          </div>
        )}

        {/* Indicateur de chargement animé (compact) */}
        <div className="flex justify-center space-x-1 mt-4">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Hook pour détecter si on est sur mobile
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

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

  return isMobile;
}

/**
 * Composant de chargement adaptatif (desktop/mobile)
 * 
 * Utilise LoadingScreenMobile sur mobile (CSS-only, léger)
 * et LoadingScreen sur desktop (framer-motion, animations riches).
 * Gère la conversion de variant entre mobile et desktop.
 */
export function AdaptiveLoadingScreen(props: LoadingScreenMobileProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <LoadingScreenMobile {...props} />;
  }

  // Conversion de variant mobile → desktop
  const desktopVariant = props.variant === 'pwa' ? 'orion' : 'default';

  return (
    <LoadingScreen
      message={props.message}
      progress={props.progress}
      showProgress={props.showProgress}
      variant={desktopVariant}
      className={props.className}
    />
  );
}
