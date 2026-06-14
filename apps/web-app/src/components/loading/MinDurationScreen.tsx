/**
 * MinDurationScreen Component — v4 Clean Premium
 *
 * Garantit que l'écran de chargement s'affiche pendant une durée minimale
 * avant de révéler le contenu. PLUS DE PROGRESSION FICTIVE.
 *
 * CHANGEMENTS MAJEURS :
 * - La progression vient UNIQUEMENT du parent via la prop `progress`
 * - Plus de timer interne qui simule un pourcentage
 * - Le composant ne fait que : attendre `ready` + durée minimale, puis révéler
 * - L'affichage de la barre de progression est optionnel et contrôlé par le parent
 *
 * MOBILE : Sur mobile, utilise LoadingScreenMobile (CSS-only, léger)
 * au lieu de LoadingScreen (framer-motion, ~30KB) pour de meilleures performances.
 *
 * Durée minimale : 6 secondes (réduit de 10s)
 * Palette : Royal Blue (#1A237E), Blue (#3F51B5), Gold (#f5b335)
 */

'use client';

import { useState, useEffect } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { LoadingScreenMobile } from './LoadingScreenMobile';

/** Durée minimale par défaut (ms) — réduit à 2.5s pour un chargement plus rapide */
const DEFAULT_MIN_DURATION_MS = 2500;

export interface MinDurationScreenProps {
  /** Si true, le contenu est prêt à être affiché */
  ready: boolean;
  /** Durée minimale d'affichage du loading en ms (défaut: 6000) */
  minDuration?: number;
  /** Contenu à afficher une fois prêt et la durée minimale écoulée */
  children?: React.ReactNode;
  /** Message de chargement optionnel */
  message?: { title: string; subtitle?: string };
  /** Variante visuelle */
  variant?: 'default' | 'minimal' | 'orion';
  /** Force l'affichage du loading */
  forceLoading?: boolean;
  /** Progression réelle 0-100 (provenant du parent, PAS fictive) */
  progress?: number;
  /** Étape actuelle (pour affichage contextuel) */
  step?: string;
}

/**
 * Hook léger pour détecter mobile côté client.
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
 * MinDurationScreen — Progression réelle uniquement
 *
 * Le contenu n'est révélé que lorsque DEUX conditions sont remplies :
 * 1. `ready` est true (les données sont chargées)
 * 2. La durée minimale s'est écoulée
 *
 * La barre de progression affiche la valeur `progress` fournie par le parent.
 * Si aucun `progress` n'est fourni, aucune barre ne s'affiche (mode minimal).
 */
export function MinDurationScreen({
  ready,
  minDuration = DEFAULT_MIN_DURATION_MS,
  children,
  message,
  variant = 'default',
  forceLoading = false,
  progress,
  step,
}: MinDurationScreenProps) {
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const isMobile = useIsMobile();

  // Timer pour la durée minimale (seulement pour éviter les flash)
  // Ne simule AUCUNE progression
  useEffect(() => {
    if (minDuration <= 0) {
      setMinDurationElapsed(true);
      return;
    }

    const timer = setTimeout(() => {
      setMinDurationElapsed(true);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration]);

  const showLoading = forceLoading || !ready || !minDurationElapsed;

  if (!showLoading) {
    return <>{children}</>;
  }

  // Si on n'a pas de progression réelle, afficher un mode minimal
  const realProgress = typeof progress === 'number' ? progress : undefined;
  const showProgressBar = realProgress !== undefined;

  if (isMobile) {
    return (
      <LoadingScreenMobile
        message={message ?? { title: 'Chargement…' }}
        progress={realProgress ?? 0}
        showProgress={showProgressBar}
        variant={variant === 'orion' ? 'pwa' : 'default'}
        minDuration={0}
      />
    );
  }

  return (
    <LoadingScreen
      message={message ?? { title: 'Chargement…' }}
      progress={realProgress ?? 0}
      showProgress={showProgressBar}
      variant={variant}
    />
  );
}
