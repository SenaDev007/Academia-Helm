/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - CAHIERS DE TEXTES
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Book, Edit, Trash2 } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';

interface ClassDiary {
  id: string;
  date: string;
  homework?: string;
  notes?: string;
  classSubject: {
    id: string;
    class: {
      id: string;
      name: string;
    };
    subject: {
      id: string;
      name: string;
    };
  };
}

export default function ClassDiariesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [classDiaries, setClassDiaries] = useState<ClassDiary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadClassDiaries();
    }
  }, [academicYear, schoolLevel]);

  const loadClassDiaries = async () => {
    if (!academicYear || !schoolLevel) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      });

      const response = await fetch(`/api/class-diaries?${params}`);
      if (response.ok) {
        const data = await response.json();
        setClassDiaries(data);
      }
    } catch (error) {
      console.error('Failed to load class diaries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Cahiers de textes',
          description: 'Devoirs et notes pour les élèves',
          icon: 'book',
          actions: (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle entrée</span>
            </button>
          ),
        }}
        content={{
          layout: 'table',
          isLoading,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Classe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Matière
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Devoirs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {classDiaries.map((diary) => (
                  <tr key={diary.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(diary.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatGradeLabel(diary.classSubject.class.name)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {diary.classSubject.subject.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {diary.homework || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {diary.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        }}
      />

      <FormModal
        title="Créer une entrée de cahier de textes"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="lg"
        actions={
          <>
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                // TODO: Implémenter la création
                setIsCreateModalOpen(false);
                loadClassDiaries();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Créer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Devoirs
            </label>
            <textarea
              rows={3}
              placeholder="Devoirs à faire"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Devoirs"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              placeholder="Notes pour les élèves"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Notes"
            />
          </div>
        </div>
      </FormModal>
    </>
  );
}

