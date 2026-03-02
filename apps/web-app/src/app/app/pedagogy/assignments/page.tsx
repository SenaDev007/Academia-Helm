/**
 * MODULE 2 — Affectations et charges horaires (SM4)
 * Liste des affectations, création/édition, résumé de charge par profil.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Users,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import Link from 'next/link';

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string | null;
}

interface Profile {
  id: string;
  teacher: Teacher;
  maxWeeklyHours: number;
}

interface AcademicClass {
  id: string;
  name: string;
  code: string;
  level?: { name: string };
  cycle?: { name: string };
}

interface Subject {
  id: string;
  name: string;
  code?: string | null;
}

interface Series {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  profileId: string;
  classId: string;
  subjectId: string;
  profile: Profile;
  academicClass: AcademicClass;
  subject: Subject;
  series?: Series | null;
  weeklyHours: number;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
}

interface ChargeSummary {
  profileId: string;
  teacher: Teacher;
  maxWeeklyHours: number;
  currentWeeklyHours: number;
  overload: boolean;
}

async function apiAssignments(
  path: string,
  options?: { method?: string; body?: object; query?: Record<string, string> }
): Promise<unknown> {
  const base = '/api/pedagogy/assignments';
  const pathPart = path.startsWith('http') ? '' : path;
  const qs = options?.query ? '?' + new URLSearchParams(options.query).toString() : '';
  const url = path.startsWith('http') ? path : `${base}${pathPart ? `/${pathPart}` : ''}${qs}`;
  const res = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? err.error ?? res.statusText);
  }
  return res.json();
}

async function apiTeacherProfiles(
  path: string,
  options?: { method?: string; body?: object; query?: Record<string, string> }
): Promise<unknown> {
  const base = '/api/pedagogy/teacher-profiles';
  const pathPart = path.startsWith('http') ? '' : path;
  const qs = options?.query ? '?' + new URLSearchParams(options.query).toString() : '';
  const url = path.startsWith('http') ? path : `${base}${pathPart ? `/${pathPart}` : ''}${qs}`;
  const res = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? err.error ?? res.statusText);
  }
  return res.json();
}

async function apiStructure(path: string): Promise<unknown> {
  const res = await fetch(`/api/pedagogy/academic-structure/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? err.error ?? res.statusText);
  }
  return res.json();
}

async function apiSubjects(): Promise<unknown> {
  const res = await fetch('/api/subjects', {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erreur chargement matières');
  return res.json();
}

export default function AssignmentsPage() {
  const { academicYear } = useModuleContext();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | { edit: Assignment } | null>(null);
  const [chargeProfileId, setChargeProfileId] = useState<string | null>(null);
  const [chargeSummary, setChargeSummary] = useState<ChargeSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await apiAssignments('', {
        query: { academicYearId: academicYear.id },
      })) as Assignment[];
      setAssignments(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  const loadProfiles = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = (await apiTeacherProfiles('', {
        query: { academicYearId: academicYear.id },
      })) as Profile[];
      setProfiles(Array.isArray(data) ? data : []);
    } catch {
      setProfiles([]);
    }
  }, [academicYear?.id]);

  const loadClasses = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const data = (await apiStructure(
        `classes?academicYearId=${academicYear.id}`
      )) as AcademicClass[];
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  }, [academicYear?.id]);

  const loadSubjects = useCallback(async () => {
    try {
      const data = (await apiSubjects()) as Subject[];
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (academicYear?.id) {
      loadProfiles();
      loadClasses();
      loadSubjects();
    }
  }, [academicYear?.id, loadProfiles, loadClasses, loadSubjects]);

  const loadChargeSummary = useCallback(
    async (profileId: string) => {
      if (chargeProfileId === profileId && chargeSummary) return;
      setChargeProfileId(profileId);
      try {
        const data = (await apiAssignments(
          `charge-summary/${profileId}`
        )) as ChargeSummary;
        setChargeSummary(data);
      } catch {
        setChargeSummary(null);
      }
    },
    [chargeProfileId, chargeSummary]
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette affectation ?')) return;
    setError(null);
    try {
      await apiAssignments(id, { method: 'DELETE' });
      loadAssignments();
      if (chargeSummary && assignments.find((a) => a.id === id)?.profileId === chargeSummary.profileId) {
        setChargeSummary(null);
        setChargeProfileId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur suppression');
    }
  };

  const handleSubmitCreate = async (body: {
    profileId: string;
    classId: string;
    subjectId: string;
    seriesId?: string | null;
    weeklyHours: number;
    startDate: string;
    endDate?: string | null;
  }) => {
    if (!academicYear?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiAssignments('', {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          ...body,
        },
      });
      setModal(null);
      loadAssignments();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (
    id: string,
    body: {
      weeklyHours?: number;
      startDate?: string;
      endDate?: string | null;
      seriesId?: string | null;
      isActive?: boolean;
    }
  ) => {
    setSaving(true);
    setFormError(null);
    try {
      await apiAssignments(id, { method: 'PUT', body });
      setModal(null);
      loadAssignments();
      if (chargeSummary && assignments.find((a) => a.id === id)?.profileId === chargeSummary.profileId) {
        setChargeProfileId(chargeSummary.profileId);
        const data = (await apiAssignments(
          `charge-summary/${chargeSummary.profileId}`
        )) as ChargeSummary;
        setChargeSummary(data);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleContainer
      header={{
        title: 'Affectations et charges horaires',
        description: 'Affecter enseignant à classe/matière, volume horaire',
        icon: 'bookOpen',
      }}
      content={{
        layout: 'custom',
        children: (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/app/pedagogy/teachers"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                <Users className="h-4 w-4" /> Enseignants
              </Link>
              <Link
                href="/app/pedagogy/timetables"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4" /> Emploi du temps
              </Link>
              {academicYear?.id && (
                <button
                  type="button"
                  onClick={() => setModal('create')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Nouvelle affectation
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!academicYear?.id ? (
              <p className="text-gray-500">
                Sélectionnez une année scolaire pour gérer les affectations.
              </p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement…
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border bg-white">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                          Enseignant
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                          Classe
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                          Matière
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                          h/sem
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                          Période
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500">
                          Actif
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {assignments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-8 text-center text-gray-500"
                          >
                            Aucune affectation pour cette année.
                          </td>
                        </tr>
                      ) : (
                        assignments.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-2 text-sm">
                              <button
                                type="button"
                                onClick={() => loadChargeSummary(a.profileId)}
                                className="text-left font-medium text-blue-600 hover:underline"
                              >
                                {a.profile.teacher.lastName}{' '}
                                {a.profile.teacher.firstName}
                              </button>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {a.academicClass.name}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {a.subject.name}
                            </td>
                            <td className="px-4 py-2 text-right text-sm">
                              {a.weeklyHours}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(a.startDate).toLocaleDateString('fr-FR')}
                              {a.endDate
                                ? ` – ${new Date(a.endDate).toLocaleDateString('fr-FR')}`
                                : ''}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {a.isActive ? (
                                <span className="text-green-600">Oui</span>
                              ) : (
                                <span className="text-gray-400">Non</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setModal({ edit: a })}
                                className="text-gray-600 hover:text-blue-600"
                                title="Modifier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(a.id)}
                                className="ml-2 text-gray-600 hover:text-red-600"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {chargeSummary && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h3 className="mb-2 font-medium text-blue-900">
                      Charge : {chargeSummary.teacher.lastName}{' '}
                      {chargeSummary.teacher.firstName}
                    </h3>
                    <p className="text-sm text-blue-800">
                      {chargeSummary.currentWeeklyHours} h /{' '}
                      {chargeSummary.maxWeeklyHours} h max
                      {chargeSummary.overload && (
                        <span className="ml-2 font-medium text-red-600">
                          (surcharge)
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Modal création */}
            {modal === 'create' && (
              <AssignmentsFormModal
                profiles={profiles}
                classes={classes}
                subjects={subjects}
                initialValues={null}
                saving={saving}
                formError={formError}
                onClose={() => {
                  setModal(null);
                  setFormError(null);
                }}
                onSubmit={handleSubmitCreate}
              />
            )}

            {/* Modal édition */}
            {modal && typeof modal === 'object' && 'edit' in modal && (
              <AssignmentsFormModal
                profiles={profiles}
                classes={classes}
                subjects={subjects}
                initialValues={modal.edit}
                saving={saving}
                formError={formError}
                onClose={() => {
                  setModal(null);
                  setFormError(null);
                }}
                onSubmit={(body) => handleSubmitEdit(modal.edit.id, body)}
                isEdit
              />
            )}
          </div>
        ),
      }}
    />
  );
}

