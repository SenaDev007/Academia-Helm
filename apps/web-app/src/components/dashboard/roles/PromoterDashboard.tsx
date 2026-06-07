/**
 * ============================================================================
 * PROMOTER DASHBOARD - SUPER DASHBOARD
 * ============================================================================
 * 
 * Dashboard pour le PROMOTEUR (fusion de tous les dashboards)
 * Accès à tous les modules, tous les niveaux scolaires, tous les KPI
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useTenantContext } from '@/contexts/TenantContext';
import { dashboardService, DashboardKpi } from '@/services/dashboard.service';
import { offlineCacheService } from '@/services/offline-cache.service';
import { KpiCard } from '../widgets/KpiCard';
import { AlertCard } from '../widgets/AlertCard';

export function PromoterDashboard() {
  const { context } = useTenantContext();
  const [kpis, setKpis] = useState<DashboardKpi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!context) return;

    // Écouter les changements de statut réseau
    const cleanup = offlineCacheService.onNetworkStatusChange((online) => {
      setIsOffline(!online);
    });

    loadDashboardData();

    return cleanup;
  }, [context]);

  const loadDashboardData = async () => {
    if (!context) return;

    setIsLoading(true);

    try {
      // Essayer le cache d'abord
      const cachedData = offlineCacheService.getCachedDashboardData('PROMOTER');
      if (cachedData && offlineCacheService.isOffline()) {
        setKpis(cachedData.kpis || []);
        setIsLoading(false);
        return;
      }

      // Charger depuis l'API
      const data = await dashboardService.getPromoterKpis(
        context.tenant.id,
        context.academicYear?.id
      );

      setKpis(data);

      // Mettre en cache
      offlineCacheService.cacheDashboardData('PROMOTER', { kpis: data });
    } catch (error) {
      console.error('Error loading promoter dashboard data:', error);
      
      // Essayer le cache en dernier recours
      const cachedData = offlineCacheService.getCachedDashboardData('PROMOTER');
      if (cachedData) {
        setKpis(cachedData.kpis || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!context) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Promoteur</h1>
            <p className="text-gray-600 mt-2">
              {context.tenant.school?.name || context.tenant.name}
              {context.academicYear && ` - ${context.academicYear.name}`}
            </p>
          </div>
          {isOffline && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded">
              Mode hors ligne
            </div>
          )}
        </div>
      </div>

      {/* KPIs Principaux */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {kpis.map((kpi, index) => (
            <KpiCard
              key={index}
              title={kpi.title}
              value={kpi.value}
              subtitle={kpi.subtitle}
              trend={kpi.trend}
            />
          ))}
        </div>
      )}

      {/* ORION Summary */}
      {context.orionSummary && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">ORION - Alertes Critiques</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Alertes Critiques</p>
              <p className="text-2xl font-bold">{context.orionSummary.criticalAlerts}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Incohérences de Données</p>
              <p className="text-2xl font-bold">{context.orionSummary.dataInconsistencies}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modules d'Accès */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Finance</h3>
          <p className="text-gray-600">Gestion financière complète</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Pédagogie</h3>
          <p className="text-gray-600">Gestion pédagogique</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Paramètres</h3>
          <p className="text-gray-600">Configuration complète</p>
        </div>
      </div>
    </div>
  );
}
