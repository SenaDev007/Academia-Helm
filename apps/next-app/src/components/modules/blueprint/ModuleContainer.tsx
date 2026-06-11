/**
 * ============================================================================
 * MODULE CONTAINER - STRUCTURE DE BASE (PREMIUM UPGRADE)
 * ============================================================================
 * 
 * Composant racine pour tous les modules Academia Hub.
 * Gère le layout standard : Header > Navigation > Content.
 */

'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleHeader, { ModuleHeaderProps } from './ModuleHeader';
import SubModuleNavigation, { SubModule, SubModuleTab } from './SubModuleNavigation';
import ModuleContentArea, { ModuleContentAreaProps } from './ModuleContentArea';
import { cn } from '@/lib/utils';

interface ModuleContainerProps {
  /** Configuration du header */
  header: ModuleHeaderProps;
  /** Configuration de la navigation sous-modules */
  subModules?: {
    modules?: SubModule[];
    tabs?: SubModuleTab[];
    currentPath?: string;
    activeModuleId?: string;
    onModuleChange?: (id: string) => void;
  };
  /** Configuration du contenu */
  content: ModuleContentAreaProps & {
    children?: ReactNode;
  };
  /** Classes CSS additionnelles */
  className?: string;
}

export default function ModuleContainer({
  header,
  subModules,
  content,
  className,
}: ModuleContainerProps) {
  return (
    <div className={cn('flex flex-col space-y-6 animate-in fade-in duration-700', className)}>
      {/* 1. Header du module */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ModuleHeader {...header} />
      </motion.div>

      {/* 2. Navigation des sous-modules (si présente) */}
      {subModules && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="sticky top-0 z-20"
        >
          <SubModuleNavigation {...subModules} />
        </motion.div>
      )}

      {/* 3. Zone de contenu */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <ModuleContentArea {...content}>
          <AnimatePresence mode="wait">
            <motion.div
              key={subModules?.activeModuleId || 'main-content'}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
            >
              {content.children}
            </motion.div>
          </AnimatePresence>
        </ModuleContentArea>
      </motion.div>
    </div>
  );
}
