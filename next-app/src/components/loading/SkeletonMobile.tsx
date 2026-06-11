/**
 * ============================================================================
 * SKELETON COMPONENTS MOBILE - PREMIUM BRANDED ACADEMIA HELM
 * ============================================================================
 *
 * Composants skeleton optimisés pour mobile/PWA
 * avec effets captivants CSS-only (pas de JS runtime).
 *
 * Refonte premium avec :
 * - Shimmer wave branded (Navy → Blue → Gold)
 * - Animations slide-up pour une apparition fluide
 * - Accent doré subtil sur les cartes
 * - Flottement léger (academiaFloat) pour le contenu
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 */

'use client';

import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

/**
 * Accent doré mobile — plus discret que la version desktop
 */
function MobileCornerAccent() {
  return (
    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-xl border-t-[#f5b335]/20 border-r-[#f5b335]/20" />
  );
}

/**
 * Skeleton pour carte KPI mobile (compacte, 2 colonnes)
 */
export function CardSkeletonMobile({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative bg-white rounded-xl border border-slate-100 p-3.5 shadow-sm overflow-hidden"
          style={{
            animation: 'academiaSlideUp 0.4s ease-out both',
            animationDelay: `${i * 80}ms`,
          }}
        >
          <MobileCornerAccent />
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
          style={{
            animation: 'academiaSlideUp 0.35s ease-out both',
            animationDelay: `${i * 50}ms`,
          }}
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
            <div
              key={i}
              className="flex space-x-3 p-2 rounded-lg"
              style={{
                animation: 'academiaSlideUp 0.3s ease-out both',
                animationDelay: `${i * 50}ms`,
              }}
            >
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
      <div
        className="relative bg-white rounded-xl border border-slate-100 p-4 shadow-sm overflow-hidden"
        style={{ animation: 'academiaSlideUp 0.5s ease-out both', animationDelay: '200ms' }}
      >
        <MobileCornerAccent />
        <Skeleton className="h-3.5 w-24 mb-3 rounded-full" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>

      {/* Liste */}
      <div
        className="relative bg-white rounded-xl border border-slate-100 p-4 shadow-sm overflow-hidden"
        style={{ animation: 'academiaSlideUp 0.5s ease-out both', animationDelay: '300ms' }}
      >
        <MobileCornerAccent />
        <Skeleton className="h-3.5 w-24 mb-3 rounded-full" />
        <ListSkeletonMobile items={5} />
      </div>
    </div>
  );
}

/**
 * Skeleton pour carte de recrutement mobile
 */
export function JobCardSkeletonMobile({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden bg-white rounded-xl border border-slate-100 p-4 shadow-sm"
          style={{
            animation: 'academiaSlideUp 0.4s ease-out both',
            animationDelay: `${i * 100}ms`,
          }}
        >
          <MobileCornerAccent />
          <div className="flex items-center gap-3">
            {/* Logo placeholder */}
            <div
              className="h-10 w-10 rounded-lg shrink-0 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(11,47,115,0.08), rgba(29,79,165,0.08))',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(245,179,53,0.08), transparent)',
                  animation: 'academiaShimmerWave 2.5s ease-in-out infinite',
                  transform: 'translateX(-100%)',
                }}
              />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton className="h-3 w-3/4 rounded-full" />
              <Skeleton className="h-2 w-1/2 rounded-full" />
            </div>
            <div
              className="h-4 w-12 rounded-full shrink-0 relative overflow-hidden"
              style={{ background: 'rgba(16,185,129,0.06)' }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.08), transparent)',
                  animation: 'academiaShimmerWave 2s ease-in-out infinite',
                  transform: 'translateX(-100%)',
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
