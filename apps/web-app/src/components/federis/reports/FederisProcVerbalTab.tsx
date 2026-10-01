/**
 * FederisProcVerbalTab — Onglet « Procès-verbal » du module Rapports & Bilans
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ T46 (2026-10-01) — Reproduction DE A À Z de l'onglet « Procès-verbal » du
 * module Examen d'Academia Helm (ProcVerbalWorkspace.tsx) pour les examens
 * nationaux Federis (CEP / BEPC / Baccalauréat / CAP).
 *
 *   - Sélecteur d'examen par type (CEP | BEPC | Baccalauréat | CAP) puis
 *     campagne — par défaut le PREMIER type (CEP), comme les autres modules ;
 *   - Filtre : ordre de mérite (défaut) / ordre alphabétique ;
 *   - Grand tableau principal : Matricule | Nom et prénoms | [Matières
 *     dynamiques : abréviation + coefficient en sous-titre, note du candidat]
 *     | Total | Coef | Moyenne | Rang ;
 *   - 2 mini-tableaux dynamiques : « N premiers » / « N derniers » (N
 *     sélectionnable : 3, 5 ou 10) — ⭐ T51 : les « derniers » sont
 *     exclusivement les candidats N'AYANT PAS LA MOYENNE (moyenne < 10 ou
 *     non évaluée), sans jamais reprendre un candidat déjà classé parmi
 *     les premiers ;
 *   - Génération PDF A4 paysage (POST backend — même charte officielle que
 *     le Helm : en-tête République du Bénin + patronat organisateur).
 *
 * ADAPTATION aux vraies données Federis :
 *   - pas de sous-onglets évaluation / trimestriel / annuel (un examen
 *     national = UNE session unique) — le sélecteur de campagne les remplace ;
 *   - les notes, moyennes et rangs viennent du REGISTRE OFFICIEL (module
 *     Notes et Moyennes) : moyenne retenue = modèle effectif des règles de
 *     calcul (simple au CEP, pondérée sinon), rang dense officiel ;
 *   - Total / Coef affichés selon le modèle : pondéré (Σ note×coef / Σ coef)
 *     ou simple (Σ notes / nb matières évaluées) ;
 *   - les ABSENTS sont marqués « ABS » (donnée réelle du registre).
 */

'use client';

