/**
 * ============================================================================
 * BREADCRUMBS - FIL D'ARIANE
 * ============================================================================
 * 
 * Composant standard pour la navigation par fil d'Ariane
 * 
 * ============================================================================
 */

'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export function Breadcrumbs({ items, showHome = true, className }: BreadcrumbsProps) {
  const allItems = showHome
    ? [{ label: 'Accueil', href: '/app' }, ...items]
    : items;

  return (
    <nav className={cn('flex items-center space-x-2 text-sm', className)}>
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        const content = (
          <span
            className={cn(
              'flex items-center',
              isLast ? 'text-gray-900 font-medium' : 'text-gray-600',
            )}
          >
            {index === 0 && showHome && (
              <Home className="w-4 h-4 mr-1" />
            )}
            {item.label}
          </span>
        );

        return (
          <div key={index} className="flex items-center">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-gray-900">
                {content}
              </Link>
            ) : (
              content
            )}
            {!isLast && (
              <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
