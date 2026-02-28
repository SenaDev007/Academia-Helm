/**
 * ============================================================================
 * MODULE CONTENT AREA - ZONE DE CONTENU STANDARDISÉE
 * ============================================================================
 * 
 * Zone de contenu standardisée pour tous les modules
 * Supporte : Table, Cards, Graphiques, Formulaires
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ContentLayout = 'table' | 'cards' | 'grid' | 'chart' | 'form' | 'custom';

export interface ModuleContentAreaProps {
  /** Contenu principal */
  children: ReactNode;
  /** Layout du contenu */
  layout?: ContentLayout;
  /** Filtres persistants (affichés en haut) */
  filters?: ReactNode;
  /** Actions de la zone de contenu (recherche, export, etc.) */
  toolbar?: ReactNode;
  /** Pagination (si applicable) */
  pagination?: ReactNode;
  /** Chargement */
  isLoading?: boolean;
  /** Message d'erreur */
  error?: string | null;
  /** Message vide */
  emptyMessage?: string;
  /** Style personnalisé */
  className?: string;
}

export default function ModuleContentArea({
  children,
  layout = 'table',
  filters,
  toolbar,
  pagination,
  isLoading = false,
  error,
  emptyMessage,
  className,
}: ModuleContentAreaProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Filtres persistants */}
      {filters && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 sm:p-6 shadow-sm">
          {filters}
        </div>
      )}

      {/* Toolbar (recherche, export, etc.) */}
      {toolbar && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 sm:px-6 sm:py-4 shadow-sm">
          {toolbar}
        </div>
      )}

      {/* Zone de contenu principale */}
      <div
        className={cn(
          'bg-white rounded-lg border border-gray-200 shadow-sm',
          layout === 'table' && 'overflow-hidden p-4 sm:p-5 lg:p-6',
          layout === 'default' && 'p-5 sm:p-6 lg:p-8',
          layout === 'cards' && 'p-5 sm:p-6 lg:p-8',
          layout === 'grid' && 'p-5 sm:p-6 lg:p-8',
          layout === 'chart' && 'p-5 sm:p-6 lg:p-8',
          layout === 'form' && 'p-5 sm:p-6 lg:p-8',
        )}
      >
        {/* État de chargement */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Chargement...</p>
            </div>
          </div>
        )}

        {/* Message d'erreur */}
        {error && !isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-sm font-medium text-red-600 mb-1">Erreur</p>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          </div>
        )}

        {/* Message vide */}
        {!isLoading && !error && emptyMessage && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-600">{emptyMessage}</p>
          </div>
        )}

        {/* Contenu principal */}
        {!isLoading && !error && (
          <div
            className={cn(
              layout === 'table' && 'overflow-x-auto',
              layout === 'cards' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
              layout === 'grid' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4',
            )}
          >
            {children}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 sm:p-6 shadow-sm">
          {pagination}
        </div>
      )}
    </div>
  );
}

