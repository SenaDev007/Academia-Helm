/**
 * ============================================================================
 * SUB MODULE NAVIGATION - NAVIGATION INTERNE (PREMIUM UPGRADE)
 * ============================================================================
 * 
 * Navigation par tabs pour les sous-modules
 * Design moderne avec pill-active et transitions fluides.
 */

'use client';

import { ReactNode, isValidElement, cloneElement } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SubModule {
  id: string;
  label: string;
  icon?: any;
  badge?: ReactNode;
  href?: string;
  disabled?: boolean;
}

export interface SubModuleTab {
  id: string;
  label: string;
  path: string;
  icon?: any;
}

export interface SubModuleNavigationProps {
  modules?: SubModule[];
  tabs?: SubModuleTab[];
  currentPath?: string;
  activeModuleId?: string;
  onModuleChange?: (moduleId: string) => void;
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
    <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden', className)}>
      <nav
        className="flex border-b border-gray-200 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
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
                'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none',
                'disabled:opacity-30 disabled:cursor-not-allowed border-none rounded-none shadow-none',
                isActive
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {module.icon && (
                <span className={cn("flex-shrink-0", isActive ? "text-blue-600" : "text-gray-400")}>
                  {isValidElement(module.icon) ? (
                    cloneElement(module.icon as React.ReactElement, { 
                      className: cn("w-4 h-4", (module.icon as any).props.className) 
                    } as any)
                  ) : typeof module.icon === 'function' || (typeof module.icon === 'object' && module.icon !== null) ? (
                    <module.icon className="w-4 h-4" />
                  ) : (
                    module.icon
                  )}
                </span>
              )}
              <span>{module.label}</span>
              {module.badge && (
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-bold",
                  isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                )}>
                  {module.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
