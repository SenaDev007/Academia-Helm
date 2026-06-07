/**
 * ============================================================================
 * DIRECTOR DASHBOARD
 * ============================================================================
 * 
 * Dashboard pour le DIRECTEUR (pilotage pédagogique + administratif)
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

export function DirectorDashboard() {
  const { context } = useTenantContext();
  const [kpis, setKpis] = useState<DashboardKpi[]>([]);
  const [criticalAbsences, setCriticalAbsences] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!context) return;

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
      const cachedData = offlineCacheService.getCachedDashboardData('DIRECTOR');
      if (cachedData && offlineCacheService.isOffline()) {
        setKpis(cachedData.kpis || []);
        setCriticalAbsences(cachedData.criticalAbsences || null);
        setIsLoading(false);
        return;
      }

      // Charger depuis l'API
      const [kpisData, absencesData] = await Promise.all([
        dashboardService.getDirectorKpis(
          context.tenant.id,
          context.academicYear?.id
        ),
        dashboardService.getCriticalAbsences(
          context.tenant.id,
          context.academicYear?.id
        ),
      ]);

      setKpis(kpisData);
      setCriticalAbsences(absencesData);

      // Mettre en cache
      offlineCacheService.cacheDashboardData('DIRECTOR', {
        kpis: kpisData,
        criticalAbsences: absencesData,
      });
    } catch (error) {
      console.error('Error loading director dashboard data:', error);
      
      const cachedData = offlineCacheService.getCachedDashboardData('DIRECTOR');
      if (cachedData) {
        setKpis(cachedData.kpis || []);
        setCriticalAbsences(cachedData.criticalAbsences || null);
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
            <h1 className="text-3xl font-bold">Dashboard Directeur</h1>
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

      {/* KPIs Pédagogiques */}
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

      {/* Absences Critiques */}
      {criticalAbsences && criticalAbsences.count > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Absences Critiques</h2>
          <AlertCard
            title="Absences à traiter"
            count={criticalAbsences.count}
            level="warning"
          />
        </div>
      )}

      {/* ORION Summary */}
      {context.orionSummary && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">ORION - Alertes Pédagogiques</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Alertes Critiques</p>
              <p className="text-2xl font-bold">{context.orionSummary.criticalAlerts}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Incohérences</p>
              <p className="text-2xl font-bold">{context.orionSummary.dataInconsistencies}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions Rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Élèves</h3>
          <p className="text-gray-600">Gestion des élèves</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Enseignants</h3>
          <p className="text-gray-600">Gestion des enseignants</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Examens</h3>
          <p className="text-gray-600">Gestion des examens</p>
        </div>
      </div>
    </div>
  );
}
