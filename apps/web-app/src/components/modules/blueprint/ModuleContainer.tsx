/**
 * ============================================================================
 * MODULE CONTAINER - WRAPPER PRINCIPAL DU MODULE
 * ============================================================================
 * 
 * Container principal qui structure tous les modules
 * Intègre : Header, Navigation, Content Area
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import ModuleHeader, { ModuleHeaderProps } from './ModuleHeader';
import SubModuleNavigation, { SubModuleNavigationProps } from './SubModuleNavigation';
import ModuleContentArea, { ModuleContentAreaProps } from './ModuleContentArea';
import { useModuleContext } from '@/hooks/useModuleContext';
import { getPageSlideMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';

export interface ModuleContainerProps {
  /** Props du header */
  header: ModuleHeaderProps;
  /** Props de la navigation interne (optionnel) */
  subModules?: SubModuleNavigationProps;
  /** Props de la zone de contenu */
  content: ModuleContentAreaProps;
  /** Contenu personnalisé après le header (optionnel) */
  afterHeader?: ReactNode;
  /** Contenu personnalisé avant le footer (optionnel) */
  beforeFooter?: ReactNode;
  /** Style personnalisé */
  className?: string;
}

/**
 * ModuleContainer - Structure standardisée pour tous les modules
 * 
 * Structure :
 * - ModuleHeader (titre, description, KPI, actions)
 * - SubModuleNavigation (tabs, si applicable)
 * - ModuleContentArea (contenu principal)
 */
export default function ModuleContainer({
  header,
  subModules,
  content,
  afterHeader,
  beforeFooter,
  className,
}: ModuleContainerProps) {
  // Le contexte module est automatiquement fourni par useModuleContext
  // Il contient : academicYear, schoolLevel, academicTrack, tenant
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion);

  return (
    <motion.div
      className={`space-y-6 ${className || ''}`}
      initial={pageMotion.initial}
      animate={pageMotion.animate}
      transition={pageMotion.transition}
    >
      {/* Header du module */}
      <ModuleHeader {...header} />

      {/* Contenu après le header (optionnel) */}
      {afterHeader && <div>{afterHeader}</div>}

      {/* Navigation interne par sous-modules */}
      {subModules && <SubModuleNavigation {...subModules} />}

      {/* Zone de contenu principale */}
      <ModuleContentArea {...content} />

      {/* Contenu avant le footer (optionnel) */}
      {beforeFooter && <div>{beforeFooter}</div>}
    </motion.div>
  );
}

