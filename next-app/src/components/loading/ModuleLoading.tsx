/**
 * ModuleLoading Component
 *
 * Composant de chargement branded pour les transitions de modules.
 * Affiche un skeleton contextuel avec le nom du module.
 */

'use client';

import { ModuleSkeleton } from '@/components/loading/Skeleton';

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
  return (
    <div className={className}>
      <ModuleSkeleton moduleName={moduleName} />
    </div>
  );
}
