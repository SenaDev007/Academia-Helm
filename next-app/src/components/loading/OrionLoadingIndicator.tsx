/**
 * ============================================================================
 * ORION LOADING INDICATOR - BRANDED ACADEMIA HELM
 * ============================================================================
 *
 * Indicateur de chargement ORION premium avec :
 * - Anneau doré rotatif
 * - Compteur d'alertes avec animation
 * - Barre de progression linéaire
 * - Design cohérent avec la charte Academia Helm
 */

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { LinearProgress } from '@/components/ui/feedback/InlineSpinner';

export interface OrionLoadingIndicatorProps {
  isActive: boolean;
  alertsCount?: number;
  /** Phase actuelle de l'analyse */
  phase?: 'scan' | 'analyze' | 'report';
  className?: string;
}

const phaseLabels: Record<string, string> = {
  scan: 'Scan des indicateurs…',
  analyze: 'Analyse prédictive en cours…',
  report: 'Génération du rapport…',
};

/**
 * Indicateur de chargement ORION premium
 *
 * Affiche un indicateur visuel pendant l'analyse ORION
 * avec le nombre d'alertes critiques détectées et la phase courante.
 */
export function OrionLoadingIndicator({
  isActive,
  alertsCount = 0,
  phase = 'scan',
  className,
}: OrionLoadingIndicatorProps) {
  const [showAlerts, setShowAlerts] = useState(false);
  const [dots, setDots] = useState('');

  // Afficher les alertes après un court délai
  useEffect(() => {
    if (!isActive || alertsCount <= 0) {
      setShowAlerts(false);
      return;
    }
    const timer = setTimeout(() => setShowAlerts(true), 500);
    return () => clearTimeout(timer);
  }, [isActive, alertsCount]);

  // Animation des points de suspension
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <div className={cn('rounded-xl bg-gradient-to-r from-[#0b2f73]/5 via-[#1d4fa5]/5 to-[#f5b335]/5 border border-[#1d4fa5]/10 p-4', className)}>
      {/* Ligne supérieure : spinner + message */}
      <div className="flex items-center gap-3">
        {/* Anneau ORION */}
        <div className="relative shrink-0">
          <div
            className="h-8 w-8 rounded-full border-2 border-[#f5b335]/20 border-t-[#f5b335] animate-spin"
            style={{ animationDuration: '1s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-[#f5b335] animate-pulse" />
          </div>
        </div>

        {/* Texte */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#0b2f73]">
              ORION{dots}
            </p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#f5b335]/10 text-[#b8860b] border border-[#f5b335]/20">
              {phase === 'scan' ? 'Scan' : phase === 'analyze' ? 'Analyse' : 'Rapport'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {phaseLabels[phase] || 'Analyse ORION en cours…'}
          </p>
        </div>

        {/* Compteur d'alertes */}
        {showAlerts && alertsCount > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200">
            <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs font-bold text-orange-700">
              {alertsCount} alerte{alertsCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Barre de progression */}
      <div className="mt-3">
        <LinearProgress color="gold" />
      </div>
    </div>
  );
}
