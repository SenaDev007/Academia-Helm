/**
 * ============================================================================
 * MODULE CONTAINER - STRUCTURE DE BASE (PREMIUM UPGRADE)
 * ============================================================================
 *
 * Composant racine pour tous les modules Academia Hub.
 * Gere le layout standard : Header > Navigation > Content.
 *
 * ⭐ FIX PERFORMANCE : Les composants d'onglet sont maintenant gardes
 *    montes en memoire (display: none) au lieu d'etre detruits a chaque
 *    changement d'onglet. Cela preserve les donnees et evite le
 *    rechargement depuis le backend.
 */

'use client';

import { ReactNode, useRef, useState, useEffect } from 'react';
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
  const activeId = subModules?.activeModuleId || 'main-content';

  // ⭐ Cache des composants montes : garde les onglets en memoire
  //    Key = activeModuleId, Value = ReactNode (le children qui a etait rendu)
  //    Quand on revient sur un onglet, le composant est deja monte avec ses donnees.
  const [mountedTabs, setMountedTabs] = useState<Map<string, ReactNode>>(new Map());
  const prevActiveId = useRef<string>(activeId);

  useEffect(() => {
    // Ajouter le children actuel au cache s'il n'existe pas deja
    if (content.children && !mountedTabs.has(activeId)) {
      setMountedTabs(prev => {
        const next = new Map(prev);
        next.set(activeId, content.children);
        return next;
      });
    } else if (content.children && prevActiveId.current !== activeId) {
      // Le children a change (nouvel onglet) → mettre a jour le cache
      setMountedTabs(prev => {
        const next = new Map(prev);
        next.set(activeId, content.children);
        return next;
      });
    }
    prevActiveId.current = activeId;
  }, [activeId, content.children]);

  // ⭐ V10c — CORRECTIF CRITIQUE « page figée » :
  // L'onglet ACTIF doit toujours rendre les children COURANTS (props), pas la
  // copie figée au premier montage. Avant, le cache était rendu tel quel →
  // les pages qui passent du JSX INLINE (évaluations, etc.) restaient bloquées
  // sur leur premier rendu (spinner « Chargement des évaluations… » éternel)
  // car leurs mises à jour d'état produisaient un nouveau children ignoré.
  // Les pages passant un COMPOSANT (<DashboardContent />) fonctionnaient car
  // l'état vit DANS le composant monté. On corrige pour que TOUTES les formes
  // fonctionnent : actif = children live ; inactifs = snapshot du cache
  // (display:none → l'arbre reste monté, l'état est préservé).
  const allTabIds = Array.from(new Set([...mountedTabs.keys(), activeId]));

  return (
    <div className={cn('flex flex-col space-y-6 animate-in fade-in duration-700', className)}>
      {/* 1. Header du module (seulement s'il est defini) */}
      {header && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ModuleHeader {...header} />
        </motion.div>
      )}

      {/* 2. Navigation des sous-modules (si presente) */}
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

      {/* 3. Zone de contenu — onglets gardes montes */}
      <div>
        <ModuleContentArea {...content}>
          {/* ⭐ PERFORMANCE : Rendre TOUS les onglets montes, cacher les inactifs.
              Au lieu de detruire l'onglet precedent et creer le nouveau (ce qui
              force un rechargement complet des donnees), on garde tous les
              onglets en memoire et on les cache avec display:none.

              Le 1er montage d'un onglet : l'onglet est cree, ses donnees sont
              chargees via useEffect/fetch.
              Changement d'onglet : l'onglet precedent est cache (display:none)
              mais reste monte en memoire. Le nouvel onglet est affiche.
              Retour sur un onglet precedent : l'onglet est deja monte avec ses
              donnees → affichage INSTANTANE (pas de re-fetch). */}
          {allTabIds.map((tabId) => (
            <div
              key={tabId}
              style={{ display: tabId === activeId ? 'block' : 'none' }}
            >
              {/* ⭐ Onglet ACTIF : children LIVE (props) — les mises à jour d'état
                  de la page se propagent. Onglets INACTIFS : snapshot du cache
                  (arbre conservé monté via display:none). */}
              {tabId === activeId ? content.children : mountedTabs.get(tabId)}
            </div>
          ))}
        </ModuleContentArea>
      </div>
    </div>
  );
}
