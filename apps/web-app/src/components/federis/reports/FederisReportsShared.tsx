/**
 * FederisReportsShared — Socle commun des onglets « Procès-verbal » et
 * « Statistiques » du module Rapports & Bilans (Academia Frederis).
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ T46 (2026-10-01) — Reproduction du module Examen d'Academia Helm
 * (ProcVerbalWorkspace / StatsWorkspace) pour les examens nationaux Federis.
 *
 * Les DEUX onglets partagent le même périmètre :
 *   1. une barre d'onglets par TYPE d'examen (CEP | BEPC | Baccalauréat | CAP,
 *      pattern des modules Délibération / Notes et Moyennes / Candidats —
 *      sélection par défaut = PREMIER type disponible, typiquement le CEP ⭐T45) ;
 *   2. un sélecteur de campagne (les examens du type actif) ;
 *   3. le REGISTRE DES NOTES officiel (module Notes et Moyennes) comme source
 *      unique des matières, notes, moyennes et rangs — les « vraies données
 *      Federis » (règles de calcul effectives du patronat).
 */

'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { useFederisExams, getExamStatusLabel } from '@/hooks/useFederisExams';
import type { GSubject, GCandidateRow } from '@/lib/federis/grade-computations';

// ─── Types d'examen (ordre canonique — même barre que les autres modules) ──
export const REPORT_EXAM_TYPES: Array<{ type: string; label: string }> = [
  { type: 'CEP', label: 'CEP' },
  { type: 'BEPC', label: 'BEPC' },
  { type: 'BAC', label: 'Baccalauréat' },
  { type: 'CAP', label: 'CAP' },
];

// ─── Registre des notes (réponse GET /federis/exams/:id/grades/registry) ────
export interface RegistryData {
  exam: {
    id: string;
    code: string;
    name: string;
    examType: string;
    isPrimary: boolean;
  };
  subjects: GSubject[];
  session: { allSubmitted: boolean; locked: boolean };
  stats: {
    totalCandidates: number;
    composed: number;
    passed: number;
    failed: number;
    successRate: number | null;
    generalAverage: number | null;
    bestAverage: number | null;
    worstAverage: number | null;
  };
  candidates: GCandidateRow[];
}

// ─── Hook : chargement du registre d'un examen ──────────────────────────────
export function useExamRegistry(examId: string | null) {
  const [data, setData] = useState<RegistryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/grades/registry`, {
        timeout: 30000,
      });
      setData(res.data);
    } catch (err: any) {
      setError(
        (Array.isArray(err?.response?.data?.message)
          ? err.response.data.message.join(' ')
          : err?.response?.data?.message) ?? 'Impossible de charger les données de l’examen.',
      );
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

// ─── Hook : catégorisation des examens par type + sélection courante ────────
export function useExamTypeScope() {
  const { exams, examId, setExamId, loading } = useFederisExams();

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
  const visibleTypes = REPORT_EXAM_TYPES.filter(
    (t) => (examsByType.get(t.type) ?? []).length > 0,
  );
  const typeCount = (type: string) =>
    (examsByType.get(type) ?? []).reduce((sum, ex) => sum + (ex.candidatesCount ?? 0), 0);
  const switchType = (type: string) => {
    const first = (examsByType.get(type) ?? [])[0];
    if (first) setExamId(first.id);
  };

  return {
    exams,
    examId,
    setExamId,
    examsLoading: loading,
    examsByType,
    selectedExam,
    activeType,
    activeTypeExams,
    visibleTypes,
    typeCount,
    switchType,
  };
}

export type ExamScope = ReturnType<typeof useExamTypeScope>;

// ─── Composant : barre d'onglets par type + sélecteur de campagne ───────────
//    (pattern exact de la page Délibération — CEP en premier, onglet actif
//     navy, compteur de candidats par type)
export function ExamScopeBar({ scope, right }: { scope: ExamScope; right?: ReactNode }) {
  const { examId, setExamId, activeType, activeTypeExams, selectedExam, visibleTypes, typeCount, switchType } =
    scope;

  return (
    <>
      {/* Barre d'onglets par type d'examen */}
      {scope.examsLoading ? (
        <div className="fed-card px-6 py-5 text-center text-sm font-bold text-slate-400">
          Chargement des campagnes…
        </div>
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
                type="button"
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

      {/* Sélecteur de campagne + statut */}
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
                  {exam.code} — {exam.name} ({getExamStatusLabel(exam.status)})
                </option>
              ))}
            </select>
          )}
          {selectedExam && (
            <span className="text-[9px] font-black uppercase tracking-wide bg-blue-50 text-blue-900 border border-blue-100 px-3 py-1.5 rounded-lg">
              {getExamStatusLabel(selectedExam.status)}
            </span>
          )}
          {right}
        </div>
      )}
    </>
  );
}
