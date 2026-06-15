/**
 * ============================================================================
 * LOADING SKELETON - DASHBOARD WIDGETS PREMIUM BRANDED
 * ============================================================================
 *
 * Skeleton premium pour les widgets du tableau de bord.
 * Adapte automatiquement le rendu entre desktop et mobile :
 * - Desktop : CardSkeleton avec corner accents et slide-up
 * - Mobile : CardSkeletonMobile avec layout 2 colonnes compact
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 */

'use client';

import { useEffect, useState } from 'react';
import { CardSkeleton } from '@/components/loading/Skeleton';
import { CardSkeletonMobile } from '@/components/loading/SkeletonMobile';

interface LoadingSkeletonProps {
  count?: number;
}

export function LoadingSkeleton({ count = 4 }: LoadingSkeletonProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  if (isMobile) {
    return <CardSkeletonMobile count={count} />;
  }

  return <CardSkeleton count={count} />;
}
