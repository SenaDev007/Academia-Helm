/**
 * AppIcon Component
 * 
 * Composant centralisé pour toutes les icônes d'Academia Hub
 * 
 * CHARTE ICONOGRAPHIQUE OFFICIELLE v1.0
 * 
 * POSITIONNEMENT :
 * - Institutionnel
 * - Premium
 * - Sobre
 * - Intemporel
 * - Autorité silencieuse
 * 
 * RÈGLE D'OR :
 * Une icône = une fonction. Jamais une émotion.
 * 
 * STYLE :
 * - Outline uniquement
 * - Stroke : 1.5px (standard Lucide)
 * - Couleur : héritée du texte (currentColor)
 * - Dégradés : ❌ Interdits
 * - Animations : ❌ (sauf feedback UX rare)
 */

'use client';

import { getIcon, IconName, IconSize, IconSizes } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface AppIconProps {
  /**
   * Nom de l'icône (doit être dans IconMapping)
   */
  name: IconName;
  
  /**
   * Taille de l'icône (tailles officielles)
   * @default "menu"
   */
  size?: IconSize | number;
  
  /**
   * Classes CSS supplémentaires
   */
  className?: string;
  
  /**
   * Couleur personnalisée (override className)
   */
  color?: string;
  
  /**
   * Stroke width (1.5px par défaut selon charte)
   * @default 1.5
   */
  strokeWidth?: number;
  
  /**
   * Accessibilité : label pour screen readers
   */
  'aria-label'?: string;
  
  /**
   * Accessibilité : hidden pour les icônes décoratives
   */
  'aria-hidden'?: boolean;
}

/**
 * Composant AppIcon
 * 
 * Affiche une icône premium et cohérente selon la charte officielle
 */
export default function AppIcon({
  name,
  size = 'menu',
  className,
  color,
  strokeWidth = 1.5, // Standard Lucide selon charte
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden = false,
}: AppIconProps) {
  const Icon = getIcon(name);
  
  // Calculer la taille en pixels
  const iconSize = typeof size === 'number' ? size : IconSizes[size];
  
  return (
    <Icon
      size={iconSize}
      strokeWidth={strokeWidth}
      className={cn(
        // Style par défaut : hérite de la couleur du texte (currentColor)
        'text-current',
        // Permet l'override via className
        className
      )}
      style={color ? { color } : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden || !ariaLabel ? "true" : undefined}
    />
  );
}
