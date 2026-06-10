/**
 * ============================================================================
 * CONFIRM MODAL - MODAL DE CONFIRMATION STANDARDISÉ
 * ============================================================================
 * 
 * Modal réutilisable pour les confirmations d'actions
 * Utilise BaseModal pour la structure standardisée
 * 
 * Usage :
 * - Suppression logique
 * - Annulation
 * - Recalcul
 * 
 * ============================================================================
 */

'use client';

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import BaseModal from './BaseModal';

export type ConfirmModalType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmModalProps {
  /** Titre */
  title: string;
  /** Message */
  message: string;
  /** Type de modal */
  type?: ConfirmModalType;
  /** Ouvert/fermé */
  isOpen: boolean;
  /** Callback de confirmation */
  onConfirm: () => void;
  /** Callback d'annulation */
  onCancel: () => void;
  /** Label du bouton de confirmation */
  confirmLabel?: string;
  /** Label du bouton d'annulation */
  cancelLabel?: string;
  /** Chargement */
  isLoading?: boolean;
}

export default function ConfirmModal({
  title,
  message,
  type = 'warning',
  isOpen,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  isLoading = false,
}: ConfirmModalProps) {
  const typeConfig = {
    danger: {
      icon: XCircle,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      buttonColor: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      buttonColor: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      buttonColor: 'bg-green-600 hover:bg-green-700 text-white',
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <BaseModal
      title={title}
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
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
            className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${config.buttonColor}`}
          >
            {isLoading ? 'Traitement...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Icon */}
        <div className="flex items-center justify-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${config.bgColor}`}>
            <Icon className={`w-8 h-8 ${config.iconColor}`} />
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-base font-medium text-gray-900">{message}</p>
        </div>
      </div>
    </BaseModal>
  );
}

