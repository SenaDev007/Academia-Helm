/**
 * OrionLoadingIndicator — v2 Modern Premium
 *
 * Indicateur de chargement ORION premium avec :
 * - Anneau orbital double (desktop) / simple (mobile)
 * - Compteur d'alertes avec animation
 * - Barre de progression branded
 * - Détection mobile automatique
 * - Design cohérent Academia Helm
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 */

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { OrbitalSpinner, LinearProgress } from '@/components/ui/feedback/InlineSpinner';

export interface OrionLoadingIndicatorProps {
  isActive: boolean;
  alertsCount?: number;
  phase?: 'scan' | 'analyze' | 'report';
  className?: string;
}

const phaseLabels: Record<string, string> = {
  scan: 'Scan des indicateurs…',
  analyze: 'Analyse prédictive en cours…',
  report: 'Génération du rapport…',
};

const phaseColors: Record<string, string> = {
  scan: 'bg-[#1d4fa5]/10 text-[#1d4fa5] border-[#1d4fa5]/20',
  analyze: 'bg-[#f5b335]/10 text-[#b8860b] border-[#f5b335]/20',
  report: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function OrionLoadingIndicator({
  isActive,
  alertsCount = 0,
  phase = 'scan',
  className,
}: OrionLoadingIndicatorProps) {
  const [showAlerts, setShowAlerts] = useState(false);
  const [dots, setDots] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  useEffect(() => {
    if (!isActive || alertsCount <= 0) {
      setShowAlerts(false);
      return;
    }
    const timer = setTimeout(() => setShowAlerts(true), 500);
    return () => clearTimeout(timer);
  }, [isActive, alertsCount]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden',
        isMobile
          ? 'bg-[#0b2f73]/[0.03] border border-[#1d4fa5]/8 p-3'
          : 'bg-gradient-to-r from-[#0b2f73]/5 via-[#1d4fa5]/5 to-[#f5b335]/5 border border-[#1d4fa5]/10 p-4',
        className,
      )}
    >
      {/* Spinner + message */}
      <div className={cn('flex items-center', isMobile ? 'gap-2.5' : 'gap-3')}>
        {isMobile ? (
          <div className="relative shrink-0">
            <div
              className="h-7 w-7 rounded-full border-2 border-[#f5b335]/15 border-t-[#f5b335]"
              style={{ animation: 'academiaOrbit 1s linear infinite' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-1.5 w-1.5 rounded-full bg-[#f5b335]"
                style={{ animation: 'academiaPulse 1.5s ease-in-out infinite' }}
              />
            </div>
          </div>
        ) : (
          <OrbitalSpinner size="sm" />
        )}

        <div className="flex-1 min-w-0">
          <div className={cn('flex items-center', isMobile ? 'gap-1.5' : 'gap-2')}>
            <p className={cn('font-semibold text-[#0b2f73]', isMobile ? 'text-[11px]' : 'text-sm')}>
              ORION{dots}
            </p>
            <span className={cn(
              'rounded-full font-bold uppercase border',
              isMobile ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[10px]',
              phaseColors[phase],
            )}>
              {phase === 'scan' ? 'Scan' : phase === 'analyze' ? 'Analyse' : 'Rapport'}
            </span>
          </div>
          <p className={cn('text-slate-500 mt-0.5', isMobile ? 'text-[9px]' : 'text-xs')}>
            {phaseLabels[phase] || 'Analyse ORION en cours…'}
          </p>
        </div>

        {showAlerts && alertsCount > 0 && (
          <div
            className={cn(
              'shrink-0 flex items-center rounded-full bg-orange-50 border border-orange-200',
              isMobile ? 'gap-1 px-2 py-0.5' : 'gap-1.5 px-2.5 py-1',
            )}
          >
            <div
              className="h-1.5 w-1.5 rounded-full bg-orange-500"
              style={{ animation: 'academiaPulse 1s ease-in-out infinite' }}
            />
            <span className={cn('font-bold text-orange-700', isMobile ? 'text-[9px]' : 'text-xs')}>
              {alertsCount} alerte{alertsCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className={cn(isMobile ? 'mt-2' : 'mt-3')}>
        <LinearProgress color="gold" />
      </div>
    </div>
  );
}
