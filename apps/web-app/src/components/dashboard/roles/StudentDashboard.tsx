/**
 * ============================================================================
 * STUDENT DASHBOARD
 * ============================================================================
 * 
 * Dashboard pour l'ÉLÈVE (consultation)
 * 
 * ============================================================================
 */

'use client';

import { useTenantContext } from '@/contexts/TenantContext';

export function StudentDashboard() {
  const { context } = useTenantContext();

  if (!context) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard Élève</h1>
        <p className="text-gray-600 mt-2">
          {context.tenant.school?.name || context.tenant.name}
          {context.academicYear && ` - ${context.academicYear.name}`}
        </p>
      </div>

      {/* Actions Rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Emploi du Temps</h3>
          <p className="text-gray-600">Consulter l'emploi du temps</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Notes</h3>
          <p className="text-gray-600">Consulter les notes</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Devoirs</h3>
          <p className="text-gray-600">Voir les devoirs</p>
        </div>
      </div>
    </div>
  );
}
