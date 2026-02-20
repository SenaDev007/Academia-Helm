/**
 * ============================================================================
 * HR MODULE - PAYROLL PAGE
 * ============================================================================
 */

'use client';

import { Plus } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';

export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Paie"
        description="Gestion de la paie et bulletins de salaire"
        icon="rh"
      />
      <div className="p-4">
        <div className="flex justify-end mb-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <Plus className="w-4 h-4 inline mr-2" />
            Nouvelle paie
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600">Interface de gestion de la paie en cours de développement...</p>
        </div>
      </div>
    </div>
  );
}

