/**
 * FederisGradesPage — Module « Notes et Moyennes » (Academia Federis)
 *
 * Reproduction du module Examen d'Academia Helm, adapté aux examens
 * nationaux (2026-09-29) :
 *   1. L'interface demande D'ABORD le type d'examen : CEP | BEPC | BAC | CAP
 *      (onglets dédiés — jamais de mélange, pattern module Candidats) ;
 *   2. Le tableau de saisie s'adapte au type :
 *        · CEP → saisie du PRIMAIRE (sans coefficients) ;
 *        · BEPC / BAC / CAP → saisie du SECONDAIRE avec coefficients ;
 *   3. Trois sous-onglets : Saisie des notes | Registre des notes |
 *      Relevés de notes (le « bulletin » Helm, renommé relevé) ;
 *   4. Gestion des matières et coefficients (jeu officiel initialisable en
 *      un clic, puis ajustable — séries du BAC, filières du CAP…).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite } from '@/lib/patronat/permissions';
import { useFederisExams, EXAM_STATUS_LABELS } from '@/hooks/useFederisExams';
import { FedPage, FedCountUp } from '@/components/federis/federis-motion';
import FederisGradeSheetTab from '@/components/federis/FederisGradeSheetTab';
import FederisGradeRegistryTab from '@/components/federis/FederisGradeRegistryTab';
import FederisGradeRelevesTab from '@/components/federis/FederisGradeRelevesTab';

/** Ordre canonique des types d'examen (catégorisation — jamais de mélange). */
const EXAM_TYPES: Array<{ type: 'CEP' | 'BEPC' | 'BAC' | 'CAP'; label: string }> = [
  { type: 'CEP', label: 'CEP' },
  { type: 'BEPC', label: 'BEPC' },
  { type: 'BAC', label: 'Baccalauréat' },
  { type: 'CAP', label: 'CAP' },
];

const TYPE_MODEL_LABEL: Record<string, string> = {
  CEP: 'Saisie du primaire — sans coefficients',
  BEPC: 'Saisie du secondaire — avec coefficients',
  BAC: 'Saisie du secondaire — avec coefficients',
  CAP: 'Saisie du secondaire — avec coefficients',
};

type SubTab = 'saisie' | 'registre' | 'releves';

const SUB_TABS: Array<{ key: SubTab; label: string }> = [
  { key: 'saisie', label: 'Saisie des notes' },
  { key: 'registre', label: 'Registre des notes' },
  { key: 'releves', label: 'Relevés de notes' },
];

interface SubjectRow {
  id: string;
  code: string;
  name: string;
  coefficient: number;
  maxScore: number;
  passingScore: number | null;
  duration: number | null;
  order: number;
  gradedCount: number;
}

interface SubjectsPayload {
  examType: string;
  isPrimary: boolean;
  totalCandidates: number;
  subjects: SubjectRow[];
  defaults: Array<{ code: string; name: string; coefficient: number }>;
}

interface FederisGradesPageProps {
  tenantId?: string;
  userRole?: string | null;
}

