/**
 * ============================================================================
 * OPTIMIZE IMPORTS - UTILITAIRES POUR OPTIMISER LES IMPORTS
 * ============================================================================
 * 
 * ✅ Utilitaires pour optimiser les imports et réduire la taille des bundles
 */

import React from 'react';

/**
 * ✅ Import optimisé de lucide-react
 * Utilise tree-shaking pour ne charger que les icônes nécessaires
 */
export function importIcon(iconName: string) {
  return import(`lucide-react`).then(mod => mod[iconName]);
}

/**
 * ✅ Lazy load d'un composant avec loading state
 */
export function lazyLoadComponent<T = any>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  loadingMessage = 'Chargement...'
) {
  return import('next/dynamic').then(({ default: dynamic }) =>
    dynamic(importFn, {
      loading: () => (
        React.createElement('div', { className: 'flex items-center justify-center p-8' },
          React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' }),
          React.createElement('span', { className: 'ml-3 text-gray-600' }, loadingMessage)
        )
      ),
      ssr: false, // ✅ Désactiver SSR pour les composants lourds
    })
  );
}

/**
 * ✅ Debounce pour optimiser les appels API
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * ✅ Throttle pour limiter la fréquence des appels
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
