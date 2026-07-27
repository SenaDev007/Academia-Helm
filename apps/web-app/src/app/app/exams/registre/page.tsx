'use client';

/**
 * ============================================================================
 * MODULE EXAMEN — REGISTRE DES NOTES (Récapitulatif)
 * ============================================================================
 *
 * Vue récapitulative de TOUTES les notes VALIDÉES d'une classe.
 *
 * Hiérarchisation :
 *   Classe → Trimestre → Tableau des notes
 *
 * Filtrage par niveau scolaire :
 *   - Maternelle : tableau qualitatif (TS/S/PS par domaine × élève)
 *   - Primaire : tableau quantitatif (CM/CP/Total par matière × élève)
 *   - Secondaire : tableau quantitatif (Note/20 par matière × élève + Moyenne)
 *
 * Seules les évaluations avec status=VALIDATED ou LOCKED sont affichées.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader2, ClipboardList, Download, AlertCircle, FileText,
  ChevronRight, Calendar, Users, RefreshCw,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules } from '../layout';
import apiClient from '@/lib/api/client';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { cn } from '@/lib/utils';

const MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function getTrimester(month: number): string {
  if (month >= 9 || month === 12) return 'Trimestre 1';
  if (month >= 1 && month <= 3) return 'Trimestre 2';
  if (month >= 4 && month <= 6) return 'Trimestre 3';
  return 'Vacances (été)';
}

function RegistreContent() {
  const searchParams = useSearchParams();
  const { academicYear, schoolLevel } = useModuleContext();

  const levelCode = searchParams.get('level') || schoolLevel?.code || '';
  const language = searchParams.get('lang') || 'FR';

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [gradesByEval, setGradesByEval] = useState<Record<string, any[]>>({});

  const isMaternelle = levelCode === 'MATERNELLE';
  const isSecondaire = levelCode === 'SECONDAIRE' || levelCode === 'COLLEGE' || levelCode === 'LYCEE';

  // ── Charger les classes du niveau ──────────────────────────────────────────
  const loadClasses = useCallback(async () => {
    if (!schoolLevel?.id && !schoolLevel?.schoolLevelId) return;
    const slId = schoolLevel?.schoolLevelId || schoolLevel?.id;
    try {
      const res = await fetch(`/api/classes?schoolLevelId=${slId}`, { credentials: 'include' });
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : (data?.items || []));
    } catch {
      setClasses([]);
    }
  }, [schoolLevel]);

  // ── Charger les évaluations VALIDÉES ───────────────────────────────────────
  const loadEvaluations = useCallback(async () => {
    if (!academicYear?.id || !selectedClassId) return;
    setLoading(true);
    try {
      // Récupérer les évaluations validées pour cette classe
      const response = await apiClient.get(`/institutional-exams/evaluations`, {
        params: {
          academicYearId: academicYear.id,
          classId: selectedClassId,
          status: 'VALIDATED,LOCKED',
        },
      });
      const allEvals = Array.isArray(response.data) ? response.data : [];

      // Charger les grades pour chaque évaluation
      const gradesMap: Record<string, any[]> = {};
      await Promise.all(
        allEvals.map(async (ev: any) => {
          try {
            const res = await apiClient.get(`/institutional-exams/grades/evaluation/${ev.id}`);
            gradesMap[ev.id] = Array.isArray(res.data) ? res.data : [];
          } catch {
            gradesMap[ev.id] = [];
          }
        })
      );

      setEvaluations(allEvals);
      setGradesByEval(gradesMap);
    } catch (err) {
      console.error('Erreur chargement évaluations:', err);
      setEvaluations([]);
      setGradesByEval({});
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, selectedClassId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { if (selectedClassId) loadEvaluations(); }, [loadEvaluations]);

  // ── Grouper les évaluations par trimestre ──────────────────────────────────
  const groupedByTrimester = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const ev of evaluations) {
      const dateStr = ev.evaluationDate || ev.startDate || ev.endDate;
      const month = dateStr ? new Date(dateStr).getMonth() + 1 : 1;
      const trimester = getTrimester(month);
      if (!map[trimester]) map[trimester] = [];
      map[trimester].push(ev);
    }
    return map;
  }, [evaluations]);

  const trimesters = Object.keys(groupedByTrimester).sort();

  // ── Construire le tableau pour un trimestre ────────────────────────────────
  const renderTrimesterTable = (trimesterEvals: any[]) => {
    // Collecter toutes les matières uniques
    const subjectsMap = new Map<string, { id: string; name: string }>();
    for (const ev of trimesterEvals) {
      if (ev.subject?.id && !subjectsMap.has(ev.subject.id)) {
        subjectsMap.set(ev.subject.id, { id: ev.subject.id, name: ev.subject.name });
      }
    }
    const subjects = Array.from(subjectsMap.values());

    // Collecter tous les élèves uniques (depuis les grades)
    const studentsMap = new Map<string, { id: string; name: string; gender: string }>();
    for (const ev of trimesterEvals) {
      const grades = gradesByEval[ev.id] || [];
      for (const g of grades) {
        const sid = g.studentId;
        if (!studentsMap.has(sid)) {
          const firstName = g.student?.firstName || g.firstName || '';
          const lastName = g.student?.lastName || g.lastName || '';
          studentsMap.set(sid, {
            id: sid,
            name: `${lastName} ${firstName}`.trim(),
            gender: g.student?.gender || g.gender || '',
          });
        }
      }
    }
    const students = Array.from(studentsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    return (
      <div className="overflow-x-auto border border-slate-300 rounded-lg">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12 sticky left-0 bg-slate-100 z-10">N°</th>
              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "180px" }}>Nom et prénom</th>
              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
              {subjects.map((subj) => (
                isMaternelle ? (
                  <th key={subj.id} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                    {subj.name}<div className="text-[9px] text-slate-400 font-normal">TS/S/PS</div>
                  </th>
                ) : isSecondaire ? (
                  <th key={subj.id} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                    {subj.name}<div className="text-[9px] text-slate-400 font-normal">Note/20</div>
                  </th>
                ) : (
                  <th key={subj.id} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[120px]">
                    {subj.name}
                  </th>
                )
              ))}
              {!isMaternelle && (
                <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16 bg-blue-50">Total</th>
              )}
              {!isMaternelle && (
                <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16 bg-blue-50">Moy.</th>
              )}
            </tr>
            {!isMaternelle && !isSecondaire && (
              <tr className="bg-slate-50">
                <th colSpan={3} className="border border-slate-300"></th>
                {subjects.map((_, idx) => (
                  <>
                    <th key={`cm-${idx}`} className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">CM/18</th>
                    <th key={`cp-${idx}`} className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">CP/2</th>
                    <th key={`t-${idx}`} className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Tot</th>
                  </>
                ))}
                <th className="border border-slate-300 bg-blue-50"></th>
                <th className="border border-slate-300 bg-blue-50"></th>
              </tr>
            )}
          </thead>
          <tbody>
            {students.map((student, idx) => {
              let totalGeneral = 0;
              let nbMatieres = 0;

              return (
                <tr key={student.id} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                  <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-medium">{student.name}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    {student.gender?.startsWith('F') ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-700">F</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-700">M</span>
                    )}
                  </td>
                  {subjects.map((subj) => {
                    // Trouver l'évaluation correspondant à cette matière
                    const ev = trimesterEvals.find(e => e.subject?.id === subj.id);
                    if (!ev) {
                      return isMaternelle || isSecondaire ? (
                        <td key={subj.id} className="border border-slate-300 px-2 py-1 text-center text-slate-300">—</td>
                      ) : (
                        <>
                          <td className="border border-slate-300 px-2 py-1 text-center text-slate-300">—</td>
                          <td className="border border-slate-300 px-2 py-1 text-center text-slate-300">—</td>
                          <td className="border border-slate-300 px-2 py-1 text-center text-slate-300">—</td>
                        </>
                      );
                    }
                    const grades = gradesByEval[ev.id] || [];
                    const grade = grades.find((g: any) => g.studentId === student.id);
                    if (!grade || grade.isAbsent) {
                      return isMaternelle || isSecondaire ? (
                        <td key={subj.id} className="border border-slate-300 px-2 py-1 text-center text-red-400">Abs</td>
                      ) : (
                        <>
                          <td className="border border-slate-300 px-2 py-1 text-center text-red-400">—</td>
                          <td className="border border-slate-300 px-2 py-1 text-center text-red-400">—</td>
                          <td className="border border-slate-300 px-2 py-1 text-center text-red-400">—</td>
                        </>
                      );
                    }

                    if (isMaternelle) {
                      const code = grade.qualitativeCode;
                      return (
                        <td key={subj.id} className="border border-slate-300 px-2 py-1 text-center">
                          {code ? (
                            <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold",
                              code === 'TS' && "bg-emerald-600 text-white",
                              code === 'S' && "bg-blue-600 text-white",
                              code === 'PS' && "bg-amber-600 text-white",
                            )}>{code}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    }

                    if (isSecondaire) {
                      const score = grade.score ?? 0;
                      totalGeneral += score;
                      nbMatieres++;
                      return (
                        <td key={subj.id} className="border border-slate-300 px-2 py-1 text-center font-bold">
                          <span className={cn(score < 10 ? "text-rose-600" : score >= 14 ? "text-emerald-600" : "text-slate-900")}>
                            {score.toFixed(2)}
                          </span>
                        </td>
                      );
                    }

                    // Primaire : CM/CP/Total
                    let cm = grade.cm ?? null;
                    let cp = grade.cp ?? null;
                    if ((cm === null || cp === null) && grade.comment) {
                      try {
                        const parsed = typeof grade.comment === 'string' ? JSON.parse(grade.comment) : grade.comment;
                        if (cm === null && parsed?.cm !== undefined) cm = parsed.cm;
                        if (cp === null && parsed?.cp !== undefined) cp = parsed.cp;
                      } catch {}
                    }
                    const total = (cm ?? 0) + (cp ?? 0);
                    totalGeneral += total;
                    nbMatieres++;
                    return (
                      <>
                        <td key={`cm-${subj.id}`} className="border border-slate-300 px-2 py-1 text-center">
                          <span className={cn(cm !== null && cm < 10 ? "text-rose-600" : cm !== null && cm >= 14 ? "text-emerald-600" : "text-slate-900", "font-semibold")}>
                            {cm ?? '—'}
                          </span>
                        </td>
                        <td key={`cp-${subj.id}`} className="border border-slate-300 px-2 py-1 text-center">
                          <span className="text-slate-700">{cp ?? '—'}</span>
                        </td>
                        <td key={`t-${subj.id}`} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">
                          {total.toFixed(2)}
                        </td>
                      </>
                    );
                  })}
                  {!isMaternelle && (
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                      {totalGeneral > 0 ? totalGeneral.toFixed(2) : '—'}
                    </td>
                  )}
                  {!isMaternelle && (
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-800 bg-blue-50">
                      {nbMatieres > 0 ? (totalGeneral / nbMatieres).toFixed(2) : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={isMaternelle ? 4 + subjects.length : isSecondaire ? 5 + subjects.length : 5 + subjects.length * 3}
                  className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm">
                  Aucun élève ou aucune note validée pour ce trimestre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* En-tête + filtres */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Registre des notes</h2>
          <Badge variant="outline" className="text-xs">
            {levelCode} {language ? `· ${language}` : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold"
          >
            <option value="">— Sélectionner une classe —</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {selectedClassId && (
            <Button variant="outline" size="sm" onClick={() => loadEvaluations()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
            </Button>
          )}
        </div>
      </div>

      {/* Info barème */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <strong>Affichage :</strong>{' '}
        {isMaternelle ? 'Qualitatif (TS/S/PS par domaine)' :
         isSecondaire ? 'Quantitatif (/20 par matière + Moyenne)' :
         'Quantitatif (CM/18 + CP/2 = Total/20 par matière)'}
        {' — '}
        <strong>Source :</strong> Évaluations avec statut VALIDÉ ou VERROUILLÉ uniquement.
      </div>

      {/* Contenu */}
      {!selectedClassId ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">Sélectionnez une classe pour afficher le registre</p>
            <p className="text-xs mt-1">Le registre affiche toutes les notes validées, classées par trimestre.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Chargement du registre...</span>
        </div>
      ) : evaluations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">Aucune note validée pour cette classe</p>
            <p className="text-xs mt-1">Les notes apparaîtront ici une fois validées dans l'onglet "Validation".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pour chaque trimestre */}
          {trimesters.map(trimester => (
            <div key={trimester} className="space-y-3">
              {/* Header trimestre */}
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">{trimester}</h3>
                <span className="ml-auto text-xs text-indigo-500">
                  {groupedByTrimester[trimester].length} évaluation(s) validée(s)
                </span>
              </div>
              {/* Tableau du trimestre */}
              {renderTrimesterTable(groupedByTrimester[trimester])}
            </div>
          ))}

          {/* Légende */}
          {isMaternelle && (
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
              <span className="font-bold">Légende :</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">TS = Très Satisfaisant</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">S = Satisfaisant</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">PS = Peu Satisfaisant</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RegistrePage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  return (
    <ModuleContainer
      header={{
        title: 'Registre des notes',
        description: 'Récapitulatif de toutes les notes validées, classées par classe et par trimestre.',
        icon: 'clipboardList',
      }}
      subModules={{
        modules: scopedSubModules,
        activeModuleId: 'registre',
      }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
            <RegistreContent />
          </Suspense>
        ),
      }}
    />
  );
}