export default function FederisGradesPage({ userRole }: FederisGradesPageProps) {
  const { exams, examId, setExamId, loading: examsLoading } = useFederisExams();

  // ── Sous-onglet actif (reset au changement d'examen) ────────────────────
  const [subTab, setSubTab] = useState<SubTab>('saisie');
  useEffect(() => {
    setSubTab('saisie');
  }, [examId]);

  // ── Matières (gestion + version pour recharger les onglets) ─────────────
  const [manageOpen, setManageOpen] = useState(false);
  const [subjectsPayload, setSubjectsPayload] = useState<SubjectsPayload | null>(null);
  const [subjectsVersion, setSubjectsVersion] = useState(0);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectNotice, setSubjectNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { coefficient?: number; maxScore?: number; name?: string }>>({});
  const [newSubject, setNewSubject] = useState({ code: '', name: '', coefficient: '1', maxScore: '20' });
  const [working, setWorking] = useState(false);

  const canManage = canWrite(userRole, 'candidates');

  const loadSubjects = useCallback(async () => {
    if (!examId) return;
    setSubjectsLoading(true);
    setSubjectError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/subjects`, { timeout: 20000 });
      setSubjectsPayload(res.data);
      setDraft({});
    } catch (err: any) {
      setSubjectError(err?.response?.data?.message ?? 'Impossible de charger les matières.');
    } finally {
      setSubjectsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    setManageOpen(false);
    void loadSubjects();
  }, [loadSubjects]);

  const bumpVersion = () => setSubjectsVersion((v) => v + 1);

  // ── Actions matières ────────────────────────────────────────────────────
  const initDefaults = async () => {
    if (!examId) return;
    setWorking(true);
    setSubjectError(null);
    setSubjectNotice(null);
    try {
      const res = await apiClient.post(`/federis/exams/${examId}/subjects/init`, {}, { timeout: 30000 });
      setSubjectNotice(res.data?.message ?? 'Matières officielles initialisées.');
      await loadSubjects();
      bumpVersion();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSubjectError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Initialisation impossible.');
    } finally {
      setWorking(false);
    }
  };

  const addSubject = async () => {
    if (!examId || !newSubject.code.trim() || !newSubject.name.trim()) {
      setSubjectError('Code et intitulé de la matière obligatoires.');
      return;
    }
    setWorking(true);
    setSubjectError(null);
    setSubjectNotice(null);
    try {
      await apiClient.post(
        `/federis/exams/${examId}/subjects`,
        {
          code: newSubject.code.trim(),
          name: newSubject.name.trim(),
          coefficient: Number(newSubject.coefficient.replace(',', '.')) || 1,
          maxScore: Number(newSubject.maxScore.replace(',', '.')) || 20,
        },
        { timeout: 20000 },
      );
      setSubjectNotice(`Matière « ${newSubject.name.trim()} » ajoutée.`);
      setNewSubject({ code: '', name: '', coefficient: '1', maxScore: '20' });
      await loadSubjects();
      bumpVersion();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSubjectError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Ajout impossible.');
    } finally {
      setWorking(false);
    }
  };

  const saveSubjectEdits = async () => {
    if (!examId || Object.keys(draft).length === 0) return;
    setWorking(true);
    setSubjectError(null);
    setSubjectNotice(null);
    try {
      for (const [subjectId, patch] of Object.entries(draft)) {
        const payload: Record<string, number | string> = {};
        if (patch.name !== undefined) payload.name = patch.name;
        if (patch.coefficient !== undefined) payload.coefficient = patch.coefficient;
        if (patch.maxScore !== undefined) payload.maxScore = patch.maxScore;
        await apiClient.patch(`/federis/exams/${examId}/subjects/${subjectId}`, payload, { timeout: 20000 });
      }
      setSubjectNotice(`${Object.keys(draft).length} matière(s) mise(s) à jour — notes coefficient recalculées.`);
      await loadSubjects();
      bumpVersion();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSubjectError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Enregistrement impossible.');
    } finally {
      setWorking(false);
    }
  };

  const removeSubject = async (subject: SubjectRow) => {
    if (!examId) return;
    if (subject.gradedCount > 0) {
      setSubjectError(
        `Impossible de supprimer « ${subject.name} » : ${subject.gradedCount} note(s) y sont rattachées. Effacez d'abord les notes dans la grille de saisie.`,
      );
      return;
    }
    setWorking(true);
    setSubjectError(null);
    setSubjectNotice(null);
    try {
      await apiClient.delete(`/federis/exams/${examId}/subjects/${subject.id}`, { timeout: 20000 });
      setSubjectNotice(`Matière « ${subject.name} » supprimée.`);
      await loadSubjects();
      bumpVersion();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSubjectError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Suppression impossible.');
    } finally {
      setWorking(false);
    }
  };

  // ── Catégorisation par type (pattern FederisCandidatesPage) ─────────────
  const examsByType = useMemo(() => {
    const map = new Map<string, typeof exams>();
    for (const ex of exams) {
      const key = ex.examType ?? 'CEP';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ex);
    }
    return map;
  }, [exams]);

  const selectedExam = exams.find((e) => e.id === examId) ?? null;
  const activeType = selectedExam?.examType ?? null;
  const activeTypeExams = activeType ? (examsByType.get(activeType) ?? []) : [];
  const subjects = subjectsPayload?.subjects ?? [];
  const totalCoefficients = subjects.reduce((sum, s) => sum + (s.coefficient ?? 1), 0);

  const switchType = (type: string) => {
    const first = (examsByType.get(type) ?? [])[0];
    if (first) setExamId(first.id);
  };

  const visibleTypes = EXAM_TYPES.filter((t) => (examsByType.get(t.type) ?? []).length > 0);
  const typeCount = (type: string) =>
    (examsByType.get(type) ?? []).reduce((sum, ex) => sum + (ex.candidatesCount ?? 0), 0);

  return (
    <FedPage className="space-y-8">
      {/* En-tête — style Helm : titre + description + KPI */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="fed-badge mb-2">Module notes et moyennes</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Notes et moyennes</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Saisie des notes, registre et relevés des examens nationaux — reproduit le module Examen
            d&apos;Academia Helm : saisie du <strong>primaire</strong> pour le CEP (sans coefficients),
            saisie du <strong>secondaire avec coefficients</strong> pour le BEPC, le BAC et le CAP.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              <FedCountUp value={selectedExam?.candidatesCount ?? 0} />
            </p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Candidats</p>
          </div>
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              <FedCountUp value={subjects.length} />
            </p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Matières</p>
          </div>
          {activeType && activeType !== 'CEP' && (
            <div className="fed-card px-6 py-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {String(totalCoefficients).replace('.', ',')}
              </p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">Σ coefficients</p>
            </div>
          )}
        </div>
      </div>

      {/* ⭐ 1. Sélection du type d'examen : CEP | BEPC | BAC | CAP */}
      {examsLoading ? (
        <div className="fed-card px-6 py-4 text-sm font-bold text-slate-400">Chargement des campagnes…</div>
      ) : visibleTypes.length === 0 ? (
        <div className="fed-card px-6 py-8 text-center">
          <p className="text-sm font-bold text-slate-500">
            Aucun examen — créez d&apos;abord une campagne dans le module Examens nationaux.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Type d'examen">
          {visibleTypes.map((t) => {
            const isActive = activeType === t.type;
            return (
              <button
                key={t.type}
                role="tab"
                aria-selected={isActive}
                onClick={() => switchType(t.type)}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all',
                  isActive
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-900/40 hover:text-blue-900',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'ml-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold',
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {typeCount(t.type)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sélecteur de campagne + modèle + gestion des matières */}
      {examId && (
        <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Campagne</span>
          {activeTypeExams.length === 1 ? (
            <span className="text-sm font-bold text-blue-900">
              {selectedExam?.code} — {selectedExam?.name}
            </span>
          ) : (
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="fed-input-light flex-1 !w-auto font-bold px-4 py-2.5"
            >
              {activeTypeExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.code} — {exam.name} ({EXAM_STATUS_LABELS[exam.status] ?? exam.status})
                </option>
              ))}
            </select>
          )}
          {activeType && (
            <span className="text-[9px] font-black uppercase tracking-wide bg-blue-50 text-blue-900 border border-blue-100 px-3 py-1.5 rounded-lg">
              {TYPE_MODEL_LABEL[activeType]}
            </span>
          )}
          {canManage && (
            <button
              onClick={() => setManageOpen((v) => !v)}
              className="px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-blue-900/20 text-blue-900 hover:bg-blue-50 transition-colors lg:ml-auto"
            >
              {manageOpen ? 'Fermer les matières' : 'Matières et coefficients'}
            </button>
          )}
        </div>
      )}

      {/* Panneau de gestion des matières (coordonnateur / organisateur / secrétaire) */}
      {examId && manageOpen && canManage && (
        <div className="fed-card p-6 lg:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-blue-900 uppercase">Matières et coefficients</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                {subjectsPayload?.isPrimary
                  ? 'CEP — modèle du primaire : les coefficients ne sont pas utilisés dans les calculs (moyenne simple).'
                  : 'BEPC / BAC / CAP — modèle du secondaire : chaque note est pondérée par le coefficient de la matière (moyenne = Σ(note × coef) / Σ(coef)). Modifiez un coefficient : les notes coefficient déjà saisies sont recalculées.'}
              </p>
            </div>
            <button
              onClick={initDefaults}
              disabled={working}
              className="fed-btn-navy px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50 shrink-0"
              title="Ajouter le jeu officiel de matières du type d'examen (les codes déjà présents sont ignorés)"
            >
              {working ? '…' : 'Initialiser les matières officielles'}
            </button>
          </div>

          {subjectsLoading ? (
            <p className="text-xs font-bold text-slate-400 py-4 text-center">Chargement des matières…</p>
          ) : subjects.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-5 text-center">
              <p className="text-sm font-bold text-amber-800">Aucune matière définie pour cette campagne</p>
              <p className="text-xs text-amber-700 mt-1">
                Initialisez le jeu officiel ({(subjectsPayload?.defaults ?? []).map((d) => d.code).join(', ')}) ou
                ajoutez vos matières ci-dessous — indispensable avant la saisie des notes.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-[#f7f9fc]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Intitulé</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Coefficient</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Barème</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Notes saisies</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {subjects.map((s) => {
                    const patch = draft[s.id] ?? {};
                    return (
                      <tr key={s.id} className="hover:bg-[#f7f9fc]">
                        <td className="px-4 py-2.5">
                          <span className="inline-block bg-blue-50 border border-blue-100 text-blue-900 font-mono font-bold text-[10px] px-2.5 py-1 rounded-lg">
                            {s.code}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={patch.name ?? s.name}
                            onChange={(e) => setDraft((prev) => ({ ...prev, [s.id]: { ...prev[s.id], name: e.target.value } }))}
                            className="fed-input-light px-3 py-1.5 text-xs font-bold !w-56"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="20"
                            value={patch.coefficient ?? s.coefficient}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [s.id]: { ...prev[s.id], coefficient: Number(e.target.value) },
                              }))
                            }
                            className="w-20 text-center text-xs font-bold rounded-lg border border-slate-200 px-2 py-1.5 focus:border-blue-600 outline-none"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="number"
                            step="5"
                            min="5"
                            max="100"
                            value={patch.maxScore ?? s.maxScore}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [s.id]: { ...prev[s.id], maxScore: Number(e.target.value) },
                              }))
                            }
                            className="w-20 text-center text-xs font-bold rounded-lg border border-slate-200 px-2 py-1.5 focus:border-blue-600 outline-none"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-600">{s.gradedCount}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => removeSubject(s)}
                            disabled={working}
                            className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 disabled:opacity-50"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Ajout manuel */}
          <div className="bg-[#f7f9fc] border border-blue-100 rounded-xl p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Ajouter une matière</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newSubject.code}
                onChange={(e) => setNewSubject((s) => ({ ...s, code: e.target.value }))}
                placeholder="Code (ex. ANG)"
                className="fed-input-light px-3 py-2 text-xs font-bold !w-32"
              />
              <input
                type="text"
                value={newSubject.name}
                onChange={(e) => setNewSubject((s) => ({ ...s, name: e.target.value }))}
                placeholder="Intitulé (ex. Anglais)"
                className="fed-input-light px-3 py-2 text-xs font-bold flex-1 min-w-[180px]"
              />
              <input
                type="text"
                value={newSubject.coefficient}
                onChange={(e) => setNewSubject((s) => ({ ...s, coefficient: e.target.value }))}
                placeholder="Coef"
                className="fed-input-light px-3 py-2 text-xs font-bold !w-20 text-center"
              />
              <input
                type="text"
                value={newSubject.maxScore}
                onChange={(e) => setNewSubject((s) => ({ ...s, maxScore: e.target.value }))}
                placeholder="/20"
                className="fed-input-light px-3 py-2 text-xs font-bold !w-20 text-center"
              />
              <button
                onClick={addSubject}
                disabled={working}
                className="fed-btn-navy px-5 py-2 text-[10px] font-bold uppercase disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </div>

          {Object.keys(draft).length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={saveSubjectEdits}
                disabled={working}
                className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
              >
                {working ? 'Enregistrement…' : `Enregistrer les modifications (${Object.keys(draft).length})`}
              </button>
              <button
                onClick={() => setDraft({})}
                className="px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600"
              >
                Annuler
              </button>
            </div>
          )}

          {subjectError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm font-semibold text-red-800">{subjectError}</div>
          )}
          {subjectNotice && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm font-semibold text-emerald-800">{subjectNotice}</div>
          )}
        </div>
      )}

      {/* ⭐ 2. Sous-onglets : Saisie | Registre | Relevés */}
      {examId && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections du module notes">
          {SUB_TABS.map((t) => {
            const isActive = subTab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSubTab(t.key)}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all',
                  isActive
                    ? 'bg-white text-blue-900 border-blue-900 shadow-sm'
                    : 'bg-white/60 text-slate-500 border-slate-200 hover:border-blue-900/40 hover:text-blue-900',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ⭐ 3. Contenu du sous-onglet */}
      {examId && subTab === 'saisie' && (
        <FederisGradeSheetTab
          key={`saisie-${examId}`}
          examId={examId}
          canWrite={canManage}
          subjectsVersion={subjectsVersion}
          onManageSubjects={() => setManageOpen(true)}
        />
      )}
      {examId && subTab === 'registre' && (
        <FederisGradeRegistryTab key={`registre-${examId}`} examId={examId} subjectsVersion={subjectsVersion} />
      )}
      {examId && subTab === 'releves' && (
        <FederisGradeRelevesTab key={`releves-${examId}`} examId={examId} subjectsVersion={subjectsVersion} />
      )}
    </FedPage>
  );
}
