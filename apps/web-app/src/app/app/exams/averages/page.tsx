/**
 * ============================================================================
 * MODULE EXAMENS — MOYENNES (Refonte par évaluation)
 * ============================================================================
 *
 * Flux utilisateur :
 *   1. Sélectionner un trimestre (Trimestre 1, 2, 3)
 *   2. Sélectionner une classe (CI A, CP, CE1, etc.)
 *   3. Sélectionner un type d'évaluation (EM1, EM2, EC)
 *   4. Cliquer sur "Lancer le calcul"
 *   5. Modal de progression s'affiche (élève X / N)
 *   6. Tableau de résultats s'affiche :
 *      - Maternelle : TS/S/PS par matière + appréciation globale
 *      - Primaire : Note /20 par matière + moyenne générale + rang
 *
 * Le panneau de droite (stats) est adapté au niveau scolaire :
 *   - Maternelle : Répartition TS/S/PS (pas de /20, pas de seuil)
 *   - Primaire : Moyenne de classe + seuil 10/20 + admis/à revoir
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import {
  Calculator, RefreshCcw, Users, AlertCircle, AlertTriangle,
  CheckCircle, Loader2, ChevronDown, BookOpen, Award, TrendingUp,
  X,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

export default function AveragesPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);

  return (
    <ModuleContainer
      header={{
        title: 'Moyennes',
        description: 'Calcul des moyennes par évaluation, classe et trimestre.',
        icon: 'calculator',
      }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'averages' }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
            <AveragesContent />
          </Suspense>
        ),
      }}
    />
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function AveragesContent() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [evaluationTypes, setEvaluationTypes] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedEvalTypeId, setSelectedEvalTypeId] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [progressModal, setProgressModal] = useState<{
    open: boolean;
    current: number;
    total: number;
    currentStudent: string;
  }>({ open: false, current: 0, total: 0, currentStudent: '' });

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

  // ── Load classes (with pedagogical sort + auto-select first) ──────────────
  const loadClasses = useCallback(async () => {
    if (!schoolLevelUuid) {
      setLoadingClasses(false);
      return;
    }
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
    } catch {
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [schoolLevelUuid, scopeLang, selectedClassId]);

  // ── Load periods (trimesters) ──────────────────────────────────────────────
  const loadPeriods = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const res = await fetch(
        `/api/settings/academic-years/${academicYear.id}/periods`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const periodList = Array.isArray(data) ? data : (data?.items || []);
        setPeriods(periodList);
        if (periodList.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(periodList[0].id);
        }
      }
    } catch {
      setPeriods([]);
    }
  }, [academicYear?.id, selectedPeriodId]);

  // ── Load evaluation types for this school level ────────────────────────────
  const loadEvaluationTypes = useCallback(async () => {
    if (!schoolLevelUuid) {
      setLoadingTypes(false);
      return;
    }
    try {
      const types = await institutionalExamsService.getEvaluationTypes(schoolLevelUuid);
      setEvaluationTypes(Array.isArray(types) ? types : []);
      if (types.length > 0 && !selectedEvalTypeId) {
        setSelectedEvalTypeId(types[0].id);
      }
    } catch {
      setEvaluationTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  }, [schoolLevelUuid, selectedEvalTypeId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => { loadEvaluationTypes(); }, [loadEvaluationTypes]);

  // ── Handle Calculate ───────────────────────────────────────────────────────
  const handleCalculate = async () => {
    if (!selectedClassId || !selectedPeriodId || !selectedEvalTypeId || !academicYear?.id) {
      toastError('Sélection incomplète', {
        description: 'Veuillez sélectionner un trimestre, une classe et une évaluation.',
      });
      return;
    }

    setCalculating(true);
    // Open progress modal
    setProgressModal({
      open: true,
      current: 0,
      total: 0,
      currentStudent: 'Initialisation…',
    });

    try {
      // Simulate progress (the API call is fast, but we show progress for UX)
      // In a real implementation, we'd use SSE or polling for real progress
      setProgressModal(prev => ({ ...prev, current: 1, total: 100, currentStudent: 'Récupération des élèves…' }));

      const response = await apiClient.post('/exams/calculate-evaluation-averages', {
        classId: selectedClassId,
        periodId: selectedPeriodId,
        academicYearId: academicYear.id,
        evaluationTypeId: selectedEvalTypeId,
      });

      const result: CalculationResult = response.data;

      // Animate progress to 100%
      setProgressModal(prev => ({ ...prev, current: 100, currentStudent: 'Calcul terminé !' }));

      // Close modal after a short delay
      setTimeout(() => {
        setProgressModal({ open: false, current: 0, total: 0, currentStudent: '' });
      }, 800);

      setCalculationResult(result);
      toastSuccess('Calcul terminé', {
        description: `${result.results.length} élèves · ${result.subjects.length} matières`,
      });
    } catch (err: any) {
      setProgressModal({ open: false, current: 0, total: 0, currentStudent: '' });
      toastError('Erreur lors du calcul', {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setCalculating(false);
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
        <Calculator className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">Moyennes par évaluation</h2>
        <Badge variant="outline" className="text-xs">
          {scopeLevel || '—'} {scopeLang ? `· ${scopeLang}` : ''}
        </Badge>
      </div>

      {/* Control Bar — 3 selectors + Calculate button */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Trimester selector */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Trimestre
            </label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sélectionner —</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name || p.label}</option>
              ))}
            </select>
          </div>

          {/* Class selector */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Classe
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sélectionner —</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Evaluation type selector */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Évaluation
            </label>
            <select
              value={selectedEvalTypeId}
              onChange={(e) => setSelectedEvalTypeId(e.target.value)}
              className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sélectionner —</option>
              {evaluationTypes.map(t => (
                <option key={t.id} value={t.id}>
                  [{t.code}] {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Calculate button */}
          <div className="flex items-end">
            <Button
              onClick={handleCalculate}
              disabled={calculating || !selectedClassId || !selectedPeriodId || !selectedEvalTypeId}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm w-full md:w-auto"
            >
              {calculating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calcul…</>
              ) : (
                <><Calculator className="w-4 h-4 mr-2" />Lancer le calcul</>
              )}
            </Button>
          </div>
        </div>

        {/* Summary of selection */}
        {(selectedClassName || selectedPeriodName || selectedEvalTypeName) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap text-xs text-gray-500">
            <span className="font-semibold">Sélection :</span>
            <Badge variant="outline" className="text-xs">{selectedPeriodName || '—'}</Badge>
            <span>·</span>
            <Badge variant="outline" className="text-xs">{selectedClassName || '—'}</Badge>
            <span>·</span>
            <Badge variant="outline" className="text-xs">
              {selectedEvalTypeCode ? `[${selectedEvalTypeCode}] ` : ''}{selectedEvalTypeName || '—'}
            </Badge>
          </div>
        )}
      </div>

      {/* Results */}
      {!calculationResult ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">Aucun calcul lancé</p>
          <p className="text-sm text-gray-400 mt-1">
            Sélectionnez un trimestre, une classe et une évaluation, puis cliquez sur « Lancer le calcul ».
          </p>
        </div>
      ) : (
        <CalculationResults result={calculationResult} />
      )}

      {/* Progress Modal */}
      {progressModal.open && (
        <ProgressModal
          current={progressModal.current}
          total={progressModal.total}
          currentStudent={progressModal.currentStudent}
        />
      )}
    </div>
  );
}

