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
 * ⭐ Utilise le MÊME pattern que le registre des notes :
 *    - institutionalExamsService.getEvaluations() pour récupérer les évaluations
 *    - apiClient.get('/institutional-exams/grades/evaluation/:id') pour les notes
 *    - Calcul des moyennes côté frontend (pas d'appel POST /exams/* qui échoue)
 *
 * Format PDF : A4 paysage, avec en-tête école
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import {
  FileText, Loader2, ChevronDown, ChevronRight, Download,
  Users, BookOpen, Award, Calendar, Printer, AlertCircle,
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

// ─── Evaluation type ordering: EM1 → EM2 → EC ───────────────────────────────
const EVAL_TYPE_ORDER = ['EM1', 'EM2', 'EC', 'DV', 'INT', 'COMP', 'EB', 'EP', 'ORAL'];
const evalTypeSortIndex = (code: string): number => {
  const idx = EVAL_TYPE_ORDER.indexOf(code?.toUpperCase() || '');
  return idx === -1 ? EVAL_TYPE_ORDER.length : idx;
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
  studentName: string;
  matricule?: string;
  gender?: string;
  subjectScores: Record<string, SubjectScore>;
  generalAverage: number | null;
  appreciationGlobale: string | null;
  classRank: number;
}

interface BulletinData {
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
      header={{ title: 'Bulletins', description: 'Bulletins de notes par évaluation, classe et trimestre.', icon: 'fileText' }}
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
  const [loadingBulletins, setLoadingBulletins] = useState(false);
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const isMaternelle = scopeLevel === 'MATERNELLE';

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find((l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL');
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  // ── Load classes (same pattern as registre) ────────────────────────────────
  const loadClasses = useCallback(async () => {
    if (!schoolLevelUuid) return;
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
      if (langClasses.length > 0 && !selectedClassId) setSelectedClassId(langClasses[0].id);
    } catch { setClasses([]); }
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
        if (periodList.length > 0 && !selectedPeriodId) setSelectedPeriodId(periodList[0].id);
      }
    } catch { setPeriods([]); }
  }, [academicYear?.id, selectedPeriodId]);

  // ── Load evaluation types (sorted EM1 → EM2 → EC) ──────────────────────────
  const loadEvaluationTypes = useCallback(async () => {
    if (!schoolLevelUuid) return;
    try {
      const types = await institutionalExamsService.getEvaluationTypes(schoolLevelUuid);
      const sorted = (Array.isArray(types) ? types : []).sort((a: any, b: any) =>
        evalTypeSortIndex(a.code) - evalTypeSortIndex(b.code)
      );
      setEvaluationTypes(sorted);
      if (sorted.length > 0 && !selectedEvalTypeId) setSelectedEvalTypeId(sorted[0].id);
    } catch { setEvaluationTypes([]); }
  }, [schoolLevelUuid, selectedEvalTypeId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => { loadEvaluationTypes(); }, [loadEvaluationTypes]);

  // ── Load bulletins (auto-calculate — same pattern as registre) ─────────────
  const loadBulletins = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId || !selectedEvalTypeId || !academicYear?.id) return;
    setLoadingBulletins(true);
    try {
      // ⭐ Step 1: Fetch VALIDATED evaluations (same as registre)
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      // Filter by period + evaluationType
      const filtered = allEvals.filter((ev: any) =>
        ev.period?.id === selectedPeriodId &&
        ev.evaluationType?.id === selectedEvalTypeId
      );

      // Filter by language (FR/EN)
      const langFiltered = scopeLang
        ? filtered.filter((ev: any) => {
            const lang = ev.subject?.language;
            return !lang || lang === scopeLang || lang === 'FR';
          })
        : filtered;

      // ⭐ Step 2: Build subject list (sorted)
      const subjects: Array<{ id: string; name: string; code?: string }> = [];
      const seenSubjectIds = new Set<string>();
      for (const ev of langFiltered) {
        if (ev.subject?.id && !seenSubjectIds.has(ev.subject.id)) {
          subjects.push({ id: ev.subject.id, name: ev.subject.name, code: ev.subject.code });
          seenSubjectIds.add(ev.subject.id);
        }
      }

      // ⭐ Step 3: Fetch grades for each evaluation (same as registre)
      const evalGradesMap = new Map<string, any[]>();
      await Promise.all(
        langFiltered.map(async (ev: any) => {
          try {
            const response = await apiClient.get(`/institutional-exams/grades/evaluation/${ev.id}`);
            evalGradesMap.set(ev.id, Array.isArray(response.data) ? response.data : []);
          } catch {
            evalGradesMap.set(ev.id, []);
          }
        })
      );

      // ⭐ Step 4: Build student results + compute averages (frontend calculation)
      const studentMap = new Map<string, StudentResult>();

      for (const ev of langFiltered) {
        const grades = evalGradesMap.get(ev.id) || [];
        const subjectId = ev.subject?.id;
        if (!subjectId) continue;

        for (const grade of grades) {
          if (!studentMap.has(grade.studentId)) {
            studentMap.set(grade.studentId, {
              id: grade.studentId,
              studentName: grade.studentName || 'Inconnu',
              matricule: grade.matricule,
              gender: grade.gender,
              subjectScores: {},
              generalAverage: null,
              appreciationGlobale: null,
              classRank: 0,
            });
          }
          const student = studentMap.get(grade.studentId)!;

          if (grade.isAbsent) {
            student.subjectScores[subjectId] = { score: null, qualitativeCode: null, isAbsent: true, appreciation: 'Absent' };
          } else if (isMaternelle) {
            const code = grade.qualitativeCode;
            student.subjectScores[subjectId] = {
              score: null, qualitativeCode: code, isAbsent: false,
              appreciation: code === 'TS' ? 'Très Satisfaisant' : code === 'S' ? 'Satisfaisant' : code === 'PS' ? 'Peu Satisfaisant' : '—',
            };
          } else {
            const score = grade.score !== null ? Number(grade.score) : null;
            student.subjectScores[subjectId] = {
              score, qualitativeCode: null, isAbsent: false,
              appreciation: score === null ? '—' : score >= 16 ? 'Très Bien' : score >= 14 ? 'Bien' : score >= 12 ? 'Assez Bien' : score >= 10 ? 'Passable' : 'Insuffisant',
            };
          }
        }
      }

      // Fill missing subjects + compute averages
      const results = Array.from(studentMap.values());
      for (const student of results) {
        for (const subject of subjects) {
          if (!student.subjectScores[subject.id]) {
            student.subjectScores[subject.id] = { score: null, qualitativeCode: null, isAbsent: false, appreciation: '—' };
          }
        }

        // Compute general average
        let totalScore = 0;
        let validCount = 0;
        let tsCount = 0, sCount = 0, psCount = 0;

        for (const subject of subjects) {
          const s = student.subjectScores[subject.id];
          if (!s || s.isAbsent) continue;
          if (isMaternelle) {
            if (s.qualitativeCode === 'TS') { tsCount++; validCount++; }
            else if (s.qualitativeCode === 'S') { sCount++; validCount++; }
            else if (s.qualitativeCode === 'PS') { psCount++; validCount++; }
          } else {
            if (s.score !== null) { totalScore += s.score; validCount++; }
          }
        }

        if (isMaternelle) {
          if (validCount > 0) {
            student.generalAverage = (tsCount * 3 + sCount * 2 + psCount * 1) / validCount;
            student.appreciationGlobale = student.generalAverage >= 2.5 ? 'Très Satisfaisant' :
              student.generalAverage >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';
          }
        } else {
          if (validCount > 0) student.generalAverage = totalScore / validCount;
        }
      }

      // Sort by average DESC + assign ranks
      results.sort((a, b) => (b.generalAverage ?? -1) - (a.generalAverage ?? -1));
      results.forEach((r, idx) => { r.classRank = idx + 1; });

      // Stats
      const validResults = results.filter(r => r.generalAverage !== null);
      const classAverage = validResults.length > 0
        ? validResults.reduce((sum, r) => sum + (r.generalAverage || 0), 0) / validResults.length : null;
      const passingCount = isMaternelle
        ? validResults.filter(r => r.appreciationGlobale === 'Très Satisfaisant' || r.appreciationGlobale === 'Satisfaisant').length
        : validResults.filter(r => (r.generalAverage || 0) >= 10).length;

      setBulletinData({
        subjects,
        results,
        stats: {
          totalStudents: results.length,
          composedStudents: validResults.length,
          classAverage,
          passingCount,
          failingCount: validResults.length - passingCount,
          passingRate: validResults.length > 0 ? (passingCount / validResults.length) * 100 : 0,
        },
      });

      if (results.length > 0) setExpandedStudents(new Set([results[0].id]));
    } catch (err: any) {
      console.error('Error loading bulletins:', err);
      toastError('Erreur lors du chargement', { description: err.message });
      setBulletinData(null);
    } finally {
      setLoadingBulletins(false);
    }
  }, [selectedClassId, selectedPeriodId, selectedEvalTypeId, academicYear?.id, scopeLang, isMaternelle]);

  useEffect(() => { loadBulletins(); }, [loadBulletins]);

  const toggleStudent = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  };

  const handleGeneratePdf = (student: StudentResult) => {
    setGeneratingPdf(student.id);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) { toastError('Erreur', { description: 'Veuillez autoriser les popups' }); return; }
      const html = generateBulletinHtml(student, bulletinData!, school, academicYear, periods, selectedPeriodId, isMaternelle);
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
      toastSuccess('Bulletin généré', { description: student.studentName });
    } catch (err: any) {
      toastError('Erreur PDF', { description: err.message });
    } finally { setGeneratingPdf(null); }
  };

  const handleGenerateAllPdf = () => {
    if (!bulletinData) return;
    for (const student of bulletinData.results) {
      setTimeout(() => handleGeneratePdf(student), 500);
    }
  };

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';
  const selectedPeriodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
  const selectedEvalTypeName = evaluationTypes.find(t => t.id === selectedEvalTypeId)?.name || '';
  const selectedEvalTypeCode = evaluationTypes.find(t => t.id === selectedEvalTypeId)?.code || '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">Bulletins par évaluation</h2>
        <Badge variant="outline" className="text-xs">{scopeLevel || '—'} {scopeLang ? `· ${scopeLang}` : ''}</Badge>
      </div>

      {/* Control Bar */}
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
          {bulletinData && bulletinData.results.length > 0 && (
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
            <Badge variant="outline" className="text-xs">{selectedPeriodName || '—'}</Badge><span>·</span>
            <Badge variant="outline" className="text-xs">{selectedClassName || '—'}</Badge><span>·</span>
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
      ) : !bulletinData ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">Aucun bulletin à afficher</p>
          <p className="text-sm text-gray-400 mt-1">Sélectionnez un trimestre, une classe et une évaluation.</p>
        </div>
      ) : bulletinData.results.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">Aucun élève / aucune note validée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-xs gap-1"><Users className="w-3 h-3" />{bulletinData.results.length} élèves</Badge>
              <Badge variant="outline" className="text-xs gap-1"><BookOpen className="w-3 h-3" />{bulletinData.subjects.length} matières</Badge>
              {!isMaternelle && bulletinData.stats.classAverage !== null && (
                <Badge variant="outline" className="text-xs gap-1"><Award className="w-3 h-3" />Moy. classe: {bulletinData.stats.classAverage.toFixed(2)}/20</Badge>
              )}
            </div>
          </div>

          {/* Student bulletins */}
          {bulletinData.results.map((student) => {
            const isExpanded = expandedStudents.has(student.id);
            return (
              <div key={student.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => toggleStudent(student.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">{student.classRank}</div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{student.studentName}</div>
                      <div className="text-xs text-slate-500">
                        {student.matricule || '—'} · Rang {student.classRank}
                        {!isMaternelle && student.generalAverage !== null && ` · ${student.generalAverage.toFixed(2)}/20`}
                        {isMaternelle && student.appreciationGlobale && ` · ${student.appreciationGlobale}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isMaternelle && student.generalAverage !== null && (
                      <span className={cn('px-2 py-1 rounded text-xs font-bold', student.generalAverage >= 10 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                        {student.generalAverage.toFixed(2)}/20
                      </span>
                    )}
                    {isMaternelle && student.appreciationGlobale && (
                      <span className={cn('px-2 py-1 rounded text-xs font-bold',
                        student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
                        student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
                        student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
                      )}>{student.appreciationGlobale}</span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-4">
                    {/* Bulletin header */}
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        {school?.logoUrl && <img src={school.logoUrl} alt="logo" className="h-12 w-12 rounded-lg object-cover" />}
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{school?.schoolName || 'École'}</h3>
                          <p className="text-xs text-slate-500">{school?.address || ''} · Tél: {school?.phone || ''}</p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">
                        Année scolaire: <strong>{academicYear?.label || ''}</strong> · {selectedPeriodName} · Classe: <strong>{selectedClassName}</strong>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Élève: <strong>{student.studentName}</strong> · Matricule: {student.matricule || '—'} · {selectedEvalTypeCode} {selectedEvalTypeName}
                      </div>
                    </div>

                    {/* Notes table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                            <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Matière</th>
                            <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">{isMaternelle ? 'Appréciation' : 'Note /20'}</th>
                            <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">Observation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulletinData.subjects.map((subject, idx) => {
                            const score = student.subjectScores[subject.id];
                            return (
                              <tr key={subject.id} className={cn(idx % 2 === 1 && 'bg-slate-50/50')}>
                                <td className="border border-slate-300 px-2 py-1 text-center text-slate-600">{idx + 1}</td>
                                <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">{subject.name}</td>
                                <td className="border border-slate-300 px-2 py-1 text-center">
                                  {!score || score.isAbsent ? (
                                    <span className="text-red-500 text-[10px] font-bold">ABS</span>
                                  ) : isMaternelle ? (
                                    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-bold',
                                      score.qualitativeCode === 'TS' && 'bg-emerald-100 text-emerald-700',
                                      score.qualitativeCode === 'S' && 'bg-blue-100 text-blue-700',
                                      score.qualitativeCode === 'PS' && 'bg-amber-100 text-amber-700',
                                    )}>{score.qualitativeCode || '—'}</span>
                                  ) : (
                                    <span className={cn('font-bold', (score.score || 0) >= 10 ? 'text-emerald-700' : 'text-red-600')}>
                                      {score.score !== null ? Number(score.score).toFixed(2) : '—'}
                                    </span>
                                  )}
                                </td>
                                <td className="border border-slate-300 px-2 py-1 text-center text-slate-600 text-xs">{score?.appreciation || '—'}</td>
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
                          <p className="text-lg font-bold text-blue-700">{student.generalAverage !== null ? student.generalAverage.toFixed(2) : '—'}/20</p>
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
                            student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' :
                            student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant'
                          ) : student.appreciationGlobale || '—'}
                        </p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-500">Moy. classe</p>
                        <p className="text-lg font-bold text-amber-700">{bulletinData.stats.classAverage !== null ? bulletinData.stats.classAverage.toFixed(2) : '—'}</p>
                      </div>
                    </div>

                    {/* PDF button */}
                    <div className="flex justify-end">
                      <Button onClick={() => handleGeneratePdf(student)} disabled={generatingPdf === student.id} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                        {generatingPdf === student.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération…</> : <><Download className="w-4 h-4 mr-2" />Générer PDF</>}
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
  data: BulletinData,
  school: any,
  academicYear: any,
  periods: any[],
  selectedPeriodId: string,
  isMaternelle: boolean,
): string {
  const periodName = periods.find(p => p.id === selectedPeriodId)?.name || '';

  const subjectRows = data.subjects.map((subject, idx) => {
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
    return `<tr><td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${idx + 1}</td><td style="border:1px solid #ccc;padding:4px 8px;font-weight:500">${subject.name}</td><td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${scoreCell}</td><td style="border:1px solid #ccc;padding:4px 8px;text-align:center;font-size:11px">${score?.appreciation || '—'}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bulletin - ${student.studentName}</title><style>
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
  </style></head><body>
  <div class="header">
    ${school?.logoUrl ? `<img src="${school.logoUrl}" style="height:50px;float:left" />` : ''}
    <h1>${school?.schoolName || 'École'}</h1>
    <div class="school-info">${school?.address || ''} · Tél: ${school?.phone || ''}</div>
    <div class="school-info">Année scolaire: ${academicYear?.label || ''} · ${periodName}</div>
  </div>
  <div class="student-info">
    <div><strong>Élève:</strong> ${student.studentName}</div>
    <div><strong>Matricule:</strong> ${student.matricule || '—'}</div>
    <div><strong>Rang:</strong> ${student.classRank}</div>
  </div>
  <table><thead><tr><th style="width:40px">N°</th><th style="text-align:left">Matière</th><th>${isMaternelle ? 'Appréciation' : 'Note /20'}</th><th>Observation</th></tr></thead><tbody>${subjectRows}</tbody></table>
  <div class="synthesis">
    ${!isMaternelle ? `<div><div class="label">Moyenne</div><div class="value" style="color:blue">${student.generalAverage?.toFixed(2) || '—'}/20</div></div>` : ''}
    <div><div class="label">Rang</div><div class="value">${student.classRank}</div></div>
    <div><div class="label">${isMaternelle ? 'Appréciation' : 'Mention'}</div><div class="value" style="color:green;font-size:13px">${isMaternelle ? (student.appreciationGlobale || '—') : (student.generalAverage !== null ? (student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' : student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant') : '—')}</div></div>
    <div><div class="label">Moy. classe</div><div class="value" style="color:orange">${data.stats.classAverage?.toFixed(2) || '—'}</div></div>
  </div>
  <div class="signatures"><div>Le Titulaire<br/><br/><br/>_________________</div><div>Le Directeur<br/><br/><br/>_________________</div><div>Les Parents<br/><br/><br/>_________________</div></div>
  </body></html>`;
}
