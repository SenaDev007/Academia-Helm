/**
 * ============================================================================
 * LOADING STATE - ÉTAT DE CHARGEMENT BRANDED ACADEMIA HELM
 * ============================================================================
 *
 * Composant standard pour afficher un état de chargement inline.
 * Utilise le spinner branded InlineSpinner au lieu du Loader2 basique.
 *
 * Variantes :
 * - default : Spinner avec message
 * - orion   : Spinner doré avec label ORION
 * - sara    : Points rebondissants avec label IA
 * - compact : Spinner seul sans texte
 */

'use client';

import { cn } from '@/lib/utils';
import { InlineSpinner, BouncingDots, LinearProgress, type SpinnerColor } from './InlineSpinner';

export interface LoadingStateProps {
  /** Message affiché sous le spinner */
  message?: string;
  /** Plein écran */
  fullScreen?: boolean;
  /** Variante visuelle */
  variant?: 'default' | 'orion' | 'sara' | 'compact' | 'linear';
  /** Couleur du spinner */
  color?: SpinnerColor;
  /** Classe CSS supplémentaire */
  className?: string;
}

export function LoadingState({
  message = 'Chargement...',
  fullScreen = false,
  variant = 'default',
  color = 'blue',
  className,
}: LoadingStateProps) {
  // Variante linéaire
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

  // Variante ORION (dorée, premium)
  if (variant === 'orion') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          fullScreen ? 'min-h-screen' : 'py-12',
          className,
        )}
      >
        <div className="relative mb-4">
          {/* Anneau extérieur doré */}
          <div className="h-12 w-12 rounded-full border-[3px] border-[#f5b335]/20 border-t-[#f5b335] animate-spin" style={{ animationDuration: '1.2s' }} />
          {/* Éclat central */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-[#f5b335]/40 animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-semibold text-[#0b2f73]">{message || 'Analyse ORION…'}</p>
        <p className="text-xs text-slate-400 mt-1">Intelligence prédictive</p>
      </div>
    );
  }

  // Variante SARA (points rebondissants)
  if (variant === 'sara') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          fullScreen ? 'min-h-screen' : 'py-12',
          className,
        )}
      >
        <BouncingDots size="lg" color="blue" className="mb-3" />
        <p className="text-sm font-medium text-[#1d4fa5]">{message || 'SARA réfléchit…'}</p>
        <p className="text-xs text-slate-400 mt-1">Assistant intelligent</p>
      </div>
    );
  }

  // Variante compacte (spinner seul)
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <InlineSpinner size="sm" color={color} />
      </div>
    );
  }

  // Variante par défaut
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        fullScreen ? 'min-h-screen' : 'py-12',
        className,
      )}
    >
      <InlineSpinner size="lg" color={color} className="mb-4" />
      <p className="text-sm text-slate-600 font-medium">{message}</p>
    </div>
  );
}
