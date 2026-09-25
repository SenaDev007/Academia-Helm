'use client';

/**
 * ============================================================================
 * REGISTRE TABLE — Tableau de notes en lecture seule (composant réutilisable)
 * ============================================================================
 *
 * Extrait du RegistreDetailSheet pour être réutilisé dans :
 *   - Module Examen → Registre des notes (admin)
 *   - Portail Parent → Notes et Bulletins (parent)
 *
 * Affiche EXACTEMENT le même tableau que GradingSheet (read-only) :
 *   - Maternelle : TS/S/PS, appréciation globale (pas de /20, pas de moyenne)
 *   - Primaire : CM/18, CP/2, Total, Total gén., Rang, Seuil
 *   - Secondaire : Note/20, Total gén., Rang, Seuil
 *
 * + Tableau récapitulatif (effectif, ayant composé, seuil atteint, % réussite)
 * ============================================================================
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Loader2, Users, CheckCircle2, Lock,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import type { GroupedEvaluation, GradeRow } from '@/components/exams/GradingSheet';
import { formatRang, computeAppreciationGlobale, getSubjectOrderIndex, getSubjectIdForEvaluation } from '@/components/exams/GradingSheet';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RegistreTableProps {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  isPrimaire: boolean;
  isSecondaire: boolean;
  /** If true, shows the "Registre des notes validées — lecture seule" banner */
  showBanner?: boolean;
  /** If true, shows the récapitulatif table at the bottom */
  showRecap?: boolean;
}

