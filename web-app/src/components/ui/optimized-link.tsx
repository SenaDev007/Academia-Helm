/**
 * ============================================================================
 * OPTIMIZED LINK - COMPOSANT LINK OPTIMISÉ POUR PERFORMANCE
 * ============================================================================
 * 
 * ✅ Composant Link optimisé avec prefetching intelligent
 * - Prefetch automatique pour les liens visibles
 * - Prefetch désactivé pour les liens non critiques
 * - Optimisation du chargement des pages
 */

'use client';

import Link from 'next/link';
import { ReactNode, MouseEvent } from 'react';

interface OptimizedLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean; // ✅ Contrôle explicite du prefetch
  priority?: 'high' | 'low' | 'auto'; // ✅ Priorité de chargement
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  [key: string]: any;
}

/**
 * ✅ Link optimisé avec prefetching intelligent
 * 
 * Usage:
 * - Links critiques (navigation principale): <OptimizedLink href="/app/students" priority="high" />
 * - Links secondaires: <OptimizedLink href="/app/settings" prefetch={false} />
 */
export function OptimizedLink({
  href,
  children,
  className,
  prefetch = true, // ✅ Prefetch par défaut pour les liens visibles
  priority = 'auto',
  onClick,
  ...props
}: OptimizedLinkProps) {
  // ✅ Désactiver prefetch pour les liens non critiques ou externes
  const shouldPrefetch = prefetch && !href.startsWith('http') && priority !== 'low';

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch}
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </Link>
  );
}
