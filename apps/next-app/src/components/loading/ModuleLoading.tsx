/**
 * ModuleLoading Component
 * 
 * Composant de chargement pour les transitions de modules
 * Transition douce, message contextuel
 */

'use client';

import { getModuleMessage } from '@/lib/loading/loading-messages';
import { MinimalLoadingScreen } from './LoadingScreen';

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
  const message = getModuleMessage(moduleName);

  return (
    <div className={className}>
      <MinimalLoadingScreen message={message.title} />
    </div>
  );
}
