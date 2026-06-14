/**
 * ============================================================================
 * LOGO CIRCLE — Logo circulaire avec jeu lumineux
 * ============================================================================
 *
 * Composant réutilisable qui affiche un logo dans un cercle parfait
 * avec un effet lumineux identique à la page de loading :
 *   - Halo doré pulsant (academiaPulse)
 *   - Anneau rotatif doré (academiaOrbit)
 *   - Logo pulsant à l'intérieur
 *
 * Utilisé sur les pages de login, forgot-password, school-portal, etc.
 *
 * Palette Academia Helm :
 *   Navy  #0b2f73  |  Blue  #1d4fa5  |  Gold  #f5b335
 * ============================================================================
 */

'use client';

import Image from 'next/image';
import { BRAND } from '@/lib/brand';

const GOLD = '#f5b335';

interface LogoCircleProps {
  /** URL du logo (si null, utilise le logo par défaut Academia Helm) */
  logoUrl?: string | null;
  /** Texte alternatif pour le logo */
  alt?: string;
  /** Taille du cercle en pixels (défaut : 80) */
  size?: number;
  /** Active l'animation lumineuse (défaut : true) */
  animated?: boolean;
  /** Classe CSS supplémentaire sur le conteneur */
  className?: string;
}

export default function LogoCircle({
  logoUrl,
  alt,
  size = 80,
  animated = true,
  className = '',
}: LogoCircleProps) {
  const hasLogo = !!logoUrl;
  const displayAlt = alt || BRAND.name;
  const logoSize = Math.round(size * 0.65);

  return (
    <div className={`relative flex justify-center ${className}`}>
      {/* Halo doré pulsant */}
      {animated && (
        <div
          className="absolute inset-0 -m-6 rounded-full blur-xl"
          style={{
            background: `radial-gradient(circle, ${GOLD}12, transparent 70%)`,
            animation: 'academiaPulse 3s ease-in-out infinite',
          }}
        />
      )}

      {/* Anneau rotatif doré */}
      {animated && (
        <div
          className="absolute inset-0 -m-3 rounded-full border-2 border-white/10 border-t-[#f5b335]"
          style={{ animation: 'academiaOrbit 1.2s linear infinite' }}
        />
      )}

      {/* Conteneur circulaire pour le logo */}
      <div
        className="relative z-10 flex items-center justify-center overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          background: hasLogo ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.10)',
          border: `2px solid ${hasLogo ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.25)'}`,
          backdropFilter: 'blur(4px)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.3)${hasLogo ? `, 0 0 0 1px ${GOLD}20` : ''}`,
        }}
      >
        {hasLogo ? (
          <Image
            src={logoUrl!}
            alt={displayAlt}
            width={logoSize}
            height={logoSize}
            className="rounded-full object-cover"
            style={animated ? { animation: 'academiaPulse 3s ease-in-out infinite' } : undefined}
            priority
          />
        ) : (
          <Image
            src={BRAND.logoPath}
            alt={displayAlt}
            width={logoSize}
            height={logoSize}
            className="rounded-full object-contain"
            style={animated ? { animation: 'academiaPulse 3s ease-in-out infinite' } : undefined}
            priority
          />
        )}
      </div>
    </div>
  );
}
