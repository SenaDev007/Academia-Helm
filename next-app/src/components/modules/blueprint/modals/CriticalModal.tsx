/**
 * ============================================================================
 * CRITICAL MODAL - MODAL POUR ACTIONS SENSIBLES
 * ============================================================================
 * 
 * Modal BLOQUANT pour actions critiques :
 * - Finances
 * - Examens
 * - RH
 * - Validation officielle
 * 
 * Caractéristiques :
 * - ESC désactivé
 * - Overlay clic désactivé
 * - Style danger
 * - Mention "irréversible"
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import BaseModal from './BaseModal';
import { cn } from '@/lib/utils';

export interface CriticalModalProps {
  /** Titre */
  title: string;
  /** Message principal */
  message: string;
  /** Détails de l'action */
  details?: ReactNode;
  /** Avertissement supplémentaire */
  warning?: string;
  /** Ouvert/fermé */
  isOpen: boolean;
  /** Callback de validation */
  onConfirm: () => void;
  /** Callback d'annulation */
  onCancel: () => void;
  /** Label du bouton de validation */
  confirmLabel?: string;
  /** Label du bouton d'annulation */
  cancelLabel?: string;
  /** Chargement */
  isLoading?: boolean;
  /** Taille */
  size?: 'md' | 'lg' | 'xl';
}

export default function CriticalModal({
  title,
  message,
  details,
  warning,
  isOpen,
  onConfirm,
  onCancel,
  confirmLabel = 'Valider',
  cancelLabel = 'Annuler',
  isLoading = false,
  size = 'md',
}: CriticalModalProps) {
  return (
    <BaseModal
      title={title}
      isOpen={isOpen}
      onClose={onCancel}
      size={size}
      disableEscClose={true}
      disableOverlayClose={true}
      showContext={true}
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Traitement...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Icon d'alerte */}
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Message principal */}
        <div className="text-center">
          <p className="text-base font-medium text-gray-900 mb-2">{message}</p>
          {warning && (
            <p className="text-sm text-red-600 font-medium">{warning}</p>
          )}
        </div>

        {/* Détails */}
        {details && (
          <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
            {details}
          </div>
        )}

        {/* Avertissement irréversible */}
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex items-start space-x-2">
            <Lock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">
                Action irréversible
              </p>
              <p className="text-xs text-red-700 mt-1">
                Cette action ne peut pas être annulée. Veuillez vérifier toutes les informations avant de valider.
              </p>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

