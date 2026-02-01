/**
 * Helpers SEO pour composants et pages
 * 
 * Fonctions utilitaires pour garantir l'optimisation SEO
 * dans tous les composants et pages
 */

import React from 'react';
import Image from 'next/image';
import type { ImageProps } from 'next/image';

/**
 * Wrapper pour Image avec alt text obligatoire
 * Garantit que toutes les images ont un alt text descriptif
 */
export function SEOImage({
  alt,
  ...props
}: ImageProps & { alt: string }) {
  if (!alt || alt.trim() === '') {
    console.warn('⚠️ SEO: Image sans alt text détectée. Ajoutez un alt text descriptif.');
  }
  
  return <Image alt={alt} {...props} />;
}

/**
 * Génère un title SEO optimisé
 */
export function generateSEOTitle(pageTitle: string, includeBrand: boolean = true): string {
  if (includeBrand && !pageTitle.includes('Academia Hub')) {
    return `${pageTitle} | Academia Hub`;
  }
  return pageTitle;
}

/**
 * Génère une description SEO optimisée
 */
export function generateSEODescription(
  baseDescription: string,
  maxLength: number = 160
): string {
  if (baseDescription.length > maxLength) {
    return baseDescription.substring(0, maxLength - 3) + '...';
  }
  return baseDescription;
}

/**
 * Valide les métadonnées SEO d'une page
 */
export function validateSEOMetadata(metadata: {
  title?: string;
  description?: string;
  keywords?: string[];
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!metadata.title || metadata.title.trim() === '') {
    errors.push('Title est requis');
  } else if (metadata.title.length > 60) {
    errors.push(`Title trop long (${metadata.title.length} caractères, max 60)`);
  }

  if (!metadata.description || metadata.description.trim() === '') {
    errors.push('Description est requise');
  } else if (metadata.description.length < 120) {
    errors.push(`Description trop courte (${metadata.description.length} caractères, min 120)`);
  } else if (metadata.description.length > 160) {
    errors.push(`Description trop longue (${metadata.description.length} caractères, max 160)`);
  }

  if (!metadata.keywords || metadata.keywords.length === 0) {
    errors.push('Keywords sont requis (minimum 3)');
  } else if (metadata.keywords.length < 3) {
    errors.push(`Pas assez de keywords (${metadata.keywords.length}, minimum 3)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Hook pour vérifier l'optimisation SEO en développement
 */
export function useSEOValidation(metadata: {
  title?: string;
  description?: string;
  keywords?: string[];
}) {
  if (process.env.NODE_ENV === 'development') {
    const validation = validateSEOMetadata(metadata);
    if (!validation.valid) {
      console.warn('⚠️ SEO Validation Errors:', validation.errors);
    }
  }
}

