/**
 * ============================================================================
 * INLINE SPINNER - PREMIUM BRANDED ACADEMIA HELM
 * ============================================================================
 *
 * Composant spinner unifié pour TOUTE l'application.
 * Refonte premium avec :
 * - Effet traînée gradient branded (navy → blue → gold)
 * - Noyau lumineux avec glow doré
 * - Détection mobile pour animations légères CSS-only
 * - Variante SVG orbitale pour les contextes premium
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 *
 * @example
 * <InlineSpinner size="sm" />              // Petit spinner dans un bouton
 * <InlineSpinner size="md" color="gold" /> // Spinner doré moyen
 * <InlineSpinner size="lg" withLabel />    // Grand spinner avec texte
 */

'use client';

import { useEffect, useState } from 'react';
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

const sizeMap: Record<SpinnerSize, { ring: string; core: string; glow: string }> = {
  xs: { ring: 'h-3 w-3 border-[1.5px]', core: 'h-1 w-1', glow: '' },
  sm: { ring: 'h-4 w-4 border-2', core: 'h-1.5 w-1.5', glow: '' },
  md: { ring: 'h-6 w-6 border-2', core: 'h-2 w-2', glow: 'shadow-[0_0_6px_1px_rgba(245,179,53,0.3)]' },
  lg: { ring: 'h-8 w-8 border-[3px]', core: 'h-2.5 w-2.5', glow: 'shadow-[0_0_8px_2px_rgba(245,179,53,0.4)]' },
  xl: { ring: 'h-12 w-12 border-4', core: 'h-3 w-3', glow: 'shadow-[0_0_10px_3px_rgba(245,179,53,0.5)]' },
};

const colorMap: Record<SpinnerColor, { border: string; core: string; text: string }> = {
  navy: { border: 'border-[#0b2f73]/15 border-t-[#0b2f73]', core: 'bg-[#0b2f73]', text: 'text-[#0b2f73]' },
  blue: { border: 'border-[#1d4fa5]/15 border-t-[#1d4fa5]', core: 'bg-[#1d4fa5]', text: 'text-[#1d4fa5]' },
  gold: { border: 'border-[#f5b335]/15 border-t-[#f5b335]', core: 'bg-[#f5b335]', text: 'text-[#f5b335]' },
  white: { border: 'border-white/15 border-t-white', core: 'bg-white', text: 'text-white' },
  muted: { border: 'border-slate-200 border-t-slate-400', core: 'bg-slate-400', text: 'text-slate-500' },
};

/**
 * Spinner premium avec noyau lumineux branded
 *
 * L'anneau externe tourne avec un gradient coloré,
 * le noyau central pulse avec un effet glow doré.
 */
export function InlineSpinner({
  size = 'md',
  color = 'blue',
  label,
  className,
}: InlineSpinnerProps) {
  const s = sizeMap[size];
  const c = colorMap[color];
  // Mobile detection for lighter animation
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  // On mobile: use simpler animation without glow to preserve performance
  if (isMobile) {
    return (
      <div className={cn('flex flex-col items-center justify-center', className)}>
        <div
          className={cn('rounded-full', s.ring, c.border)}
          style={{ animation: 'academiaOrbit 0.9s linear infinite' }}
        />
        {label && (
          <p className={cn('text-xs mt-2 font-medium', c.text)}>
            {label}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="relative">
        {/* Outer ring with branded spin */}
        <div
          className={cn('rounded-full', s.ring, c.border)}
          style={{ animation: 'academiaOrbit 0.9s linear infinite' }}
        />
        {/* Core dot with glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn('rounded-full', c.core, s.core, s.glow)}
            style={{ animation: 'academiaGlow 1.8s ease-in-out infinite' }}
          />
        </div>
      </div>
      {label && (
        <p className={cn('text-xs mt-2 font-medium', c.text)}>
          {label}
        </p>
      )}
    </div>
  );
}

/**
 * Points ondulants premium (style Academia Helm)
 *
 * Remplace les bouncing dots basiques par un effet de vague
 * avec transition de couleurs Navy → Blue → Gold.
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
  const gap = size === 'sm' ? 'space-x-1' : size === 'lg' ? 'space-x-1.5' : 'space-x-1';
  const colors: Record<SpinnerColor, string> = {
    navy: 'bg-[#0b2f73]',
    blue: 'bg-[#1d4fa5]',
    gold: 'bg-[#f5b335]',
    white: 'bg-white',
    muted: 'bg-slate-400',
  };

  // Branded wave colors for dots: each dot has a slightly different hue
  const brandedColors = [
    colors[color], // Primary color
    color === 'blue' ? 'bg-[#1648a0]' : color === 'navy' ? 'bg-[#0a2860]' : colors[color],
    color === 'blue' ? 'bg-[#1d4fa5]' : color === 'navy' ? 'bg-[#0b2f73]' : colors[color],
  ];

  return (
    <div className={cn('flex items-center', gap, className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn('rounded-full', dotSize, brandedColors[i])}
          style={{
            animation: 'academiaWaveDot 1.4s ease-in-out infinite',
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Barre de progression linéaire premium
 *
 * Flux gradient avec la palette Academia Helm.
 * Le gradient se déplace en boucle pour simuler
 * un chargement actif et dynamique.
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
          animation: 'academiaFlow 1.8s ease-in-out infinite',
          width: '40%',
        }}
      />
    </div>
  );
}

/**
 * Spinner orbital premium avec double anneau SVG
 *
 * Utilisé pour les contextes haut de gamme (ORION, SARA, dashboards).
 * Deux anneaux concentriques tournent en sens inverse avec
 * des traînées gradient branded.
 */
export function OrbitalSpinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dimension = size === 'sm' ? 32 : size === 'lg' ? 56 : 40;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  // Mobile: simpler CSS-only orbital
  if (isMobile) {
    return (
      <div className={cn('relative', className)} style={{ width: dimension, height: dimension }}>
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-[#1d4fa5]/10 border-t-[#1d4fa5]"
          style={{ animation: 'academiaOrbit 1.2s linear infinite' }}
        />
        {/* Core */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-2 w-2 rounded-full bg-[#f5b335]"
            style={{ animation: 'academiaPulse 1.5s ease-in-out infinite' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} style={{ width: dimension, height: dimension }}>
      {/* Outer ring - rotates clockwise */}
      <svg
        className="absolute inset-0"
        width={dimension}
        height={dimension}
        style={{ animation: 'academiaOrbit 2s linear infinite' }}
      >
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={dimension / 2 - 3}
          fill="none"
          stroke="url(#orbitalGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${dimension * 0.8} ${dimension * 2}`}
        />
        <defs>
          <linearGradient id="orbitalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0b2f73" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#1d4fa5" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f5b335" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>
      {/* Inner ring - rotates counter-clockwise */}
      <svg
        className="absolute inset-0"
        width={dimension}
        height={dimension}
        style={{ animation: 'academiaOrbitReverse 3s linear infinite' }}
      >
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={dimension / 2 - 7}
          fill="none"
          stroke="url(#orbitalGradientInner)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={`${dimension * 0.5} ${dimension * 2}`}
        />
        <defs>
          <linearGradient id="orbitalGradientInner" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f5b335" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#f5b335" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1d4fa5" stopOpacity="0.3" />
          </linearGradient>
        </defs>
      </svg>
      {/* Core glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-full bg-[#f5b335]"
          style={{
            width: dimension * 0.15,
            height: dimension * 0.15,
            animation: 'academiaGlow 2s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}
