/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - ENSEIGNANTS ACADÉMIQUES
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit, Archive, Eye, Search, Users,
  BookOpen, Layers, X, CheckCircle, ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import {
  ModuleContainer,
  FormModal,
  ConfirmModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import { pedagogyFetch, academicStructureUrl } from '@/lib/pedagogy/academic-structure-client';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AcademicLevel { id: string; name: string }   // pedagogy levels (habilitations)
interface Subject { id: string; code: string; name: string }

interface SubjectQualification {
  id: string;
  subjectId: string;
  certified: boolean;
  subject: { id: string; code: string; name: string };
}
interface LevelAuthorization {
  id: string;
  levelId: string;
  level: { id: string; name: string };
}
interface AcademicProfile {
  id: string;
  maxWeeklyHours: number;
  isSemainier: boolean;
  isActive: boolean;
  subjectQualifications: SubjectQualification[];
  levelAuthorizations: LevelAuthorization[];
}

interface Teacher {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender?: string;
  email?: string;
  phone?: string;
  position?: string;
  specialization?: string;
  contractType?: string;
  status: string;
  schoolLevel?: { id: string; code: string; label: string };
  department?: { id: string; name: string };
  teacherSubjects?: { subject: { id: string; code: string; name: string } }[];
}

type ModalState = 'none' | 'create' | 'edit' | 'view' | 'archive';
type ViewTab = 'info' | 'habilitations';

const emptyForm = {
  firstName: '',
  lastName: '',
  gender: '',
  email: '',
  phone: '',
  schoolLevelId: '',
  position: '',
  specialization: '',
  contractType: '',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  archived: 'Archivé',
  inactive: 'Inactif',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
  inactive: 'bg-yellow-100 text-yellow-800',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function TeachersPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>('none');
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [search, setSearch] = useState('');
  const [filterLevelId, setFilterLevelId] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  // Habilitations state
  const [viewTab, setViewTab] = useState<ViewTab>('info');
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [addSubjectId, setAddSubjectId] = useState('');
  const [addLevelId, setAddLevelId] = useState('');
  const [habSaving, setHabSaving] = useState(false);

  // ─── Loaders ────────────────────────────────────────────────────────────

  const loadTeachers = useCallback(async () => {
    if (!academicYear || !schoolLevel) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (schoolLevel.id !== 'ALL') params.set('schoolLevelId', filterLevelId || schoolLevel.id);
      if (filterLevelId) params.set('schoolLevelId', filterLevelId);
      if (filterStatus) params.set('status', filterStatus);
      if (search) params.set('search', search);
      const data = await pedagogyFetch<Teacher[]>(`/api/teachers?${params}`);
      setTeachers(data);
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors du chargement des enseignants');
    } finally {
      setIsLoading(false);
    }
  }, [academicYear, schoolLevel, search, filterLevelId, filterStatus]);

  const loadAcademicLevels = useCallback(async () => {
    if (!academicYear) return;
    try {
      const data = await pedagogyFetch<AcademicLevel[]>(
        academicStructureUrl('levels', { academicYearId: academicYear.id })
      );
      setAcademicLevels(data);
    } catch { /* non-blocking */ }
  }, [academicYear]);

  const loadSubjects = useCallback(async () => {
    if (!academicYear) return;
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      const data = await pedagogyFetch<Subject[]>(`/api/subjects?${params}`);
      setAllSubjects(data);
    } catch { /* non-blocking */ }
  }, [academicYear]);

  const loadProfile = useCallback(async (teacherId: string) => {
    if (!academicYear) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await pedagogyFetch<AcademicProfile>(
        `/api/pedagogy/teacher-profiles/by-teacher/${teacherId}?academicYearId=${academicYear.id}`
      );
      setProfile(data);
    } catch (err: any) {
      if (err?.message?.includes('404') || err?.message?.toLowerCase().includes('not found')) {
        setProfile(null);
      } else {
        setProfileError(err?.message ?? 'Erreur profil');
      }
    } finally {
      setProfileLoading(false);
    }
  }, [academicYear]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);
  useEffect(() => { loadAcademicLevels(); loadSubjects(); }, [loadAcademicLevels, loadSubjects]);

  // ─── Modal helpers ───────────────────────────────────────────────────────

  const openCreate = () => {
    setSelected(null);
    setForm({ ...emptyForm, schoolLevelId: schoolLevel?.id !== 'ALL' ? (schoolLevel?.id ?? '') : '' });
    setSaveError(null);
    setModal('create');
  };

  const openEdit = (teacher: Teacher) => {
    setSelected(teacher);
    setForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      gender: teacher.gender ?? '',
      email: teacher.email ?? '',
      phone: teacher.phone ?? '',
      schoolLevelId: teacher.schoolLevel?.id ?? '',
      position: teacher.position ?? '',
      specialization: teacher.specialization ?? '',
      contractType: teacher.contractType ?? '',
    });
    setSaveError(null);
    setModal('edit');
  };

  const openView = (teacher: Teacher) => {
    setSelected(teacher);
    setViewTab('info');
    setProfile(null);
    setAddSubjectId('');
    setAddLevelId('');
    setModal('view');
    loadProfile(teacher.id);
  };

  const closeModal = () => {
    setModal('none');
    setSelected(null);
    setSaveError(null);
  };

  // ─── CRUD ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.schoolLevelId) {
      setSaveError('Prénom, Nom et Niveau scolaire sont requis.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        schoolLevelId: form.schoolLevelId,
        gender: form.gender || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        position: form.position.trim() || undefined,
        specialization: form.specialization.trim() || undefined,
        contractType: form.contractType || undefined,
      };
      if (modal === 'edit' && selected) {
        await pedagogyFetch(`/api/teachers/${selected.id}`, { method: 'PUT', body: payload });
      } else {
        await pedagogyFetch('/api/teachers', { method: 'POST', body: payload });
      }
      closeModal();
      loadTeachers();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await pedagogyFetch<null>(`/api/teachers/${selected.id}/archive`, { method: 'POST' });
      closeModal();
      loadTeachers();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Erreur lors de l\'archivage');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Habilitations ───────────────────────────────────────────────────────

  const ensureProfile = async (): Promise<AcademicProfile | null> => {
    if (profile) return profile;
    if (!selected || !academicYear) return null;
    setHabSaving(true);
    try {
      const created = await pedagogyFetch<AcademicProfile>('/api/pedagogy/teacher-profiles', {
        method: 'POST',
        body: { academicYearId: academicYear.id, teacherId: selected.id, maxWeeklyHours: 20 },
      });
      setProfile(created);
      return created;
    } catch (err: any) {
      setProfileError(err?.message ?? 'Impossible de créer le profil');
      return null;
    } finally {
      setHabSaving(false);
    }
  };

  const addSubjectQualification = async () => {
    if (!addSubjectId || !academicYear) return;
    const p = await ensureProfile();
    if (!p) return;
    setHabSaving(true);
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-profiles/${p.id}/qualifications`, {
        method: 'POST',
        body: { academicYearId: academicYear.id, subjectId: addSubjectId },
      });
      setAddSubjectId('');
      await loadProfile(selected!.id);
    } catch (err: any) {
      setProfileError(err?.message ?? 'Erreur ajout matière');
    } finally {
      setHabSaving(false);
    }
  };

  const removeSubjectQualification = async (subjectId: string) => {
    if (!profile) return;
    setHabSaving(true);
    try {
      await pedagogyFetch<null>(
        `/api/pedagogy/teacher-profiles/${profile.id}/qualifications/${subjectId}`,
        { method: 'DELETE' }
      );
      await loadProfile(selected!.id);
    } catch (err: any) {
      setProfileError(err?.message ?? 'Erreur suppression matière');
    } finally {
      setHabSaving(false);
    }
  };

  const addLevelAuthorization = async () => {
    if (!addLevelId || !academicYear) return;
    const p = await ensureProfile();
    if (!p) return;
    setHabSaving(true);
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-profiles/${p.id}/level-authorizations`, {
        method: 'POST',
        body: { academicYearId: academicYear.id, levelId: addLevelId },
      });
      setAddLevelId('');
      await loadProfile(selected!.id);
    } catch (err: any) {
      setProfileError(err?.message ?? 'Erreur ajout niveau');
    } finally {
      setHabSaving(false);
    }
  };

  const removeLevelAuthorization = async (levelId: string) => {
    if (!profile) return;
    setHabSaving(true);
    try {
      await pedagogyFetch<null>(
        `/api/pedagogy/teacher-profiles/${profile.id}/level-authorizations/${levelId}`,
        { method: 'DELETE' }
      );
      await loadProfile(selected!.id);
    } catch (err: any) {
      setProfileError(err?.message ?? 'Erreur suppression niveau');
    } finally {
      setHabSaving(false);
    }
  };

  // ─── Computed ────────────────────────────────────────────────────────────

  const qualifiedSubjectIds = new Set(profile?.subjectQualifications.map((q) => q.subjectId) ?? []);
  const authorizedLevelIds = new Set(profile?.levelAuthorizations.map((l) => l.levelId) ?? []);
  const availableSubjectsToAdd = allSubjects.filter((s) => !qualifiedSubjectIds.has(s.id));
  const availableAcademicLevelsToAdd = academicLevels.filter((l) => !authorizedLevelIds.has(l.id));

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Enseignants académiques',
          description: 'Profils, habilitations et charge horaire',
          icon: 'users',
          actions: (
            <div className="flex items-center gap-2">
              <Link
                href="/app/pedagogy/assignments"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ClipboardList className="h-4 w-4" />
                Affectations
              </Link>
              <button
                onClick={openCreate}
                disabled={!academicYear || !schoolLevel}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvel enseignant</span>
              </button>
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
          layout: 'table',
          isLoading,
          children: (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 px-4 pt-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher (nom, matricule, email)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {availableLevels.filter((l) => l.id !== 'ALL').length > 1 && (
                  <select
                    value={filterLevelId}
                    onChange={(e) => setFilterLevelId(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tous les niveaux</option>
                    {availableLevels.filter((l) => l.id !== 'ALL').map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                )}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les statuts</option>
                  <option value="active">Actifs</option>
                  <option value="inactive">Inactifs</option>
                  <option value="archived">Archivés</option>
                </select>
              </div>

              {error && (
                <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {error}
                </div>
              )}

              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matricule</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom & Prénom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Niveau</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spécialisation</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Matières</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teachers.length === 0 && !isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        Aucun enseignant trouvé
                      </td>
                    </tr>
                  ) : (
                    teachers.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                          {teacher.matricule}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {teacher.lastName} {teacher.firstName}
                          </div>
                          {teacher.email && (
                            <div className="text-xs text-gray-500">{teacher.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {teacher.schoolLevel?.label ?? '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {teacher.specialization ?? teacher.position ?? '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {teacher.teacherSubjects && teacher.teacherSubjects.length > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {teacher.teacherSubjects.length} matière{teacher.teacherSubjects.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[teacher.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[teacher.status] ?? teacher.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => openView(teacher)} className="text-blue-600 hover:text-blue-900" title="Voir" aria-label="Voir l'enseignant">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEdit(teacher)} className="text-yellow-600 hover:text-yellow-900" title="Modifier" aria-label="Modifier l'enseignant">
                              <Edit className="w-4 h-4" />
                            </button>
                            {teacher.status !== 'archived' && (
                              <button onClick={() => { setSelected(teacher); setModal('archive'); }} className="text-red-500 hover:text-red-700" title="Archiver" aria-label="Archiver l'enseignant">
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ),
        }}
      />

      {/* ── Create / Edit modal ─────────────────────────────────────────── */}
      <FormModal
        title={modal === 'edit' ? "Modifier l'enseignant" : 'Nouvel enseignant'}
        isOpen={modal === 'create' || modal === 'edit'}
        onClose={closeModal}
        size="lg"
        actions={
          <>
            <button onClick={closeModal} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? 'Enregistrement...' : modal === 'edit' ? 'Modifier' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{saveError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom <span className="text-red-500">*</span></label>
              <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Prénom" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
              <input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Nom de famille" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire <span className="text-red-500">*</span></label>
              <select value={form.schoolLevelId} onChange={(e) => setForm((f) => ({ ...f, schoolLevelId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Sélectionner —</option>
                {availableLevels.filter((l) => l.id !== 'ALL').map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
              <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Genre —</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@exemple.com" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+237 6XX XXX XXX" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Poste / Fonction</label>
              <input type="text" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder="Ex: Professeur titulaire" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Spécialisation</label>
              <input type="text" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} placeholder="Ex: Mathématiques" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de contrat</label>
            <select value={form.contractType} onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Type de contrat —</option>
              <option value="permanent">Permanent</option>
              <option value="temporary">Temporaire / Vacataire</option>
              <option value="part-time">Temps partiel</option>
              <option value="intern">Stagiaire</option>
            </select>
          </div>
        </div>
      </FormModal>

      {/* ── View + Habilitations modal ──────────────────────────────────── */}
      <ReadOnlyModal
        title={selected ? `${selected.lastName} ${selected.firstName}` : ''}
        isOpen={modal === 'view'}
        onClose={closeModal}
        size="lg"
      >
        {selected && (
          <div>
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex space-x-4">
                <button
                  onClick={() => setViewTab('info')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${viewTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Informations
                </button>
                <button
                  onClick={() => setViewTab('habilitations')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${viewTab === 'habilitations' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Habilitations
                  {profile && (
                    <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">
                      {profile.subjectQualifications.length + profile.levelAuthorizations.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Info tab */}
            {viewTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Matricule</p>
                    <p className="mt-1 text-sm font-mono font-semibold text-gray-900">{selected.matricule}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Statut</p>
                    <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[selected.status] ?? ''}`}>
                      {STATUS_LABELS[selected.status] ?? selected.status}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Niveau scolaire</p>
                    <p className="mt-1 text-sm text-gray-900">{selected.schoolLevel?.label ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Genre</p>
                    <p className="mt-1 text-sm text-gray-900">{selected.gender === 'M' ? 'Masculin' : selected.gender === 'F' ? 'Féminin' : '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                    <p className="mt-1 text-sm text-gray-900">{selected.email ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Téléphone</p>
                    <p className="mt-1 text-sm text-gray-900">{selected.phone ?? '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Poste</p>
                    <p className="mt-1 text-sm text-gray-900">{selected.position ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Spécialisation</p>
                    <p className="mt-1 text-sm text-gray-900">{selected.specialization ?? '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Type de contrat</p>
                  <p className="mt-1 text-sm text-gray-900">{selected.contractType ?? '—'}</p>
                </div>
              </div>
            )}

            {/* Habilitations tab */}
            {viewTab === 'habilitations' && (
              <div className="space-y-6">
                {profileLoading && (
                  <p className="text-sm text-gray-500 text-center py-4">Chargement du profil académique...</p>
                )}
                {profileError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{profileError}</div>
                )}

                {!profileLoading && (
                  <>
                    {/* Subjects */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">Matières enseignées</h3>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                        {(profile?.subjectQualifications ?? []).length === 0 ? (
                          <p className="text-xs text-gray-400">Aucune matière assignée</p>
                        ) : (
                          profile?.subjectQualifications.map((q) => (
                            <span key={q.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-800">
                              {q.certified && <CheckCircle className="w-3 h-3 text-blue-600" />}
                              <span className="font-mono">{q.subject.code}</span>
                              <span>{q.subject.name}</span>
                              <button onClick={() => removeSubjectQualification(q.subjectId)} disabled={habSaving} className="ml-1 text-blue-400 hover:text-red-500 disabled:opacity-50">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      {availableSubjectsToAdd.length > 0 && (
                        <div className="flex gap-2">
                          <select value={addSubjectId} onChange={(e) => setAddSubjectId(e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Ajouter une matière...</option>
                            {availableSubjectsToAdd.map((s) => (
                              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                            ))}
                          </select>
                          <button onClick={addSubjectQualification} disabled={!addSubjectId || habSaving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                            {habSaving ? '...' : 'Ajouter'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Levels */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="w-4 h-4 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-900">Niveaux autorisés</h3>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                        {(profile?.levelAuthorizations ?? []).length === 0 ? (
                          <p className="text-xs text-gray-400">Aucun niveau assigné</p>
                        ) : (
                          profile?.levelAuthorizations.map((la) => (
                            <span key={la.id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs font-medium text-purple-800">
                              {la.level.name}
                              <button onClick={() => removeLevelAuthorization(la.levelId)} disabled={habSaving} className="ml-1 text-purple-400 hover:text-red-500 disabled:opacity-50">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      {availableAcademicLevelsToAdd.length > 0 && (
                        <div className="flex gap-2">
                          <select value={addLevelId} onChange={(e) => setAddLevelId(e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Ajouter un niveau...</option>
                            {availableAcademicLevelsToAdd.map((l) => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                          <button onClick={addLevelAuthorization} disabled={!addLevelId || habSaving} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50">
                            {habSaving ? '...' : 'Ajouter'}
                          </button>
                        </div>
                      )}
                    </div>

                    {!profile && !profileLoading && (
                      <p className="text-xs text-gray-400 text-center">
                        Le profil académique sera créé automatiquement lors de l'ajout d'une première habilitation.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </ReadOnlyModal>

      {/* ── Archive modal ────────────────────────────────────────────────── */}
      <ConfirmModal
        title="Archiver l'enseignant"
        message={`Archiver "${selected?.lastName} ${selected?.firstName}" ? L'enseignant ne sera plus actif mais ses données sont conservées.`}
        type="danger"
        isOpen={modal === 'archive'}
        onConfirm={handleArchive}
        onCancel={closeModal}
        confirmLabel={isSaving ? 'Archivage...' : 'Archiver'}
      />
    </>
  );
}
