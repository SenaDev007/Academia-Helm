/**
 * ============================================================================
 * SUB MODULE NAVIGATION - NAVIGATION INTERNE (PREMIUM UPGRADE)
 * ============================================================================
 * 
 * Navigation par tabs pour les sous-modules
 * Design moderne avec pill-active et transitions fluides.
 */

'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SubModule {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  href?: string;
  disabled?: boolean;
}

export interface SubModuleTab {
  id: string;
  label: string;
  path: string;
  icon?: ReactNode;
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
    <div className={cn('bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-1.5 overflow-hidden', className)}>
      <nav
        className="flex items-center gap-1 overflow-x-auto scrollbar-none px-1"
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
                'relative flex items-center gap-2 px-4 py-2 text-sm font-bold whitespace-nowrap transition-all duration-300',
                'rounded-xl focus:outline-none',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                isActive
                  ? 'text-indigo-600'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-indigo-50 rounded-xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {module.icon && <span className={cn("flex-shrink-0", isActive ? "text-indigo-600" : "text-gray-400")}>{module.icon}</span>}
                <span>{module.label}</span>
                {module.badge && (
                  <span className={cn(
                    "ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-black",
                    isActive ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500"
                  )}>
                    {module.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
