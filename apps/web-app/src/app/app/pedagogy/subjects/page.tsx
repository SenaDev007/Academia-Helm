/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - MATIÈRES & PROGRAMMES
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, Search, BookOpen } from 'lucide-react';
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
import type { SchoolLevel } from '@/hooks/useSchoolLevel';

interface AcademicTrack {
  id: string;
  code: string;
  label: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  weeklyHours?: number;
  description?: string;
  language?: string;
  schoolLevel?: SchoolLevel;
  academicYear?: { id: string; label: string };
  academicTrack?: AcademicTrack;
}

type ModalState = 'none' | 'create' | 'edit' | 'view' | 'delete';

const emptyForm = {
  code: '',
  name: '',
  schoolLevelId: '',
  academicTrackId: '',
  language: '',
  coefficient: 1.0,
  weeklyHours: 0,
  description: '',
};

export default function SubjectsPage() {
  const { academicYear, schoolLevel, isBilingualEnabled } = useModuleContext();
  const { availableLevels } = useSchoolLevel();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tracks, setTracks] = useState<AcademicTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>('none');
  const [selected, setSelected] = useState<Subject | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [search, setSearch] = useState('');
  const [filterLevelId, setFilterLevelId] = useState('');
  const [filterLang, setFilterLang] = useState('');

  const loadSubjects = useCallback(async () => {
    if (!academicYear || !schoolLevel) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevel.id !== 'ALL') params.set('schoolLevelId', schoolLevel.id);
      if (search) params.set('search', search);
      if (filterLevelId) params.set('schoolLevelId', filterLevelId);

      const data = await pedagogyFetch<Subject[]>(`/api/subjects?${params}`);
      setSubjects(data);
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors du chargement des matières');
    } finally {
      setIsLoading(false);
    }
  }, [academicYear, schoolLevel, search, filterLevelId]);

  // school levels come from context (availableLevels) — no separate load needed

  const loadTracks = useCallback(async () => {
    if (!academicYear || !isBilingualEnabled) return;
    try {
      const data = await pedagogyFetch<AcademicTrack[]>(
        academicStructureUrl('tracks', { academicYearId: academicYear.id })
      );
      setTracks(data);
    } catch {
      // non-blocking
    }
  }, [academicYear, isBilingualEnabled]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const openCreate = () => {
    setSelected(null);
    setForm({
      ...emptyForm,
      schoolLevelId: schoolLevel?.id !== 'ALL' ? schoolLevel?.id ?? '' : '',
    });
    setSaveError(null);
    setModal('create');
  };

  const openEdit = (subject: Subject) => {
    setSelected(subject);
    setForm({
      code: subject.code,
      name: subject.name,
      schoolLevelId: subject.schoolLevel?.id ?? '',
      academicTrackId: subject.academicTrack?.id ?? '',
      language: subject.language ?? '',
      coefficient: subject.coefficient,
      weeklyHours: subject.weeklyHours ?? 0,
      description: subject.description ?? '',
    });
    setSaveError(null);
    setModal('edit');
  };

  const openView = (subject: Subject) => {
    setSelected(subject);
    setModal('view');
  };

  const openDelete = (subject: Subject) => {
    setSelected(subject);
    setModal('delete');
  };

  const closeModal = () => {
    setModal('none');
    setSelected(null);
    setSaveError(null);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.schoolLevelId) {
      setSaveError('Code, Nom et Niveau scolaire sont requis.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        schoolLevelId: form.schoolLevelId,
        coefficient: Number(form.coefficient) || 1.0,
        weeklyHours: Number(form.weeklyHours) || 0,
        description: form.description.trim() || undefined,
      };
      if (isBilingualEnabled) {
        if (form.academicTrackId) payload.academicTrackId = form.academicTrackId;
        if (form.language) payload.language = form.language;
      }

      if (modal === 'edit' && selected) {
        await pedagogyFetch(`/api/subjects/${selected.id}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        if (!academicYear) throw new Error('Année académique non sélectionnée');
        payload.academicYearId = academicYear.id;
        await pedagogyFetch('/api/subjects', {
          method: 'POST',
          body: payload,
        });
      }
      closeModal();
      loadSubjects();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await pedagogyFetch<null>(`/api/subjects/${selected.id}`, { method: 'DELETE' });
      closeModal();
      loadSubjects();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Erreur lors de la suppression');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = subjects.filter((s) => {
    if (filterLang && s.language !== filterLang) return false;
    return true;
  });

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Matières',
          description: 'Gestion des matières par niveau scolaire',
          icon: 'bookOpen',
          actions: (
            <button
              onClick={openCreate}
              disabled={!academicYear || !schoolLevel}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 px-4 pt-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou code..."
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
                {isBilingualEnabled && (
                  <select
                    value={filterLang}
                    onChange={(e) => setFilterLang(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Toutes les langues</option>
                    <option value="FR">Français</option>
                    <option value="EN">Anglais</option>
                  </select>
                )}
              </div>

              {error && (
                <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {error}
                </div>
              )}

              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Niveau
                    </th>
                    {isBilingualEnabled && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Langue
                      </th>
                    )}
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      H/sem
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coeff.
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.length === 0 && !isLoading ? (
                    <tr>
                      <td
                        colSpan={isBilingualEnabled ? 7 : 6}
                        className="px-6 py-12 text-center text-sm text-gray-500"
                      >
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        Aucune matière trouvée
                      </td>
                    </tr>
                  ) : (
                    filtered.map((subject) => (
                      <tr key={subject.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
                          {subject.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {subject.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {subject.schoolLevel?.label ?? '—'}
                        </td>
                        {isBilingualEnabled && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {subject.language ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                subject.language === 'EN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {subject.language === 'EN' ? 'Anglais' : 'Français'}
                              </span>
                            ) : '—'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                          {subject.weeklyHours ?? 0}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                          {subject.coefficient}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openView(subject)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Voir"
                              aria-label="Voir la matière"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEdit(subject)}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Modifier"
                              aria-label="Modifier la matière"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDelete(subject)}
                              className="text-red-600 hover:text-red-900"
                              title="Supprimer"
                              aria-label="Supprimer la matière"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Create / Edit modal */}
      <FormModal
        title={modal === 'edit' ? 'Modifier la matière' : 'Créer une matière'}
        isOpen={modal === 'create' || modal === 'edit'}
        onClose={closeModal}
        size="lg"
        actions={
          <>
            <button
              onClick={closeModal}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : modal === 'edit' ? 'Modifier' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="Ex: MATH"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Mathématiques"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Niveau scolaire <span className="text-red-500">*</span>
            </label>
            <select
              value={form.schoolLevelId}
              onChange={(e) => setForm((f) => ({ ...f, schoolLevelId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sélectionner un niveau —</option>
              {availableLevels.filter((l) => l.id !== 'ALL').map((l) => (
                <option key={l.id} value={l.id}>{l.label} ({l.code})</option>
              ))}
            </select>
          </div>

          {isBilingualEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Piste académique
                </label>
                <select
                  value={form.academicTrackId}
                  onChange={(e) => setForm((f) => ({ ...f, academicTrackId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Toutes les pistes —</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} ({t.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Langue d'enseignement
                </label>
                <select
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Langue —</option>
                  <option value="FR">Français</option>
                  <option value="EN">Anglais</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Volume horaire hebdomadaire (h)
              </label>
              <input
                type="number"
                min="0"
                max="40"
                value={form.weeklyHours}
                onChange={(e) => setForm((f) => ({ ...f, weeklyHours: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coefficient
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={form.coefficient}
                onChange={(e) => setForm((f) => ({ ...f, coefficient: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Objectifs pédagogiques
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Décrire les objectifs pédagogiques de cette matière..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>

      {/* View modal */}
      <ReadOnlyModal
        title={`Matière : ${selected?.name ?? ''}`}
        isOpen={modal === 'view'}
        onClose={closeModal}
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Code</p>
                <p className="mt-1 text-sm font-mono font-semibold text-gray-900">{selected.code}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Nom</p>
                <p className="mt-1 text-sm text-gray-900">{selected.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Niveau</p>
                <p className="mt-1 text-sm text-gray-900">{selected.schoolLevel?.label ?? '—'}</p>
              </div>
              {isBilingualEnabled && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Langue</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {selected.language === 'EN' ? 'Anglais' : selected.language === 'FR' ? 'Français' : '—'}
                  </p>
                </div>
              )}
            </div>
            {isBilingualEnabled && selected.academicTrack && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Piste académique</p>
                <p className="mt-1 text-sm text-gray-900">{selected.academicTrack.label}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Volume horaire</p>
                <p className="mt-1 text-sm text-gray-900">{selected.weeklyHours ?? 0}h / semaine</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Coefficient</p>
                <p className="mt-1 text-sm text-gray-900">{selected.coefficient}</p>
              </div>
            </div>
            {selected.description && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Objectifs pédagogiques</p>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
              </div>
            )}
          </div>
        )}
      </ReadOnlyModal>

      {/* Delete modal */}
      <ConfirmModal
        title="Supprimer la matière"
        message={`Êtes-vous sûr de vouloir supprimer "${selected?.name}" ? Cette action est irréversible.`}
        type="danger"
        isOpen={modal === 'delete'}
        onConfirm={handleDelete}
        onCancel={closeModal}
        confirmLabel={isSaving ? 'Suppression...' : 'Supprimer'}
      />
    </>
  );
}
