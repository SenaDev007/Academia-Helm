/**
 * FederisSchoolsPage Component
 * 
 * Gestion du Réseau d'Écoles (Academia Helm & Écoles Manuelles)
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface School {
  id: string;
  name: string;
  type: 'ACADEMIA_HELM' | 'MANUAL';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  candidatesCount: number;
  joinedAt?: string;
}

export default function FederisSchoolsPage({ tenantId }: { tenantId: string }) {
  const [activeTab, setActiveTab] = useState<'HELM' | 'MANUAL'>('HELM');
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulation chargement
    setTimeout(() => {
      setSchools([
        { id: '1', name: 'Lycée Technique de Cotonou', type: 'ACADEMIA_HELM', status: 'ACTIVE', candidatesCount: 450, joinedAt: '2024-01-12' },
        { id: '2', name: 'Collège Notre Dame', type: 'ACADEMIA_HELM', status: 'ACTIVE', candidatesCount: 320, joinedAt: '2024-02-05' },
        { id: '3', name: 'École Primaire Privée "Le Savoir"', type: 'MANUAL', status: 'ACTIVE', candidatesCount: 85, joinedAt: '2024-03-20' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const filteredSchools = schools.filter(s => 
    activeTab === 'HELM' ? s.type === 'ACADEMIA_HELM' : s.type === 'MANUAL'
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900">Réseau d'Écoles</h1>
          <p className="text-gray-500 font-medium">Gérez les établissements membres et les demandes d'association.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all flex items-center gap-2">
            <AppIcon name="userPlus" size="submenu" />
            Invitation Helm
          </button>
          <button className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-800 transition-all flex items-center gap-2">
            <AppIcon name="add" size="submenu" />
            Ajout Manuel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('HELM')}
          className={cn(
            'px-6 py-3 text-sm font-bold transition-all border-b-2',
            activeTab === 'HELM' 
              ? 'border-blue-900 text-blue-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Écoles Academia Helm ({schools.filter(s => s.type === 'ACADEMIA_HELM').length})
        </button>
        <button
          onClick={() => setActiveTab('MANUAL')}
          className={cn(
            'px-6 py-3 text-sm font-bold transition-all border-b-2',
            activeTab === 'MANUAL' 
              ? 'border-blue-900 text-blue-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Écoles Manuelles ({schools.filter(s => s.type === 'MANUAL').length})
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Établissement</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Statut Synchro</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Candidats</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adhésion</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-blue-900/20 border-t-blue-900 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-500">Synchronisation des données...</p>
                  </div>
                </td>
              </tr>
            ) : filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Aucun établissement trouvé dans cette catégorie.
                </td>
              </tr>
            ) : (
              filteredSchools.map((school) => (
                <tr key={school.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center font-bold text-blue-700">
                        {school.name[0]}
                      </div>
                      <div className="text-sm font-bold text-gray-900 group-hover:text-blue-900">{school.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider',
                      school.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                    )}>
                      {school.status === 'ACTIVE' ? 'Synchronisé' : 'En attente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-700">
                    {school.candidatesCount}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                    {school.joinedAt ? new Date(school.joinedAt).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all">
                      <AppIcon name="eye" size="submenu" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all ml-1">
                      <AppIcon name="delete" size="submenu" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

