/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - MATIÈRES
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, BookOpen, Edit, Trash2, Eye } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
  ConfirmModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  schoolLevel?: {
    id: string;
    code: string;
    label: string;
  };
  academicTrack?: {
    id: string;
    code: string;
    label: string;
  };
}

export default function SubjectsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadSubjects();
    }
  }, [academicYear, schoolLevel]);

  const loadSubjects = async () => {
    if (!academicYear || !schoolLevel) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      });

      const response = await fetch(`/api/subjects?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSubjects(data);
      }
    } catch (error) {
      console.error('Failed to load subjects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    try {
      if (selectedSubject) {
        const response = await fetch(`/api/subjects/${selectedSubject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (response.ok) {
          setIsEditModalOpen(false);
          loadSubjects();
        }
      } else {
        const response = await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            academicYearId: academicYear?.id,
            schoolLevelId: schoolLevel?.id,
          }),
        });
        if (response.ok) {
          setIsCreateModalOpen(false);
          loadSubjects();
        }
      }
    } catch (error) {
      console.error('Failed to save subject:', error);
    }
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Matières',
          description: 'Gestion des matières par niveau scolaire',
          icon: 'bookOpen',
          actions: (
            <button
              onClick={() => {
                setSelectedSubject(null);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle matière</span>
            </button>
          ),
        }}
        subModules={{
          modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            return {
              id: tab.id,
              label: tab.label,
              href: tab.path,
              icon: <Icon className="w-4 h-4" />,
            };
          }),
        }}
        content={{
          layout: 'table',
          isLoading,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Coefficient
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {subject.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {subject.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {subject.coefficient}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedSubject(subject);
                            setIsViewModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Voir"
                          aria-label="Voir la matière"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSubject(subject);
                            setIsEditModalOpen(true);
                          }}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Modifier"
                          aria-label="Modifier la matière"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSubject(subject);
                            setIsDeleteModalOpen(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                          aria-label="Supprimer la matière"
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
        title={selectedSubject ? 'Modifier la matière' : 'Créer une matière'}
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedSubject(null);
        }}
        size="md"
        actions={
          <>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                setSelectedSubject(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={() => handleSubmit({})}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {selectedSubject ? 'Modifier' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code *
            </label>
            <input
              type="text"
              defaultValue={selectedSubject?.code || ''}
              placeholder="Ex: MATH"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Code de la matière"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom *
            </label>
            <input
              type="text"
              defaultValue={selectedSubject?.name || ''}
              placeholder="Ex: Mathématiques"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Nom de la matière"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coefficient
            </label>
            <input
              type="number"
              step="0.1"
              defaultValue={selectedSubject?.coefficient || 1.0}
              placeholder="1.0"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Coefficient"
            />
          </div>
        </div>
      </FormModal>

      <ReadOnlyModal
        title={`Matière : ${selectedSubject?.name}`}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedSubject(null);
        }}
        size="md"
      >
        {selectedSubject && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <p className="text-sm text-gray-900 font-mono">{selectedSubject.code}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <p className="text-sm text-gray-900">{selectedSubject.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coefficient</label>
              <p className="text-sm text-gray-900">{selectedSubject.coefficient}</p>
            </div>
          </div>
        )}
      </ReadOnlyModal>

      <ConfirmModal
        title="Supprimer la matière"
        message={`Êtes-vous sûr de vouloir supprimer "${selectedSubject?.name}" ?`}
        type="danger"
        isOpen={isDeleteModalOpen}
        onConfirm={async () => {
          if (selectedSubject) {
            try {
              await fetch(`/api/subjects/${selectedSubject.id}`, { method: 'DELETE' });
              setIsDeleteModalOpen(false);
              setSelectedSubject(null);
              loadSubjects();
            } catch (error) {
              console.error('Failed to delete subject:', error);
            }
          }
        }}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setSelectedSubject(null);
        }}
        confirmLabel="Supprimer"
      />
    </>
  );
}

