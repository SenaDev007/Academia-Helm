'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ModuleContainer, FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';
import { pedagogyFetch, academicStructureUrl } from '@/lib/pedagogy/academic-structure-client';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

interface ClassDiary {
  id: string;
  date: string;
  homework?: string;
  notes?: string;
  classSubject: {
    id: string;
    class: { id: string; name: string };
    subject: { id: string; name: string };
  };
}

interface Resource {
  id: string;
  name: string;
}

interface ClassSubject {
  id: string;
  subject: { id: string; name: string };
}

const emptyForm = {
  classId: '',
  classSubjectId: '',
  date: new Date().toISOString().split('T')[0],
  homework: '',
  notes: '',
};

export default function ClassDiariesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [classDiaries, setClassDiaries] = useState<ClassDiary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [classes, setClasses] = useState<Resource[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);

  const loadClassDiaries = useCallback(async () => {
    if (!academicYear || !schoolLevel) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id, schoolLevelId: schoolLevel.id });
      const data = await pedagogyFetch<ClassDiary[]>(`/api/class-diaries?${params}`);
      setClassDiaries(data ?? []);
    } catch {
      setClassDiaries([]);
    } finally {
      setIsLoading(false);
    }
  }, [academicYear, schoolLevel]);

  const loadClasses = useCallback(async () => {
    if (!academicYear || !schoolLevel) return;
    try {
      const q = { academicYearId: academicYear.id, schoolLevelId: schoolLevel.id };
      const data = await pedagogyFetch<Resource[]>(academicStructureUrl('classes', q));
      setClasses(data ?? []);
    } catch {
      setClasses([]);
    }
  }, [academicYear, schoolLevel]);

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadClassDiaries();
      loadClasses();
    }
  }, [academicYear, schoolLevel, loadClassDiaries, loadClasses]);

  const handleClassChange = async (classId: string) => {
    setForm((f) => ({ ...f, classId, classSubjectId: '' }));
    setClassSubjects([]);
    if (!classId || !academicYear) return;
    setLoadingClassSubjects(true);
    try {
      const params = new URLSearchParams({ classId, academicYearId: academicYear.id });
      const data = await pedagogyFetch<ClassSubject[]>(`/api/pedagogy/class-subjects?${params}`);
      setClassSubjects(data ?? []);
    } catch {
      setClassSubjects([]);
    } finally {
      setLoadingClassSubjects(false);
    }
  };

  const openModal = () => {
    setForm(emptyForm);
    setClassSubjects([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.classSubjectId) {
      setFormError('La classe et la matière sont requises.');
      return;
    }
    if (!academicYear || !schoolLevel) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await pedagogyFetch('/api/class-diaries', {
        method: 'POST',
        body: {
          classSubjectId: form.classSubjectId,
          date: form.date,
          homework: form.homework || undefined,
          notes: form.notes || undefined,
          academicYearId: academicYear.id,
          schoolLevelId: schoolLevel.id,
        },
      });
      setIsModalOpen(false);
      await loadClassDiaries();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette entrée du cahier de textes ?')) return;
    try {
      await pedagogyFetch(`/api/class-diaries/${id}`, { method: 'DELETE' });
      await loadClassDiaries();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la suppression');
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
              onClick={openModal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle entrée</span>
            </button>
          ),
        }}
        subModules={{
          modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
          }),
        }}
        content={{
          layout: 'table',
          isLoading,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matière</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Devoirs</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {classDiaries.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">
                      Aucune entrée dans le cahier de textes
                    </td>
                  </tr>
                ) : (
                  classDiaries.map((diary) => (
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
                      <td className="px-6 py-4 text-sm text-gray-500">{diary.homework || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{diary.notes || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDelete(diary.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ),
        }}
      />

      <FormModal
        title="Nouvelle entrée — Cahier de textes"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="lg"
        actions={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement…' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classe *</label>
              <select
                value={form.classId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Sélectionner —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{formatGradeLabel(c.name)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matière *</label>
              <select
                value={form.classSubjectId}
                onChange={(e) => setForm((f) => ({ ...f, classSubjectId: e.target.value }))}
                disabled={!form.classId || loadingClassSubjects}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                <option value="">
                  {loadingClassSubjects ? 'Chargement…' : '— Sélectionner —'}
                </option>
                {classSubjects.map((cs) => (
                  <option key={cs.id} value={cs.id}>{cs.subject.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Devoirs</label>
            <textarea
              rows={3}
              value={form.homework}
              onChange={(e) => setForm((f) => ({ ...f, homework: e.target.value }))}
              placeholder="Devoirs à faire (optionnel)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes pour les élèves (optionnel)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>
    </>
  );
}
