/**
 * LogoutLoadingScreen — v4 Clean Premium
 *
 * Écran de chargement pendant le flow de logout.
 * Design épuré avec logo circulaire, barre épaisse, palette Royal Blue.
 * Durée minimale d'affichage : 6 secondes (réduit de 10s)
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';
import type { LogoutFlowProgress } from '@/lib/logout/secure-logout-flow.service';
import FloatingEduParticles from '@/components/ui/FloatingEduParticles';

/** Durée minimale d'affichage du loading de logout (ms) — réduit à 2s */
const MIN_LOGOUT_LOADING_MS = 2000;

export interface LogoutLoadingScreenProps {
  progress: LogoutFlowProgress | null;
}

/**
 * Écran de chargement pour le logout
 *
 * Garantit un affichage minimum de 6 secondes pour une expérience fluide.
 * Design épuré avec fond Royal Blue, logo circulaire et progression branded.
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

  // Timer pour la durée minimale de 6 secondes
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A237E] safe-area-inset-top safe-area-inset-bottom">
      {/* Particules éducatives flottantes — variant light pour fond navy */}
      <FloatingEduParticles count={24} opacityMultiplier={2.0} variant="light" />

      {/* Ambiance subtile */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-10 w-48 h-48 bg-[#f5b335]/5 rounded-full blur-[90px]" style={{ animation: 'academiaPulse 6s ease-in-out infinite' }} />
        <div className="absolute -bottom-24 -right-12 w-56 h-56 bg-[#3F51B5]/8 rounded-full blur-[100px]" style={{ animation: 'academiaPulse 8s ease-in-out infinite reverse' }} />
      </div>

      <div className={`${isMobile ? 'w-full max-w-xs px-4' : 'w-full max-w-sm px-6'} text-center relative z-10`}>
        {/* Logo circulaire avec bordure */}
        <div className="mb-7 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 -m-4 rounded-full bg-[#f5b335]/6 blur-lg" style={{ animation: 'academiaPulse 3s ease-in-out infinite' }} />
            <div className="absolute inset-0 -m-2 rounded-full border-2 border-white/10 border-t-[#f5b335]" style={{ animation: 'academiaOrbit 1.2s linear infinite' }} />
            <div className={`relative z-10 ${isMobile ? 'w-14 h-14' : 'w-16 h-16'} rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm`}>
              <Image
                src={BRAND.logoPath}
                alt={BRAND.name}
                width={isMobile ? 36 : 44}
                height={isMobile ? 36 : 44}
                className="rounded-full"
                style={{ animation: 'academiaPulse 3s ease-in-out infinite' }}
                priority
              />
            </div>
          </div>
        </div>

        {/* Message */}
        <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-medium text-white/90 mb-0.5`}>
          {progress?.message || 'Déconnexion en cours…'}
        </h2>
        <p className="text-xs text-blue-200/45">Fermeture sécurisée de votre session</p>

        {/* Barre de progression épaisse */}
        <div className="mt-7">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${effectiveProgress}%`,
                background: 'linear-gradient(90deg, #3F51B5, #f5b335)',
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] text-blue-200/35 uppercase tracking-wider font-medium">Progression</span>
            <span className="text-xs text-[#f5b335] font-bold tabular-nums">{Math.round(effectiveProgress)}%</span>
          </div>
        </div>

        {/* Dots animés */}
        <div className="flex justify-center items-center space-x-2 mt-6">
          <div className="h-1.5 w-1.5 rounded-full bg-[#3F51B5]/70 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.7s' }} />
          <div className="h-2 w-2 rounded-full bg-[#3F51B5] animate-bounce" style={{ animationDelay: '120ms', animationDuration: '0.7s' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-[#f5b335] animate-bounce" style={{ animationDelay: '240ms', animationDuration: '0.7s' }} />
        </div>
      </div>
    </div>
  );
}
