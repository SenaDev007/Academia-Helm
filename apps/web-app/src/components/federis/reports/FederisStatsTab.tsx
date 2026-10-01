/**
 * FederisStatsTab — Onglet « Statistiques » du module Rapports & Bilans
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ T46 (2026-10-01) — Reproduction DE A À Z de l'onglet « Statistiques » du
 * module Examen d'Academia Helm (StatsWorkspace.tsx) pour les examens
 * nationaux Federis (CEP / BEPC / Baccalauréat / CAP).
 *
 *   2 onglets principaux :
 *     1. Statistiques des notes
 *        - Taux de réussite : tableau (matières × effectifs présents G/F/T,
 *          admis G/F/T, % réussite G/F/T, % échec G/F/T) + graphique en
 *          barres (nombre d'admis par matière) ;
 *        - Intervalle des notes : dénombrement par intervalle
 *          (0-3, 3-7, 7-9, 9-10, 10-12, 12-14, 14-16, 16-20) ;
 *        - Meilleures notes : Top N (Matricule | Nom | École | Note |
 *          Appréciation) ;
 *     2. Statistiques des moyennes — mêmes tableaux sur les moyennes
 *        générales des candidats (1 ligne « Moyenne générale »).
 *
 * ADAPTATION aux vraies données Federis :
 *   - sélecteur d'examen par type (CEP | BEPC | Baccalauréat | CAP) puis
 *     campagne — par défaut le PREMIER type (CEP) ;
 *   - pas de modes évaluation / trimestriel / annuel (session unique) :
 *     chaque candidat a UNE note par matière (équivalent du mode
 *     « évaluation » du Helm — pas d'agrégation par élève nécessaire) ;
 *   - les notes et moyennes viennent du REGISTRE OFFICIEL (module Notes et
 *     Moyennes — modèle effectif des règles de calcul) ;
 *   - la colonne « Classe » du Helm devient « École » (école de provenance).
 */

'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Filter,
  Loader2,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import {
  appreciationFor,
  candidateDisplayName,
  type GCandidateRow,
  type GSubject,
} from '@/lib/federis/grade-computations';
import { ExamScopeBar, useExamRegistry, useExamTypeScope } from './FederisReportsShared';

// ─── Intervalles des notes (copie exacte du Helm) ───────────────────────────
const INTERVALS = [
  { label: '0 — 3', min: 0, max: 3 },
  { label: '3 — 7', min: 3, max: 7 },
  { label: '7 — 9', min: 7, max: 9 },
  { label: '9 — 10', min: 9, max: 10 },
  { label: '10 — 12', min: 10, max: 12 },
  { label: '12 — 14', min: 12, max: 14 },
  { label: '14 — 16', min: 14, max: 16 },
  { label: '16 — 20', min: 16, max: 20 },
];

type MainTab = 'notes' | 'moyennes';
type SubTab = 'taux-reussite' | 'intervalle' | 'meilleurs';

interface SuccessRow {
  subjectName: string;
  present: { boys: number; girls: number; total: number };
  admitted: { boys: number; girls: number; total: number };
  passRate: { boys: number; girls: number; total: number };
  failRate: { boys: number; girls: number; total: number };
}

interface IntervalRow {
  subjectName: string;
  effectif: number;
  intervals: Array<{ label: string; count: number }>;
}

interface BestRow {
  matricule: string;
  name: string;
  school: string;
  score: number;
  appreciation: string;
}

/** Note effective d'un candidat dans une matière (null si absent / saisie). */
function effectiveScore(c: GCandidateRow, subjectId: string): number | null {
  const cell = c.scores?.[subjectId];
  if (!cell || cell.isAbsent) return null;
  const score = cell.score;
  return typeof score === 'number' && !isNaN(score) ? score : null;
}

const isGirl = (gender: string | null | undefined) =>
  gender === 'F' || gender === 'FEMALE' || gender === 'FEMME';
const isBoy = (gender: string | null | undefined) => gender === 'M' || gender === 'MALE';

