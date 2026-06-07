/**
 * OrionAlertsBanner Component
 * 
 * Bannière pour afficher les alertes ORION critiques après le chargement
 * S'affiche en haut du dashboard pour les rôles direction
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrionAlert {
  id: string;
  level: 'INFO' | 'ATTENTION' | 'CRITIQUE';
  message: string;
}

export interface OrionAlertsBannerProps {
  alerts: OrionAlert[];
  onDismiss?: (alertId: string) => void;
  className?: string;
}

/**
 * Bannière d'alertes ORION
 * 
 * Affiche les alertes critiques détectées pendant le chargement
 * 
 * @example
 * ```tsx
 * <OrionAlertsBanner
 *   alerts={orionAlerts}
 *   onDismiss={(id) => acknowledgeAlert(id)}
 * />
 * ```
 */
export function OrionAlertsBanner({
  alerts,
  onDismiss,
  className,
}: OrionAlertsBannerProps) {
  const [visibleAlerts, setVisibleAlerts] = useState<OrionAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Filtrer uniquement les alertes critiques
    const criticalAlerts = alerts.filter(
      (alert) => alert.level === 'CRITIQUE' && !dismissed.has(alert.id)
    );
    setVisibleAlerts(criticalAlerts);
  }, [alerts, dismissed]);

  const handleDismiss = (alertId: string) => {
    setDismissed((prev) => new Set([...prev, alertId]));
    onDismiss?.(alertId);
  };

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className={cn('mb-6', className)}>
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg shadow-sm mb-3"
        >
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-orange-900 mb-1">
                Alerte critique détectée
              </h3>
              <p className="text-sm text-orange-800">{alert.message}</p>
            </div>
            {onDismiss && (
              <button
                onClick={() => handleDismiss(alert.id)}
                className="ml-4 text-orange-600 hover:text-orange-800 transition-colors"
                aria-label="Fermer l'alerte"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
