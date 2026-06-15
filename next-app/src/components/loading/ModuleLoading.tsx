/**
 * ModuleLoading Component - Premium Branded
 *
 * Composant de chargement branded pour les transitions de modules.
 * Affiche un skeleton contextuel avec le nom du module.
 * Adapte automatiquement le rendu entre desktop et mobile.
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 */

'use client';

import { useEffect, useState } from 'react';
import { ModuleSkeleton } from '@/components/loading/Skeleton';
import { DashboardSkeletonMobile } from '@/components/loading/SkeletonMobile';

export interface ModuleLoadingProps {
  moduleName: string;
  className?: string;
}

/**
 * Composant de chargement pour un module
 *
 * @example
 * ```tsx
 * <ModuleLoading moduleName="finance" />
 * ```
 */
export function ModuleLoading({ moduleName, className }: ModuleLoadingProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  return (
    <div className={className}>
      {isMobile ? (
        <DashboardSkeletonMobile />
      ) : (
        <ModuleSkeleton moduleName={moduleName} />
      )}
    </div>
  );
}