/** Téléchargement authentifié (blob) — POST + payload JSON (pattern Helm). */
async function downloadFile(
  url: string,
  payload: unknown,
  filename: string,
  timeout = 120000,
): Promise<void> {
  const res = await apiClient.post(url, payload, { responseType: 'blob', timeout });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export default function FederisStatsTab() {
  const scope = useExamTypeScope();
  const { examId, selectedExam } = scope;
  const { data, loading, error } = useExamRegistry(examId);

  const [mainTab, setMainTab] = useState<MainTab>('notes');
  const [subTab, setSubTab] = useState<SubTab>('taux-reussite');
  const [topN, setTopN] = useState<number>(3);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const subjects: GSubject[] = data?.subjects ?? [];
  const candidates: GCandidateRow[] = data?.candidates ?? [];
  const examLabel = data ? `${data.exam.name} (${data.exam.code})` : '';

  // ── Taux de réussite PAR MATIÈRE (mode notes — comme le Helm) ────────────
  //    Chaque candidat a UNE note par matière (session unique) : présents =
  //    candidats avec note non-absente ; admis = note ≥ 10/20.
  const successRateData: SuccessRow[] = useMemo(
    () =>
      subjects.map((subj) => {
        const present = candidates.filter((c) => effectiveScore(c, subj.id) !== null);
        const boys = present.filter((c) => isBoy(c.gender));
        const girls = present.filter((c) => isGirl(c.gender));
        const admitted = present.filter((c) => (effectiveScore(c, subj.id) ?? -1) >= 10);
        const admittedBoys = admitted.filter((c) => isBoy(c.gender));
        const admittedGirls = admitted.filter((c) => isGirl(c.gender));
        const total = present.length;
        return {
          subjectName: subj.name,
          present: { boys: boys.length, girls: girls.length, total },
          admitted: { boys: admittedBoys.length, girls: admittedGirls.length, total: admitted.length },
          passRate: {
            boys: boys.length > 0 ? (admittedBoys.length / boys.length) * 100 : 0,
            girls: girls.length > 0 ? (admittedGirls.length / girls.length) * 100 : 0,
            total: total > 0 ? (admitted.length / total) * 100 : 0,
          },
          failRate: {
            boys: boys.length > 0 ? ((boys.length - admittedBoys.length) / boys.length) * 100 : 0,
            girls:
              girls.length > 0 ? ((girls.length - admittedGirls.length) / girls.length) * 100 : 0,
            total: total > 0 ? ((total - admitted.length) / total) * 100 : 0,
          },
        };
      }),
    [subjects, candidates],
  );

  // ── Intervalle des notes PAR MATIÈRE (comme le Helm) ─────────────────────
  const intervalData: IntervalRow[] = useMemo(
    () =>
      subjects.map((subj) => {
        const present = candidates.filter((c) => effectiveScore(c, subj.id) !== null);
        const counts = INTERVALS.map((interval) => ({
          label: interval.label,
          count: present.filter((c) => {
            const score = effectiveScore(c, subj.id) ?? -1;
            return (
              score >= interval.min && (interval.max === 20 ? score <= interval.max : score < interval.max)
            );
          }).length,
        }));
        return { subjectName: subj.name, effectif: present.length, intervals: counts };
      }),
    [subjects, candidates],
  );

  // ── Meilleures notes (toutes matières — Top N, comme le Helm) ────────────
  const bestNotesData: BestRow[] = useMemo(() => {
    const all: BestRow[] = [];
    for (const subj of subjects) {
      for (const c of candidates) {
        const score = effectiveScore(c, subj.id);
        if (score !== null) {
          all.push({
            matricule: c.matricule ?? '',
            name: candidateDisplayName(c),
            school: c.school ?? '—',
            score,
            appreciation: appreciationFor(score),
          });
        }
      }
    }
    return all.sort((a, b) => b.score - a.score);
  }, [subjects, candidates]);

  // ── Moyennes générales des candidats (registre officiel — modèle effectif) ─
  const studentAverages = useMemo(
    () =>
      candidates
        .map((c) => ({
          id: c.id,
          matricule: c.matricule ?? '',
          name: candidateDisplayName(c),
          school: c.school ?? '—',
          gender: c.gender,
          moyenne: c.computed?.finalAverage ?? null,
        }))
        .sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1)),
    [candidates],
  );

  // ── Taux de réussite des moyennes (1 ligne « Moyenne générale ») ─────────
  const moyennesSuccessData: SuccessRow[] = useMemo(() => {
    const present = studentAverages.filter((s) => s.moyenne !== null);
    const boys = present.filter((s) => isBoy(s.gender));
    const girls = present.filter((s) => isGirl(s.gender));
    const admitted = present.filter((s) => (s.moyenne ?? 0) >= 10);
    const admittedBoys = admitted.filter((s) => isBoy(s.gender));
    const admittedGirls = admitted.filter((s) => isGirl(s.gender));
    const total = present.length;
    return [
      {
        subjectName: 'Moyenne générale',
        present: { boys: boys.length, girls: girls.length, total },
        admitted: { boys: admittedBoys.length, girls: admittedGirls.length, total: admitted.length },
        passRate: {
          boys: boys.length > 0 ? (admittedBoys.length / boys.length) * 100 : 0,
          girls: girls.length > 0 ? (admittedGirls.length / girls.length) * 100 : 0,
          total: total > 0 ? (admitted.length / total) * 100 : 0,
        },
        failRate: {
          boys: boys.length > 0 ? ((boys.length - admittedBoys.length) / boys.length) * 100 : 0,
          girls: girls.length > 0 ? ((girls.length - admittedGirls.length) / girls.length) * 100 : 0,
          total: total > 0 ? ((total - admitted.length) / total) * 100 : 0,
        },
      },
    ];
  }, [studentAverages]);

  // ── Intervalle des moyennes (1 ligne « Moyenne générale ») ───────────────
  const moyennesIntervalData: IntervalRow[] = useMemo(() => {
    const present = studentAverages.filter((s) => s.moyenne !== null);
    const counts = INTERVALS.map((interval) => ({
      label: interval.label,
      count: present.filter((s) => {
        const moy = s.moyenne ?? -1;
        return (
          moy >= interval.min && (interval.max === 20 ? moy <= interval.max : moy < interval.max)
        );
      }).length,
    }));
    return [{ subjectName: 'Moyenne générale', effectif: present.length, intervals: counts }];
  }, [studentAverages]);

  // ── Génération PDF (backend — payload front, pattern Helm) ───────────────
  const handleGeneratePdf = async () => {
    if (!examId || subjects.length === 0) return;
    setGeneratingPdf(true);
    try {
      await downloadFile(
        `/federis/exams/${examId}/reports/statistiques`,
        {
          mainTab,
          subTab,
          subjects: subjects.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            coefficient: s.coefficient ?? 1,
          })),
          successRateRows: mainTab === 'notes' ? successRateData : moyennesSuccessData,
          intervalRows: mainTab === 'notes' ? intervalData : moyennesIntervalData,
          bestRows:
            mainTab === 'notes'
              ? bestNotesData.slice(0, topN)
              : studentAverages.slice(0, topN).map((s) => ({
                  matricule: s.matricule,
                  name: s.name,
                  school: s.school,
                  score: s.moyenne ?? 0,
                  appreciation: appreciationFor(s.moyenne),
                })),
          topN,
        },
        `Stats_${subTab}_${selectedExam?.code ?? 'examen'}.pdf`,
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      alert((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Erreur lors de la génération du PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const activeSuccess = mainTab === 'notes' ? successRateData : moyennesSuccessData;
  const activeIntervals = mainTab === 'notes' ? intervalData : moyennesIntervalData;

  return (
    <div className="space-y-5">
      {/* Barre d'onglets par type d'examen + sélecteur de campagne */}
      <ExamScopeBar scope={scope} />

      {/* Onglets principaux : Statistiques des notes | des moyennes (Helm) */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: 'notes' as MainTab, label: 'Statistiques des notes', icon: BarChart3 },
          { id: 'moyennes' as MainTab, label: 'Statistiques des moyennes', icon: TrendingUp },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMainTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
              mainTab === tab.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Sous-onglets : Taux de réussite | Intervalle | Meilleurs (Helm) */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: 'taux-reussite' as SubTab, label: 'Taux de réussite', icon: Target },
          { id: 'intervalle' as SubTab, label: 'Intervalle', icon: BarChart3 },
          {
            id: 'meilleurs' as SubTab,
            label: mainTab === 'notes' ? 'Meilleures notes' : 'Meilleures moyennes',
            icon: Trophy,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1',
              subTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600',
            )}
          >
            <tab.icon className="w-3 h-3" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Sélecteur Top N (sous-onglet meilleurs — comme le Helm) */}
      {subTab === 'meilleurs' && examId && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Top</span>
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="fed-input-light !w-auto font-bold px-4 py-2"
          >
            {/* ⭐ T51 — Top limité à 10 (3 / 5 / 10) */}
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div className="fed-card px-6 py-12 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-900 mx-auto" />
          <p className="text-sm font-bold text-slate-400 mt-3">Chargement des statistiques…</p>
        </div>
      )}

      {!loading && examId && data && (
        <>
          {/* ═══ TAUX DE RÉUSSITE (reproduction Helm) ═══ */}
          {subTab === 'taux-reussite' && (
            <div className="space-y-5">
              <div className="fed-card overflow-hidden">
                <div className="px-6 py-3 bg-[#f7f9fc] border-b border-slate-100">
                  <h3 className="text-sm font-bold text-blue-900">
                    Taux de réussite — {examLabel}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100">
                      <tr>
                        <th rowSpan={2} className="px-4 py-2 text-left text-[10px] font-black text-slate-500 uppercase">
                          Matière
                        </th>
                        <th colSpan={3} className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase">
                          Effectif présents
                        </th>
                        <th colSpan={3} className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase">
                          Total admis
                        </th>
                        <th colSpan={3} className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase">
                          % Réussite
                        </th>
                        <th colSpan={3} className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase">
                          % Échec
                        </th>
                      </tr>
                      <tr>
                        {['G', 'F', 'T'].map((l, i) => (
                          <th key={`p${i}`} className="px-2 py-1.5 text-center text-[9px] font-black text-slate-400">
                            {l}
                          </th>
                        ))}
                        {['G', 'F', 'T'].map((l, i) => (
                          <th key={`a${i}`} className="px-2 py-1.5 text-center text-[9px] font-black text-slate-400">
                            {l}
                          </th>
                        ))}
                        {['G', 'F', 'T'].map((l, i) => (
                          <th key={`r${i}`} className="px-2 py-1.5 text-center text-[9px] font-black text-slate-400">
                            {l}
                          </th>
                        ))}
                        {['G', 'F', 'T'].map((l, i) => (
                          <th key={`f${i}`} className="px-2 py-1.5 text-center text-[9px] font-black text-slate-400">
                            {l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {activeSuccess.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : undefined}>
                          <td className="px-4 py-2 text-xs font-semibold text-slate-800">
                            {row.subjectName}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">{row.present.boys}</td>
                          <td className="px-2 py-2 text-center text-xs">{row.present.girls}</td>
                          <td className="px-2 py-2 text-center text-xs font-bold">
                            {row.present.total}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">{row.admitted.boys}</td>
                          <td className="px-2 py-2 text-center text-xs">{row.admitted.girls}</td>
                          <td className="px-2 py-2 text-center text-xs font-bold text-emerald-700">
                            {row.admitted.total}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            {row.passRate.boys.toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            {row.passRate.girls.toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-center text-xs font-bold text-emerald-700">
                            {row.passRate.total.toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            {row.failRate.boys.toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            {row.failRate.girls.toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-center text-xs font-bold text-red-600">
                            {row.failRate.total.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      {activeSuccess.length === 0 && (
                        <tr>
                          <td colSpan={13} className="px-4 py-6 text-center text-xs font-bold text-slate-300">
                            Aucune donnée
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Graphique : barres du nombre d'admis par matière (Helm) */}
              <div className="fed-card p-5">
                <h3 className="text-sm font-bold text-blue-900 mb-3">
                  Graphique — Nombre d&apos;admis par matière
                </h3>
                <div className="flex items-end gap-2 h-48 border-b border-slate-200 pb-1">
                  {activeSuccess.map((row, idx) => {
                    const maxAdmitted = Math.max(...activeSuccess.map((r) => r.admitted.total), 1);
                    const heightPct = (row.admitted.total / maxAdmitted) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-[9px] font-bold text-slate-700">
                          {row.admitted.total}
                        </div>
                        <div
                          className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                          style={{ height: `${heightPct}%`, minHeight: '4px' }}
                          title={`${row.subjectName}: ${row.admitted.total} admis`}
                        />
                        <div
                          className="text-[8px] text-slate-500 text-center truncate w-full"
                          style={{ maxWidth: '60px' }}
                        >
                          {row.subjectName.length > 8
                            ? row.subjectName.substring(0, 7) + '…'
                            : row.subjectName}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 text-center">
                  Ordonnée : nombre d&apos;admis · Abscisse : matières
                </div>
              </div>
            </div>
          )}

          {/* ═══ INTERVALLE DES NOTES / MOYENNES (reproduction Helm) ═══ */}
          {subTab === 'intervalle' && (
            <div className="fed-card overflow-hidden">
              <div className="px-6 py-3 bg-[#f7f9fc] border-b border-slate-100">
                <h3 className="text-sm font-bold text-blue-900">
                  {mainTab === 'notes' ? 'Intervalle des notes' : 'Intervalle des moyennes'} —{' '}
                  {examLabel}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-black text-slate-500 uppercase">
                        Matière
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase">
                        Effectif
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase">
                        Présents
                      </th>
                      {INTERVALS.map((intr) => (
                        <th
                          key={intr.label}
                          className="px-3 py-2 text-center text-[10px] font-black text-slate-500"
                        >
                          {intr.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activeIntervals.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : undefined}>
                        <td className="px-4 py-2 text-xs font-semibold text-slate-800">
                          {row.subjectName}
                        </td>
                        <td className="px-3 py-2 text-center text-xs font-bold">{row.effectif}</td>
                        <td className="px-3 py-2 text-center text-xs">{row.effectif}</td>
                        {row.intervals.map((intr, i) => (
                          <td key={i} className="px-3 py-2 text-center text-xs">
                            <span
                              className={cn(
                                'font-semibold',
                                intr.count > 0 ? 'text-slate-900' : 'text-slate-300',
                              )}
                            >
                              {intr.count}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {activeIntervals.length === 0 && (
                      <tr>
                        <td
                          colSpan={INTERVALS.length + 3}
                          className="px-4 py-6 text-center text-xs font-bold text-slate-300"
                        >
                          Aucune donnée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ MEILLEURES NOTES / MOYENNES (reproduction Helm) ═══ */}
          {subTab === 'meilleurs' && (
            <div className="fed-card overflow-hidden">
              <div className="px-6 py-3 bg-[#f7f9fc] border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-blue-900">
                  {mainTab === 'notes' ? 'Meilleures notes' : 'Meilleures moyennes'} — Top {topN}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <Filter className="w-3 h-3" /> {examLabel}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-black text-slate-500 uppercase">
                        Matricule
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-black text-slate-500 uppercase">
                        Nom
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-black text-slate-500 uppercase">
                        École
                      </th>
                      <th className="px-4 py-2 text-center text-[10px] font-black text-slate-500 uppercase">
                        {mainTab === 'notes' ? 'Note' : 'Moyenne'}
                      </th>
                      <th className="px-4 py-2 text-center text-[10px] font-black text-slate-500 uppercase">
                        Appréciation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {mainTab === 'notes'
                      ? bestNotesData.slice(0, topN).map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-xs font-mono text-slate-600">
                              {row.matricule || '—'}
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-slate-800">
                              {row.name}
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-600">{row.school}</td>
                            <td className="px-4 py-2 text-center text-xs font-black text-emerald-700">
                              {row.score.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-center text-xs">{row.appreciation}</td>
                          </tr>
                        ))
                      : studentAverages.slice(0, topN).map((st) => (
                          <tr key={st.id}>
                            <td className="px-4 py-2 text-xs font-mono text-slate-600">
                              {st.matricule || '—'}
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-slate-800">
                              {st.name}
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-600">{st.school}</td>
                            <td className="px-4 py-2 text-center text-xs font-black text-emerald-700">
                              {st.moyenne !== null ? st.moyenne.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-2 text-center text-xs">
                              {appreciationFor(st.moyenne)}
                            </td>
                          </tr>
                        ))}
                    {(mainTab === 'notes' ? bestNotesData : studentAverages).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-xs font-bold text-slate-300">
                          Aucune donnée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bouton de génération PDF */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="fed-btn-gold px-5 py-2.5 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {generatingPdf ? 'Génération…' : 'Générer PDF'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
