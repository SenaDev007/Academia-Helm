/**
 * ============================================================================
 * MODULE HEADER - COMPOSANT STANDARDISÉ (PREMIUM UPGRADE)
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
import { cn } from '@/lib/utils';

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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Header principal avec dégradé subtil */}
      <div className="px-6 py-6 sm:px-8 sm:py-7 bg-gradient-to-br from-white via-white to-indigo-50/30 border-b border-gray-100 relative">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          {icon && <AppIcon name={icon as any} size="massive" className="text-indigo-900" />}
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative">
          {/* Titre et description */}
          <div className="flex items-start space-x-5 flex-1">
            {icon && (
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <AppIcon name={icon as any} size="dashboard" className="text-white" />
                </div>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-3 mb-1.5">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h1>
                {badge && <div className="flex-shrink-0">{badge}</div>}
              </div>
              {description && (
                <p className="text-base text-gray-500 font-medium max-w-2xl">{description}</p>
              )}
            </div>
          </div>

          {/* Actions principales */}
          {actions && (
            <div className="flex items-center gap-3 flex-wrap">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* KPI rapides stylisés */}
      {kpis.length > 0 && (
        <div className="px-6 py-6 sm:px-8 bg-gray-50/50 border-b border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {kpis.map((kpi, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm transition-transform hover:-translate-y-1 hover:border-indigo-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {kpi.label}
                  </span>
                  {kpi.icon && (
                    <div className="p-1.5 rounded-lg bg-indigo-50">
                      <AppIcon name={kpi.icon as any} size="action" className="text-indigo-500" />
                    </div>
                  )}
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-gray-900 tracking-tight">{kpi.value}</span>
                  {kpi.trend && kpi.trendValue && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full",
                        kpi.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 
                        kpi.trend === 'down' ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '•'}
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
        <div className="px-6 py-6 sm:px-8 border-t border-gray-100">{customContent}</div>
      )}
    </div>
  );
}
