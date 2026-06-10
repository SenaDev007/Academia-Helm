/**
 * ============================================================================
 * TEACHER DASHBOARD
 * ============================================================================
 * 
 * Dashboard pour l'ENSEIGNANT / INSTITUTEUR (espace pédagogique personnel)
 * 
 * ============================================================================
 */

'use client';

import { useTenantContext } from '@/contexts/TenantContext';

export function TeacherDashboard() {
  const { context } = useTenantContext();

  if (!context) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard Enseignant</h1>
        <p className="text-gray-600 mt-2">
          {context.tenant.school?.name || context.tenant.name}
          {context.academicYear && ` - ${context.academicYear.name}`}
        </p>
      </div>

      {/* Classes Assignées */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Classes Assignées</h2>
        <p className="text-gray-600">-</p>
      </div>

      {/* Actions Rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Fiches Pédagogiques</h3>
          <p className="text-gray-600">Gérer les fiches pédagogiques</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Cahier Journal</h3>
          <p className="text-gray-600">Consulter le cahier journal</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Cahier de Textes</h3>
          <p className="text-gray-600">Gérer le cahier de textes</p>
        </div>
      </div>
    </div>
  );
}