interface FormModalProps {
  profiles: Profile[];
  classes: AcademicClass[];
  subjects: Subject[];
  initialValues: Assignment | null;
  saving: boolean;
  formError: string | null;
  onClose: () => void;
  onSubmit: (body: {
    profileId: string;
    classId: string;
    subjectId: string;
    seriesId?: string | null;
    weeklyHours: number;
    startDate: string;
    endDate?: string | null;
    isActive?: boolean;
  }) => void;
  isEdit?: boolean;
}

function AssignmentsFormModal({
  profiles,
  classes,
  subjects,
  initialValues,
  saving,
  formError,
  onClose,
  onSubmit,
  isEdit,
}: FormModalProps) {
  const [profileId, setProfileId] = useState(initialValues?.profileId ?? '');
  const [classId, setClassId] = useState(initialValues?.classId ?? '');
  const [subjectId, setSubjectId] = useState(initialValues?.subjectId ?? '');
  const [weeklyHours, setWeeklyHours] = useState(
    initialValues?.weeklyHours ?? 0
  );
  const [startDate, setStartDate] = useState(
    initialValues?.startDate?.slice(0, 10) ?? ''
  );
  const [endDate, setEndDate] = useState(
    initialValues?.endDate?.slice(0, 10) ?? ''
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId || !classId || !subjectId || weeklyHours <= 0 || !startDate) {
      return;
    }
    onSubmit({
      profileId,
      classId,
      subjectId,
      weeklyHours,
      startDate,
      endDate: endDate || null,
      ...(isEdit && { isActive }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">
          {isEdit ? 'Modifier l’affectation' : 'Nouvelle affectation'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Enseignant (profil)
              </label>
              <select
                required
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.teacher.lastName} {p.teacher.firstName} (max {p.maxWeeklyHours}h)
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Classe
              </label>
              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Matière
              </label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Heures / semaine
            </label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              required
              value={weeklyHours || ''}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Date début
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Date fin (optionnel)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Affectation active
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
