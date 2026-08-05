"use client";

/**
 * ============================================================================
 * Parent Portal — Notes & Résultats de l'enfant
 * ============================================================================
 *
 * Affiche les notes de l'enfant groupées par :
 *   - Trimestre (Trimestre 1, 2, 3)
 *   - Type d'évaluation (EM1, EM2, EC)
 *   - Matière (avec note /20 ou code qualitatif TS/S/PS pour maternelle)
 *
 * Source : Module Examen → évaluations VALIDATED
 * Endpoint : GET /api/parent/grades/:studentId?academicYearId=Y
 *
 * ⭐ Sécurité : le backend vérifie que l'élève appartient bien au parent
 *    connecté via assertStudentBelongsToGuardian().
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  FileText, Loader2, ChevronDown, ChevronRight, GraduationCap,
  Calendar, Award, AlertCircle, BookOpen, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  score: number | null;
  maxScore: number;
  coefficient: number;
  isAbsent: boolean;
  qualitativeCode?: string | null;
  appreciation: string;
  status: string;
}

interface EvaluationGroup {
  evaluationTypeId: string;
  evaluationTypeCode: string;
  evaluationTypeName: string;
  evaluationDate: string;
  subjects: SubjectGrade[];
}

interface QuarterGrades {
  quarterId: string;
  quarterName: string;
  quarterNumber: number;
  evaluations: EvaluationGroup[];
}

export default function ParentResultsPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [grades, setGrades] = useState<QuarterGrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuarters, setExpandedQuarters] = useState<Set<string>>(new Set());
  const [expandedEvals, setExpandedEvals] = useState<Set<string>>(new Set());

  // ── Charger la liste des enfants ───────────────────────────────────────────
  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`, { credentials: "include" });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setChildren(list);
        if (list.length > 0) setSelectedStudent(list[0].id);
      } catch { setChildren([]); }
    })();
  }, [user?.id, academicYear?.id]);

  // ── Charger les notes ──────────────────────────────────────────────────────
  const loadGrades = useCallback(async () => {
    if (!selectedStudent || !academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/parent/grades/${selectedStudent}?academicYearId=${academicYear.id}`, { credentials: "include" });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setGrades(list);
      // Auto-expand first quarter
      if (list.length > 0) {
        setExpandedQuarters(new Set([list[0].quarterId]));
        // Auto-expand first eval of first quarter
        if (list[0].evaluations?.length > 0) {
          setExpandedEvals(new Set([`${list[0].quarterId}__${list[0].evaluations[0].evaluationTypeId}`]));
        }
      }
    } catch {
      setGrades([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, academicYear?.id]);

  useEffect(() => {
    if (selectedStudent) loadGrades();
  }, [loadGrades, selectedStudent]);

  // ── Toggle expand/collapse ─────────────────────────────────────────────────
  const toggleQuarter = (quarterId: string) => {
    setExpandedQuarters(prev => {
      const next = new Set(prev);
      if (next.has(quarterId)) next.delete(quarterId);
      else next.add(quarterId);
      return next;
    });
  };

  const toggleEval = (key: string) => {
    setExpandedEvals(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Compute stats per quarter ─────────────────────────────────────────────
  const quarterStats = useMemo(() => {
    const stats: Record<string, { average: number | null; subjectCount: number; evalCount: number }> = {};
    for (const q of grades) {
      const allScores: number[] = [];
      let evalCount = 0;
      const subjectSet = new Set<string>();
      for (const ev of q.evaluations) {
        evalCount++;
        for (const s of ev.subjects) {
          subjectSet.add(s.subjectId);
          if (!s.isAbsent && s.score !== null && typeof s.score === 'number') {
            allScores.push(s.score);
          }
        }
      }
      const avg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
      stats[q.quarterId] = { average: avg, subjectCount: subjectSet.size, evalCount };
    }
    return stats;
  }, [grades]);

  // ── Detect if Maternelle (qualitative codes) ──────────────────────────────
  const isMaternelle = useMemo(() => {
    return grades.some(q => q.evaluations.some(ev => ev.subjects.some(s => s.qualitativeCode)));
  }, [grades]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-bold text-slate-900">Notes & Résultats</h2>
      </div>

      {/* Child selector (only if > 1 child) */}
      {children.length > 1 && (
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
          <GraduationCap className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-semibold text-slate-700">Enfant :</span>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Info banner */}
      {selectedStudent && children.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>{children.find(c => c.id === selectedStudent)?.firstName} {children.find(c => c.id === selectedStudent)?.lastName}</strong>
            {" — "}
            Les notes affichées sont celles validées par l'administration.
            Seules les évaluations <strong>VALIDATED</strong> sont visibles.
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="ml-3 text-sm text-slate-500">Chargement des notes…</span>
        </div>
      ) : grades.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune note disponible pour cette période.</p>
          <p className="text-xs text-slate-400 mt-1">
            Les notes apparaîtront ici dès que l'enseignant aura saisie et validé les évaluations.
          </p>
        </div>
      ) : (
        /* List of quarters */
        <div className="space-y-3">
          {grades.map((quarter) => {
            const isExpanded = expandedQuarters.has(quarter.quarterId);
            const stats = quarterStats[quarter.quarterId];
            return (
              <div key={quarter.quarterId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Quarter header */}
                <button
                  onClick={() => toggleQuarter(quarter.quarterId)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-slate-900">{quarter.quarterName}</h3>
                      <p className="text-xs text-slate-500">
                        {stats?.evalCount || 0} évaluation{(stats?.evalCount || 0) > 1 ? 's' : ''} · {stats?.subjectCount || 0} matière{(stats?.subjectCount || 0) > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {stats?.average !== null && stats?.average !== undefined && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-700">
                        Moyenne: {stats.average.toFixed(2)}/20
                      </span>
                    </div>
                  )}
                </button>

                {/* Quarter content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {quarter.evaluations.map((ev) => {
                      const key = `${quarter.quarterId}__${ev.evaluationTypeId}`;
                      const isEvExpanded = expandedEvals.has(key);
                      const validScores = ev.subjects.filter(s => !s.isAbsent && s.score !== null);
                      const evAvg = validScores.length > 0
                        ? validScores.reduce((sum, s) => sum + (s.score || 0), 0) / validScores.length
                        : null;
                      return (
                        <div key={key} className="px-4">
                          {/* Evaluation header */}
                          <button
                            onClick={() => toggleEval(key)}
                            className="w-full py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {isEvExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold">
                                  {ev.evaluationTypeCode}
                                </span>
                                <div className="text-left">
                                  <div className="text-sm font-semibold text-slate-900">{ev.evaluationTypeName}</div>
                                  {ev.evaluationDate && (
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {format(new Date(ev.evaluationDate), 'd MMM yyyy', { locale: fr })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span>{ev.subjects.length} matière{ev.subjects.length > 1 ? 's' : ''}</span>
                              {!isMaternelle && evAvg !== null && (
                                <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                                  {evAvg.toFixed(2)}/20
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Subjects table */}
                          {isEvExpanded && (
                            <div className="pb-3 overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <th className="text-left px-3 py-2 font-semibold">Matière</th>
                                    <th className="text-center px-3 py-2 font-semibold">
                                      {isMaternelle ? 'Appréciation' : 'Note'}
                                    </th>
                                    {!isMaternelle && (
                                      <th className="text-center px-3 py-2 font-semibold">Sur</th>
                                    )}
                                    <th className="text-center px-3 py-2 font-semibold">Coef.</th>
                                    <th className="text-left px-3 py-2 font-semibold">Observation</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ev.subjects.map((s, i) => (
                                    <tr key={s.subjectId || i} className="border-t border-slate-100">
                                      <td className="px-3 py-2 font-medium text-slate-900">
                                        <div className="flex items-center gap-2">
                                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                          {s.subjectName}
                                        </div>
                                      </td>
                                      <td className="text-center px-3 py-2">
                                        {s.isAbsent ? (
                                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                                            ABS
                                          </span>
                                        ) : isMaternelle ? (
                                          <span className={cn(
                                            'inline-flex px-2 py-0.5 rounded text-xs font-bold',
                                            s.qualitativeCode === 'TS' && 'bg-emerald-100 text-emerald-700',
                                            s.qualitativeCode === 'S' && 'bg-blue-100 text-blue-700',
                                            s.qualitativeCode === 'PS' && 'bg-amber-100 text-amber-700',
                                          )}>
                                            {s.qualitativeCode || '—'}
                                          </span>
                                        ) : (
                                          <span className={cn(
                                            'font-bold',
                                            (s.score || 0) >= 10 ? 'text-emerald-700' : 'text-red-600'
                                          )}>
                                            {s.score !== null ? Number(s.score).toFixed(2) : '—'}
                                          </span>
                                        )}
                                      </td>
                                      {!isMaternelle && (
                                        <td className="text-center px-3 py-2 text-slate-500">/{s.maxScore}</td>
                                      )}
                                      <td className="text-center px-3 py-2 text-slate-500 text-xs">{s.coefficient}</td>
                                      <td className="px-3 py-2 text-slate-600 text-xs">
                                        <span className={cn(
                                          'inline-flex items-center gap-1',
                                          s.appreciation === 'Très Bien' && 'text-emerald-600',
                                          s.appreciation === 'Bien' && 'text-blue-600',
                                          s.appreciation === 'Assez Bien' && 'text-cyan-600',
                                          s.appreciation === 'Passable' && 'text-amber-600',
                                          (s.appreciation === 'Insuffisant' || s.appreciation === 'Absent') && 'text-red-600',
                                          s.appreciation === 'Très Satisfaisant' && 'text-emerald-600',
                                          s.appreciation === 'Satisfaisant' && 'text-blue-600',
                                          s.appreciation === 'Peu Satisfaisant' && 'text-amber-600',
                                        )}>
                                          <Award className="w-3 h-3" />
                                          {s.appreciation}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
