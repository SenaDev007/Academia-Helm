'use client';

import NextImage from 'next/image';
import { cn } from '@/lib/utils';

type PlatformImageProps = {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  /** LCP / hero */
  priority?: boolean;
};

/**
 * Affichage image plateforme :
 * - `data:` / `blob:` → balise native (Next/Image ne optimise pas les data URL).
 * - URL absolue externe → Next/Image en `unoptimized` (évite d’énumérer tous les domaines).
 * - chemin relatif `/...` → Next/Image optimisé (AVIF/WebP selon next.config).
 */
export function PlatformImage({
  src,
  alt,
  width = 64,
  height = 64,
  className,
  priority = false,
}: PlatformImageProps) {
  if (!src) return null;

  const isData = src.startsWith('data:');
  const isBlob = src.startsWith('blob:');
  /** URL absolue hors origine app : pas de remotePatterns exhaustifs → livraison telle quelle. */
  const isAbsoluteRemote = /^https?:\/\//i.test(src);

  if (isData || isBlob) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn(className)}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
      />
    );
  }

  return (
    <NextImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn(className)}
      priority={priority}
      unoptimized={isAbsoluteRemote}
      loading={priority ? undefined : 'lazy'}
    />
  );
}
