'use client';

/**
 * ============================================================================
 * StudentAvatar — Photo élève avec fallback initiales
 * ============================================================================
 *
 * Affiche la photo de l'élève si photoUrl est disponible, sinon affiche
 * les initiales (première lettre du prénom + première lettre du nom).
 *
 * Variantes de taille :
 *   - sm : 32px (listes compactes)
 *   - md : 48px (cartes dashboard)
 *   - lg : 64px (page détail)
 *   - xl : 80px (en-tête principal)
 *
 * Variantes de couleur (fallback) :
 *   - blue : gradient bleu-violet (défaut, parent)
 *   - emerald : gradient vert (finance)
 *   - navy : gradient navy-gold (branding)
 * ============================================================================
 */

import Image from 'next/image';
import { useState } from 'react';

interface StudentAvatarProps {
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'blue' | 'emerald' | 'navy';
  className?: string;
}

const SIZE_MAP = {
  sm: { container: 'w-8 h-8', text: 'text-xs', img: 32 },
  md: { container: 'w-12 h-12', text: 'text-lg', img: 48 },
  lg: { container: 'w-16 h-16', text: 'text-2xl', img: 64 },
  xl: { container: 'w-20 h-20', text: 'text-3xl', img: 80 },
};

const VARIANT_MAP = {
  blue: 'bg-gradient-to-br from-blue-400 to-purple-500',
  emerald: 'bg-gradient-to-br from-emerald-400 to-teal-500',
  navy: 'bg-gradient-to-br from-[#0A2A5E] to-[#103E91]',
};

export default function StudentAvatar({
  firstName,
  lastName,
  photoUrl,
  size = 'md',
  variant = 'blue',
  className = '',
}: StudentAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeConfig = SIZE_MAP[size];
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';

  // Afficher la photo si disponible et pas d'erreur
  if (photoUrl && !imgError) {
    return (
      <div
        className={`${sizeConfig.container} rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/30 ${className}`}
      >
        <Image
          src={photoUrl}
          alt={`${firstName || ''} ${lastName || ''}`.trim() || 'Élève'}
          width={sizeConfig.img}
          height={sizeConfig.img}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback : initiales dans un cercle coloré
  return (
    <div
      className={`${sizeConfig.container} rounded-full ${VARIANT_MAP[variant]} flex items-center justify-center text-white font-bold ${sizeConfig.text} flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