export function RegistreTable({
  group,
  isMaternelle,
  isPrimaire,
  isSecondaire,
  showBanner = true,
  showRecap = true,
}: RegistreTableProps) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const sortedSubjects = useMemo(() => {
    return [...group.subjects].sort((a, b) =>
      getSubjectOrderIndex(a.name, isMaternelle, isPrimaire) -
      getSubjectOrderIndex(b.name, isMaternelle, isPrimaire)
    );
  }, [group.subjects, isMaternelle, isPrimaire]);

  // ── Load students + grades ──────────────────────────────────────────────────
  useEffect(() => {
    const loadSheet = async () => {
      if (!group.evaluationIds.length) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sheets = await Promise.all(
          group.evaluationIds.map(async (evId) => {
            try {
              const response = await apiClient.get(`/institutional-exams/grades/evaluation/${evId}`);
              return { evaluationId: evId, students: Array.isArray(response.data) ? response.data : [] };
            } catch {
              return { evaluationId: evId, students: [] };
            }
          })
        );

        const evalToSubject = new Map<string, string>();
        // ⭐ V10d — mapping robuste (subjectByEvalId prioritaire sur la position)
        group.evaluationIds.forEach((evId) => {
          const subjectId = getSubjectIdForEvaluation(group, evId);
          if (subjectId) evalToSubject.set(evId, subjectId);
        });

        const studentMap = new Map<string, GradeRow>();
        sheets.forEach(({ evaluationId, students }) => {
          const subjectId = evalToSubject.get(evaluationId);
          if (!subjectId) return;
          students.forEach((student: any) => {
            if (!studentMap.has(student.studentId)) {
              studentMap.set(student.studentId, {
                studentId: student.studentId,
                studentName: student.studentName || 'Inconnu',
                matricule: student.matricule,
                gender: student.gender,
                scores: {},
                status: student.status || 'NEW',
              });
            }
            const row = studentMap.get(student.studentId)!;
            const incoming = {
              score: student.score ?? null,
              cm: student.cm ?? null,
              cp: student.cp ?? null,
              qualitativeCode: student.qualitativeCode ?? null,
              isAbsent: student.isAbsent ?? false,
              comment: student.comment ?? '',
            };
            const existing = row.scores[subjectId];
            // ⭐ V10d — Doublons de session : une valeur vide n'écrase jamais
            // une valeur déjà saisie (première valeur non vide gagne).
            const hasValue = (s: typeof incoming) =>
              s.qualitativeCode !== null || s.score !== null || s.cm !== null || s.cp !== null || s.isAbsent;
            if (!existing) {
              row.scores[subjectId] = incoming;
            } else if (!hasValue(existing) && hasValue(incoming)) {
              row.scores[subjectId] = incoming;
            } else if (!existing.comment && incoming.comment) {
              row.scores[subjectId] = { ...existing, comment: incoming.comment };
            }
          });
        });

        const rowsArray = Array.from(studentMap.values());
        rowsArray.forEach((row) => {
          group.subjects.forEach((subject) => {
            if (!row.scores[subject.id]) {
              row.scores[subject.id] = { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
            }
          });
        });
        rowsArray.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
        setRows(rowsArray);
      } catch (err) {
        console.error('Error loading registre sheet', err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    loadSheet();
  }, [group]);

  // ── Stats récapitulatives ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalBoys = 0, totalGirls = 0;
    let composedBoys = 0, composedGirls = 0;
    let reachedBoys = 0, reachedGirls = 0;
    let notReachedBoys = 0, notReachedGirls = 0;

    rows.forEach((row) => {
      const isBoy = row.gender === 'M';
      const isGirl = row.gender === 'F';
      if (isBoy) totalBoys++;
      if (isGirl) totalGirls++;

      const hasScore = sortedSubjects.some((subj) => {
        const s = row.scores[subj.id];
        if (!s || s.isAbsent) return false;
        return isMaternelle ? !!s.qualitativeCode : (s.cm !== null || s.score !== null);
      });

      if (hasScore) {
        if (isBoy) composedBoys++;
        if (isGirl) composedGirls++;

        let didReach = false;
        if (isMaternelle) {
          const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
          didReach = (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant');
        } else {
          const totalGeneral = sortedSubjects.reduce((sum, subj) => {
            const s = row.scores[subj.id];
            return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
          }, 0);
          didReach = totalGeneral >= (10 * sortedSubjects.length);
        }

        if (didReach) {
          if (isBoy) reachedBoys++;
          if (isGirl) reachedGirls++;
        } else {
          if (isBoy) notReachedBoys++;
          if (isGirl) notReachedGirls++;
        }
      }
    });

    const total = totalBoys + totalGirls;
    const composed = composedBoys + composedGirls;
    const reached = reachedBoys + reachedGirls;
    const notReached = notReachedBoys + notReachedGirls;
    const pctReussite = composed > 0 ? (reached / composed) * 100 : 0;

    return {
      totalBoys, totalGirls, total,
      composedBoys, composedGirls, composed,
      reachedBoys, reachedGirls, reached,
      notReachedBoys, notReachedGirls, notReached,
      pctReussite,
    };
  }, [rows, sortedSubjects, isMaternelle]);

  // ── Rang calculé ────────────────────────────────────────────────────────────
  const getRang = (row: GradeRow) => {
    const sortedByTotal = [...rows]
      .map((r) => ({
        id: r.studentId,
        total: sortedSubjects.reduce((sum, subj) => {
          const s = r.scores[subj.id];
          if (!s || s.isAbsent) return sum;
          if (isMaternelle) {
            if (s.qualitativeCode === 'TS') return sum + 3;
            if (s.qualitativeCode === 'S') return sum + 2;
            if (s.qualitativeCode === 'PS') return sum + 1;
            return sum;
          }
          return sum + (typeof s.score === 'number' ? s.score : 0);
        }, 0),
      }))
      .sort((a, b) => b.total - a.total);
    const rank = sortedByTotal.findIndex((r) => r.id === row.studentId) + 1;
    return rank;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="ml-3 text-sm text-gray-500">Chargement des notes…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Aucun élève dans cette classe</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tableau en lecture seule (même structure que GradingSheet) */}
      <div className="bg-white border-2 border-slate-800 rounded-xl overflow-x-auto">
        {showBanner && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Registre des notes validées — lecture seule
          </div>
        )}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
              <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Nom et prénom</th>
              <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
              {sortedSubjects.map((subject, idx) => (
                isMaternelle ? (
                  <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[100px]">
                    {subject.name}<div className="text-[9px] text-slate-400 font-normal">TS / S / PS</div>
                  </th>
                ) : isSecondaire ? (
                  <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                    {subject.name}<div className="text-[9px] text-slate-400 font-normal">Note /20</div>
                  </th>
                ) : (
                  <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[180px]">{subject.name}</th>
                )
              ))}
              {!isMaternelle && !isSecondaire && (
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total gén.</th>
              )}
              <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Rang</th>
              <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil fixé</th>
              <th colSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-24">Seuil atteint</th>
              {isMaternelle && (
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Appréciation globale</th>
              )}
            </tr>
            {!isSecondaire && !isMaternelle && (
              <tr className="bg-slate-50">
                {sortedSubjects.map((_, idx) => (
                  <React.Fragment key={idx}>
                    <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>
                    <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>
                    <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>
                  </React.Fragment>
                ))}
                <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Oui</th>
                <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Non</th>
              </tr>
            )}
            {isMaternelle && (
              <tr className="bg-slate-50">
                <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Oui</th>
                <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Non</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const totalGeneral = isMaternelle ? null : sortedSubjects.reduce((sum, subj) => {
                const s = row.scores[subj.id];
                return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
              }, 0);
              const rang = getRang(row);
              const isAllAbsent = sortedSubjects.every((subj) => row.scores[subj.id]?.isAbsent);
              const seuilAtteint = isMaternelle ? null : (
                !isAllAbsent && totalGeneral !== null && totalGeneral >= (10 * sortedSubjects.length)
              );

              return (
                <tr key={row.studentId} className={cn('hover:bg-slate-50', idx % 2 === 1 && 'bg-slate-50/50')}>
                  <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900">{row.studentName}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    {row.gender === 'M' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-700">M</span>
                    ) : row.gender === 'F' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-700">F</span>
                    ) : '—'}
                  </td>
                  {/* Notes en lecture seule */}
                  {sortedSubjects.map((subject) => {
                    const score = row.scores[subject.id] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
                    if (isMaternelle) {
                      return (
                        <td key={subject.id} className="border border-slate-300 px-2 py-1 text-center">
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded text-xs font-bold',
                            score.qualitativeCode === 'TS' ? 'bg-emerald-100 text-emerald-700' :
                            score.qualitativeCode === 'S' ? 'bg-blue-100 text-blue-700' :
                            score.qualitativeCode === 'PS' ? 'bg-amber-100 text-amber-700' :
                            'text-slate-300',
                            score.isAbsent && 'line-through opacity-50'
                          )}>
                            {score.isAbsent ? 'ABS' : (score.qualitativeCode || '—')}
                          </span>
                        </td>
                      );
                    }
                    if (isSecondaire) {
                      return (
                        <td key={subject.id} className="border border-slate-300 px-2 py-1 text-center font-bold">
                          {score.isAbsent ? <span className="text-red-500 text-[10px]">ABS</span> :
                            (score.score !== null ? Number(score.score).toFixed(2) : '—')}
                        </td>
                      );
                    }
                    const cmValue = score.cm ?? null;
                    const cpValue = score.cp ?? null;
                    const totalValue = (cmValue !== null ? cmValue : 0) + (cpValue !== null ? cpValue : 0);
                    return (
                      <>
                        <td key={`cm-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-semibold">
                          {score.isAbsent ? '—' : (cmValue !== null ? cmValue : '—')}
                        </td>
                        <td key={`cp-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-semibold">
                          {score.isAbsent ? '—' : (cpValue !== null ? cpValue : '—')}
                        </td>
                        <td key={`tot-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">
                          {score.isAbsent ? '—' : (cmValue !== null || cpValue !== null ? Number(totalValue).toFixed(2) : '—')}
                        </td>
                      </>
                    );
                  })}
                  {/* Total général */}
                  {!isMaternelle && !isSecondaire && (
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                      {totalGeneral !== null ? totalGeneral.toFixed(2) : '—'}
                    </td>
                  )}
                  {/* Rang */}
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-700">
                    {formatRang(rang, row.gender)}
                  </td>
                  {/* Seuil fixé */}
                  <td className="border border-slate-300 px-2 py-1 text-center text-slate-600 text-xs">
                    {isMaternelle ? 'TS/S' : '10/20'}
                  </td>
                  {/* Seuil atteint — Oui */}
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    {(() => {
                      if (isMaternelle) {
                        const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                        return (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant') ?
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : null;
                      }
                      return seuilAtteint ?
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : null;
                    })()}
                  </td>
                  {/* Seuil atteint — Non (only for students who composed but didn't reach) */}
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    {(() => {
                      if (isAllAbsent) return null;
                      if (isMaternelle) {
                        const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                        return (appreciation !== 'Très Satisfaisant' && appreciation !== 'Satisfaisant') ?
                          <span className="text-red-500 text-xs">✗</span> : null;
                      }
                      return !seuilAtteint ?
                        <span className="text-red-500 text-xs">✗</span> : null;
                    })()}
                  </td>
                  {/* Appréciation (Maternelle) */}
                  {isMaternelle && (
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                      <span className={cn(
                        'text-xs',
                        computeAppreciationGlobale(row.scores, sortedSubjects) === 'Très Satisfaisant' && 'text-emerald-600',
                        computeAppreciationGlobale(row.scores, sortedSubjects) === 'Satisfaisant' && 'text-blue-600',
                        computeAppreciationGlobale(row.scores, sortedSubjects) === 'Peu Satisfaisant' && 'text-amber-600',
                      )}>
                        {computeAppreciationGlobale(row.scores, sortedSubjects)}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Récapitulatif dynamique */}
      {showRecap && !loading && rows.length > 0 && (
        <div className="bg-white border-2 border-slate-300 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Récapitulatif de l'évaluation</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-left">Indicateur</th>
                  <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Garçons</th>
                  <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Filles</th>
                  <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 font-semibold">Effectif total de la classe</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{stats.totalBoys}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{stats.totalGirls}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold">{stats.total}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 font-semibold">Nombre d'élèves ayant composé</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{stats.composedBoys}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{stats.composedGirls}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold">{stats.composed}</td>
                </tr>
                <tr className="bg-emerald-50/50">
                  <td className="border border-slate-300 px-3 py-2 font-semibold">Ont atteint le seuil de réussite</td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{stats.reachedBoys}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{stats.reachedGirls}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700">{stats.reached}</td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="border border-slate-300 px-3 py-2 font-semibold">N'ont pas atteint le seuil</td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{stats.notReachedBoys}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{stats.notReachedGirls}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold text-red-700">{stats.notReached}</td>
                </tr>
                <tr className="bg-blue-50/50">
                  <td className="border border-slate-300 px-3 py-2 font-bold">% de réussite</td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">
                    {stats.composedBoys > 0 ? ((stats.reachedBoys / stats.composedBoys) * 100).toFixed(2) : '—'}%
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">
                    {stats.composedGirls > 0 ? ((stats.reachedGirls / stats.composedGirls) * 100).toFixed(2) : '—'}%
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-800">
                    {stats.pctReussite.toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
