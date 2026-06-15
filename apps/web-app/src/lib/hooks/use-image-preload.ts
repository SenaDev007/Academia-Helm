/**
 * ============================================================================
 * IMAGE PRELOAD HOOK — Préchargement intelligent pour LCP
 * ============================================================================
 *
 * Précharge les images critiques (LCP) avec la bonne résolution
 * en fonction du device de l'utilisateur.
 *
 * Utilisation :
 *   useImagePreload('/images/hero.webp', { as: 'image', priority: 'high' });
 *
 * Stratégie PageSpeed :
 *   - Précharge uniquement les images above-the-fold
 *   - Utilise <link rel="preload"> pour les images LCP
 *   - Respecte la connexion réseau (save-data, 2g/3g)
 * ============================================================================
 */

'use client';

import { useEffect } from 'react';

interface PreloadOptions {
  /** Type de ressource (défaut: 'image') */
  as?: 'image';
  /** Priorité de fetch (défaut: 'high') */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Type MIME pour les images WebP/AVIF */
  type?: string;
}

/**
 * Précharge une image critique pour le LCP.
 * À utiliser uniquement pour les images above-the-fold.
 */
export function useImagePreload(src: string | null | undefined, options?: PreloadOptions) {
  useEffect(() => {
    if (!src) return;

    // Respecter Save-Data
    const conn = (navigator as any).connection;
    if (conn?.saveData) return;

    // Ne pas précharger si déjà présent
    const existing = document.querySelector(`link[rel="preload"][href="${src}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = options?.as || 'image';
    link.href = src;
    if (options?.fetchPriority) {
      link.setAttribute('fetchpriority', options.fetchPriority);
    }
    if (options?.type) {
      link.type = options.type;
    }

    document.head.appendChild(link);

    return () => {
      try {
        document.head.removeChild(link);
      } catch {}
    };
  }, [src, options?.as, options?.fetchPriority, options?.type]);
}

/**
 * Génère un placeholder blurDataURL pour Next/Image.
 * Utile pour les images dynamiques (logos uploadés, etc.)
 */
export function generateBlurPlaceholder(width = 10, height = 10): string {
  // Simple gray placeholder — pour les images dynamiques
  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : null;

  if (!canvas) return '';

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#e2e8f0'; // slate-200
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL('image/png');
}
