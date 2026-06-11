/**
 * ============================================================================
 * INLINE SPINNER - SPINNER BRANDED ACADEMIA HELM
 * ============================================================================
 *
 * Composant spinner unifié pour TOUTE l'application.
 * Remplace les 80+ instances incohérentes de animate-spin.
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 *
 * @example
 * <InlineSpinner size="sm" />           // Petit spinner dans un bouton
 * <InlineSpinner size="md" color="gold" /> // Spinner doré moyen
 * <InlineSpinner size="lg" withLabel /> // Grand spinner avec texte
 */

'use client';

import { cn } from '@/lib/utils';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'navy' | 'blue' | 'gold' | 'white' | 'muted';

export interface InlineSpinnerProps {
  /** Taille du spinner */
  size?: SpinnerSize;
  /** Couleur du spinner */
  color?: SpinnerColor;
  /** Afficher un texte sous le spinner */
  label?: string;
  /** Classe CSS supplémentaire */
  className?: string;
}

const sizeMap: Record<SpinnerSize, { ring: string; dot: string }> = {
  xs: { ring: 'h-3 w-3 border-[1.5px]', dot: '' },
  sm: { ring: 'h-4 w-4 border-2', dot: '' },
  md: { ring: 'h-6 w-6 border-2', dot: '' },
  lg: { ring: 'h-8 w-8 border-[3px]', dot: '' },
  xl: { ring: 'h-12 w-12 border-4', dot: '' },
};

const colorMap: Record<SpinnerColor, { border: string; text: string }> = {
  navy: { border: 'border-[#0b2f73]/20 border-t-[#0b2f73]', text: 'text-[#0b2f73]' },
  blue: { border: 'border-[#1d4fa5]/20 border-t-[#1d4fa5]', text: 'text-[#1d4fa5]' },
  gold: { border: 'border-[#f5b335]/20 border-t-[#f5b335]', text: 'text-[#f5b335]' },
  white: { border: 'border-white/20 border-t-white', text: 'text-white' },
  muted: { border: 'border-slate-200 border-t-slate-400', text: 'text-slate-500' },
};

export function InlineSpinner({
  size = 'md',
  color = 'blue',
  label,
  className,
}: InlineSpinnerProps) {
  const s = sizeMap[size];
  const c = colorMap[color];

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div
        className={cn(
          'rounded-full animate-spin',
          s.ring,
          c.border,
        )}
        style={{
          animationDuration: '0.8s',
        }}
      />
      {label && (
        <p className={cn('text-xs mt-2 font-medium', c.text)}>
          {label}
        </p>
      )}
    </div>
  );
}

/**
 * Spinner avec 3 points rebondissants (style Academia Helm)
 * Alternative au spinner rotatif pour les zones de contenu
 */
export function BouncingDots({
  size = 'md',
  color = 'blue',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  color?: SpinnerColor;
  className?: string;
}) {
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2';
  const colors: Record<SpinnerColor, string> = {
    navy: 'bg-[#0b2f73]',
    blue: 'bg-[#1d4fa5]',
    gold: 'bg-[#f5b335]',
    white: 'bg-white',
    muted: 'bg-slate-400',
  };

  return (
    <div className={cn('flex items-center space-x-1', className)}>
      <div
        className={cn('rounded-full', dotSize, colors[color])}
        style={{ animation: 'academiaBounce 1.2s ease-in-out infinite', animationDelay: '0ms' }}
      />
      <div
        className={cn('rounded-full', dotSize, colors[color])}
        style={{ animation: 'academiaBounce 1.2s ease-in-out infinite', animationDelay: '150ms' }}
      />
      <div
        className={cn('rounded-full', dotSize, colors[color])}
        style={{ animation: 'academiaBounce 1.2s ease-in-out infinite', animationDelay: '300ms' }}
      />
    </div>
  );
}

/**
 * Spinner avec barre de progression linéaire
 * Pour les opérations de durée indéterminée dans les modules
 */
export function LinearProgress({
  color = 'blue',
  className,
}: {
  color?: SpinnerColor;
  className?: string;
}) {
  const gradients: Record<SpinnerColor, string> = {
    navy: 'from-[#0b2f73] via-[#1d4fa5] to-[#0b2f73]',
    blue: 'from-[#1d4fa5] via-[#4a8af4] to-[#1d4fa5]',
    gold: 'from-[#f5b335] via-[#ffd166] to-[#f5b335]',
    white: 'from-white/60 via-white to-white/60',
    muted: 'from-slate-300 via-slate-400 to-slate-300',
  };

  return (
    <div className={cn('w-full h-1 bg-gray-100 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full bg-gradient-to-r', gradients[color])}
        style={{
          animation: 'academiaShimmer 1.8s ease-in-out infinite',
          width: '40%',
        }}
      />
    </div>
  );
}
