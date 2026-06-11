/**
 * LogoutLoadingScreen Component
 * 
 * Écran de chargement pendant le flow de logout
 * Affiche les messages de progression
 * Durée minimale d'affichage : 5 secondes
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { LogOut } from 'lucide-react';
import type { LogoutFlowProgress } from '@/lib/logout/secure-logout-flow.service';

/** Durée minimale d'affichage du loading de logout (ms) */
const MIN_LOGOUT_LOADING_MS = 5000;

export interface LogoutLoadingScreenProps {
  progress: LogoutFlowProgress | null;
}

/**
 * Écran de chargement pour le logout
 * 
 * Garantit un affichage minimum de 5 secondes pour une expérience fluide.
 * La barre de progression anime de 0% à 85% pendant la durée minimale,
 * puis monte à 100% quand le flow est terminé.
 */
export function LogoutLoadingScreen({ progress }: LogoutLoadingScreenProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Détecter mobile pour adapter le layout
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Timer pour la durée minimale de 5 secondes
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

  // Quand le flow est terminé ET la durée minimale écoulée, monter à 100%
  useEffect(() => {
    if (minElapsed && progress && progress.progress >= 100) {
      setDisplayProgress(100);
    }
  }, [minElapsed, progress]);

  // La progression affichée est le max entre le flow réel et l'animation
  const effectiveProgress = progress
    ? Math.max(displayProgress, Math.min(progress.progress, minElapsed ? 100 : 85))
    : displayProgress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white safe-area-inset-top safe-area-inset-bottom">
      <div className={`${isMobile ? 'w-full max-w-sm px-4' : 'w-full max-w-md px-6'} text-center`}>
        {/* Icône */}
        <div className={`${isMobile ? 'mb-6' : 'mb-8'} flex justify-center`}>
          <div className="relative">
            <div className={`${isMobile ? 'h-16 w-16' : 'h-20 w-20'} rounded-full border-4 border-orange-200`}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <LogOut className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'} text-orange-600 animate-pulse`} />
            </div>
          </div>
        </div>

        {/* Message */}
        <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-900 mb-2`}>
          {progress?.message || 'Déconnexion en cours…'}
        </h2>

        {/* Barre de progression */}
        <div className="mt-6">
          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${effectiveProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{Math.round(effectiveProgress)}%</p>
        </div>
      </div>
    </div>
  );
}
