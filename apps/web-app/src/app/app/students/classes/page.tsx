/**
 * ============================================================================
 * SOUS-MODULE : CLASSES
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

interface Class {
  id: string;
  name: string;
  code: string;
  level?: string;
  capacity?: number;
  classStudents?: Array<{
    student: { id: string; firstName: string; lastName: string };
  }>;
}

interface ClassForm {
  name: string;
  level: string;
  capacity: string;
}

const EMPTY_FORM: ClassForm = { name: '', level: '', capacity: '' };

export default function ClassesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);

  useEffect(() => {
    if (academicYear) loadClasses();
  }, [academicYear, schoolLevel]);

  const loadClasses = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevel?.id && schoolLevel.id !== 'ALL') params.set('schoolLevelId', schoolLevel.id);
      const response = await fetch(`/api/classes?${params}`);
      if (response.ok) {
        const data = await response.json();
        setClasses(Array.isArray(data) ? data : (data.data ?? []));
      }
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.level || !schoolLevel?.id || !academicYear?.id) return;
    setIsSaving(true);
    try {
      await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          level: form.level,
          schoolLevelId: schoolLevel.id,
          academicYearId: academicYear.id,
          capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        }),
      });
      setIsCreateModalOpen(false);
      setForm(EMPTY_FORM);
      loadClasses();
    } catch (error) {
      console.error('Failed to create class:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Classes',
          description: 'Organisation et gestion des classes',
          icon: 'users',
          actions: (
            <button
              onClick={() => { setForm(EMPTY_FORM); setIsCreateModalOpen(true); }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle classe</span>
            </button>
          ),
        }}
        content={{
          layout: 'grid',
          isLoading,
          children: classes.map((classItem) => (
            <div
              key={classItem.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{classItem.name}</h3>
                <span className="text-sm text-gray-500">{classItem.level ?? classItem.code}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Effectif</span>
                  <span className="font-medium text-gray-900">
                    {classItem.classStudents?.length ?? 0}
                    {classItem.capacity ? ` / ${classItem.capacity}` : ''}
                  </span>
                </div>
              </div>
            </div>
          )),
        }}
      />

      <FormModal
        title="Créer une classe"
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setForm(EMPTY_FORM); }}
        size="md"
        actions={
          <>
            <button
              onClick={() => { setIsCreateModalOpen(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={isSaving || !form.name || !form.level}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Création…' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la classe *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: 6ème A"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Niveau / Code *</label>
            <input
              type="text"
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              placeholder="Ex: 6A ou 6ème"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacité</label>
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
              placeholder="Ex: 40"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>
    </>
  );
}
