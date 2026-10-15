'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — MES ÉLÈVES
 * ============================================================================
 *
 * Constitution des classes : l'enseignant autonome ajoute ses vrais élèves à
 * ses classes pour la saisie de notes et la génération de bulletins.
 *
 * Données :
 *   - Classes : GET /api/pedagogy-space/my-classes (BFF, même contrat que l'UI
 *     enseignant école)
 *   - Élèves  : GET/POST/DELETE /teacher-portal/* (module dédié)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  UserPlus,
  Trash2,
  Users,
  Plus,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';

interface MyClass {
  classId: string;
  className: string;
  schoolLevelName: string;
  subjects: Array<{ subjectId: string; subjectName: string }>;
}

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  gender?: string;
  matricule?: string;
}

export default function ProfElevesPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();

  const [classes, setClasses] = useState<MyClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', gender: '' });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teacherId = user?.teacherId || user?.id || '';

  // ── Classes de l'enseignant ──
  useEffect(() => {
    if (!academicYear?.id || !teacherId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYear.id}&language=FR`,
          { credentials: 'include' },
        );
        const data = await response.json();
        if (!cancelled && Array.isArray(data)) {
          setClasses(data);
          if (data.length > 0) setSelectedClassId((prev) => prev || data[0].classId);
        }
      } catch {
        if (!cancelled) setError('Impossible de charger vos classes.');
      } finally {
        if (!cancelled) setClassesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id, teacherId]);

  // ── Élèves de la classe sélectionnée ──
  const loadStudents = useCallback(async (classId: string) => {
    if (!classId) return;
    setStudentsLoading(true);
    try {
      const response = await apiClient.get('/teacher-portal/students', {
        params: { classId },
        timeout: 15000,
      });
      setStudents(response.data?.students || []);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) loadStudents(selectedClassId);
  }, [selectedClassId, loadStudents]);

  // ── Ajout d'un élève ──
  const addStudent = async () => {
    if (!selectedClassId || formSubmitting) return;
    if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) {
      setError('Prénom et nom requis (2 caractères minimum).');
      return;
    }
    setFormSubmitting(true);
    setError(null);
    try {
      await apiClient.post(
        '/teacher-portal/students',
        {
          classId: selectedClassId,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          gender: form.gender || undefined,
        },
        { timeout: 20000 },
      );
      setForm({ firstName: '', lastName: '', gender: '' });
      setShowForm(false);
      await loadStudents(selectedClassId);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Échec de l’ajout de l’élève.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Retrait d'un élève ──
  const removeStudent = async (studentId: string) => {
    if (!selectedClassId) return;
    try {
      await apiClient.delete(`/teacher-portal/students/${studentId}`, { timeout: 15000 });
      await loadStudents(selectedClassId);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Échec du retrait de l’élève.');
    }
  };

  if (classesLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement de vos classes…
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
        <Users className="h-10 w-10 text-slate-300" />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Aucune classe disponible</h2>
          <p className="mt-1 text-sm text-slate-500">
            Activez un niveau dans vos paramètres pour recevoir vos classes.
          </p>
        </div>
      </div>
    );
  }

  const selectedClass = classes.find((c) => c.classId === selectedClassId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Mes élèves</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ajoutez les élèves de vos classes pour saisir les notes et générer les bulletins.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          disabled={!selectedClassId}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {showForm ? 'Fermer' : 'Ajouter un élève'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Sélecteur de classe ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Classe
        </label>
        <div className="flex flex-wrap gap-2">
          {classes.map((cls) => (
            <button
              key={cls.classId}
              onClick={() => setSelectedClassId(cls.classId)}
              className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                selectedClassId === cls.classId
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {cls.className}
            </button>
          ))}
        </div>
        {selectedClass && selectedClass.subjects.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            {selectedClass.subjects.length} matière(s) :{' '}
            {selectedClass.subjects
              .slice(0, 6)
              .map((s) => s.subjectName)
              .join(', ')}
            {selectedClass.subjects.length > 6 ? '…' : ''}
          </p>
        )}
      </div>

      {/* ── Formulaire d'ajout ── */}
      {showForm && selectedClassId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Nouvel élève — {selectedClass?.className}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Prénom</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="Awa"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Nom</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="DOSSOU"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Genre (optionnel)
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              onClick={addStudent}
              disabled={formSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {formSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {formSubmitting ? 'Ajout…' : 'Ajouter à la classe'}
            </button>
          </div>
        </div>
      )}

      {/* ── Liste des élèves ── */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Élèves de {selectedClass?.className || '…'}
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {students.length} élève(s)
          </span>
        </div>

        {studentsLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement…
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              Aucun élève dans cette classe. Ajoutez vos élèves pour les évaluations et bulletins.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3 font-semibold">#</th>
                  <th className="px-6 py-3 font-semibold">Matricule</th>
                  <th className="px-6 py-3 font-semibold">Prénom</th>
                  <th className="px-6 py-3 font-semibold">Nom</th>
                  <th className="px-6 py-3 font-semibold">Genre</th>
                  <th className="px-6 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">
                      {student.matricule || '—'}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900">{student.firstName}</td>
                    <td className="px-6 py-3 text-slate-900">{student.lastName}</td>
                    <td className="px-6 py-3 text-slate-500">{student.gender || '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => removeStudent(student.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Retirer l’élève"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
