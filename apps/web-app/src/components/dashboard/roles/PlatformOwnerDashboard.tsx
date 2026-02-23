/**
 * ============================================================================
 * PLATFORM OWNER DASHBOARD
 * ============================================================================
 * 
 * Dashboard pour le PLATFORM_OWNER (contrôle global de la plateforme)
 * 
 * ============================================================================
 */

'use client';

import { useTenantContext } from '@/contexts/TenantContext';

export function PlatformOwnerDashboard() {
  const { context } = useTenantContext();

  if (!context) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard PLATFORM_OWNER</h1>
        <p className="text-gray-600 mt-2">
          Contrôle global de la plateforme Academia Helm
        </p>
      </div>

      {/* KPIs Globaux */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Tenants Actifs</h3>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Abonnements</h3>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Alertes ORION</h3>
          <p className="text-2xl font-bold mt-2">
            {context.orionSummary?.criticalAlerts || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Incidents Critiques</h3>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
      </div>

      {/* Sélecteur de Tenant */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Sélecteur de Tenant</h2>
        <p className="text-gray-600">
          Tenant actuel : <strong>{context.tenant.name}</strong>
        </p>
        {/* TODO: Implémenter le sélecteur de tenant */}
      </div>

      {/* Accès Rapide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Écoles</h3>
          <p className="text-gray-600">Gestion des écoles</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Patronats</h3>
          <p className="text-gray-600">Gestion des patronats</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Incidents Critiques</h3>
          <p className="text-gray-600">Suivi des incidents</p>
        </div>
      </div>
    </div>
  );
}
