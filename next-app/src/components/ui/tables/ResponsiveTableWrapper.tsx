/**
 * ============================================================================
 * RESPONSIVE TABLE WRAPPER - ENROBAGE RESPONSIF POUR TABLEAUX
 * ============================================================================
 *
 * Composant réutilisable qui rend tout tableau HTML défilable horizontalement
 * sur mobile. Applique `overflow-x-auto` + marges négatives mobiles pour
 * que le tableau occupe toute la largeur de l'écran tout en permettant
 * le scroll horizontal pour voir les colonnes masquées.
 *
 * Utilisation :
 *   <ResponsiveTableWrapper>
 *     <table className="min-w-full ...">...</table>
 *   </ResponsiveTableWrapper>
 *
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ResponsiveTableWrapperProps {
  /** Le tableau HTML ou composant <Table> à envelopper */
  children: ReactNode;
  /** Classes CSS supplémentaires pour le conteneur extérieur */
  className?: string;
  /** Largeur minimale du tableau (défaut : 640px pour la plupart des tableaux) */
  minWidth?: string;
  /** Afficher une indication de scroll sur mobile (défaut : true) */
  showScrollHint?: boolean;
}

export default function ResponsiveTableWrapper({
  children,
  className,
  minWidth = '640px',
  showScrollHint = true,
}: ResponsiveTableWrapperProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Indicateur de scroll latéral sur mobile */}
      {showScrollHint && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden" />
      )}
      {/* Conteneur scrollable : overflow-x-auto + marges négatives mobile */}
      <div
        className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ minWidth }}>{children}</div>
      </div>
    </div>
  );
}
