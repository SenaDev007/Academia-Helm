'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ModuleContainer, FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';
import { pedagogyFetch, academicStructureUrl } from '@/lib/pedagogy/academic-structure-client';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

interface LessonPlan {
  id: string;
  title: string;
  date: string;
  content: string;
  homework?: string;
  class?: { id: string; name: string };
  subject?: { id: string; name: string };
}

interface Resource {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
}

const emptyForm = {
  title: '',
  content: '',
  homework: '',
  date: new Date().toISOString().split('T')[0],
  classId: '',
  subjectId: '',
  teacherId: '',
};

export default function LessonPlansPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [classes, setClasses] = useState<Resource[]>([]);
  const [subjects, setSubjects] = useState<Resource[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const loadLessonPlans = useCallback(async () => {
    if (!academicYear || !schoolLevel) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id, schoolLevelId: schoolLevel.id });
      const data = await pedagogyFetch<LessonPlan[]>(`/api/lesson-plans?${params}`);
      setLessonPlans(data ?? []);
    } catch {
      setLessonPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, [academicYear, schoolLevel]);

  const loadResources = useCallback(async () => {
    if (!academicYear || !schoolLevel) return;
    const q = { academicYearId: academicYear.id, schoolLevelId: schoolLevel.id };
    const [cls, subs, tchs] = await Promise.allSettled([
      pedagogyFetch<Resource[]>(academicStructureUrl('classes', q)),
      pedagogyFetch<Resource[]>(`/api/subjects?${new URLSearchParams(q)}`),
      pedagogyFetch<Teacher[]>(`/api/teachers?${new URLSearchParams(q)}`),
    ]);
    setClasses(cls.status === 'fulfilled' ? (cls.value ?? []) : []);
    setSubjects(subs.status === 'fulfilled' ? (subs.value ?? []) : []);
    setTeachers(tchs.status === 'fulfilled' ? (tchs.value ?? []) : []);
  }, [academicYear, schoolLevel]);

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadLessonPlans();
      loadResources();
    }
  }, [academicYear, schoolLevel, loadLessonPlans, loadResources]);

  const openModal = () => {
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.date) {
      setFormError('Titre, contenu et date sont requis.');
      return;
    }
    if (!academicYear || !schoolLevel) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await pedagogyFetch('/api/lesson-plans', {
        method: 'POST',
        body: {
          title: form.title,
          content: form.content,
          homework: form.homework || undefined,
          date: form.date,
          academicYearId: academicYear.id,
          schoolLevelId: schoolLevel.id,
          classId: form.classId || undefined,
          subjectId: form.subjectId || undefined,
          teacherId: form.teacherId || undefined,
        },
      });
      setIsModalOpen(false);
      await loadLessonPlans();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette fiche pédagogique ?')) return;
    try {
      await pedagogyFetch(`/api/lesson-plans/${id}`, { method: 'DELETE' });
      await loadLessonPlans();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Fiches pédagogiques',
          description: 'Gestion des fiches pédagogiques par matière',
          icon: 'fileText',
          actions: (
            <button
              onClick={openModal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle fiche</span>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matière</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lessonPlans.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">
                      Aucune fiche pédagogique
                    </td>
                  </tr>
                ) : (
                  lessonPlans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{plan.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatGradeLabel(plan.class?.name) || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {plan.subject?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(plan.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDelete(plan.id)}
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
        title="Nouvelle fiche pédagogique"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Titre de la fiche"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
              <select
                value={form.classId}
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Toutes —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{formatGradeLabel(c.name)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matière</label>
              <select
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Toutes —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Enseignant</label>
              <select
                value={form.teacherId}
                onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Aucun —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.lastName} {t.firstName}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu *</label>
            <textarea
              rows={5}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Objectifs, déroulement, activités…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Devoirs</label>
            <textarea
              rows={2}
              value={form.homework}
              onChange={(e) => setForm((f) => ({ ...f, homework: e.target.value }))}
              placeholder="Devoirs à faire (optionnel)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>
    </>
  );
}
