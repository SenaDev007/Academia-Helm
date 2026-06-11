/**
 * ============================================================================
 * SKELETON COMPONENTS MOBILE - BRANDED ACADEMIA HELM
 * ============================================================================
 *
 * Composants skeleton optimisés pour mobile/PWA
 * avec shimmer gradient branded.
 *
 * - Cards KPI compactes
 * - Listes optimisées
 * - Tableaux responsifs
 */

'use client';

import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

/**
 * Skeleton pour carte KPI mobile (compacte, 2 colonnes)
 */
export function CardSkeletonMobile({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-sm"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-2.5 w-14 rounded-full" />
            <div className={cn(
              'h-5 w-5 rounded-md',
              i % 2 === 0 ? 'bg-[#0b2f73]/8' : 'bg-[#f5b335]/10',
            )} />
          </div>
          <Skeleton className="h-5 w-16 mb-1.5" />
          <Skeleton className="h-2 w-10 rounded-full" />
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
        <div
          key={i}
          className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-2 w-2/3 rounded-full" />
          </div>
          <Skeleton className="h-6 w-12 rounded-lg shrink-0" />
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
        <div className="flex space-x-3 mb-3 pb-2 border-b border-slate-50">
          <Skeleton className="h-3 w-20 rounded-full flex-shrink-0" />
          <Skeleton className="h-3 w-24 rounded-full flex-shrink-0" />
          <Skeleton className="h-3 w-16 rounded-full flex-shrink-0" />
          <Skeleton className="h-3 w-20 rounded-full flex-shrink-0" />
        </div>
        {/* Lignes */}
        <div className="space-y-1.5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex space-x-3 p-2 rounded-lg">
              <Skeleton className="h-8 w-20 flex-shrink-0" />
              <Skeleton className="h-8 w-24 flex-shrink-0" />
              <Skeleton className="h-8 w-16 flex-shrink-0" />
              <Skeleton className="h-8 w-20 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton pour dashboard mobile complet
 */
export function DashboardSkeletonMobile() {
  return (
    <div className="space-y-4 p-4">
      {/* KPIs */}
      <CardSkeletonMobile count={4} />

      {/* Graphique */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <Skeleton className="h-3.5 w-24 mb-3 rounded-full" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <Skeleton className="h-3.5 w-24 mb-3 rounded-full" />
        <ListSkeletonMobile items={5} />
      </div>
    </div>
  );
}
