/**
 * ============================================================================
 * LOADING SKELETON - DASHBOARD WIDGETS BRANDED
 * ============================================================================
 *
 * Skeleton premium pour les widgets du tableau de bord.
 * Utilise le Skeleton branded avec shimmer gradient.
 */

'use client';

import { CardSkeleton } from '@/components/loading/Skeleton';

interface LoadingSkeletonProps {
  count?: number;
}

export function LoadingSkeleton({ count = 4 }: LoadingSkeletonProps) {
  return <CardSkeleton count={count} />;
}
