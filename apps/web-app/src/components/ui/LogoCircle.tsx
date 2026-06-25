/**
 * ============================================================================
 * LOGO CIRCLE — Logo circulaire avec jeu lumineux
 * ============================================================================
 *
 * Composant réutilisable qui affiche un logo dans un cercle parfait
 * avec un effet lumineux appliqué directement sur le cercle du logo :
 *   - Halo doré pulsant sur le cercle du logo
 *   - Bordure dorée pulsante sur le cercle du logo
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
  const logoSize = size;

  return (
    <div className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
      {/* Halo doré pulsant */}
      {animated && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: `0 0 20px 4px ${GOLD}30, 0 0 40px 8px ${GOLD}10`,
            animation: 'academiaPulse 3s ease-in-out infinite',
          }}
        />
      )}

      {/* Cadre circulaire avec overflow hidden — masque les logos carrés */}
      <div
        className="relative z-10 flex items-center justify-center rounded-full overflow-hidden"
        style={{ width: size, height: size }}
      >
        {hasLogo ? (
          <Image
            src={logoUrl!}
            alt={displayAlt}
            width={logoSize}
            height={logoSize}
            className="object-cover"
            style={animated ? { animation: 'academiaPulse 3s ease-in-out infinite' } : undefined}
            priority
          />
        ) : (
          <Image
            src={BRAND.logoPath}
            alt={displayAlt}
            width={logoSize}
            height={logoSize}
            className="object-cover"
            style={animated ? { animation: 'academiaPulse 3s ease-in-out infinite' } : undefined}
            priority
          />
        )}
      </div>
    </div>
  );
}
