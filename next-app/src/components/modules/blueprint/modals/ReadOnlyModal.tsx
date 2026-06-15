/**
 * ============================================================================
 * READ ONLY MODAL - MODAL DE LECTURE SEULE
 * ============================================================================
 * 
 * Modal réutilisable pour l'affichage en lecture seule
 * Utilise BaseModal pour la structure standardisée
 * 
 * Usage :
 * - Détails
 * - Historique
 * - Lecture institutionnelle
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import BaseModal from './BaseModal';

export interface ReadOnlyModalProps {
  /** Titre */
  title: string;
  /** Sous-titre (optionnel) */
  subtitle?: string;
  /** Contenu */
  children: ReactNode;
  /** Ouvert/fermé */
  isOpen: boolean;
  /** Callback de fermeture */
  onClose: () => void;
  /** Actions optionnelles (boutons) */
  actions?: ReactNode;
  /** Taille */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Afficher le contexte */
  showContext?: boolean;
}

export default function ReadOnlyModal({
  title,
  subtitle,
  children,
  isOpen,
  onClose,
  actions,
  size = 'lg',
  showContext = true,
}: ReadOnlyModalProps) {
  return (
    <BaseModal
      title={title}
      subtitle={subtitle}
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      showContext={showContext}
      footer={actions}
    >
      {children}
    </BaseModal>
  );
}

