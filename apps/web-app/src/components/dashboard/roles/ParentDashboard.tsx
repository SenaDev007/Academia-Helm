/**
 * ============================================================================
 * PARENT DASHBOARD
 * ============================================================================
 * 
 * Dashboard pour le PARENT (suivi enfant(s))
 * 
 * ============================================================================
 */

'use client';

import { useTenantContext } from '@/contexts/TenantContext';

export function ParentDashboard() {
  const { context } = useTenantContext();

  if (!context) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard Parent</h1>
        <p className="text-gray-600 mt-2">
          {context.tenant.school?.name || context.tenant.name}
          {context.academicYear && ` - ${context.academicYear.name}`}
        </p>
      </div>

      {/* Situation Scolaire */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Situation Scolaire</h3>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Absences</h3>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Notes / Bulletins</h3>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
      </div>

      {/* Situation Financière */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Situation Financière</h2>
        <p className="text-gray-600">-</p>
      </div>

      {/* Paiement Fedapay */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Paiement Fedapay</h2>
        <p className="text-gray-600">-</p>
      </div>
    </div>
  );
}
