/**
 * Skeleton Components Mobile
 * 
 * Composants skeleton optimisés pour mobile/PWA
 * - Cards KPI compactes
 * - Listes optimisées
 * - Tableaux responsives
 */

'use client';

import { Skeleton, CardSkeleton, ListSkeleton, TableSkeleton } from './Skeleton';
import { cn } from '@/lib/utils';

/**
 * Skeleton pour carte KPI mobile (compacte)
 */
export function CardSkeletonMobile({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-6 w-20 mb-2" />
          <Skeleton className="h-2 w-12" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton pour liste mobile (compacte)
 */
export function ListSkeletonMobile({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton pour tableau mobile (scroll horizontal)
 */
export function TableSkeletonMobile({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* En-tête */}
        <div className="flex space-x-3 mb-3">
          <Skeleton className="h-4 w-20 flex-shrink-0" />
          <Skeleton className="h-4 w-24 flex-shrink-0" />
          <Skeleton className="h-4 w-16 flex-shrink-0" />
          <Skeleton className="h-4 w-18 flex-shrink-0" />
        </div>
        {/* Lignes */}
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex space-x-3">
              <Skeleton className="h-10 w-20 flex-shrink-0" />
              <Skeleton className="h-10 w-24 flex-shrink-0" />
              <Skeleton className="h-10 w-16 flex-shrink-0" />
              <Skeleton className="h-10 w-18 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton pour dashboard mobile
 */
export function DashboardSkeletonMobile() {
  return (
    <div className="space-y-4 p-4">
      {/* KPIs */}
      <CardSkeletonMobile count={4} />
      
      {/* Graphique */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-48 w-full" />
      </div>
      
      {/* Liste */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <Skeleton className="h-4 w-24 mb-3" />
        <ListSkeletonMobile items={5} />
      </div>
    </div>
  );
}
