'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Détermine un budget d'animation intelligent :
 * - prefers-reduced-motion => réduction stricte
 * - CPU faible (hardwareConcurrency <= 4) => réduction soft
 */
export function useMotionBudget() {
  const prefersReducedMotion = useReducedMotion();
  const [isLowPowerDevice, setIsLowPowerDevice] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === 'number' && cores > 0) {
      setIsLowPowerDevice(cores <= 4);
    }
  }, []);

  const shouldReduceMotion = useMemo(
    () => Boolean(prefersReducedMotion) || isLowPowerDevice,
    [prefersReducedMotion, isLowPowerDevice]
  );

  return {
    prefersReducedMotion: Boolean(prefersReducedMotion),
    isLowPowerDevice,
    shouldReduceMotion,
  };
}

