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
import { motion } from 'framer-motion';
import ModuleHeader, { ModuleHeaderProps } from './ModuleHeader';
import SubModuleNavigation, { SubModule, SubModuleTab } from './SubModuleNavigation';
import ModuleContentArea, { ModuleContentAreaProps } from './ModuleContentArea';
import { cn } from '@/lib/utils';

interface ModuleContainerProps {
  /** Configuration du header */
  header?: ModuleHeaderProps;
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
      {/* 1. Header du module (seulement s'il est défini) */}
      {header && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ModuleHeader {...header} />
        </motion.div>
      )}

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

      {/* 3. Zone de contenu — sans animation de transition pour préserver les données */}
      <div>
        <ModuleContentArea {...content}>
          {/* ⭐ FIX : AnimatePresence + motion.div retirés pour éviter la
              destruction/re-création des composants à chaque changement d'onglet.
              Avant : chaque changement d'onglet détruisait l'ancien composant
              (perte de toutes les données en mémoire) et créait le nouveau
              (rechargement depuis le backend → délai + données vides temporaires).
              Maintenant : le contenu est rendu directement sans animation de
              transition, ce qui préserve les données et accélère la navigation.
              Les animations peuvent être réactivées plus tard avec une approche
              qui préserve l'état (ex: garder les composants montés avec
              display:none au lieu de les détruire). */}
          {content.children}
        </ModuleContentArea>
      </div>
    </div>
  );
}
