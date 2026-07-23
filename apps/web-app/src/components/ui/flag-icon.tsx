/**
 * ============================================================================
 * FLAG ICON — Drapeaux nationaux en SVG (cross-platform)
 * ============================================================================
 *
 * Pourquoi ce composant existe :
 * Windows ne supporte PAS les emojis de drapeaux nationaux (🇫🇷🇬🇧) dans
 * Segoe UI Emoji — par décision politique de Microsoft. À la place, Windows
 * affiche le code pays à 2 lettres ("FR", "GB"). Sur macOS/Linux/mobile, les
 * drapeaux s'affichent correctement.
 *
 * Ce composant utilise des drapeaux SVG vectoriels qui s'affichent
 * IDENTIQUEMENT sur tous les OS (Windows, macOS, Linux, Android, iOS).
 *
 * Sources des SVG : drapeaux simplifiés selon les spécifications officielles.
 *
 * Usage :
 *   <FlagIcon code="FR" className="w-8 h-6" />
 *   <FlagIcon code="GB" className="w-8 h-6" />
 *   <FlagIcon code="BJ" className="w-8 h-6" />
 *   <FlagIcon code="CI" className="w-8 h-6" />
 *
 * Composant avec label intégré :
 *   <FlagIcon code="FR" withLabel /> → 🇫🇷 Francophone
 *   <FlagIcon code="GB" withLabel /> → 🇬🇧 Anglophone
 * ============================================================================
 */

'use client';

import { cn } from '@/lib/utils';

interface FlagIconProps {
  code: 'FR' | 'GB' | 'BJ' | 'CI' | string;
  className?: string;
  /** Affiche le drapeau seul (défaut) ou avec un label textuel à côté */
  withLabel?: boolean;
  /** Personnalise le label affiché à côté du drapeau */
  label?: string;
  /** Taille du drapeau : 'sm' (16px), 'md' (24px), 'lg' (40px), 'xl' (64px) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// ─── Drapeaux SVG (versions simplifiées mais fidèles) ──────────────────────

const FLAGS_SVG: Record<string, { svg: string; label: string }> = {
  // France : bleu-blanc-rouge vertical
  FR: {
    label: 'Francophone',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice">
      <rect width="20" height="40" fill="#0055A4"/>
      <rect x="20" width="20" height="40" fill="#FFFFFF"/>
      <rect x="40" width="20" height="40" fill="#EF4135"/>
    </svg>`,
  },
  // Royaume-Uni : Union Jack
  GB: {
    label: 'Anglophone',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice">
      <rect width="60" height="40" fill="#012169"/>
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" stroke-width="6"/>
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="3" clip-path="inset(0)"/>
      <path d="M30,0 V40 M0,20 H60" stroke="#FFFFFF" stroke-width="10"/>
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="6"/>
    </svg>`,
  },
  // Bénin : vert-jaune-rouge horizontal
  BJ: {
    label: 'Bénin',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice">
      <rect width="60" height="40" fill="#FCD116"/>
      <rect width="24" height="40" fill="#008751"/>
      <rect y="20" width="36" height="20" fill="#E8112D"/>
      <rect width="24" height="20" fill="#008751"/>
    </svg>`,
  },
  // Côte d'Ivoire : orange-blanc-vert vertical
  CI: {
    label: "Côte d'Ivoire",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice">
      <rect width="20" height="40" fill="#F77F00"/>
      <rect x="20" width="20" height="40" fill="#FFFFFF"/>
      <rect x="40" width="20" height="40" fill="#009E60"/>
    </svg>`,
  },
};

const SIZE_CLASSES: Record<NonNullable<FlagIconProps['size']>, string> = {
  sm: 'w-5 h-3.5',
  md: 'w-7 h-5',
  lg: 'w-12 h-8',
  xl: 'w-20 h-14',
};

export function FlagIcon({
  code,
  className,
  withLabel = false,
  label,
  size = 'md',
}: FlagIconProps) {
  const flag = FLAGS_SVG[code.toUpperCase()];
  if (!flag) {
    // Code non supporté → fallback sur le code en texte
    return (
      <span className={cn('inline-flex items-center', className)}>
        {code.toUpperCase()}
      </span>
    );
  }

  const sizeClass = SIZE_CLASSES[size];

  if (withLabel) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <span
          className={cn('inline-block rounded-sm overflow-hidden border border-gray-200 shadow-sm', sizeClass)}
          dangerouslySetInnerHTML={{ __html: flag.svg }}
        />
        <span className="font-medium text-gray-700">{label || flag.label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn('inline-block rounded-sm overflow-hidden border border-gray-200 shadow-sm', sizeClass, className)}
      dangerouslySetInnerHTML={{ __html: flag.svg }}
    />
  );
}

export default FlagIcon;
