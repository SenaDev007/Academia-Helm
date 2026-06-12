/**
 * LogoutLoadingScreen — v2 Modern
 *
 * Écran de chargement pendant le flow de logout.
 * Design immersif avec palette Academia Helm.
 * Durée minimale d'affichage : 10 secondes (réduit de 15s)
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';
import type { LogoutFlowProgress } from '@/lib/logout/secure-logout-flow.service';

/** Durée minimale d'affichage du loading de logout (ms) — réduit à 10s */
const MIN_LOGOUT_LOADING_MS = 10000;

export interface LogoutLoadingScreenProps {
  progress: LogoutFlowProgress | null;
}

/**
 * Écran de chargement pour le logout
 *
 * Garantit un affichage minimum de 10 secondes pour une expérience fluide.
 * Design immersif avec fond Navy, halo doré et progression branded.
 */
export function LogoutLoadingScreen({ progress }: LogoutLoadingScreenProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Timer pour la durée minimale de 10 secondes
  useEffect(() => {
    startTimeRef.current = Date.now();

    const totalSteps = 85;
    const stepDuration = MIN_LOGOUT_LOADING_MS / totalSteps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const elapsed = Date.now() - startTimeRef.current;

      if (elapsed >= MIN_LOGOUT_LOADING_MS) {
        setMinElapsed(true);
        clearInterval(interval);
      } else {
        const baseProgress = (currentStep / totalSteps) * 85;
        setDisplayProgress(Math.min(Math.round(baseProgress), 85));
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (minElapsed && progress && progress.progress >= 100) {
      setDisplayProgress(100);
    }
  }, [minElapsed, progress]);

  const effectiveProgress = progress
    ? Math.max(displayProgress, Math.min(progress.progress, minElapsed ? 100 : 85))
    : displayProgress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b2f73] safe-area-inset-top safe-area-inset-bottom">
      {/* Ambiance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-10 w-56 h-56 bg-[#f5b335]/8 rounded-full blur-[80px]" style={{ animation: 'academiaPulse 5s ease-in-out infinite' }} />
        <div className="absolute -bottom-24 -right-12 w-64 h-64 bg-[#1d4fa5]/12 rounded-full blur-[90px]" style={{ animation: 'academiaPulse 7s ease-in-out infinite reverse' }} />
      </div>

      <div className={`${isMobile ? 'w-full max-w-sm px-4' : 'w-full max-w-md px-6'} text-center relative z-10`}>
        {/* Logo avec halo */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 -m-4 rounded-full bg-[#f5b335]/6 blur-lg" style={{ animation: 'academiaPulse 2.5s ease-in-out infinite' }} />
            <div className="absolute inset-0 -m-2 rounded-full border-2 border-[#f5b335]/15 border-t-[#f5b335]" style={{ animation: 'academiaOrbit 1.2s linear infinite' }} />
            <Image
              src={BRAND.logoPath}
              alt={BRAND.name}
              width={isMobile ? 48 : 56}
              height={isMobile ? 48 : 56}
              className="relative z-10 rounded-xl"
              style={{ animation: 'academiaPulse 3s ease-in-out infinite' }}
              priority
            />
          </div>
        </div>

        {/* Message */}
        <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-medium text-white/90 mb-1`}>
          {progress?.message || 'Déconnexion en cours…'}
        </h2>
        <p className="text-xs text-blue-200/50">Fermeture sécurisée de votre session</p>

        {/* Barre de progression branded */}
        <div className="mt-8">
          <div className="h-1 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${effectiveProgress}%`,
                background: 'linear-gradient(90deg, #1d4fa5, #f5b335)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-blue-200/30 uppercase tracking-wider">Progression</span>
            <span className="text-[10px] text-[#f5b335] font-semibold tabular-nums">{Math.round(effectiveProgress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
