/**
 * ============================================================================
 * LOADING SKELETON - SKELETON DE CHARGEMENT
 * ============================================================================
 */

'use client';

interface LoadingSkeletonProps {
  count?: number;
}

export function LoadingSkeleton({ count = 4 }: LoadingSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        </div>
      ))}
    </div>
  );
}
