'use client';

import NextImage from 'next/image';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

type PlatformImageProps = {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  /** LCP / hero — charge en priorité */
  priority?: boolean;
  /** Qualité de l'image (1-100, défaut 75) */
  quality?: number;
  /** fill mode — l'image remplit son conteneur parent */
  fill?: boolean;
  /** object-fit CSS */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
  /** Tailles responsives — aide Next.js à générer le bon srcset */
  sizes?: string;
  /** Placeholder blur — affiche un flou pendant le chargement */
  placeholder?: 'blur' | 'empty';
  /** URL de fallback si l'image échoue à charger */
  fallbackSrc?: string;
  /** Callback quand l'image est chargée */
  onLoad?: () => void;
  /** Style inline supplémentaire */
  style?: React.CSSProperties;
};

/**
 * ── PlatformImage — Composant Image optimisé pour toute la plateforme ──
 *
 * Stratégie d'optimisation PageSpeed :
 *
 * 1. Images distantes (https://) :
 *    - Next.js les optimise automatiquement via remotePatterns (AVIF/WebP)
 *    - Plus besoin de unoptimized=true — les images sont compressées à la volée
 *
 * 2. Images locales (/images/, /uploads/) :
 *    - Optimisées par Next.js Image (AVIF/WebP, redimensionnement automatique)
 *    - Chargées en lazy par défaut, eager si priority=true
 *
 * 3. Data URLs / Blob URLs :
 *    - Servies via <img> natif (Next/Image ne peut pas les optimiser)
 *    - Loading lazy + decoding async
 *
 * 4. Fallback intelligent :
 *    - Si l'image échoue à charger, un placeholder élégant est affiché
 *    - Option fallbackSrc pour remplacer par une image de secours
 *
 * 5. Cache-Control :
 *    - Les headers dans next.config.js garantissent un cache de 1 an
 *    - immutable + max-age=31536000 pour les images statiques et uploadées
 */
export function PlatformImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 75,
  fill = false,
  objectFit = 'cover',
  sizes,
  placeholder = 'empty',
  fallbackSrc,
  onLoad,
  style,
}: PlatformImageProps) {
  const [imgError, setImgError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const handleError = useCallback(() => {
    if (fallbackSrc && !useFallback) {
      setUseFallback(true);
    } else {
      setImgError(true);
    }
  }, [fallbackSrc, useFallback]);

  // Pas de source → placeholder
  if (!src) {
    return (
      <div
        className={cn('flex items-center justify-center bg-slate-100', className)}
        style={{
          width: fill ? undefined : width,
          height: fill ? undefined : height,
          ...style,
        }}
        role="img"
        aria-label={alt}
      >
        <svg
          className="h-1/3 w-1/3 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
          />
        </svg>
      </div>
    );
  }

  // Erreur de chargement → placeholder
  if (imgError) {
    return (
      <div
        className={cn('flex items-center justify-center bg-slate-100', className)}
        style={{
          width: fill ? undefined : width,
          height: fill ? undefined : height,
          ...style,
        }}
        role="img"
        aria-label={alt}
      >
        <svg
          className="h-1/3 w-1/3 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
          />
        </svg>
      </div>
    );
  }

  const effectiveSrc = useFallback && fallbackSrc ? fallbackSrc : src;

  // Data URLs et Blob URLs → <img> natif (Next/Image ne peut pas les optimiser)
  const isData = effectiveSrc.startsWith('data:');
  const isBlob = effectiveSrc.startsWith('blob:');

  if (isData || isBlob) {
    return (
      <img
        src={effectiveSrc}
        alt={alt}
        width={width}
        height={height}
        className={cn(className)}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        style={{ objectFit, ...style }}
        onError={handleError}
        onLoad={onLoad}
      />
    );
  }

  // Toutes les autres images → Next/Image optimisé (AVIF/WebP, srcset, etc.)
  return (
    <NextImage
      src={effectiveSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      className={cn(className)}
      priority={priority}
      quality={quality}
      sizes={sizes}
      placeholder={placeholder}
      style={{ objectFit, ...style }}
      loading={priority ? undefined : 'lazy'}
      onError={handleError}
      onLoad={onLoad}
    />
  );
}
