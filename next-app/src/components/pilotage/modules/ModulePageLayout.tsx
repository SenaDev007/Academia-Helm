/**
 * ============================================================================
 * MODULE PAGE LAYOUT - STRUCTURE COMMUNE
 * ============================================================================
 * 
 * Layout commun pour toutes les pages de modules
 * 
 * Structure :
 * [Titre du module]        [Actions principales]
 * 
 * [Filtres contextuels]
 * --------------------------------------------
 * [Table / Vue principale]
 * 
 * [Détails / Panneau secondaire]
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';

interface ModulePageLayoutProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}

export default function ModulePageLayout({
  title,
  subtitle,
  badge,
  actions,
  filters,
  children,
}: ModulePageLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-bold text-navy-900">{title}</h1>
            {badge && badge}
          </div>
          {subtitle && (
            <p className="text-gray-600">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>

      {/* Filtres */}
      {filters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {filters}
        </div>
      )}

      {/* Contenu principal */}
      <div>
        {children}
      </div>
    </div>
  );
}

