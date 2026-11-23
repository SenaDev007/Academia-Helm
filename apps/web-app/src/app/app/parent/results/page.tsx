"use client";

/**
 * ============================================================================
 * Parent Portal — Notes et Bulletins
 * ============================================================================
 *
 * Deux onglets :
 *   1. Notes et Résultats — notes validées par trimestre + évaluation
 *   2. Bulletins — bulletins officiels (ReportCard)
 *
 * Si le parent a plusieurs enfants, un sélecteur d'enfant est affiché.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  FileText, Loader2, GraduationCap, AlertCircle, BookOpen,
  ChevronDown, ChevronRight, Calendar, Award, TrendingUp,
  Download, Landmark, CheckCircle2,
} from "lucide-react";
import apiClient from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RegistreTable } from "@/components/exams/RegistreTable";
import type { GroupedEvaluation } from "@/components/exams/GradingSheet";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  classId?: string;
  className?: string;
  schoolLevelCode?: string;
}

interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  score: number | null;
  maxScore: number;
  coefficient: number;
  isAbsent: boolean;
  qualitativeCode?: string | null;
  appreciation: string;
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

interface ReportCard {
  id: string;
  type: string;
  overallAverage: number | null;
  rank: number | null;
  status: string;
  filePath: string | null;
  publishedAt: string | null;
  createdAt: string;
  quarterName: string | null;
  quarterNumber: number | null;
  // ⭐ 2026-11-23 — Workflow de signature : le bulletin envoyé par l'école
  //    (étape 5 — « Envoyer aux parents ») porte le statut PARENT_SENT et la
  //    date d'envoi ; le type d'évaluation (EM1, EC, EP…) est affiché pour
  //    distinguer les bulletins d'une même période.
  sentToParentAt: string | null;
  evaluationTypeId: string | null;
  evaluationTypeName: string | null;
  evaluationTypeCode: string | null;
  items: Array<{
    average: number | null;
    coefficient: number | null;
    rank: number | null;
    comments: string | null;
    subjectName: string;
  }>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ParentResultsPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  // ⭐ T27 (2026-10-01) — 3e onglet « Examens nationaux » : résultats CEP/BEPC/
  //    BAC/CAP de l'enfant + relevés officiels distribués (comme les bulletins).
  const [activeTab, setActiveTab] = useState<'notes' | 'bulletins' | 'examens'>('notes');
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");

  // ── Load children ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`, { credentials: "include" });
        const data = await res.json();
        // ⭐ v4.3.0 — réponse hors ligne parfois partielle : filtrer les trimestres non conformes
      const list = (Array.isArray(data) ? data : []).filter((q: any) => q && typeof q === 'object');
        setChildren(list);
        if (list.length > 0) setSelectedStudent(list[0].id);
      } catch { setChildren([]); }
    })();
  }, [user?.id, academicYear?.id]);

  const selectedChild = children.find(c => c.id === selectedStudent);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-bold text-slate-900">Notes et Bulletins</h2>
      </div>

      {/* Child selector */}
      {children.length > 0 && (
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
          {selectedChild?.className && (
            <span className="text-xs text-slate-500">— Classe : {selectedChild.className}</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'notes'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <BookOpen className="w-4 h-4" />
          Notes et Résultats
        </button>
        <button
          onClick={() => setActiveTab('bulletins')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'bulletins'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <FileText className="w-4 h-4" />
          Bulletins
        </button>
        <button
          onClick={() => setActiveTab('examens')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'examens'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <Landmark className="w-4 h-4" />
          Examens nationaux
        </button>
      </div>

      {/* Content */}
      {activeTab === 'notes' ? (
        <NotesTab studentId={selectedStudent} academicYearId={academicYear?.id} child={selectedChild} />
      ) : activeTab === 'examens' ? (
        <NationalExamsTab studentId={selectedStudent} />
      ) : (
        <BulletinsTab studentId={selectedStudent} academicYearId={academicYear?.id} child={selectedChild} />
      )}
    </div>
  );
}

// ─── Notes Tab (uses /parent/grades endpoint + RegistreTable) ───────────────

function NotesTab({ studentId, academicYearId, child }: { studentId: string; academicYearId?: string; child?: Child }) {
  const [grades, setGrades] = useState<QuarterGrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuarters, setExpandedQuarters] = useState<Set<string>>(new Set());

  const loadGrades = useCallback(async () => {
    if (!studentId || !academicYearId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/parent/grades/${studentId}?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      // ⭐ v4.3.0 — réponse hors ligne parfois partielle : filtrer les trimestres non conformes
      const list = (Array.isArray(data) ? data : []).filter((q: any) => q && typeof q === 'object');
      setGrades(list);
      if (list.length > 0) {
        setExpandedQuarters(new Set([list[0].quarterId]));
      }
    } catch {
      setGrades([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, academicYearId]);

  useEffect(() => {
    if (studentId) loadGrades();
  }, [loadGrades, studentId]);

  const toggleQuarter = (quarterId: string) => {
    setExpandedQuarters(prev => {
      const next = new Set(prev);
      if (next.has(quarterId)) next.delete(quarterId);
      else next.add(quarterId);
      return next;
    });
  };

  const isMaternelle = useMemo(() => {
    // Derive from grades data: if any subject has qualitativeCode, it's Maternelle
    // ⭐ v4.3.0 — null-safety : un trimestre sans évaluations (ou une
    //    réponse partielle hors ligne) ne doit JAMAIS faire crasher la page
    //    (error boundary « Module en attente du réseau » constaté en E2E).
    return (grades || []).some(
      (q: any) => (q?.evaluations || []).some(
        (ev: any) => (ev?.subjects || []).some((s: any) => s?.qualitativeCode),
      ),
    );
  }, [grades]);
  const isPrimaire = !isMaternelle && child?.schoolLevelCode === 'PRIMAIRE';
  const isSecondaire = child?.schoolLevelCode === 'SECONDAIRE';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-3 text-sm text-slate-500">Chargement des notes…</span>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune note disponible pour cette période.</p>
        <p className="text-xs text-slate-400 mt-1">
          Les notes apparaîtront ici dès que l'enseignant aura saisi et validé les évaluations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grades.map((quarter) => {
        const isExpanded = expandedQuarters.has(quarter.quarterId);
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
                    {(quarter.evaluations || []).length} évaluation{(quarter.evaluations || []).length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </button>

            {/* Quarter content: evaluations */}
            {isExpanded && (
              <div className="border-t border-slate-100 divide-y divide-slate-100">
                {(quarter.evaluations || []).map((ev) => {
                  // Build a GroupedEvaluation for RegistreTable
                  const group: GroupedEvaluation = {
                    classId: child?.classId || '',
                    className: child?.className || '',
                    evaluationTypeId: ev.evaluationTypeId,
                    evaluationTypeName: ev.evaluationTypeName,
                    evaluationTypeCode: ev.evaluationTypeCode,
                    periodId: quarter.quarterId,
                    periodName: quarter.quarterName,
                    startDate: ev.evaluationDate,
                    endDate: ev.evaluationDate,
                    subjects: ev.subjects.map(s => ({ id: s.subjectId, name: s.subjectName })),
                    evaluationIds: [`${ev.evaluationTypeId}_${ev.evaluationDate}`], // fake ID for RegistreTable
                    statuses: ['VALIDATED'],
                    firstEvaluation: {} as any,
                  };

                  return (
                    <div key={ev.evaluationTypeId} className="p-4">
                      {/* Evaluation header */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold">
                          {ev.evaluationTypeCode}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{ev.evaluationTypeName}</div>
                          {ev.evaluationDate && (
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(ev.evaluationDate), 'd MMM yyyy', { locale: fr })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Grades table — only for single evaluation (not the full class registre) */}
                      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
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
                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">ABS</span>
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bulletins Tab ──────────────────────────────────────────────────────────

function BulletinsTab({ studentId, academicYearId, child }: { studentId: string; academicYearId?: string; child?: Child }) {
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId || !academicYearId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/parent/results/${studentId}?academicYearId=${academicYearId}`, { credentials: "include" });
        const data = await res.json();
        setReportCards(Array.isArray(data) ? data : []);
      } catch {
        setReportCards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId, academicYearId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-3 text-sm text-slate-500">Chargement des bulletins…</span>
      </div>
    );
  }

  if (reportCards.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucun bulletin disponible pour cette période.</p>
        <p className="text-xs text-slate-400 mt-1">
          Les bulletins seront publiés par l'école après les compositions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reportCards.map((rc) => (
        <div key={rc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {/* ⭐ 2026-11-23 — Période réelle (academic_periods) + type
                      d'évaluation (EM1, EC, EP…) : le bulletin porte son
                      intitulé complet, exactement comme dans l'onglet du
                      directeur. */}
                  {rc.quarterName || 'Bulletin'}{rc.evaluationTypeName ? ` — ${rc.evaluationTypeName}` : ''}
                </h3>
                <p className="text-xs text-slate-500">
                  {rc.type === 'QUARTERLY' ? 'Bulletin trimestriel' : rc.type}
                  {rc.publishedAt && ` · Publié le ${format(new Date(rc.publishedAt), 'd MMM yyyy', { locale: fr })}`}
                  {/* ⭐ 2026-11-23 — Workflow : « reçu le … » quand l'école a
                      envoyé le bulletin aux parents (statut PARENT_SENT). */}
                  {rc.status === 'PARENT_SENT' && rc.sentToParentAt
                    && ` · Reçu le ${format(new Date(rc.sentToParentAt), 'd MMM yyyy', { locale: fr })}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {rc.overallAverage !== null && (
                  <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold">
                    Moy: {Number(rc.overallAverage).toFixed(2)}/20
                  </span>
                )}
                {rc.rank !== null && (
                  <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-sm font-bold">
                    Rang: {rc.rank}
                  </span>
                )}
                {/* ⭐ Bouton PDF — le bulletin exactement comme généré par le
                    directeur (filePath = archive publique posée à la
                    génération/à l'envoi WhatsApp). */}
                {rc.filePath && (
                  <a
                    href={rc.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-lg bg-purple-600 text-white text-xs font-semibold flex items-center gap-1 hover:bg-purple-700"
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </a>
                )}
              </div>
            </div>
          </div>
          {rc.items && rc.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="text-left px-3 py-2 font-semibold">Matière</th>
                    <th className="text-center px-3 py-2 font-semibold">Moyenne</th>
                    <th className="text-center px-3 py-2 font-semibold">Coef.</th>
                    <th className="text-center px-3 py-2 font-semibold">Rang</th>
                    <th className="text-left px-3 py-2 font-semibold">Appréciation</th>
                  </tr>
                </thead>
                <tbody>
                  {rc.items.map((item, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{item.subjectName || '—'}</td>
                      <td className="text-center px-3 py-2 font-bold">
                        {item.average !== null ? Number(item.average).toFixed(2) : '—'}
                      </td>
                      <td className="text-center px-3 py-2 text-slate-500">{item.coefficient || '—'}</td>
                      <td className="text-center px-3 py-2 text-slate-500">{item.rank || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{item.comments || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── National Exams Tab (T27 — 2026-10-01) ─────────────────────────────────
// Résultats des examens nationaux (CEP / BEPC / BAC / CAP) de l'enfant :
// campagnes présentées par l'école, décision du jury, moyenne, rang et
// téléchargement du relevé officiel dès que le patronat l'a distribué.

interface NationalExamResult {
  examId: string;
  examCode: string;
  examName: string;
  examType: string;
  level: string | null;
  academicYearLabel: string | null;
  publishedAt: string | null;
  candidateId: string;
  matricule: string;
  decision: 'ADMIS' | 'AJOURNE' | 'EN_ATTENTE' | 'NON_DELIBERE' | string;
  decisionLabel: string | null;
  moyenne: number | null;
  mention: string | null;
  rank: number | null;
  totalCandidates: number | null;
  releveDispatched: boolean;
}

function NationalExamsTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<{
    student?: { name: string; matricule?: string };
    exams?: NationalExamResult[];
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!studentId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/parent/national-exams/${studentId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Chargement impossible');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Chargement impossible.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const downloadReleve = async (exam: NationalExamResult) => {
    setDownloadingId(exam.candidateId);
    try {
      const res = await fetch(
        `/api/parent/national-exams/${studentId}/releve/${exam.candidateId}/pdf?examId=${encodeURIComponent(exam.examId)}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        let msg = 'Téléchargement impossible.';
        try {
          const j = await res.json();
          msg = Array.isArray(j?.message) ? j.message.join(' ') : (j?.message ?? msg);
        } catch { /* blob d'erreur non JSON */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Releve_${exam.examCode}_${exam.matricule}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message ?? 'Téléchargement impossible.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-3 text-sm text-slate-500">Chargement des résultats…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  const exams = data?.exams ?? [];
  if (exams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Landmark className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucun examen national pour cet enfant.</p>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          {data?.message ??
            "Les résultats des examens nationaux (CEP, BEPC, Baccalauréat, CAP) apparaîtront ici dès que l'école présente l'enfant et que le patronat délibère."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exams.map((exam) => {
        const isAdmis = exam.decision === 'ADMIS';
        return (
          <div key={exam.candidateId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-slate-50/60">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {exam.examName} <span className="text-slate-400 font-mono text-xs">({exam.examCode})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {exam.academicYearLabel ? `Session ${exam.academicYearLabel}` : ''}
                  {exam.publishedAt
                    ? ` · publié le ${format(new Date(exam.publishedAt), 'd MMM yyyy', { locale: fr })}`
                    : ''}
                  {exam.totalCandidates ? ` · ${exam.totalCandidates} candidats` : ''}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold',
                  isAdmis
                    ? 'bg-emerald-100 text-emerald-700'
                    : exam.decision === 'EN_ATTENTE'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-700',
                )}
              >
                {isAdmis ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />}
                {exam.decisionLabel ?? (isAdmis ? 'Admis' : '—')}
              </span>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Moyenne</p>
                <p className={cn('text-sm font-black', isAdmis ? 'text-emerald-700' : 'text-red-600')}>
                  {exam.moyenne !== null && exam.moyenne !== undefined
                    ? `${Number(exam.moyenne).toFixed(2)} / 20`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Rang</p>
                <p className="text-sm font-bold text-slate-800">
                  {exam.rank ? `${exam.rank}${exam.totalCandidates ? ` / ${exam.totalCandidates}` : ''}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Mention</p>
                <p className="text-sm font-bold text-slate-800">{exam.mention ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Matricule</p>
                <p className="text-sm font-mono font-bold text-slate-800">{exam.matricule}</p>
              </div>
            </div>
            {exam.releveDispatched ? (
              <div className="px-4 pb-3">
                <button
                  onClick={() => downloadReleve(exam)}
                  disabled={downloadingId === exam.candidateId}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold',
                    'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60',
                  )}
                >
                  {downloadingId === exam.candidateId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Télécharger le relevé de notes officiel
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
