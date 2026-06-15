/**
 * ============================================================================
 * ALERT MODAL - MODAL POUR BLOCAGES MÉTIER
 * ============================================================================
 * 
 * Modal pour :
 * - Incohérences détectées
 * - Conflits
 * - Règles violées
 * 
 * Caractéristiques :
 * - Affichage du problème
 * - Action requise claire
 * - Pas d'action destructive
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { AlertCircle, Info, XCircle, CheckCircle } from 'lucide-react';
import BaseModal from './BaseModal';
import { cn } from '@/lib/utils';

export type AlertModalType = 'error' | 'warning' | 'info' | 'success';

export interface AlertModalProps {
  /** Titre */
  title: string;
  /** Message */
  message: string;
  /** Détails du problème */
  details?: ReactNode;
  /** Type d'alerte */
  type?: AlertModalType;
  /** Ouvert/fermé */
  isOpen: boolean;
  /** Callback de fermeture */
  onClose: () => void;
  /** Action optionnelle */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Taille */
  size?: 'sm' | 'md' | 'lg';
}

export default function AlertModal({
  title,
  message,
  details,
  type = 'warning',
  isOpen,
  onClose,
  action,
  size = 'md',
}: AlertModalProps) {
  const typeConfig = {
    error: {
      icon: XCircle,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-900',
    },
    warning: {
      icon: AlertCircle,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-900',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-900',
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <BaseModal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      footer={
        <div className="flex items-center justify-end space-x-3">
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                type === 'error' && 'bg-red-600 text-white hover:bg-red-700',
                type === 'warning' && 'bg-yellow-600 text-white hover:bg-yellow-700',
                type === 'info' && 'bg-blue-600 text-white hover:bg-blue-700',
                type === 'success' && 'bg-green-600 text-white hover:bg-green-700'
              )}
            >
              {action.label}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {action ? 'Fermer' : 'OK'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Icon */}
        <div className="flex items-center justify-center">
          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center', config.bgColor)}>
            <Icon className={cn('w-8 h-8', config.iconColor)} />
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-base font-medium text-gray-900">{message}</p>
        </div>

        {/* Détails */}
        {details && (
          <div className={cn('rounded-md p-4 border', config.bgColor, config.borderColor)}>
            <div className={cn('text-sm', config.textColor)}>{details}</div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

