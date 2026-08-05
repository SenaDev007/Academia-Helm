/**
 * ============================================================================
 * MODULE EXAMENS — BULLETINS (Refonte par évaluation)
 * ============================================================================
 *
 * Affiche les bulletins des élèves pour une évaluation donnée :
 *   1. Sélectionner un trimestre (T1, T2, T3)
 *   2. Sélectionner une classe (CI A, CP, CE1, etc.)
 *   3. Sélectionner un type d'évaluation (EM1, EM2, EC)
 *   4. Les bulletins de tous les élèves s'affichent automatiquement
 *
 * Le bulletin affiche :
 *   - En-tête école (logo, nom, adresse, année scolaire, période)
 *   - Tableau des notes par matière (adapté au niveau scolaire)
 *   - Synthèse (moyenne, rang, mention, appréciation)
 *   - Bouton "Générer PDF" par élève + bouton "Générer toute la classe"
 *
 * Format PDF : A4 paysage, avec en-tête école (comme module Élèves)
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import {
  FileText, Loader2, ChevronDown, ChevronRight, Download,
  Users, BookOpen, Award, Calendar, Printer, AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useSchoolIdentity } from '@/hooks/useSchoolIdentity';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import apiClient from '@/lib/api/client';
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Pedagogical class ordering ──────────────────────────────────────────────
const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];

const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (const prefix of PEDAGOGICAL_ORDER) {
    if (upper.startsWith(prefix)) return PEDAGOGICAL_ORDER.indexOf(prefix);
  }
  return PEDAGOGICAL_ORDER.length;
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubjectScore {
  score: number | null;
  qualitativeCode: string | null;
  isAbsent: boolean;
  appreciation: string;
}

interface StudentResult {
  id: string;
  student: {
    firstName: string;
    lastName: string;
    matricule?: string;
    gender?: string;
  };
  subjectScores: Record<string, SubjectScore>;
  generalAverage: number | null;
  appreciationGlobale: string | null;
  isMaternelle: boolean;
  tsCount: number;
  sCount: number;
  psCount: number;
  validSubjectsCount: number;
  classRank: number;
}

interface CalculationResult {
  classId: string;
  className: string;
  schoolLevelCode: string;
  isMaternelle: boolean;
  evaluationTypeId: string;
  periodId: string;
  subjects: Array<{ id: string; name: string; code?: string }>;
  results: StudentResult[];
  stats: {
    totalStudents: number;
    composedStudents: number;
    classAverage: number | null;
    passingCount: number;
    failingCount: number;
    passingRate: number;
  };
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BulletinsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);

  return (
    <ModuleContainer
      header={{
        title: 'Bulletins',
        description: 'Bulletins de notes par évaluation, classe et trimestre.',
        icon: 'fileText',
      }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'bulletins' }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
            <BulletinsContent />
          </Suspense>
        ),
      }}
    />
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function BulletinsContent() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { identity: school } = useSchoolIdentity();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [evaluationTypes, setEvaluationTypes] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedEvalTypeId, setSelectedEvalTypeId] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingBulletins, setLoadingBulletins] = useState(false);
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const isMaternelle = scopeLevel === 'MATERNELLE';
  const isPrimaire = scopeLevel === 'PRIMAIRE';
  const isSecondaire = scopeLevel === 'SECONDAIRE';

  // ── Resolve schoolLevelUuid ────────────────────────────────────────────────
  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find(
      (l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL'
    );
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  // ── Load classes ──────────────────────────────────────────────────────────
  const loadClasses = useCallback(async () => {
    if (!schoolLevelUuid) { setLoadingClasses(false); return; }
    try {
      const res = await fetch('/api/all-classes', { credentials: 'include' });
      const data = await res.json();
      const allClasses = Array.isArray(data) ? data : (data?.items || []);
      const levelClasses = allClasses.filter((c: any) =>
        c.schoolLevelId === schoolLevelUuid || c.schoolLevel?.id === schoolLevelUuid
      );
      const langClasses = scopeLang
        ? levelClasses.filter((c: any) => {
            const classLang = c.language;
            const trackCode = c.academicTrack?.code || c.academicTrackCode;
            if (!classLang && !trackCode) return true;
            if (classLang === scopeLang) return true;
            if (trackCode === scopeLang) return true;
            return false;
          })
        : levelClasses;
      langClasses.sort((a: any, b: any) => {
        const idxA = pedagogicalSortIndex(a.name);
        const idxB = pedagogicalSortIndex(b.name);
        if (idxA !== idxB) return idxA - idxB;
        return (a.name || '').localeCompare(b.name || '', 'fr');
      });
      setClasses(langClasses);
      if (langClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(langClasses[0].id);
      }
    } catch { setClasses([]); }
    finally { setLoadingClasses(false); }
  }, [schoolLevelUuid, scopeLang, selectedClassId]);

  // ── Load periods ──────────────────────────────────────────────────────────
  const loadPeriods = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const res = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const periodList = Array.isArray(data) ? data : (data?.items || []);
        setPeriods(periodList);
        if (periodList.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(periodList[0].id);
        }
      }
    } catch { setPeriods([]); }
  }, [academicYear?.id, selectedPeriodId]);

  // ── Load evaluation types ──────────────────────────────────────────────────
  const loadEvaluationTypes = useCallback(async () => {
    if (!schoolLevelUuid) { setLoadingTypes(false); return; }
    try {
      const types = await institutionalExamsService.getEvaluationTypes(schoolLevelUuid);
      setEvaluationTypes(Array.isArray(types) ? types : []);
      if (types.length > 0 && !selectedEvalTypeId) {
        setSelectedEvalTypeId(types[0].id);
      }
    } catch { setEvaluationTypes([]); }
    finally { setLoadingTypes(false); }
  }, [schoolLevelUuid, selectedEvalTypeId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => { loadEvaluationTypes(); }, [loadEvaluationTypes]);

  // ── Load bulletins (auto-calculate when all 3 selectors are set) ───────────
  const loadBulletins = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId || !selectedEvalTypeId || !academicYear?.id) return;
    setLoadingBulletins(true);
    try {
      const response = await apiClient.post('/exams/calculate-evaluation-averages', {
        classId: selectedClassId,
        periodId: selectedPeriodId,
        academicYearId: academicYear.id,
        evaluationTypeId: selectedEvalTypeId,
        language: scopeLang,
      });
      setCalcResult(response.data);
      // Auto-expand first student
      if (response.data?.results?.length > 0) {
        setExpandedStudents(new Set([response.data.results[0].id]));
      }
    } catch (err: any) {
      console.error('Error loading bulletins:', err);
      toastError('Erreur lors du chargement', {
        description: err.response?.data?.message || err.message,
      });
      setCalcResult(null);
    } finally {
      setLoadingBulletins(false);
    }
  }, [selectedClassId, selectedPeriodId, selectedEvalTypeId, academicYear?.id, scopeLang]);

  useEffect(() => { loadBulletins(); }, [loadBulletins]);

  // ── Toggle student expansion ───────────────────────────────────────────────
  const toggleStudent = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  // ── Generate PDF for a single student ──────────────────────────────────────
  const handleGeneratePdf = async (student: StudentResult) => {
    setGeneratingPdf(student.id);
    try {
      // Use the browser's print functionality for now
      // In production, this would call a backend PDF generation endpoint
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toastError('Erreur', { description: 'Veuillez autoriser les popups' });
        return;
      }
      const html = generateBulletinHtml(student, calcResult!, school, academicYear, periods, selectedPeriodId, scopeLang);
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
      toastSuccess('Bulletin généré', { description: `${student.student.firstName} ${student.student.lastName}` });
    } catch (err: any) {
      toastError('Erreur PDF', { description: err.message });
    } finally {
      setGeneratingPdf(null);
    }
  };

  // ── Generate PDF for entire class ──────────────────────────────────────────
  const handleGenerateAllPdf = async () => {
    if (!calcResult) return;
    for (const student of calcResult.results) {
      await handleGeneratePdf(student);
    }
  };

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';
  const selectedPeriodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
  const selectedEvalTypeName = evaluationTypes.find(t => t.id === selectedEvalTypeId)?.name || '';
  const selectedEvalTypeCode = evaluationTypes.find(t => t.id === selectedEvalTypeId)?.code || '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">Bulletins par évaluation</h2>
        <Badge variant="outline" className="text-xs">
          {scopeLevel || '—'} {scopeLang ? `· ${scopeLang}` : ''}
        </Badge>
      </div>

      {/* Control Bar — 3 selectors */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Trimestre</label>
            <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500">
              <option value="">— Sélectionner —</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Classe</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500">
              <option value="">— Sélectionner —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Évaluation</label>
            <select value={selectedEvalTypeId} onChange={(e) => setSelectedEvalTypeId(e.target.value)}
              className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500">
              <option value="">— Sélectionner —</option>
              {evaluationTypes.map(t => <option key={t.id} value={t.id}>[{t.code}] {t.name}</option>)}
            </select>
          </div>
          {calcResult && calcResult.results.length > 0 && (
            <div className="flex items-end">
              <Button onClick={handleGenerateAllPdf} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-lg shadow-sm w-full md:w-auto">
                <Printer className="w-4 h-4 mr-2" />Toute la classe
              </Button>
            </div>
          )}
        </div>
        {(selectedClassName || selectedPeriodName || selectedEvalTypeName) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap text-xs text-gray-500">
            <span className="font-semibold">Sélection :</span>
            <Badge variant="outline" className="text-xs">{selectedPeriodName || '—'}</Badge>
            <span>·</span>
            <Badge variant="outline" className="text-xs">{selectedClassName || '—'}</Badge>
            <span>·</span>
            <Badge variant="outline" className="text-xs">{selectedEvalTypeCode ? `[${selectedEvalTypeCode}] ` : ''}{selectedEvalTypeName || '—'}</Badge>
          </div>
        )}
      </div>

      {/* Results */}
      {loadingBulletins ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-slate-500">Chargement des bulletins…</span>
        </div>
      ) : !calcResult ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">Aucun bulletin à afficher</p>
          <p className="text-sm text-gray-400 mt-1">Sélectionnez un trimestre, une classe et une évaluation.</p>
        </div>
      ) : calcResult.results.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">Aucun élève dans cette classe</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-xs gap-1">
                <Users className="w-3 h-3" />{calcResult.results.length} élèves
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <BookOpen className="w-3 h-3" />{calcResult.subjects.length} matières
              </Badge>
              {!isMaternelle && calcResult.stats.classAverage !== null && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Award className="w-3 h-3" />Moy. classe: {calcResult.stats.classAverage.toFixed(2)}/20
                </Badge>
              )}
            </div>
          </div>

          {/* Student bulletins (collapsible) */}
          {calcResult.results.map((student) => {
            const isExpanded = expandedStudents.has(student.id);
            return (
              <div key={student.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Student header */}
                <button
                  onClick={() => toggleStudent(student.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {student.classRank}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-900">
                        {student.student.lastName} {student.student.firstName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {student.student.matricule || '—'} · Rang {student.classRank}
                        {!isMaternelle && student.generalAverage !== null && ` · ${student.generalAverage.toFixed(2)}/20`}
                        {isMaternelle && student.appreciationGlobale && ` · ${student.appreciationGlobale}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isMaternelle && student.generalAverage !== null && (
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-bold',
                        student.generalAverage >= 10 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      )}>
                        {student.generalAverage.toFixed(2)}/20
                      </span>
                    )}
                    {isMaternelle && student.appreciationGlobale && (
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-bold',
                        student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
                        student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
                        student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
                      )}>
                        {student.appreciationGlobale}
                      </span>
                    )}
                  </div>
                </button>

                {/* Bulletin content (expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-4">
                    {/* Bulletin header */}
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        {school?.logoUrl && (
                          <img src={school.logoUrl} alt="logo" className="h-12 w-12 rounded-lg object-cover" />
                        )}
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{school?.schoolName || 'École'}</h3>
                          <p className="text-xs text-slate-500">{school?.address || ''} · Tél: {school?.phone || ''}</p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">
                        Année scolaire: <strong>{academicYear?.label || ''}</strong> · {selectedPeriodName} · Classe: <strong>{selectedClassName}</strong>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Élève: <strong>{student.student.lastName} {student.student.firstName}</strong> · Matricule: {student.student.matricule || '—'} · {selectedEvalTypeCode} {selectedEvalTypeName}
                      </div>
                    </div>

                    {/* Notes table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                            <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Matière</th>
                            {isMaternelle ? (
                              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">Appréciation</th>
                            ) : (
                              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">Note /20</th>
                            )}
                            <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">Observation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calcResult.subjects.map((subject, idx) => {
                            const score = student.subjectScores[subject.id];
                            return (
                              <tr key={subject.id} className={cn(idx % 2 === 1 && 'bg-slate-50/50')}>
                                <td className="border border-slate-300 px-2 py-1 text-center text-slate-600">{idx + 1}</td>
                                <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">{subject.name}</td>
                                <td className="border border-slate-300 px-2 py-1 text-center">
                                  {!score || score.isAbsent ? (
                                    <span className="text-red-500 text-[10px] font-bold">ABS</span>
                                  ) : isMaternelle ? (
                                    <span className={cn(
                                      'inline-flex px-2 py-0.5 rounded text-xs font-bold',
                                      score.qualitativeCode === 'TS' && 'bg-emerald-100 text-emerald-700',
                                      score.qualitativeCode === 'S' && 'bg-blue-100 text-blue-700',
                                      score.qualitativeCode === 'PS' && 'bg-amber-100 text-amber-700',
                                    )}>{score.qualitativeCode || '—'}</span>
                                  ) : (
                                    <span className={cn(
                                      'font-bold',
                                      (score.score || 0) >= 10 ? 'text-emerald-700' : 'text-red-600'
                                    )}>{score.score !== null ? Number(score.score).toFixed(2) : '—'}</span>
                                  )}
                                </td>
                                <td className="border border-slate-300 px-2 py-1 text-center text-slate-600 text-xs">
                                  {score?.appreciation || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Synthèse */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {!isMaternelle && (
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <p className="text-[10px] uppercase font-bold text-slate-500">Moyenne</p>
                          <p className="text-lg font-bold text-blue-700">
                            {student.generalAverage !== null ? student.generalAverage.toFixed(2) : '—'}/20
                          </p>
                        </div>
                      )}
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-500">Rang</p>
                        <p className="text-lg font-bold text-slate-700">{student.classRank}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-500">Mention</p>
                        <p className="text-sm font-bold text-emerald-700">
                          {!isMaternelle && student.generalAverage !== null ? (
                            student.generalAverage >= 16 ? 'Très Bien' :
                            student.generalAverage >= 14 ? 'Bien' :
                            student.generalAverage >= 12 ? 'Assez Bien' :
                            student.generalAverage >= 10 ? 'Passable' : 'Insuffisant'
                          ) : student.appreciationGlobale || '—'}
                        </p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-500">Moy. classe</p>
                        <p className="text-lg font-bold text-amber-700">
                          {calcResult.stats.classAverage !== null ? calcResult.stats.classAverage.toFixed(2) : '—'}
                        </p>
                      </div>
                    </div>

                    {/* PDF button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleGeneratePdf(student)}
                        disabled={generatingPdf === student.id}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                      >
                        {generatingPdf === student.id ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération…</>
                        ) : (
                          <><Download className="w-4 h-4 mr-2" />Générer PDF</>
                        )}
                      </Button>
                    </div>
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

// ─── PDF HTML Generator (A4 paysage) ────────────────────────────────────────

function generateBulletinHtml(
  student: StudentResult,
  calcResult: CalculationResult,
  school: any,
  academicYear: any,
  periods: any[],
  selectedPeriodId: string,
  scopeLang: string,
): string {
  const isMaternelle = calcResult.isMaternelle;
  const periodName = periods.find(p => p.id === selectedPeriodId)?.name || '';

  const subjectRows = calcResult.subjects.map((subject, idx) => {
    const score = student.subjectScores[subject.id];
    let scoreCell = '—';
    if (score?.isAbsent) {
      scoreCell = '<span style="color:red;font-weight:bold">ABS</span>';
    } else if (isMaternelle) {
      const color = score?.qualitativeCode === 'TS' ? 'green' : score?.qualitativeCode === 'S' ? 'blue' : score?.qualitativeCode === 'PS' ? 'orange' : 'gray';
      scoreCell = `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-weight:bold">${score?.qualitativeCode || '—'}</span>`;
    } else {
      const val = score?.score !== null ? Number(score.score).toFixed(2) : '—';
      const color = (score?.score || 0) >= 10 ? 'green' : 'red';
      scoreCell = `<span style="color:${color};font-weight:bold">${val}</span>`;
    }
    return `<tr>
      <td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${idx + 1}</td>
      <td style="border:1px solid #ccc;padding:4px 8px;font-weight:500">${subject.name}</td>
      <td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${scoreCell}</td>
      <td style="border:1px solid #ccc;padding:4px 8px;text-align:center;font-size:11px">${score?.appreciation || '—'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bulletin - ${student.student.firstName} ${student.student.lastName}</title>
<style>
  @page { size: A4 landscape; margin: 1cm; }
  body { font-family: 'Times New Roman', serif; margin: 0; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
  .header h1 { font-size: 14px; margin: 0; }
  .header .school-info { font-size: 11px; color: #555; }
  .student-info { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f0f0f0; padding: 6px 8px; border: 1px solid #ccc; text-align: center; font-size: 10px; }
  .synthesis { display: flex; justify-content: space-around; margin-top: 15px; }
  .synthesis div { text-align: center; padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; }
  .synthesis .label { font-size: 9px; color: #666; text-transform: uppercase; }
  .synthesis .value { font-size: 16px; font-weight: bold; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    ${school?.logoUrl ? `<img src="${school.logoUrl}" style="height:50px;float:left" />` : ''}
    <h1>${school?.schoolName || 'École'}</h1>
    <div class="school-info">${school?.address || ''} · Tél: ${school?.phone || ''}</div>
    <div class="school-info">Année scolaire: ${academicYear?.label || ''} · ${periodName} · Classe: ${calcResult.className}</div>
  </div>
  <div class="student-info">
    <div><strong>Élève:</strong> ${student.student.lastName} ${student.student.firstName}</div>
    <div><strong>Matricule:</strong> ${student.student.matricule || '—'}</div>
    <div><strong>Rang:</strong> ${student.classRank}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">N°</th>
        <th style="text-align:left">Matière</th>
        <th>${isMaternelle ? 'Appréciation' : 'Note /20'}</th>
        <th>Observation</th>
      </tr>
    </thead>
    <tbody>${subjectRows}</tbody>
  </table>
  <div class="synthesis">
    ${!isMaternelle ? `<div><div class="label">Moyenne</div><div class="value" style="color:blue">${student.generalAverage?.toFixed(2) || '—'}/20</div></div>` : ''}
    <div><div class="label">Rang</div><div class="value">${student.classRank}</div></div>
    <div><div class="label">${isMaternelle ? 'Appréciation' : 'Mention'}</div><div class="value" style="color:green;font-size:13px">${isMaternelle ? (student.appreciationGlobale || '—') : (student.generalAverage !== null ? (student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' : student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant') : '—')}</div></div>
    <div><div class="label">Moy. classe</div><div class="value" style="color:orange">${calcResult.stats.classAverage?.toFixed(2) || '—'}</div></div>
  </div>
  <div class="signatures">
    <div>Le Titulaire<br/><br/><br/>_________________</div>
    <div>Le Directeur<br/><br/><br/>_________________</div>
    <div>Les Parents<br/><br/><br/>_________________</div>
  </div>
</body>
</html>`;
}
