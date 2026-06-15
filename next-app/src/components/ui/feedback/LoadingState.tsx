/**
 * ============================================================================
 * LOADING STATE - PREMIUM BRANDED ACADEMIA HELM
 * ============================================================================
 *
 * Composant standard pour afficher un état de chargement inline.
 * Refonte premium avec :
 * - Détection mobile automatique pour performances optimales
 * - Spinner orbital premium sur desktop, CSS-only sur mobile
 * - Messages contextuels avec animation typewriter
 * - Variantes enrichies : default, orion, sara, compact, linear, wave
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 */

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { InlineSpinner, BouncingDots, LinearProgress, OrbitalSpinner, type SpinnerColor } from './InlineSpinner';

export interface LoadingStateProps {
  /** Message affiché sous le spinner */
  message?: string;
  /** Plein écran */
  fullScreen?: boolean;
  /** Variante visuelle */
  variant?: 'default' | 'orion' | 'sara' | 'compact' | 'linear' | 'wave';
  /** Couleur du spinner */
  color?: SpinnerColor;
  /** Classe CSS supplémentaire */
  className?: string;
}

/** Messages contextuels qui tournent pendant le chargement */
const contextualMessages = [
  'Chargement des données…',
  'Synchronisation en cours…',
  'Préparation de l\'affichage…',
];

/**
 * Composant de message rotatif — change de texte toutes les 3s
 * pour donner l'impression d'une activité active.
 */
function RotatingMessage({ isMobile }: { isMobile?: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % contextualMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className={cn(
        'text-slate-400 transition-opacity duration-500',
        isMobile ? 'text-[10px]' : 'text-xs',
      )}
    >
      {contextualMessages[msgIndex]}
    </p>
  );
}

export function LoadingState({
  message = 'Chargement...',
  fullScreen = false,
  variant = 'default',
  color = 'blue',
  className,
}: LoadingStateProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  // ─── Variante linéaire ───
  if (variant === 'linear') {
    return (
      <div className={cn('w-full py-4', className)}>
        <LinearProgress color={color} />
        {message && (
          <p className="text-xs text-slate-400 text-center mt-2">{message}</p>
        )}
      </div>
    );
  }

  // ─── Variante ORION (dorée, premium, orbitale) ───
  if (variant === 'orion') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          fullScreen ? 'min-h-screen' : 'py-12',
          className,
        )}
      >
        {isMobile ? (
          /* Mobile: simple gold ring + pulse core */
          <div className="relative mb-4">
            <div
              className="h-10 w-10 rounded-full border-[3px] border-[#f5b335]/15 border-t-[#f5b335]"
              style={{ animation: 'academiaOrbit 1.2s linear infinite' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-2.5 w-2.5 rounded-full bg-[#f5b335]"
                style={{ animation: 'academiaPulse 1.5s ease-in-out infinite' }}
              />
            </div>
          </div>
        ) : (
          /* Desktop: orbital spinner premium */
          <OrbitalSpinner size="lg" className="mb-4" />
        )}
        <p className={cn('font-semibold text-[#0b2f73]', isMobile ? 'text-xs' : 'text-sm')}>
          {message || 'Analyse ORION…'}
        </p>
        <p className={cn('mt-1', isMobile ? 'text-[10px]' : 'text-xs')}>
          <span className="text-[#f5b335] font-medium">Intelligence prédictive</span>
        </p>
        {!fullScreen && <RotatingMessage isMobile={isMobile} />}
      </div>
    );
  }

  // ─── Variante SARA (points ondulants premium) ───
  if (variant === 'sara') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          fullScreen ? 'min-h-screen' : 'py-12',
          className,
        )}
      >
        {isMobile ? (
          /* Mobile: simple CSS wave dots */
          <div className="flex items-center space-x-1.5 mb-3">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={cn(
                  'rounded-full',
                  i === 0 ? 'h-2 w-2 bg-[#0b2f73]' : i === 1 ? 'h-2.5 w-2.5 bg-[#1d4fa5]' : 'h-2 w-2 bg-[#f5b335]',
                )}
                style={{
                  animation: 'academiaWaveDot 1.4s ease-in-out infinite',
                  animationDelay: `${i * 200}ms`,
                }}
              />
            ))}
          </div>
        ) : (
          /* Desktop: branded wave dots */
          <BouncingDots size="lg" color="blue" className="mb-3" />
        )}
        <p className={cn('font-medium text-[#1d4fa5]', isMobile ? 'text-xs' : 'text-sm')}>
          {message || 'SARA réfléchit…'}
        </p>
        <p className={cn('text-slate-400 mt-1', isMobile ? 'text-[10px]' : 'text-xs')}>
          Assistant intelligent
        </p>
      </div>
    );
  }

  // ─── Variante compacte (spinner seul) ───
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <InlineSpinner size="sm" color={color} />
      </div>
    );
  }

  // ─── Variante wave (ondulation branded) ───
  if (variant === 'wave') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          fullScreen ? 'min-h-screen' : 'py-8',
          className,
        )}
      >
        {/* Branded wave bar */}
        <div
          className={cn(
            'w-full max-w-xs rounded-full overflow-hidden',
            isMobile ? 'h-1' : 'h-1.5',
          )}
          style={{ background: 'rgba(11,47,115,0.06)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #0b2f73, #1d4fa5, #f5b335, #1d4fa5, #0b2f73)',
              backgroundSize: '200% 100%',
              animation: 'academiaWave 2s linear infinite',
              width: '60%',
            }}
          />
        </div>
        <p className={cn('text-slate-500 font-medium mt-3', isMobile ? 'text-[10px]' : 'text-sm')}>
          {message}
        </p>
      </div>
    );
  }

  // ─── Variante par défaut (spinner + message) ───
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        fullScreen ? 'min-h-screen' : 'py-12',
        className,
      )}
    >
      <InlineSpinner
        size={isMobile ? 'md' : 'lg'}
        color={color}
        className="mb-4"
      />
      <p className={cn(
        'text-slate-600 font-medium',
        isMobile ? 'text-xs' : 'text-sm',
      )}>
        {message}
      </p>
      {!fullScreen && <RotatingMessage isMobile={isMobile} />}
    </div>
  );
}
