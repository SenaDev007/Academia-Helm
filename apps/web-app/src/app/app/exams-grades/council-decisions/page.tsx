/**
 * ============================================================================
 * MODULE 3 : DÉCISIONS DE CONSEIL DE CLASSE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, AlertCircle, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
  ConfirmModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';

interface CouncilDecision {
  id: string;
  decision: string;
  description: string;
  comments?: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  council?: {
    id: string;
    class?: {
      name: string;
    };
  };
  quarter?: {
    id: string;
    name: string;
  };
}

export default function CouncilDecisionsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [decisions, setDecisions] = useState<CouncilDecision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<CouncilDecision | null>(null);
  const [filters, setFilters] = useState({
    decision: '',
    search: '',
  });

  useEffect(() => {
    if (academicYear) {
      loadDecisions();
    }
  }, [academicYear, schoolLevel, filters]);

  const loadDecisions = async () => {
    if (!academicYear) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        ...(schoolLevel && { schoolLevelId: schoolLevel.id }),
        ...(filters.decision && { decision: filters.decision }),
      });

      const response = await fetch(`/api/council-decisions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDecisions(data);
      }
    } catch (error) {
      console.error('Failed to load decisions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDecisionLabel = (decision: string) => {
    const labels: Record<string, string> = {
      ADMIS: 'Admis',
      REDOUBLE: 'Redouble',
      AJOURNE: 'Ajourné',
      CONDITIONAL: 'Admis conditionnel',
    };
    return labels[decision] || decision;
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'ADMIS':
        return 'bg-green-100 text-green-800';
      case 'REDOUBLE':
        return 'bg-red-100 text-red-800';
      case 'AJOURNE':
        return 'bg-orange-100 text-orange-800';
      case 'CONDITIONAL':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const admittedCount = decisions.filter((d) => d.decision === 'ADMIS').length;
  const repeatCount = decisions.filter((d) => d.decision === 'REDOUBLE').length;
  const conditionalCount = decisions.filter((d) => d.decision === 'CONDITIONAL').length;

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Décisions de conseil de classe',
          description: 'Gestion des décisions des conseils de classe',
          icon: 'users',
          kpis: [
            {
              label: 'Admis',
              value: admittedCount,
              icon: 'checkCircle',
              trend: 'up',
            },
            {
              label: 'Redoublent',
              value: repeatCount,
              icon: 'xCircle',
              trend: 'down',
            },
            {
              label: 'Conditionnels',
              value: conditionalCount,
              icon: 'alertCircle',
              trend: 'warning',
            },
          ],
          actions: (
            <button
              onClick={() => {
                setSelectedDecision(null);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle décision</span>
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
                value={filters.decision}
                onChange={(e) => setFilters({ ...filters, decision: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filtrer par décision"
              >
                <option value="">Toutes les décisions</option>
                <option value="ADMIS">Admis</option>
                <option value="REDOUBLE">Redouble</option>
                <option value="AJOURNE">Ajourné</option>
                <option value="CONDITIONAL">Admis conditionnel</option>
              </select>
            </div>
          ),
          isLoading,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Élève
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Classe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Décision
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Période
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {decisions.map((decision) => (
                  <tr key={decision.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {decision.student?.firstName} {decision.student?.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatGradeLabel(decision.council?.class?.name) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getDecisionColor(
                          decision.decision
                        )}`}
                      >
                        {getDecisionLabel(decision.decision)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {decision.quarter?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedDecision(decision);
                            setIsViewModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Voir"
                          aria-label="Voir la décision"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDecision(decision);
                            setIsEditModalOpen(true);
                          }}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Modifier"
                          aria-label="Modifier la décision"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDecision(decision);
                            setIsDeleteModalOpen(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                          aria-label="Supprimer la décision"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        }}
      />

      <FormModal
        title={selectedDecision ? 'Modifier la décision' : 'Créer une décision'}
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedDecision(null);
        }}
        size="lg"
        actions={
          <>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                setSelectedDecision(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={async () => {
                // TODO: Implémenter la sauvegarde
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                setSelectedDecision(null);
                loadDecisions();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {selectedDecision ? 'Modifier' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Décision *
            </label>
            <select
              defaultValue={selectedDecision?.decision || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Décision"
            >
              <option value="">Sélectionner</option>
              <option value="ADMIS">Admis</option>
              <option value="REDOUBLE">Redouble</option>
              <option value="AJOURNE">Ajourné</option>
              <option value="CONDITIONAL">Admis conditionnel</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              rows={4}
              defaultValue={selectedDecision?.description || ''}
              placeholder="Description de la décision"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observations
            </label>
            <textarea
              rows={3}
              defaultValue={selectedDecision?.comments || ''}
              placeholder="Observations du conseil"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Observations"
            />
          </div>
        </div>
      </FormModal>

      <ReadOnlyModal
        title={`Décision : ${selectedDecision?.student?.firstName} ${selectedDecision?.student?.lastName}`}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedDecision(null);
        }}
        size="lg"
      >
        {selectedDecision && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Décision</label>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getDecisionColor(
                    selectedDecision.decision
                  )}`}
                >
                  {getDecisionLabel(selectedDecision.decision)}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
                <p className="text-sm text-gray-900">{selectedDecision.quarter?.name || '-'}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p className="text-sm text-gray-900">{selectedDecision.description}</p>
            </div>
            {selectedDecision.comments && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
                <p className="text-sm text-gray-900">{selectedDecision.comments}</p>
              </div>
            )}
          </div>
        )}
      </ReadOnlyModal>

      <ConfirmModal
        title="Supprimer la décision"
        message={`Êtes-vous sûr de vouloir supprimer cette décision ?`}
        type="danger"
        isOpen={isDeleteModalOpen}
        onConfirm={async () => {
          if (selectedDecision) {
            try {
              await fetch(`/api/council-decisions/${selectedDecision.id}`, {
                method: 'DELETE',
              });
              setIsDeleteModalOpen(false);
              setSelectedDecision(null);
              loadDecisions();
            } catch (error) {
              console.error('Failed to delete decision:', error);
            }
          }
        }}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setSelectedDecision(null);
        }}
        confirmLabel="Supprimer"
      />
    </>
  );
}

