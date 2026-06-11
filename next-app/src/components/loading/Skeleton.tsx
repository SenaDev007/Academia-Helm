/**
 * ============================================================================
 * SKELETON COMPONENTS - ACADEMIA HELM BRANDED
 * ============================================================================
 *
 * Composants skeleton premium avec effet shimmer gradient
 * remplaçant les anciens animate-pulse basiques.
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 *
 * Règle : Le squelette remplace le contenu, jamais un spinner seul
 */

'use client';

import { cn } from '@/lib/utils';

/**
 * Skeleton de base avec shimmer gradient branded
 *
 * L'effet shimmer simule le chargement avec un dégradé
 * mobile qui traverse le skeleton de gauche à droite.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-slate-100',
        className,
      )}
      {...props}
    >
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(29,79,165,0.06) 40%, rgba(245,179,53,0.1) 50%, rgba(29,79,165,0.06) 60%, transparent 100%)',
          animation: 'academiaShimmer 2s ease-in-out infinite',
          transform: 'translateX(-100%)',
        }}
      />
    </div>
  );
}

/**
 * Skeleton pour une table avec shimmer branded
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full">
      {/* En-tête */}
      <div className="flex space-x-4 mb-4 pb-3 border-b border-slate-100">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 rounded-full" />
        ))}
      </div>
      {/* Lignes */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex space-x-4 p-3 rounded-lg hover:bg-slate-50/50 transition-colors"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton
                key={j}
                className="h-8 flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton pour des cartes KPI avec branding Academia Helm
 *
 * Chaque carte a un badge coloré en haut qui simule
 * l'indicateur de tendance du KPI réel.
 */
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Indicateur coloré */}
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3 w-20 rounded-full" />
            <div className={cn(
              'h-6 w-6 rounded-lg',
              i % 3 === 0 ? 'bg-[#0b2f73]/8' : i % 3 === 1 ? 'bg-[#1d4fa5]/8' : 'bg-[#f5b335]/10',
            )} />
          </div>
          {/* Valeur principale */}
          <Skeleton className="h-7 w-28 mb-3" />
          {/* Sous-indicateur */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-2 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton pour un dashboard complet avec shimmer
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <CardSkeleton count={4} />

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <TableSkeleton rows={5} columns={4} />
      </div>
    </div>
  );
}

/**
 * Skeleton pour une liste avec avatars
 */
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center space-x-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 rounded-full" />
            <Skeleton className="h-2.5 w-1/2 rounded-full" />
          </div>
          <Skeleton className="h-7 w-16 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton pour un formulaire
 */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-3 w-24 mb-2 rounded-full" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex space-x-3 pt-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton pour un module complet avec en-tête contextuel
 */
export function ModuleSkeleton({
  moduleName,
  showTable = true,
  showCharts = true,
}: {
  moduleName?: string;
  showTable?: boolean;
  showCharts?: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* En-tête du module */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#0b2f73] to-[#1d4fa5] flex items-center justify-center">
            <div className="h-4 w-4 rounded bg-white/30" />
          </div>
          <div>
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-3 w-56 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* KPIs */}
      <CardSkeleton count={4} />

      {/* Graphiques */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      )}

      {/* Table */}
      {showTable && (
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <TableSkeleton rows={5} columns={4} />
        </div>
      )}
    </div>
  );
}
