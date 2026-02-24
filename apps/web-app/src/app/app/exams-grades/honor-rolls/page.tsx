/**
 * ============================================================================
 * MODULE 3 : TABLEAUX D'HONNEUR
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Award, Trophy, Star, Plus } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';

interface HonorRoll {
  id: string;
  mention: string;
  average: number;
  rank: number;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  class?: {
    id: string;
    name: string;
  };
  quarter?: {
    id: string;
    name: string;
  };
}

export default function HonorRollsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [honorRolls, setHonorRolls] = useState<HonorRoll[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedHonorRoll, setSelectedHonorRoll] = useState<HonorRoll | null>(null);
  const [filters, setFilters] = useState({
    mention: '',
    search: '',
  });

  useEffect(() => {
    if (academicYear) {
      loadHonorRolls();
    }
  }, [academicYear, schoolLevel, filters]);

  const loadHonorRolls = async () => {
    if (!academicYear) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        ...(schoolLevel && { schoolLevelId: schoolLevel.id }),
        ...(filters.mention && { mention: filters.mention }),
      });

      const response = await fetch(`/api/honor-rolls?${params}`);
      if (response.ok) {
        const data = await response.json();
        setHonorRolls(data);
      }
    } catch (error) {
      console.error('Failed to load honor rolls:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMentionLabel = (mention: string) => {
    const labels: Record<string, string> = {
      EXCELLENT: 'Excellent',
      TRES_BIEN: 'Très Bien',
      BIEN: 'Bien',
      ASSEZ_BIEN: 'Assez Bien',
    };
    return labels[mention] || mention;
  };

  const getMentionColor = (mention: string) => {
    switch (mention) {
      case 'EXCELLENT':
        return 'bg-purple-100 text-purple-800';
      case 'TRES_BIEN':
        return 'bg-blue-100 text-blue-800';
      case 'BIEN':
        return 'bg-green-100 text-green-800';
      case 'ASSEZ_BIEN':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const excellentCount = honorRolls.filter((hr) => hr.mention === 'EXCELLENT').length;
  const tresBienCount = honorRolls.filter((hr) => hr.mention === 'TRES_BIEN').length;
  const bienCount = honorRolls.filter((hr) => hr.mention === 'BIEN').length;

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Tableaux d\'honneur',
          description: 'Tableaux d\'honneur et mentions (Excellent, Très Bien, Bien)',
          icon: 'award',
          kpis: [
            {
              label: 'Excellent',
              value: excellentCount,
              icon: 'trophy',
              trend: 'up',
            },
            {
              label: 'Très Bien',
              value: tresBienCount,
              icon: 'star',
              trend: 'up',
            },
            {
              label: 'Bien',
              value: bienCount,
              icon: 'award',
              trend: 'neutral',
            },
          ],
          actions: (
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Générer le tableau</span>
            </button>
          ),
        }}
        content={{
          layout: 'table',
          filters: (
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Rechercher un élève..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Rechercher"
                />
              </div>
              <select
                value={filters.mention}
                onChange={(e) => setFilters({ ...filters, mention: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filtrer par mention"
              >
                <option value="">Toutes les mentions</option>
                <option value="EXCELLENT">Excellent</option>
                <option value="TRES_BIEN">Très Bien</option>
                <option value="BIEN">Bien</option>
                <option value="ASSEZ_BIEN">Assez Bien</option>
              </select>
            </div>
          ),
          isLoading,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rang
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Élève
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Classe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Moyenne
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Mention
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {honorRolls.map((roll) => (
                  <tr key={roll.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{roll.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {roll.student?.firstName} {roll.student?.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatGradeLabel(roll.class?.name) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      {roll.average.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getMentionColor(
                          roll.mention
                        )}`}
                      >
                        {getMentionLabel(roll.mention)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedHonorRoll(roll);
                          setIsViewModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Voir"
                        aria-label="Voir les détails"
                      >
                        <Award className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        }}
      />

      <FormModal
        title="Générer le tableau d'honneur"
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        size="md"
        actions={
          <>
            <button
              onClick={() => setIsGenerateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={async () => {
                if (academicYear) {
                  try {
                    await fetch('/api/honor-rolls/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        academicYearId: academicYear.id,
                        schoolLevelId: schoolLevel?.id,
                        minAverage: 12.0,
                      }),
                    });
                    setIsGenerateModalOpen(false);
                    loadHonorRolls();
                  } catch (error) {
                    console.error('Failed to generate honor roll:', error);
                  }
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Générer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seuil minimum (moyenne)
            </label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.1"
              defaultValue="12.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Seuil minimum"
            />
            <p className="mt-1 text-xs text-gray-500">
              Seules les moyennes supérieures ou égales à ce seuil seront incluses
            </p>
          </div>
        </div>
      </FormModal>

      <ReadOnlyModal
        title={`Tableau d'honneur : ${selectedHonorRoll?.student?.firstName} ${selectedHonorRoll?.student?.lastName}`}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedHonorRoll(null);
        }}
        size="md"
      >
        {selectedHonorRoll && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rang</label>
                <p className="text-sm text-gray-900 font-semibold">#{selectedHonorRoll.rank}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moyenne</label>
                <p className="text-sm text-gray-900 font-semibold">
                  {selectedHonorRoll.average.toFixed(2)} / 20
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mention</label>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getMentionColor(
                    selectedHonorRoll.mention
                  )}`}
                >
                  {getMentionLabel(selectedHonorRoll.mention)}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
                <p className="text-sm text-gray-900">{selectedHonorRoll.quarter?.name || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </ReadOnlyModal>
    </>
  );
}