// ─── Progress Modal ──────────────────────────────────────────────────────────

function ProgressModal({ current, total, currentStudent }: { current: number; total: number; currentStudent: string }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Calcul des moyennes en cours…</h3>
            <p className="text-xs text-gray-500">Veuillez patienter</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{currentStudent}</span>
            <span className="font-bold text-blue-600">{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          {total > 0 && (
            <p className="text-[10px] text-gray-400 text-center">
              {current} / {total}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      </div>
    </div>
  );
}

// ─── Calculation Results (table + stats panel) ──────────────────────────────

function CalculationResults({ result }: { result: CalculationResult }) {
  const isMaternelle = result.isMaternelle;
  const isSecondaire = result.schoolLevelCode === 'SECONDAIRE';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Table — 3 columns */}
      <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Classement — {result.className}
              </h3>
              <p className="text-xs text-gray-500">
                {result.results.length} élèves · {result.subjects.length} matières
              </p>
            </div>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              {result.subjects.length} matières
            </Badge>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Rang</th>
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Nom et prénom</th>
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                {result.subjects.map((subject, idx) => (
                  isMaternelle ? (
                    <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[100px]">
                      {subject.name}
                      <div className="text-[9px] text-slate-400 font-normal">TS / S / PS</div>
                    </th>
                  ) : isSecondaire ? (
                    <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                      {subject.name}
                      <div className="text-[9px] text-slate-400 font-normal">Note /20</div>
                    </th>
                  ) : (
                    <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                      {subject.name}
                      <div className="text-[9px] text-slate-400 font-normal">Note /20</div>
                    </th>
                  )
                ))}
                {/* Moyenne générale */}
                {!isMaternelle && (
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Moy. gén.</th>
                )}
                {/* Rang */}
                {/* Already have Rang as first column */}
                {/* Appréciation globale (Maternelle) */}
                {isMaternelle && (
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Appréciation</th>
                )}
              </tr>
            </thead>
            <tbody>
              {result.results.map((row, idx) => (
                <tr key={row.id} className={cn('hover:bg-slate-50', idx % 2 === 1 && 'bg-slate-50/50')}>
                  {/* Rang */}
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-700">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-xs font-black',
                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-slate-100 text-slate-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    )}>
                      {row.classRank}
                    </div>
                  </td>
                  {/* Nom */}
                  <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">
                    {row.student.lastName} {row.student.firstName}
                  </td>
                  {/* Sexe */}
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    {row.student.gender === 'M' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-700">M</span>
                    ) : row.student.gender === 'F' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-700">F</span>
                    ) : '—'}
                  </td>
                  {/* Notes par matière */}
                  {result.subjects.map((subject) => {
                    const score = row.subjectScores[subject.id];
                    if (!score) {
                      return (
                        <td key={subject.id} className="border border-slate-300 px-2 py-1 text-center text-slate-300">—</td>
                      );
                    }
                    if (score.isAbsent) {
                      return (
                        <td key={subject.id} className="border border-slate-300 px-2 py-1 text-center">
                          <span className="text-red-500 text-[10px] font-bold">ABS</span>
                        </td>
                      );
                    }
                    if (isMaternelle) {
                      return (
                        <td key={subject.id} className="border border-slate-300 px-2 py-1 text-center">
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded text-xs font-bold',
                            score.qualitativeCode === 'TS' && 'bg-emerald-100 text-emerald-700',
                            score.qualitativeCode === 'S' && 'bg-blue-100 text-blue-700',
                            score.qualitativeCode === 'PS' && 'bg-amber-100 text-amber-700',
                            !score.qualitativeCode && 'text-slate-300',
                          )}>
                            {score.qualitativeCode || '—'}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={subject.id} className="border border-slate-300 px-2 py-1 text-center font-bold">
                        <span className={cn(
                          (score.score || 0) >= 10 ? 'text-emerald-700' : 'text-red-600'
                        )}>
                          {score.score !== null ? Number(score.score).toFixed(2) : '—'}
                        </span>
                      </td>
                    );
                  })}
                  {/* Moyenne générale (Primaire/Secondaire) */}
                  {!isMaternelle && (
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold bg-blue-50">
                      <span className={cn(
                        'text-sm',
                        (row.generalAverage || 0) >= 10 ? 'text-emerald-700' : 'text-red-600'
                      )}>
                        {row.generalAverage !== null ? row.generalAverage.toFixed(2) : '—'}
                      </span>
                    </td>
                  )}
                  {/* Appréciation globale (Maternelle) */}
                  {isMaternelle && (
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                      <span className={cn(
                        'text-xs',
                        row.appreciationGlobale === 'Très Satisfaisant' && 'text-emerald-600',
                        row.appreciationGlobale === 'Satisfaisant' && 'text-blue-600',
                        row.appreciationGlobale === 'Peu Satisfaisant' && 'text-amber-600',
                      )}>
                        {row.appreciationGlobale || '—'}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Panel — adapted to school level */}
      <div className="space-y-4">
        {/* Class average card (Primaire only — Maternelle has no /20) */}
        {!isMaternelle && (
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
              Moyenne de Classe
            </p>
            <div className="text-3xl font-black mb-1">
              {result.stats.classAverage !== null ? result.stats.classAverage.toFixed(2) : '—'}
            </div>
            <p className="text-[10px] text-blue-200 font-bold uppercase">
              Seuil de passage : 10/20
            </p>
            {result.stats.classAverage !== null && (
              <div className="h-1.5 w-full bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, (result.stats.classAverage / 20) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Maternelle: Appreciation distribution (instead of /20) */}
        {isMaternelle && (
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-3">
              Répartition des Appreciations
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Très Satisfaisant</span>
                <span className="text-lg font-black">
                  {result.results.filter(r => r.appreciationGlobale === 'Très Satisfaisant').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Satisfaisant</span>
                <span className="text-lg font-black">
                  {result.results.filter(r => r.appreciationGlobale === 'Satisfaisant').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Peu Satisfaisant</span>
                <span className="text-lg font-black">
                  {result.results.filter(r => r.appreciationGlobale === 'Peu Satisfaisant').length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Pass/Fail card — adapted */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Résultats</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <CheckCircle className="w-4 h-4" />
                {isMaternelle ? 'Satisfaisant' : 'Admis'}
              </span>
              <span className="text-sm font-black text-emerald-700">{result.stats.passingCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-rose-700">
                <AlertCircle className="w-4 h-4" />
                {isMaternelle ? 'Peu Satisfaisant' : 'À revoir'}
              </span>
              <span className="text-sm font-black text-rose-700">{result.stats.failingCount}</span>
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Statistiques</p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Effectif total</span>
              <span className="font-bold text-gray-900">{result.stats.totalStudents}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Ayant composé</span>
              <span className="font-bold text-gray-900">{result.stats.composedStudents}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">% de réussite</span>
              <span className="font-bold text-blue-700">{result.stats.passingRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
