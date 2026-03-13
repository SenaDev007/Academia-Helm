/**
 * ============================================================================
 * SUB MODULE NAVIGATION - NAVIGATION INTERNE PAR SOUS-MODULES
 * ============================================================================
 * 
 * Navigation par tabs pour les sous-modules (3 à 7 max)
 * Ordre logique du travail réel, noms métier
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface SubModule {
  /** Identifiant unique du sous-module */
  id: string;
  /** Nom métier (jamais technique) */
  label: string;
  /** Icône optionnelle (ReactNode, ex. <Icon className="w-4 h-4" />) */
  icon?: ReactNode;
  /** Badge optionnel (compteur, statut) */
  badge?: ReactNode;
  /** Route associée */
  href?: string;
  /** Désactivé */
  disabled?: boolean;
}

/** Tab format (alias pour compatibilité pages finance, etc.) */
export interface SubModuleTab {
  id: string;
  label: string;
  path: string;
  icon?: ReactNode;
}

export interface SubModuleNavigationProps {
  /** Liste des sous-modules (3 à 7 max) */
  modules?: SubModule[];
  /** Alias : tabs avec path → converti en modules avec href */
  tabs?: SubModuleTab[];
  /** Alias : path actuel quand on utilise tabs */
  currentPath?: string;
  /** Sous-module actif */
  activeModuleId?: string;
  /** Callback lors du changement */
  onModuleChange?: (moduleId: string) => void;
  /** Style personnalisé */
  className?: string;
}

export default function SubModuleNavigation({
  modules: modulesProp,
  tabs,
  currentPath,
  activeModuleId,
  onModuleChange,
  className,
}: SubModuleNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();

  const modules: SubModule[] = modulesProp ?? (tabs?.map((t) => ({ id: t.id, label: t.label, href: t.path, icon: t.icon })) ?? []);
  const pathForActive = currentPath ?? pathname;

  // Déterminer le module actif (préférer le chemin le plus long pour /app/finance vs /app/finance/fees)
  const getActiveModuleId = () => {
    if (activeModuleId) return activeModuleId;
    let best: { id: string; len: number } | null = null;
    for (const module of modules) {
      if (module.href && pathForActive?.startsWith(module.href)) {
        const len = module.href.length;
        if (!best || len > best.len) best = { id: module.id, len };
      }
    }
    return best?.id ?? modules[0]?.id;
  };

  const currentActiveId = getActiveModuleId();

  const handleModuleClick = (module: SubModule) => {
    if (module.disabled) return;
    
    if (onModuleChange) {
      onModuleChange(module.id);
    } else if (module.href) {
      router.push(module.href);
    }
  };

  return (
    <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden', className)}>
      <nav
        className="flex border-b border-gray-200 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 px-4 sm:px-6"
        aria-label="Sous-modules"
      >
        {modules.map((module) => {
          const isActive = currentActiveId === module.id;
          return (
            <button
              key={module.id}
              onClick={() => handleModuleClick(module)}
              disabled={module.disabled}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                'border-b-2 border-transparent',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isActive
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {module.icon && <span className="flex-shrink-0">{module.icon}</span>}
              <span>{module.label}</span>
              {module.badge && <span className="ml-2">{module.badge}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

