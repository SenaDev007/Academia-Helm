/**
 * ModuleLoading Component — v2 Modern
 *
 * Composant de chargement branded pour les transitions de modules.
 * Skeleton contextuel avec design Academia Helm.
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
