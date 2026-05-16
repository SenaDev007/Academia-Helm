/**
 * OrionLoadingIndicator Component
 * 
 * Indicateur de chargement ORION avec messages contextuels
 * Utilisé pendant l'initialisation ORION dans le flow post-login
 */

'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export interface OrionLoadingIndicatorProps {
  isActive: boolean;
  alertsCount?: number;
  className?: string;
}

/**
 * Indicateur de chargement ORION
 * 
 * Affiche un indicateur visuel pendant l'analyse ORION
 * avec le nombre d'alertes critiques détectées
 */
export function OrionLoadingIndicator({
  isActive,
  alertsCount = 0,
  className,
}: OrionLoadingIndicatorProps) {
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    if (!isActive || alertsCount <= 0) {
      setShowAlerts(false);
      return;
    }

    // Afficher les alertes après un court délai
    const timer = setTimeout(() => {
      setShowAlerts(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [isActive, alertsCount]);

  if (!isActive) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center space-x-3 text-blue-600">
        <Sparkles className="h-5 w-5 animate-pulse" />
        <div>
          <p className="text-sm font-medium">Analyse ORION en cours…</p>
          {showAlerts && alertsCount > 0 && (
            <p className="text-xs text-orange-600 mt-1">
              {alertsCount} alerte{alertsCount > 1 ? 's' : ''} critique{alertsCount > 1 ? 's' : ''} détectée{alertsCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
