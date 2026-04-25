/**
 * ============================================================================
 * MODULE 2 : EMPLOIS DU TEMPS (SM5)
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowLeft, Trash2, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import { pedagogyFetch, academicStructureUrl } from '@/lib/pedagogy/academic-structure-client';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SchoolLevelRef { id: string; code: string; label: string }

interface Timetable {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  schoolLevel?: SchoolLevelRef;
  academicYear?: { id: string; label: string };
  entries?: TimetableEntry[];
}

interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  class?: { id: string; name: string };
  subject?: { id: string; name: string; code?: string };
  teacher?: { id: string; firstName: string; lastName: string };
  room?: { id: string; name: string };
}

interface AcademicClass { id: string; name: string; code: string }
interface Subject { id: string; name: string; code?: string }
interface Teacher { id: string; firstName: string; lastName: string }
interface Room { id: string; name: string; code?: string }

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_INDICES = [0, 1, 2, 3, 4, 5];

const DEFAULT_TIME_SLOTS = [
  { start: '07:30', end: '08:30' },
  { start: '08:30', end: '09:30' },
  { start: '09:30', end: '10:30' },
  { start: '10:30', end: '11:30' },
  { start: '11:30', end: '12:30' },
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
  { start: '17:00', end: '18:00' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TimetablesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();

  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [activeTimetable, setActiveTimetable] = useState<Timetable | null>(null);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create timetable modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', schoolLevelId: '', startDate: '', endDate: '' });
  const [createError, setCreateError] = useState<string | null>(null);

  // Create entry modal
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryDay, setEntryDay] = useState(0);
  const [entrySlot, setEntrySlot] = useState(DEFAULT_TIME_SLOTS[0]);
  const [entryForm, setEntryForm] = useState({ classId: '', subjectId: '', teacherId: '', roomId: '', startTime: '', endTime: '' });
  const [entryError, setEntryError] = useState<string | null>(null);

  // ─── Loaders ────────────────────────────────────────────────────────────

  const loadTimetables = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevel?.id && schoolLevel.id !== 'ALL') {
        params.set('schoolLevelId', schoolLevel.id);
      }
      const data = await pedagogyFetch<Timetable[]>(`/api/timetables?${params}`);
      setTimetables(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, schoolLevel?.id]);

  const loadTimetableDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await pedagogyFetch<Timetable>(`/api/timetables/${id}`);
      setActiveTimetable(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadResources = useCallback(async () => {
    if (!academicYear?.id) return;
    const yearParam = `academicYearId=${academicYear.id}`;
    try {
      const [cls, sub, tch, rms] = await Promise.allSettled([
        pedagogyFetch<AcademicClass[]>(academicStructureUrl('classes', { academicYearId: academicYear.id })),
        pedagogyFetch<Subject[]>(`/api/subjects?${yearParam}`),
        pedagogyFetch<Teacher[]>(`/api/teachers?${yearParam}`),
        pedagogyFetch<Room[]>(`/api/pedagogy/academic-structure/rooms?${yearParam}`).catch(() => []),
      ]);
      if (cls.status === 'fulfilled') setClasses(cls.value);
      if (sub.status === 'fulfilled') setSubjects(sub.value);
      if (tch.status === 'fulfilled') setTeachers(tch.value);
      if (rms.status === 'fulfilled') setRooms(rms.value as Room[]);
    } catch { /* non-blocking */ }
  }, [academicYear?.id]);

  useEffect(() => { loadTimetables(); }, [loadTimetables]);
  useEffect(() => { loadResources(); }, [loadResources]);

  // ─── Create timetable ────────────────────────────────────────────────────

  const handleCreateTimetable = async () => {
    if (!createForm.name.trim() || !createForm.schoolLevelId || !createForm.startDate || !academicYear) {
      setCreateError('Nom, niveau scolaire et date de début sont requis.');
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const data = await pedagogyFetch<Timetable>('/api/timetables', {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          schoolLevelId: createForm.schoolLevelId,
          name: createForm.name.trim(),
          description: createForm.description.trim() || undefined,
          startDate: new Date(createForm.startDate).toISOString(),
          endDate: createForm.endDate ? new Date(createForm.endDate).toISOString() : undefined,
        },
      });
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', schoolLevelId: '', startDate: '', endDate: '' });
      await loadTimetables();
      // Open the new timetable right away
      loadTimetableDetail(data.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erreur création');
    } finally {
      setSaving(false);
    }
  };

  // ─── Create entry ────────────────────────────────────────────────────────

  const openEntryModal = (day: number, slot: { start: string; end: string }) => {
    setEntryDay(day);
    setEntrySlot(slot);
    setEntryForm({ classId: '', subjectId: '', teacherId: '', roomId: '', startTime: slot.start, endTime: slot.end });
    setEntryError(null);
    setShowEntryModal(true);
  };

  const handleCreateEntry = async () => {
    if (!activeTimetable || !academicYear) return;
    if (!entryForm.classId || !entryForm.subjectId || !entryForm.startTime || !entryForm.endTime) {
      setEntryError('Classe, matière et horaires sont requis.');
      return;
    }
    setSaving(true);
    setEntryError(null);
    try {
      await pedagogyFetch(`/api/timetables/${activeTimetable.id}/entries`, {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          schoolLevelId: activeTimetable.schoolLevel?.id,
          dayOfWeek: entryDay,
          startTime: entryForm.startTime,
          endTime: entryForm.endTime,
          classId: entryForm.classId || undefined,
          subjectId: entryForm.subjectId || undefined,
          teacherId: entryForm.teacherId || undefined,
          roomId: entryForm.roomId || undefined,
        },
      });
      setShowEntryModal(false);
      await loadTimetableDetail(activeTimetable.id);
    } catch (e) {
      setEntryError(e instanceof Error ? e.message : 'Erreur création (conflit ?)');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Supprimer ce créneau ?') || !activeTimetable) return;
    try {
      await pedagogyFetch<null>(`/api/timetables/entries/${entryId}`, { method: 'DELETE' });
      loadTimetableDetail(activeTimetable.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur suppression');
    }
  };

  // ─── Grid helpers ────────────────────────────────────────────────────────

  const getEntry = (day: number, slot: { start: string; end: string }) => {
    return activeTimetable?.entries?.find(
      (e) => e.dayOfWeek === day && e.startTime === slot.start
    );
  };

  const activeDays = DAY_INDICES.filter((d) => {
    if (d === 5) {
      // Only show Saturday if there are entries or we're in a context that uses it
      return activeTimetable?.entries?.some((e) => e.dayOfWeek === 5);
    }
    return true;
  });

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <ModuleContainer
        header={{
          title: activeTimetable ? activeTimetable.name : 'Emplois du temps',
          description: activeTimetable
            ? `${activeTimetable.schoolLevel?.label ?? ''} — ${activeTimetable.academicYear?.label ?? ''}`
            : 'Gérer les grilles horaires par classe',
          icon: 'calendar',
          actions: (
            <div className="flex items-center gap-2">
              {activeTimetable ? (
                <button
                  onClick={() => setActiveTimetable(null)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la liste
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCreateForm({ ...createForm, schoolLevelId: schoolLevel?.id !== 'ALL' ? (schoolLevel?.id ?? '') : '' });
                    setCreateError(null);
                    setShowCreateModal(true);
                  }}
                  disabled={!academicYear}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Nouvel emploi du temps
                </button>
              )}
            </div>
          ),
        }}
        subModules={{
          modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
          }),
        }}
        content={{
          layout: 'custom',
          children: (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {!academicYear?.id ? (
                <p className="text-gray-500 text-center py-10">Sélectionnez une année scolaire.</p>
              ) : loading ? (
                <div className="flex items-center gap-2 text-gray-600 py-10 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Chargement…
                </div>
              ) : !activeTimetable ? (
                /* ── List view ── */
                <div>
                  {timetables.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>Aucun emploi du temps pour cette année.</p>
                      <p className="text-sm mt-1">Créez un premier emploi du temps pour commencer.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {timetables.map((tt) => (
                        <div key={tt.id}
                          onClick={() => loadTimetableDetail(tt.id)}
                          className="border rounded-lg p-4 bg-white hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium text-gray-900">{tt.name}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${tt.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {tt.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                          {tt.description && <p className="text-sm text-gray-500 mb-2">{tt.description}</p>}
                          <div className="text-xs text-gray-400 space-y-1">
                            {tt.schoolLevel && <p>Niveau : {tt.schoolLevel.label}</p>}
                            <p>
                              Du {new Date(tt.startDate).toLocaleDateString('fr-FR')}
                              {tt.endDate && ` au ${new Date(tt.endDate).toLocaleDateString('fr-FR')}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Grid view ── */
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 text-xs font-medium text-gray-500 text-left">
                            Horaire
                          </th>
                          {activeDays.map((d) => (
                            <th key={d} className="px-3 py-2 bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 text-center min-w-[140px]">
                              {DAYS[d]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DEFAULT_TIME_SLOTS.map((slot) => (
                          <tr key={slot.start}>
                            <td className="px-3 py-2 border border-gray-200 bg-gray-50 text-xs text-gray-500 font-mono whitespace-nowrap">
                              {slot.start}–{slot.end}
                            </td>
                            {activeDays.map((d) => {
                              const entry = getEntry(d, slot);
                              return (
                                <td key={d} className="border border-gray-200 p-1 align-top bg-white">
                                  {entry ? (
                                    <div className="rounded bg-blue-50 border border-blue-200 p-1.5 relative group">
                                      {entry.subject && (
                                        <p className="font-medium text-blue-900 text-xs truncate">
                                          {entry.subject.code ? `${entry.subject.code} ` : ''}{entry.subject.name}
                                        </p>
                                      )}
                                      {entry.class && (
                                        <p className="text-blue-700 text-xs truncate">{entry.class.name}</p>
                                      )}
                                      {entry.teacher && (
                                        <p className="text-blue-500 text-xs truncate">
                                          {entry.teacher.lastName} {entry.teacher.firstName.charAt(0)}.
                                        </p>
                                      )}
                                      {entry.room && (
                                        <p className="text-blue-400 text-xs truncate">{entry.room.name}</p>
                                      )}
                                      <button
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                                        title="Supprimer ce créneau"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => openEntryModal(d, slot)}
                                      className="w-full h-full min-h-[56px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-gray-300 hover:text-blue-400"
                                      title="Ajouter un créneau"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs text-gray-400">
                      Cliquez sur une cellule vide pour ajouter un créneau. Survolez un créneau pour le supprimer.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ),
        }}
      />

      {/* ── Create timetable modal ───────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Nouvel emploi du temps</h2>
            <div className="space-y-4">
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
                <input type="text" value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Emploi du temps 6ème A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire <span className="text-red-500">*</span></label>
                <select value={createForm.schoolLevelId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, schoolLevelId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">— Sélectionner —</option>
                  {availableLevels.filter((l) => l.id !== 'ALL').map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début <span className="text-red-500">*</span></label>
                  <input type="date" value={createForm.startDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input type="date" value={createForm.endDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description optionnelle"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} disabled={saving}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleCreateTimetable} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create entry modal ───────────────────────────────────────── */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold">Ajouter un créneau</h2>
            <p className="text-sm text-gray-500 mb-4">
              {DAYS[entryDay]} — {entrySlot.start} à {entrySlot.end}
            </p>
            <div className="space-y-3">
              {entryError && <p className="text-sm text-red-600">{entryError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Classe <span className="text-red-500">*</span></label>
                <select value={entryForm.classId}
                  onChange={(e) => setEntryForm((f) => ({ ...f, classId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">— Choisir une classe —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matière <span className="text-red-500">*</span></label>
                <select value={entryForm.subjectId}
                  onChange={(e) => setEntryForm((f) => ({ ...f, subjectId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">— Choisir une matière —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enseignant</label>
                <select value={entryForm.teacherId}
                  onChange={(e) => setEntryForm((f) => ({ ...f, teacherId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">— Choisir un enseignant —</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.lastName} {t.firstName}</option>)}
                </select>
              </div>
              {rooms.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salle</label>
                  <select value={entryForm.roomId}
                    onChange={(e) => setEntryForm((f) => ({ ...f, roomId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">— Choisir une salle —</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
                  <input type="time" value={entryForm.startTime}
                    onChange={(e) => setEntryForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
                  <input type="time" value={entryForm.endTime}
                    onChange={(e) => setEntryForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowEntryModal(false)} disabled={saving}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleCreateEntry} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
