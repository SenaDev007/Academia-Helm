'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, Trash2 } from 'lucide-react';
import { ModuleContainer, FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';
import { pedagogyFetch, academicStructureUrl } from '@/lib/pedagogy/academic-structure-client';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

interface DailyLog {
  id: string;
  date: string;
  summary: string;
  validated: boolean;
  teacher: { id: string; firstName: string; lastName: string };
  class?: { id: string; name: string };
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
  teacherId: '',
  classId: '',
  date: new Date().toISOString().split('T')[0],
  summary: '',
};

export default function DailyLogsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [classes, setClasses] = useState<Resource[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const loadDailyLogs = useCallback(async () => {
    if (!academicYear || !schoolLevel) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id, schoolLevelId: schoolLevel.id });
      const data = await pedagogyFetch<DailyLog[]>(`/api/daily-logs?${params}`);
      setDailyLogs(data ?? []);
    } catch {
      setDailyLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [academicYear, schoolLevel]);

  const loadResources = useCallback(async () => {
    if (!academicYear || !schoolLevel) return;
    const q = { academicYearId: academicYear.id, schoolLevelId: schoolLevel.id };
    const [cls, tchs] = await Promise.allSettled([
      pedagogyFetch<Resource[]>(academicStructureUrl('classes', q)),
      pedagogyFetch<Teacher[]>(`/api/teachers?${new URLSearchParams(q)}`),
    ]);
    setClasses(cls.status === 'fulfilled' ? (cls.value ?? []) : []);
    setTeachers(tchs.status === 'fulfilled' ? (tchs.value ?? []) : []);
  }, [academicYear, schoolLevel]);

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadDailyLogs();
      loadResources();
    }
  }, [academicYear, schoolLevel, loadDailyLogs, loadResources]);

  const openModal = () => {
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.teacherId) {
      setFormError("L'enseignant est requis.");
      return;
    }
    if (!form.summary.trim()) {
      setFormError('Le résumé est requis.');
      return;
    }
    if (!academicYear || !schoolLevel) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await pedagogyFetch('/api/daily-logs', {
        method: 'POST',
        body: {
          teacherId: form.teacherId,
          classId: form.classId || undefined,
          date: form.date,
          summary: form.summary,
          academicYearId: academicYear.id,
          schoolLevelId: schoolLevel.id,
        },
      });
      setIsModalOpen(false);
      await loadDailyLogs();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce cahier journal ?')) return;
    try {
      await pedagogyFetch(`/api/daily-logs/${id}`, { method: 'DELETE' });
      await loadDailyLogs();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Cahiers journaux',
          description: 'Journal quotidien des enseignants (validation direction)',
          icon: 'bookOpen',
          actions: (
            <button
              onClick={openModal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau journal</span>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enseignant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Résumé</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyLogs.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">
                      Aucun cahier journal
                    </td>
                  </tr>
                ) : (
                  dailyLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.teacher.lastName} {log.teacher.firstName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatGradeLabel(log.class?.name) || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.summary.length > 100 ? `${log.summary.substring(0, 100)}…` : log.summary}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.validated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Validé
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                            En attente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {!log.validated && (
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
        title="Nouveau cahier journal"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Enseignant *</label>
              <select
                value={form.teacherId}
                onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Sélectionner —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.lastName} {t.firstName}</option>
                ))}
              </select>
            </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Résumé *</label>
            <textarea
              rows={6}
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="Résumé de la journée, activités réalisées…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>
    </>
  );
}
