/**
 * MinDurationScreen Component — v2 Modern
 *
 * Garantit que l'écran de chargement s'affiche pendant une durée minimale
 * avant de révéler le contenu. Design moderne, captivant et professionnel.
 *
 * DURÉE PAR DÉFAUT : 10 secondes (réduit de 15s)
 *
 * MOBILE : Sur mobile, utilise LoadingScreenMobile (CSS-only, léger)
 * au lieu de LoadingScreen (framer-motion, ~30KB) pour de meilleures performances.
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { LoadingScreenMobile } from './LoadingScreenMobile';

/** Durée minimale par défaut (ms) — réduit à 10s */
const DEFAULT_MIN_DURATION_MS = 10000;

export interface MinDurationScreenProps {
  /** Si true, le contenu est prêt à être affiché */
  ready: boolean;
  /** Durée minimale d'affichage du loading en ms (défaut: 10000) */
  minDuration?: number;
  /** Contenu à afficher une fois prêt et la durée minimale écoulée */
  children?: React.ReactNode;
  /** Message de chargement optionnel */
  message?: { title: string; subtitle?: string };
  /** Variante visuelle */
  variant?: 'default' | 'minimal' | 'orion';
  /** Force l'affichage du loading (même si ready=true et durée écoulée) */
  forceLoading?: boolean;
}

/**
 * Hook léger pour détecter mobile côté client.
 * Retourne false pendant SSR pour éviter les mismatches.
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

/**
 * Composant qui garantit une durée minimale d'affichage du loading screen.
 *
 * Le contenu n'est révélé que lorsque DEUX conditions sont remplies :
 * 1. `ready` est true (les données sont chargées)
 * 2. La durée minimale s'est écoulée
 *
 * Sur mobile, utilise LoadingScreenMobile (CSS-only) au lieu de LoadingScreen
 * (framer-motion) pour de meilleures performances sur appareils bas de gamme.
 */
export function MinDurationScreen({
  ready,
  minDuration = DEFAULT_MIN_DURATION_MS,
  children,
  message,
  variant = 'default',
  forceLoading = false,
}: MinDurationScreenProps) {
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());
  const isMobile = useIsMobile();

  useEffect(() => {
    startTimeRef.current = Date.now();

    // Progression de 0% à 85% pendant la durée minimale
    const totalSteps = 85;
    const stepDuration = minDuration / totalSteps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const elapsed = Date.now() - startTimeRef.current;

      if (elapsed >= minDuration) {
        setProgress(85);
        setMinDurationElapsed(true);
        clearInterval(interval);
      } else {
        const baseProgress = (currentStep / totalSteps) * 85;
        setProgress(Math.min(baseProgress, 85));
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [minDuration]);

  // Quand les données sont prêtes, monter à 100%
  useEffect(() => {
    if (ready && minDurationElapsed) {
      setProgress(100);
    }
  }, [ready, minDurationElapsed]);

  const showLoading = forceLoading || !ready || !minDurationElapsed;

  if (!showLoading) {
    return <>{children}</>;
  }

  const effectiveProgress = ready ? Math.max(progress, 90) : progress;

  if (isMobile) {
    return (
      <LoadingScreenMobile
        message={message ?? { title: 'Chargement…' }}
        progress={effectiveProgress}
        showProgress={true}
        variant={variant === 'orion' ? 'pwa' : 'default'}
        minDuration={0}
      />
    );
  }

  return (
    <LoadingScreen
      message={message ?? { title: 'Chargement…' }}
      progress={effectiveProgress}
      showProgress={true}
      variant={variant}
    />
  );
}
