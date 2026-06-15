/**
 * ============================================================================
 * ALERT CARD - CARTE D'ALERTE (ORION)
 * ============================================================================
 * 
 * Composant standard pour afficher les alertes ORION
 * Utilisé dans tous les dashboards pour les alertes critiques
 * 
 * ============================================================================
 */

'use client';

import { AlertTriangle, Info, CheckCircle, XCircle, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'success';

export interface AlertCardProps {
  title: string;
  message: string;
  severity: AlertSeverity;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export function AlertCard({
  title,
  message,
  severity,
  icon: CustomIcon,
  action,
  onDismiss,
  className,
}: AlertCardProps) {
  const severityConfig = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: Info,
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      messageColor: 'text-blue-700',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900',
      messageColor: 'text-yellow-700',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: XCircle,
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      messageColor: 'text-red-700',
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      messageColor: 'text-green-700',
    },
  };

  const config = severityConfig[severity];
  const Icon = CustomIcon || config.icon;

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        config.bg,
        config.border,
        className,
      )}
    >
      <div className="flex items-start space-x-3">
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />
        <div className="flex-1 min-w-0">
          <h4 className={cn('text-sm font-semibold mb-1', config.titleColor)}>
            {title}
          </h4>
          <p className={cn('text-sm', config.messageColor)}>{message}</p>
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                'mt-3 text-sm font-medium underline',
                config.messageColor,
              )}
            >
              {action.label}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Fermer l'alerte"
            title="Fermer l'alerte"
            type="button"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
