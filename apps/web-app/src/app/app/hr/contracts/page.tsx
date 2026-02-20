/**
 * ============================================================================
 * HR MODULE - CONTRACTS PAGE
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Contrats de travail"
        description="Gestion des contrats de travail du personnel"
        icon="rh"
      />
      <div className="p-4">
        <div className="flex justify-end mb-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <Plus className="w-4 h-4 inline mr-2" />
            Nouveau contrat
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personnel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date début</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date fin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salaire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Aucun contrat enregistré
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contract.staff?.firstName} {contract.staff?.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{contract.contractType}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(contract.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'Indéterminé'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {Number(contract.baseSalary).toLocaleString()} XOF
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        contract.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        contract.status === 'EXPIRED' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-blue-600 hover:text-blue-800">Voir</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