import { useMemo, useState } from 'react';
import { Award, Download, Loader2, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import type { GSubject } from '@/lib/federis/grade-computations';
import { ExamScopeBar, useExamRegistry, useExamTypeScope } from './FederisReportsShared';

type SortMode = 'alphabetique' | 'merite';

/** Ligne PV d'un candidat (payload du tableau ET du PDF backend). */
interface PvRow {
  id: string;
  matricule: string;
  name: string;
  gender: string | null;
  subjectScores: Record<string, number | null>;
  /** Matières où le candidat était ABSENT (affichées « ABS »). */
  absents: string[];
  total: number;
  totalCoef: number;
  moyenne: number | null;
  rang: number | null;
}

/** Abréviation d'une matière (priorité : préfixe du code > nom complet —
 *  même logique que le PV Helm, le PDF backend appliquant aussi ses règles). */
function subjectAbbr(subj: GSubject): string {
  if (subj.code) {
    const m = subj.code.match(/^([A-Z]{2,6})/);
    if (m) return m[1];
  }
  return subj.name;
}

/** Téléchargement authentifié (blob) — POST + payload JSON (pattern Helm :
 *  le front calcule les tableaux, le backend rend le PDF officiel). */
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

export default function FederisProcVerbalTab() {
  const scope = useExamTypeScope();
  const { examId, selectedExam } = scope;
  const { data, loading, error } = useExamRegistry(examId);

  const [sortMode, setSortMode] = useState<SortMode>('merite');
  const [topN, setTopN] = useState<number>(3);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const subjects = data?.subjects ?? [];
  const isPrimary = data?.exam.isPrimary ?? false;

  // ── Construction des lignes PV depuis le registre officiel ───────────────
  const students: PvRow[] = useMemo(() => {
    const candidates = data?.candidates ?? [];
    return candidates.map((c) => {
      const computed = c.computed ?? null;
      // Total / Coef selon le MODÈLE EFFECTIF (comme le PV Helm : Σ note×coef
      // et Σ coef ; au CEP modèle simple → Σ notes et nb matières évaluées).
      const total = isPrimary ? (computed?.total ?? 0) : (computed?.totalNotesCoef ?? 0);
      const totalCoef = isPrimary ? (computed?.nbEval ?? 0) : (computed?.totalCoef ?? 0);
      const subjectScores: Record<string, number | null> = {};
      const absents: string[] = [];
      for (const s of subjects) {
        const cell = c.scores?.[s.id];
        if (!cell) {
          subjectScores[s.id] = null;
        } else if (cell.isAbsent) {
          subjectScores[s.id] = null;
          absents.push(s.id);
        } else {
          subjectScores[s.id] = cell.score ?? null;
        }
      }
      return {
        id: c.id,
        matricule: c.matricule ?? '',
        name: `${c.lastName} ${c.firstName}`.trim(),
        gender: c.gender,
        subjectScores,
        absents,
        total,
        totalCoef,
        moyenne: computed?.finalAverage ?? null,
        rang: c.rank ?? null,
      };
    });
  }, [data, subjects, isPrimary]);

  // ── Tri : ordre de mérite (défaut) / ordre alphabétique (comme le Helm) ──
  const sortedStudents = useMemo(() => {
    if (sortMode === 'alphabetique') {
      return [...students].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return [...students].sort((a, b) => {
      const ra = a.rang ?? Number.MAX_SAFE_INTEGER;
      const rb = b.rang ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  }, [students, sortMode]);

  // ⭐ T51 — « N premiers » : les N meilleures moyennes (rang croissant).
  const topRows = useMemo(
    () => [...students].sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9)).slice(0, topN),
    [students, topN],
  );

  // ⭐ T51 — « N derniers » : exclusivement les candidats N'AYANT PAS LA
  //    MOYENNE requise (moyenne < 10/20 ou non évaluée), triés de la moyenne
  //    la plus faible à la plus forte (les non évalués en tête), SANS jamais
  //    reprendre un candidat déjà classé parmi les premiers. Plus aucun
  //    candidat admis ne peut donc apparaître dans les deux tableaux.
  const bottomRows = useMemo(() => {
    const topIds = new Set(topRows.map((s) => s.id));
    return students
      .filter((s) => !topIds.has(s.id) && (s.moyenne === null || s.moyenne < 10))
      .sort((a, b) => {
        const ma = a.moyenne ?? -1;
        const mb = b.moyenne ?? -1;
        return ma - mb;
      })
      .slice(0, topN);
  }, [students, topRows, topN]);

  // ── Génération PDF (backend — même pattern que le Helm : payload front) ──
  const handleGeneratePdf = async () => {
    if (!examId || students.length === 0) return;
    setGeneratingPdf(true);
    try {
      await downloadFile(
        `/federis/exams/${examId}/reports/proces-verbal`,
        {
          sortMode,
          subjects: subjects.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            coefficient: s.coefficient ?? 1,
          })),
          students: students.map((st) => ({
            id: st.id,
            matricule: st.matricule,
            name: st.name,
            gender: st.gender,
            subjectScores: st.subjectScores,
            absents: st.absents,
            total: st.total,
            totalCoef: st.totalCoef,
            moyenne: st.moyenne,
            rang: st.rang ?? 0,
          })),
          top3: topRows.map((st) => ({ ...st, rang: st.rang ?? 0 })),
          bottom3: bottomRows.map((st) => ({ ...st, rang: st.rang ?? 0 })),
          top3Title: `${topN} premiers`,
          bottom3Title: `${topN} derniers`,
        },
        `PV_${selectedExam?.code ?? 'examen'}.pdf`,
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      alert((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Erreur lors de la génération du PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Barre d'onglets par type d'examen + sélecteur de campagne */}
      <ExamScopeBar scope={scope} />

      {/* Contrôles : classement + effectif */}
      {examId && (
        <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Classement</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="fed-input-light !w-auto font-bold px-4 py-2.5"
            >
              <option value="merite">Ordre de mérite</option>
              <option value="alphabetique">Ordre alphabétique</option>
            </select>
          </div>
          {/* ⭐ T51 — Nombre de classés affichés dans les mini-tableaux */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Top</span>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="fed-input-light !w-auto font-bold px-4 py-2.5"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
          <div className="flex-1" />
          {data && (
            <>
              <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                {isPrimary ? 'Moyenne simple (modèle primaire)' : 'Moyenne pondérée (coefficients)'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-900 uppercase bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg">
                <Users className="w-3.5 h-3.5" />
                {students.length} candidats
              </span>
            </>
          )}
        </div>
      )}

      {/* Erreur de chargement */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div className="fed-card px-6 py-12 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-900 mx-auto" />
          <p className="text-sm font-bold text-slate-400 mt-3">Chargement du procès-verbal…</p>
        </div>
      )}

      {/* Contenu */}
      {!loading && examId && data && students.length === 0 && (
        <div className="fed-card px-6 py-12 text-center text-sm font-bold text-slate-400">
          Aucun candidat — le procès-verbal s&apos;alimentera dès l&apos;inscription des candidats.
        </div>
      )}

      {!loading && examId && data && students.length > 0 && (
        <>
          {/* ═══ Grand tableau principal (reproduction Helm) ═══ */}
          <div className="fed-card overflow-hidden">
            <div className="px-6 py-3 bg-[#f7f9fc] border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-blue-900">
                Procès-verbal — {data.exam.name}
                <span className="text-slate-400 font-semibold"> ({data.exam.code})</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {sortMode === 'merite' ? 'Ordre de mérite' : 'Ordre alphabétique'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th
                      rowSpan={2}
                      className="px-3 py-2 text-left text-[10px] font-black text-slate-500 uppercase whitespace-nowrap"
                    >
                      Matricule
                    </th>
                    <th
                      rowSpan={2}
                      className="px-3 py-2 text-left text-[10px] font-black text-slate-500 uppercase whitespace-nowrap"
                    >
                      Nom et prénoms
                    </th>
                    {subjects.map((subj) => (
                      <th
                        key={subj.id}
                        className="px-2 py-2 text-center text-[10px] font-black text-slate-600 uppercase min-w-[58px]"
                        title={subj.name}
                      >
                        <div>{subjectAbbr(subj)}</div>
                        <div className="font-semibold text-[9px] text-slate-400 normal-case">
                          Coef {subj.coefficient ?? 1}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase whitespace-nowrap">
                      Total
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase whitespace-nowrap">
                      Coef
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase whitespace-nowrap">
                      Moyenne
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-black text-slate-500 uppercase whitespace-nowrap">
                      Rang
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedStudents.map((st, idx) => (
                    <tr key={st.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : undefined}>
                      <td className="px-3 py-2 text-xs whitespace-nowrap font-mono text-slate-600">
                        {st.matricule || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap text-slate-800">
                        {st.name}
                      </td>
                      {subjects.map((subj) => {
                        const score = st.subjectScores[subj.id];
                        const isAbsent = st.absents.includes(subj.id);
                        return (
                          <td key={subj.id} className="px-2 py-2 text-center">
                            {typeof score === 'number' && !isNaN(score) ? (
                              <span
                                className={cn(
                                  'text-xs font-bold',
                                  score >= 10 ? 'text-slate-900' : 'text-red-600',
                                )}
                              >
                                {score.toFixed(2)}
                              </span>
                            ) : isAbsent ? (
                              <span className="text-[10px] font-black text-amber-600">ABS</span>
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center text-xs font-bold text-slate-800">
                        {st.total.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-amber-700">
                        {st.totalCoef}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-center text-xs font-black',
                          st.moyenne !== null && st.moyenne >= 10
                            ? 'text-emerald-700'
                            : 'text-red-600',
                        )}
                      >
                        {st.moyenne !== null ? st.moyenne.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-slate-700">
                        {st.rang ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Mini-tableaux : N premiers / N derniers (T51) ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(
              [
                {
                  title: `${topN} premiers`,
                  icon: <Award className="w-4 h-4" />,
                  headClass: 'bg-emerald-50 text-emerald-800',
                  rows: topRows,
                  scoreClass: 'text-emerald-700',
                },
                {
                  title: `${topN} derniers`,
                  icon: <TrendingUp className="w-4 h-4 rotate-180" />,
                  headClass: 'bg-red-50 text-red-800',
                  rows: bottomRows,
                  scoreClass: 'text-red-600',
                },
              ] as const
            ).map((block) => (
              <div key={block.title} className="fed-card overflow-hidden">
                <div className={cn('px-5 py-2.5 border-b border-slate-100', block.headClass)}>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    {block.icon} {block.title}
                  </h3>
                </div>
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-black text-slate-400 uppercase">
                        Matricule
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-black text-slate-400 uppercase">
                        Nom
                      </th>
                      <th className="px-4 py-2 text-center text-[10px] font-black text-slate-400 uppercase">
                        Moyenne
                      </th>
                      <th className="px-4 py-2 text-center text-[10px] font-black text-slate-400 uppercase">
                        Rang
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {block.rows.map((st) => (
                      <tr key={st.id}>
                        <td className="px-4 py-2 text-xs font-mono text-slate-600">
                          {st.matricule || '—'}
                        </td>
                        <td className="px-4 py-2 text-xs font-semibold text-slate-800">{st.name}</td>
                        <td
                          className={cn(
                            'px-4 py-2 text-center text-xs font-black',
                            block.scoreClass,
                          )}
                        >
                          {st.moyenne !== null ? st.moyenne.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-2 text-center text-xs font-bold text-slate-700">
                          {st.rang ?? '—'}
                        </td>
                      </tr>
                    ))}
                    {block.rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-6 text-center text-xs font-bold text-slate-300"
                        >
                          Aucune donnée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

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
