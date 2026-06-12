/**
 * LoadingScreenMobile Component — v4 Clean Premium
 *
 * Écran de chargement optimisé mobile/PWA — CSS-only, zero JS runtime.
 * Design épuré avec logo circulaire, barre épaisse, pourcentage, dots.
 *
 * Durée minimale : 6 secondes (réduit de 10s)
 * Palette : Royal Blue (#1A237E), Blue (#3F51B5), Gold (#f5b335)
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LoadingMessage } from '@/lib/loading/loading-messages';
import { getMessageText } from '@/lib/messages/system-messages';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';

/** Durée minimale par défaut (ms) — réduit à 6s */
const DEFAULT_MIN_DURATION_MS = 6000;

export interface LoadingScreenMobileProps {
  message?: LoadingMessage;
  progress?: number;
  showProgress?: boolean;
  variant?: 'default' | 'pwa';
  className?: string;
  minDuration?: number;
}

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
    if (typeof window === 'undefined') return;
    const isStandalone = (window.navigator as any).standalone ||
                        window.matchMedia('(display-mode: standalone)').matches;
    setIsPWA(isStandalone);
  }, []);

  // Timer pour la durée minimale de 6 secondes
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

  const pwaMessage = isPWA ? getMessageText('loading.preparing_app') : undefined;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-[#1A237E] safe-area-inset-top safe-area-inset-bottom',
        variant === 'pwa' && 'bg-gradient-to-br from-[#1A237E] via-[#1E2A8A] to-[#283593]',
        className
      )}
    >
      {/* Orbes d'ambiance subtiles — CSS-only */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-10 w-48 h-48 bg-[#f5b335]/5 rounded-full blur-[90px]" style={{ animation: 'academiaPulse 6s ease-in-out infinite' }} />
        <div className="absolute -bottom-24 -right-12 w-56 h-56 bg-[#3F51B5]/8 rounded-full blur-[100px]" style={{ animation: 'academiaPulse 8s ease-in-out infinite reverse' }} />
      </div>

      <div className="w-full max-w-xs px-6 text-center relative z-10">
        {/* Logo circulaire avec bordure */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            {/* Halo doré */}
            <div className="absolute inset-0 -m-5 rounded-full bg-[#f5b335]/6 blur-lg" style={{ animation: 'academiaPulse 3s ease-in-out infinite' }} />
            {/* Anneau rotatif */}
            <div className="absolute inset-0 -m-2 rounded-full border-2 border-white/10 border-t-[#f5b335]" style={{ animation: 'academiaOrbit 1.2s linear infinite' }} />
            {/* Conteneur circulaire blanc */}
            <div className="relative z-10 w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm">
              <Image
                src={BRAND.logoPath}
                alt={BRAND.name}
                width={40}
                height={40}
                className="rounded-full"
                style={{ animation: 'academiaPulse 3s ease-in-out infinite' }}
                priority
              />
            </div>
          </div>
        </div>

        {/* Texte unifié : Bienvenue sur + Academia Helm + sous-titre */}
        <p className="text-xs text-blue-200/55 font-medium mb-0.5">
          {pwaMessage || message?.title || 'Chargement…'}
        </p>
        <h1 className="text-lg font-bold text-white tracking-tight mb-0.5">
          {BRAND.name.split(' ')[0]}
          <span className="text-[#f5b335] ml-1">{BRAND.name.split(' ')[1]}</span>
        </h1>
        <p className="text-[9px] text-blue-200/40 tracking-[0.15em] uppercase font-medium mb-5">
          {message?.subtitle || BRAND.subtitle}
        </p>

        {/* Barre de progression épaisse */}
        {showProgress && (
          <div className="mt-5">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${displayProgress}%`,
                  background: 'linear-gradient(90deg, #3F51B5, #f5b335)',
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-blue-200/35 uppercase tracking-wider font-medium">Progression</span>
              <span className="text-xs text-[#f5b335] font-bold tabular-nums">{Math.round(displayProgress)}%</span>
            </div>
          </div>
        )}

        {/* Dots animés CSS-only */}
        <div className="flex justify-center items-center space-x-2 mt-5">
          <div className="h-1.5 w-1.5 rounded-full bg-[#3F51B5]/70 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.7s' }} />
          <div className="h-2 w-2 rounded-full bg-[#3F51B5] animate-bounce" style={{ animationDelay: '120ms', animationDuration: '0.7s' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-[#f5b335] animate-bounce" style={{ animationDelay: '240ms', animationDuration: '0.7s' }} />
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
    if (typeof window === 'undefined') return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * AdaptiveLoadingScreen — Desktop/mobile auto
 */
export function AdaptiveLoadingScreen(props: LoadingScreenMobileProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <LoadingScreenMobile {...props} />;
  }

  const desktopVariant = props.variant === 'pwa' ? 'orion' : 'default';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A237E]">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 -m-3 rounded-full bg-[#f5b335]/6 blur-xl" style={{ animation: 'academiaPulse 3s ease-in-out infinite' }} />
          <div className="absolute inset-0 -m-2 rounded-full border-2 border-white/10 border-t-[#f5b335]" style={{ animation: 'academiaOrbit 1s linear infinite' }} />
          <div className="absolute inset-0 m-1 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm">
            <Image src={BRAND.logoPath} alt={BRAND.name} width={36} height={36} className="relative z-10 rounded-full" style={{ animation: 'academiaPulse 3s ease-in-out infinite' }} priority />
          </div>
        </div>
        <h2 className="text-sm font-medium text-white/85">{props.message?.title || 'Chargement…'}</h2>
        {props.showProgress && props.progress !== undefined && (
          <div className="mt-4 w-48 mx-auto">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${props.progress}%`, background: 'linear-gradient(90deg, #3F51B5, #f5b335)' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { LoadingScreen } from './LoadingScreen';
