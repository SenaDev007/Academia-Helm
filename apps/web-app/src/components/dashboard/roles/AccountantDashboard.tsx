/**
 * ============================================================================
 * ACCOUNTANT DASHBOARD
 * ============================================================================
 * 
 * Dashboard pour le COMPTABLE / SECRÉTAIRE-COMPTABLE (pilotage financier)
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useTenantContext } from '@/contexts/TenantContext';
import { dashboardService, DashboardKpi } from '@/services/dashboard.service';
import { offlineCacheService } from '@/services/offline-cache.service';
import { KpiCard } from '../widgets/KpiCard';

export function AccountantDashboard() {
  const { context } = useTenantContext();
  const [kpis, setKpis] = useState<DashboardKpi[]>([]);
  const [todayFinancials, setTodayFinancials] = useState<any>(null);
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
      const cachedData = offlineCacheService.getCachedDashboardData('ACCOUNTANT');
      if (cachedData && offlineCacheService.isOffline()) {
        setKpis(cachedData.kpis || []);
        setTodayFinancials(cachedData.todayFinancials || null);
        setIsLoading(false);
        return;
      }

      // Charger depuis l'API
      const [kpisData, financialsData] = await Promise.all([
        dashboardService.getAccountantKpis(
          context.tenant.id,
          context.academicYear?.id
        ),
        dashboardService.getTodayFinancials(context.tenant.id),
      ]);

      setKpis(kpisData);
      setTodayFinancials(financialsData);

      // Mettre en cache (TTL court pour les données financières)
      offlineCacheService.cacheDashboardData('ACCOUNTANT', {
        kpis: kpisData,
        todayFinancials: financialsData,
      }, 2 * 60 * 1000); // 2 minutes
    } catch (error) {
      console.error('Error loading accountant dashboard data:', error);
      
      const cachedData = offlineCacheService.getCachedDashboardData('ACCOUNTANT');
      if (cachedData) {
        setKpis(cachedData.kpis || []);
        setTodayFinancials(cachedData.todayFinancials || null);
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
            <h1 className="text-3xl font-bold">Dashboard Comptable</h1>
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

      {/* KPIs Financiers */}
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

      {/* Encaissements du Jour */}
      {todayFinancials && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Encaissements du Jour</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Montant Total</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'XOF',
                }).format(todayFinancials.totalAmount || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nombre de Paiements</p>
              <p className="text-2xl font-bold">{todayFinancials.count || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions Rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Reçus Récents</h3>
          <p className="text-gray-600">Voir les reçus récents</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Paiements</h3>
          <p className="text-gray-600">Gestion des paiements</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Rappels</h3>
          <p className="text-gray-600">Gestion des rappels</p>
        </div>
      </div>
    </div>
  );
}
