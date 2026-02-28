/**
 * ============================================================================
 * MODULE HEADER - COMPOSANT STANDARDISÉ
 * ============================================================================
 * 
 * Header obligatoire pour tous les modules
 * Contient : titre, description métier, KPI rapides, actions principales
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import AppIcon from '@/components/ui/AppIcon';

export interface ModuleKPI {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export interface ModuleHeaderProps {
  /** Nom du module */
  title: string;
  /** Description métier courte */
  description?: string;
  /** Icône du module */
  icon?: string;
  /** Badge optionnel (statut, version, etc.) */
  badge?: ReactNode;
  /** KPI clés à afficher (max 4) */
  kpis?: ModuleKPI[];
  /** Actions principales (boutons) */
  actions?: ReactNode;
  /** Contenu personnalisé optionnel */
  customContent?: ReactNode;
}

export default function ModuleHeader({
  title,
  description,
  icon,
  badge,
  kpis = [],
  actions,
  customContent,
}: ModuleHeaderProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header principal */}
      <div className="px-6 py-5 sm:px-8 sm:py-5 border-b border-gray-200">
        <div className="flex items-start justify-between">
          {/* Titre et description */}
          <div className="flex items-start space-x-3 flex-1">
            {icon && (
              <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <AppIcon name={icon} size="lg" className="text-blue-600" />
                </div>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {badge && <div className="flex-shrink-0">{badge}</div>}
              </div>
              {description && (
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              )}
            </div>
          </div>

          {/* Actions principales */}
          {actions && (
            <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* KPI rapides */}
      {kpis.length > 0 && (
        <div className="px-6 py-5 sm:px-8 sm:py-5 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, index) => (
              <div
                key={index}
                className="bg-white rounded-md border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    {kpi.label}
                  </span>
                  {kpi.icon && (
                    <AppIcon name={kpi.icon} size="sm" className="text-gray-400" />
                  )}
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{kpi.value}</span>
                  {kpi.trend && kpi.trendValue && (
                    <span
                      className={`text-xs font-medium ${
                        kpi.trend === 'up'
                          ? 'text-green-600'
                          : kpi.trend === 'down'
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'}{' '}
                      {kpi.trendValue}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contenu personnalisé */}
      {customContent && (
        <div className="px-6 py-5 sm:px-8">{customContent}</div>
      )}
    </div>
  );
}

