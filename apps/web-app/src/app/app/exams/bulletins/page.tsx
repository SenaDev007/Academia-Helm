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
  Calculator,
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
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
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
const EVAL_TYPE_ORDER = ['EM1', 'EM2', 'EC', 'DV', 'INT', 'COMP', 'EB', 'ORAL', 'EP'];
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
  // ⭐ Sub-tabs: 'bulletin' (current content) | 'moyennes' (trimestriel + annuel)
  const [activeSubTab, setActiveSubTab] = useState<'bulletin' | 'moyennes'>('bulletin');
  // ⭐ Sub-sub-tabs within 'moyennes': 'trimestriel' | 'annuel'
  const [activeMoyenneTab, setActiveMoyenneTab] = useState<'trimestriel' | 'annuel'>('trimestriel');

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

  const handleGeneratePdf = async (student: StudentResult, signatures?: { teacherSig: string | null; directorSig: string | null; parentSig: string | null }) => {
    setGeneratingPdf(student.id);
    try {
      // ⭐ Call backend PDF generation endpoint (same pattern as Module Élèves)
      // Backend uses Puppeteer + official header (République, drapeau, ministère, école)
      const payload = {
        schoolName: school?.schoolName,
        schoolLogo: school?.logoUrl,
        schoolAddress: school?.address,
        schoolPhone: school?.phone,
        schoolEmail: school?.email,
        schoolSlogan: school?.slogan,
        academicYearName: academicYear?.label || '',
        periodName: selectedPeriodName,
        evaluationTypeName: selectedEvalTypeName,
        evaluationTypeCode: selectedEvalTypeCode,
        className: selectedClassName,
        studentName: student.studentName,
        studentMatricule: student.matricule,
        studentGender: student.gender,
        isMaternelle,
        subjects: bulletinData!.subjects.map(s => ({
          name: s.name,
          score: student.subjectScores[s.id]?.score ?? null,
          qualitativeCode: student.subjectScores[s.id]?.qualitativeCode ?? null,
          isAbsent: student.subjectScores[s.id]?.isAbsent ?? false,
          appreciation: student.subjectScores[s.id]?.appreciation ?? '—',
        })),
        generalAverage: student.generalAverage,
        classRank: student.classRank,
        classAverage: bulletinData!.stats.classAverage,
        highestAverage: bulletinData!.results.length > 0 ? Math.max(...bulletinData!.results.map(r => r.generalAverage || 0)) : null,
        lowestAverage: bulletinData!.results.length > 0 ? Math.min(...bulletinData!.results.map(r => r.generalAverage || 0)) : null,
        totalStudents: bulletinData!.results.length,
        appreciationGlobale: student.appreciationGlobale,
        teacherSignature: signatures?.teacherSig ?? null,
        directorSignature: signatures?.directorSig ?? null,
        parentSignature: signatures?.parentSig ?? null,
      };

      const response = await apiClient.post('/institutional-exams/bulletins/generate-pdf', payload, {
        responseType: 'blob',
      });

      // Download the PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `bulletin_${student.studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toastSuccess('Bulletin généré', { description: student.studentName });
    } catch (err: any) {
      toastError('Erreur PDF', { description: err.response?.data?.message || err.message });
    } finally { setGeneratingPdf(null); }
  };

  const handleGenerateAllPdf = async () => {
    if (!bulletinData) return;
    for (const student of bulletinData.results) {
      await handleGeneratePdf(student, { teacherSig: null, directorSig: null, parentSig: null });
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
        <h2 className="text-lg font-bold text-gray-900">Bulletins</h2>
        <Badge variant="outline" className="text-xs">{scopeLevel || '—'} {scopeLang ? `· ${scopeLang}` : ''}</Badge>
      </div>

      {/* Sub-tabs: Bulletin d'évaluation | Moyenne trimestrielle et annuelle */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('bulletin')}
          className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            activeSubTab === 'bulletin' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
        >
          <FileText className="w-4 h-4" />
          Bulletin d'évaluation
        </button>
        <button
          onClick={() => setActiveSubTab('moyennes')}
          className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            activeSubTab === 'moyennes' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
        >
          <Calculator className="w-4 h-4" />
          Moyenne trimestrielle et annuelle
        </button>
      </div>

      {/* ═══ Sub-tab: Bulletin d'évaluation ═══ */}
      {activeSubTab === 'bulletin' && (
        <>

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
                  <div className="border-t border-slate-100 p-4">
                    <BulletinTwoPage
                      student={student}
                      bulletinData={bulletinData}
                      isMaternelle={isMaternelle}
                      school={school}
                      academicYear={academicYear}
                      selectedPeriodName={selectedPeriodName}
                      selectedClassName={selectedClassName}
                      selectedEvalTypeCode={selectedEvalTypeCode}
                      selectedEvalTypeName={selectedEvalTypeName}
                      onGeneratePdf={(sigs) => handleGeneratePdf(student, sigs)}
                      generatingPdf={generatingPdf === student.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* ═══ Sub-tab: Moyenne trimestrielle et annuelle ═══ */}
      {activeSubTab === 'moyennes' && (
        <MoyennesTab
          academicYear={academicYear}
          schoolLevelUuid={schoolLevelUuid}
          scopeLang={scopeLang}
          scopeLevel={scopeLevel || ''}
          isMaternelle={isMaternelle}
          classes={classes}
          activeMoyenneTab={activeMoyenneTab}
          setActiveMoyenneTab={setActiveMoyenneTab}
        />
      )}
    </div>
  );
}

// ─── Bulletin 2-Page Component (with flip animation) ────────────────────────

function BulletinTwoPage({
  student, bulletinData, isMaternelle, school, academicYear,
  selectedPeriodName, selectedClassName, selectedEvalTypeCode, selectedEvalTypeName,
  onGeneratePdf, generatingPdf,
}: {
  student: StudentResult;
  bulletinData: BulletinData;
  isMaternelle: boolean;
  school: any;
  academicYear: any;
  selectedPeriodName: string;
  selectedClassName: string;
  selectedEvalTypeCode: string;
  selectedEvalTypeName: string;
  onGeneratePdf: (signatures: { teacherSig: string | null; directorSig: string | null; parentSig: string | null }) => void;
  generatingPdf: boolean;
}) {
  const [page, setPage] = useState<1 | 2>(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  // ⭐ Signature state (lifted from BulletinPage2 so it's accessible in onGeneratePdf)
  const [teacherSig, setTeacherSig] = useState<string | null>(null);
  const [directorSig, setDirectorSig] = useState<string | null>(null);
  const [parentSig, setParentSig] = useState<string | null>(null);

  // ⭐ Only trigger page flip if horizontal swipe is dominant (not vertical scroll)
  //    AND the touch didn't start inside a scrollable table
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't track touch if it started inside a scrollable element (table, editor, etc.)
    if (target.closest('table') || target.closest('[contenteditable]') || target.closest('.overflow-x-auto')) {
      setTouchStart(null);
      return;
    }
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diffX = touchStart.x - e.changedTouches[0].clientX;
    const diffY = touchStart.y - e.changedTouches[0].clientY;
    // Only flip if horizontal movement is significantly larger than vertical
    if (Math.abs(diffX) > 80 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0 && page === 1) setPage(2);
      if (diffX < 0 && page === 2) setPage(1);
    }
    setTouchStart(null);
  };

  return (
    <div className="space-y-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Bulletin header (école) */}
      <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
        <div className="flex items-center justify-center gap-3 mb-1">
          {school?.logoUrl && <img src={school.logoUrl} alt="logo" className="h-10 w-10 rounded object-cover" />}
          <div>
            <h3 className="text-xs font-bold text-slate-900">{school?.schoolName || 'École'}</h3>
            <p className="text-[10px] text-slate-500">{school?.address || ''} · Tél: {school?.phone || ''}</p>
          </div>
        </div>
        <div className="text-[10px] text-slate-600">
          Année: <strong>{academicYear?.label || ''}</strong> · {selectedPeriodName} · Classe: <strong>{selectedClassName}</strong>
        </div>
        <div className="text-[10px] text-slate-600 mt-0.5">
          Élève: <strong>{student.studentName}</strong> · Matricule: {student.matricule || '—'} · {selectedEvalTypeCode} {selectedEvalTypeName}
        </div>
      </div>

      {/* Page navigation */}
      <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-1.5">
        <button
          onClick={() => setPage(1)}
          className={cn('text-xs font-bold px-3 py-1 rounded transition-colors', page === 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-200')}
        >← Page 1: Notes</button>
        <span className="text-[10px] text-slate-400">Page {page}/2</span>
        <button
          onClick={() => setPage(2)}
          className={cn('text-xs font-bold px-3 py-1 rounded transition-colors', page === 2 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-200')}
        >Page 2: Appréciations →</button>
      </div>

      {/* Page content with flip animation */}
      <div className="relative overflow-hidden">
        <div key={page} className="animate-in fade-in slide-in-from-right duration-300">
          {page === 1 ? (
            isMaternelle ? (
              <BulletinMaternellePage1 student={student} bulletinData={bulletinData} />
            ) : (
              <BulletinPrimairePage1 student={student} bulletinData={bulletinData} />
            )
          ) : (
            <BulletinPage2 student={student} isMaternelle={isMaternelle} signatures={{ teacherSig, directorSig, parentSig, setTeacherSig, setDirectorSig, setParentSig }} />
          )}
        </div>
      </div>

      {/* PDF button */}
      <div className="flex justify-end">
        <Button onClick={() => onGeneratePdf({ teacherSig, directorSig, parentSig })} disabled={generatingPdf} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
          {generatingPdf ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération…</> : <><Download className="w-4 h-4 mr-2" />Générer PDF</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Maternelle Page 1: Notes table (TS/S/PS columns) ──────────────────────

function BulletinMaternellePage1({ student, bulletinData }: { student: StudentResult; bulletinData: BulletinData }) {
  return (
    <div className="overflow-x-auto">
      <div className="text-center mb-2">
        <h4 className="text-xs font-bold text-slate-900 uppercase">Évaluation Sommative Mensuelle</h4>
        <p className="text-[10px] text-slate-500">(à remplir après avoir observé l'enfant)</p>
      </div>
      <table className="w-full border-collapse text-[10px]" style={{ border: '2px solid #0A2A5E' }}>
        <thead>
          <tr className="text-white" style={{ backgroundColor: '#0A2A5E' }}>
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '120px', borderColor: '#0D3B85' }}>Matière</th>
            <th colSpan={3} className="border px-1 py-1 font-bold uppercase text-center" style={{ borderColor: '#0D3B85' }}>Résultats</th>
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '80px', borderColor: '#0D3B85' }}>Appréciation enseignant</th>
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '60px', borderColor: '#0D3B85' }}>Visa Directeur</th>
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '60px', borderColor: '#0D3B85' }}>Visa Parents</th>
          </tr>
          <tr className="text-white" style={{ backgroundColor: '#0D3B85' }}>
            <th className="border px-1 py-0.5 font-bold text-center" style={{ borderColor: '#114FC4' }}>TS</th>
            <th className="border px-1 py-0.5 font-bold text-center" style={{ borderColor: '#114FC4' }}>S</th>
            <th className="border px-1 py-0.5 font-bold text-center" style={{ borderColor: '#114FC4' }}>PS</th>
          </tr>
        </thead>
        <tbody>
          {bulletinData.subjects.map((subject, idx) => {
            const score = student.subjectScores[subject.id];
            const code = score?.qualitativeCode;
            return (
              <tr key={subject.id} className={cn(idx % 2 === 1 && 'bg-slate-50/50')}>
                <td className="border border-slate-300 px-1 py-0.5 font-medium text-slate-900 whitespace-nowrap">{subject.name}</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center">
                  {code === 'TS' && <span className="font-bold text-emerald-600">✓</span>}
                  {score?.isAbsent && <span className="text-red-500 text-[8px]">ABS</span>}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center">
                  {code === 'S' && <span className="font-bold text-blue-600">✓</span>}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center">
                  {code === 'PS' && <span className="font-bold text-amber-600">✓</span>}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center text-slate-600">{score?.appreciation || '—'}</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center text-slate-300">—</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center text-slate-300">—</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* TS/S/PS Legend */}
      <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-500">
        <span className="font-bold">TS: Très Satisfaisant</span>
        <span className="font-bold">S: Satisfaisant</span>
        <span className="font-bold">PS: Peu Satisfaisant</span>
      </div>
      {/* Symbole mérité */}
      <div className="mt-2 bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
        <p className="text-[10px] font-bold text-slate-700 uppercase">Symbole mérité par l'élève</p>
        <span className={cn('inline-block mt-1 px-3 py-1 rounded text-sm font-bold',
          student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
          student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
          student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
        )}>{student.appreciationGlobale || '—'}</span>
      </div>
    </div>
  );
}

// ─── Primaire Page 1: Notes table (CM/18, CP/2, Total/20, Seuil, Appréciation) ─

function BulletinPrimairePage1({ student, bulletinData }: { student: StudentResult; bulletinData: BulletinData }) {
  const totalGeneral = bulletinData.subjects.reduce((sum, subj) => {
    const s = student.subjectScores[subj.id];
    return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
  }, 0);
  const seuilAtteint = totalGeneral >= (10 * bulletinData.subjects.length);
  const validSubjects = bulletinData.subjects.filter(subj => {
    const s = student.subjectScores[subj.id];
    return s && !s.isAbsent && s.score !== null;
  }).length;

  return (
    <div className="overflow-x-auto">
      <div className="text-center mb-2">
        <h4 className="text-xs font-bold text-slate-900 uppercase">I — Connaissance et Habiletés</h4>
      </div>
      <table className="w-full border-collapse text-[10px]" style={{ border: '2px solid #0A2A5E' }}>
        <thead>
          <tr className="text-white" style={{ backgroundColor: '#0A2A5E' }}>
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-left" style={{ minWidth: '120px', borderColor: '#0D3B85' }}>Champs de formation</th>
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center w-12" style={{ borderColor: '#0D3B85' }}>Note min.</th>
            <th className="border px-1 py-1 font-bold uppercase text-center" style={{ borderColor: '#0D3B85' }}>CM</th>
            <th className="border px-1 py-1 font-bold uppercase text-center" style={{ borderColor: '#0D3B85' }}>CP</th>
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center w-12" style={{ borderColor: '#0D3B85' }}>Total /20</th>
            <th colSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ borderColor: '#0D3B85' }}>Maîtrise min.</th>
            <th colSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ borderColor: '#0D3B85' }}>Seuil réussite</th>
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '60px', borderColor: '#0D3B85' }}>Appréciation</th>
          </tr>
          <tr className="text-white" style={{ backgroundColor: '#0D3B85' }}>
            <th className="border px-1 py-0.5 font-bold text-center text-[8px]" style={{ borderColor: '#114FC4' }}>/18</th>
            <th className="border px-1 py-0.5 font-bold text-center text-[8px]" style={{ borderColor: '#114FC4' }}>/02</th>
            <th className="border px-1 py-0.5 font-bold text-center text-[8px]" style={{ borderColor: '#114FC4' }}>Oui</th>
            <th className="border px-1 py-0.5 font-bold text-center text-[8px]" style={{ borderColor: '#114FC4' }}>Non</th>
            <th className="border px-1 py-0.5 font-bold text-center text-[8px]" style={{ borderColor: '#114FC4' }}>Oui</th>
            <th className="border px-1 py-0.5 font-bold text-center text-[8px]" style={{ borderColor: '#114FC4' }}>Non</th>
          </tr>
        </thead>
        <tbody>
          {bulletinData.subjects.map((subject, idx) => {
            const score = student.subjectScores[subject.id];
            const note = score?.score !== null && typeof score?.score === 'number' ? score.score : null;
            const reached = note !== null && note >= 10;
            return (
              <tr key={subject.id} className={cn(idx % 2 === 1 && 'bg-slate-50/50')}>
                <td className="border border-slate-300 px-1 py-0.5 font-medium text-slate-900 whitespace-nowrap">{subject.name}</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center text-slate-400 text-[8px]">10</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center text-slate-400">—</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center text-slate-400">—</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center font-bold">
                  {score?.isAbsent ? <span className="text-red-500 text-[8px]">ABS</span> :
                    note !== null ? <span className={note >= 10 ? 'text-emerald-700' : 'text-red-600'}>{note.toFixed(2)}</span> : '—'}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center">{reached ? '✓' : ''}</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center">{!reached && note !== null ? '✓' : ''}</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center">{reached ? '✓' : ''}</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center">{!reached && note !== null ? '✓' : ''}</td>
                <td className="border border-slate-300 px-1 py-0.5 text-center text-slate-600 text-[9px]">{score?.appreciation || '—'}</td>
              </tr>
            );
          })}
          {/* Total General */}
          <tr className="bg-slate-200 font-bold">
            <td className="border border-slate-300 px-1 py-0.5 uppercase text-slate-900" colSpan={4}>TOTAL GENERAL</td>
            <td className="border border-slate-300 px-1 py-0.5 text-center text-blue-700">{totalGeneral.toFixed(2)}</td>
            <td className="border border-slate-300 px-1 py-0.5 text-center" colSpan={2}></td>
            <td className="border border-slate-300 px-1 py-0.5 text-center" colSpan={2}></td>
            <td className="border border-slate-300 px-1 py-0.5 text-center"></td>
          </tr>
        </tbody>
      </table>
      {/* Synthèse */}
      <div className="mt-2 space-y-1 text-[10px] text-slate-700">
        <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
          <span>Moyenne obtenue par l'élève:</span>
          <strong className="text-blue-700">{student.generalAverage !== null ? student.generalAverage.toFixed(2) : '—'}/20</strong>
        </div>
        <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
          <span>Plus forte moyenne de la classe:</span>
          <strong>{bulletinData.stats.classAverage !== null ? Math.max(...bulletinData.results.map(r => r.generalAverage || 0)).toFixed(2) : '—'}/20</strong>
        </div>
        <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
          <span>Plus faible moyenne de la classe:</span>
          <strong>{bulletinData.stats.classAverage !== null ? Math.min(...bulletinData.results.map(r => r.generalAverage || 0)).toFixed(2) : '—'}/20</strong>
        </div>
        <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
          <span>Seuil de réussite globale fixé à:</span>
          <strong>10/20</strong>
        </div>
        <div className="flex justify-between bg-emerald-50 px-2 py-1 rounded font-bold">
          <span>Seuil de réussite globale atteint:</span>
          <span className={seuilAtteint ? 'text-emerald-700' : 'text-red-600'}>{seuilAtteint ? 'OUI' : 'NON'}</span>
        </div>
        <div className="flex justify-between bg-blue-50 px-2 py-1 rounded">
          <span>Nombre de matières évaluées:</span>
          <strong>{validSubjects}</strong>
        </div>
      </div>
    </div>
  );
}

// ─── Page 2: Appréciations + Signatures (Maternelle + Primaire) ────────────

function BulletinPage2({ student, isMaternelle, signatures }: { student: StudentResult; isMaternelle: boolean; signatures: { teacherSig: string | null; directorSig: string | null; parentSig: string | null; setTeacherSig: (v: string | null) => void; setDirectorSig: (v: string | null) => void; setParentSig: (v: string | null) => void } }) {
  // ⭐ Rich text state for each editable zone
  const [teacherAnalysis, setTeacherAnalysis] = useState('');
  const [attitudes, setAttitudes] = useState({
    assiduite: '', discipline: '', defaults: '', qualites: '',
  });
  const [parentResponse, setParentResponse] = useState('');
  // ⭐ Signatures are now managed by parent (BulletinTwoPage)

  return (
    <div className="space-y-3">
      {!isMaternelle && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <h4 className="text-xs font-bold text-slate-900 uppercase mb-2">II — Attitudes</h4>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Assiduité</label>
              <RichTextEditor
                value={attitudes.assiduite}
                onChange={(html) => setAttitudes(prev => ({ ...prev, assiduite: html }))}
                placeholder="Renseigner l'assiduité de l'élève…"
                minHeight="48px"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Discipline</label>
              <RichTextEditor
                value={attitudes.discipline}
                onChange={(html) => setAttitudes(prev => ({ ...prev, discipline: html }))}
                placeholder="Renseigner la discipline de l'élève…"
                minHeight="48px"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Défauts majeurs identifiés</label>
              <RichTextEditor
                value={attitudes.defaults}
                onChange={(html) => setAttitudes(prev => ({ ...prev, defaults: html }))}
                placeholder="Renseigner les défauts majeurs…"
                minHeight="48px"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Qualités remarquables</label>
              <RichTextEditor
                value={attitudes.qualites}
                onChange={(html) => setAttitudes(prev => ({ ...prev, qualites: html }))}
                placeholder="Renseigner les qualités remarquables…"
                minHeight="48px"
              />
            </div>
          </div>
        </div>
      )}

      {/* Analyse pédagogique */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase mb-2">
          {isMaternelle
            ? 'Analyse Pédagogique Sommaire des Résultats et Recommandations de l\'Enseignant(e) aux Parents'
            : 'Analyse des Résultats et Recommandations'}
        </h4>
        <RichTextEditor
          value={teacherAnalysis}
          onChange={setTeacherAnalysis}
          placeholder="Saisir l'analyse pédagogique et les recommandations de l'enseignant(e) aux parents… (Ctrl+B gras, Ctrl+I italique, Ctrl+U souligné)"
          minHeight="80px"
        />
      </div>

      {/* Symbole mérité */}
      <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
        <p className="text-[10px] font-bold text-slate-700 uppercase">Symbole mérité par l'élève</p>
        {isMaternelle ? (
          <span className={cn('inline-block mt-1 px-3 py-1 rounded text-sm font-bold',
            student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
            student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
            student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
          )}>{student.appreciationGlobale || '—'}</span>
        ) : (
          <span className="inline-block mt-1 px-3 py-1 rounded text-sm font-bold bg-blue-100 text-blue-700">
            {student.generalAverage !== null ? (
              student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' :
              student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant'
            ) : '—'}
          </span>
        )}
      </div>

      {/* Signatures électroniques */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase mb-3">Signatures</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-700 mb-1">Titulaire de la classe</p>
            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
              <SignatureCanvas
                width={280}
                height={100}
                onSignatureChange={signatures.setTeacherSig}
                placeholder="Signature de l'enseignant"
              />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-700 mb-1">Le Directeur(trice)</p>
            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
              <SignatureCanvas
                width={280}
                height={100}
                onSignatureChange={signatures.setDirectorSig}
                placeholder="Signature du Directeur"
              />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-700 mb-1">Les Parents</p>
            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
              <SignatureCanvas
                width={280}
                height={100}
                onSignatureChange={signatures.setParentSig}
                placeholder="Signature des parents"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Réponse des parents */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <h4 className="text-[10px] font-bold text-slate-700 uppercase mb-1">Réponse des parents de l'élève</h4>
        <RichTextEditor
          value={parentResponse}
          onChange={setParentResponse}
          placeholder="Zone de réponse des parents…"
          minHeight="48px"
        />
      </div>
    </div>
  );
}

// ─── Moyennes Tab (Trimestriel + Annuel) ─────────────────────────────────────

function MoyennesTab({
  academicYear, schoolLevelUuid, scopeLang, scopeLevel, isMaternelle, classes,
  activeMoyenneTab, setActiveMoyenneTab,
}: {
  academicYear: any;
  schoolLevelUuid?: string;
  scopeLang?: string;
  scopeLevel: string;
  isMaternelle: boolean;
  classes: any[];
  activeMoyenneTab: 'trimestriel' | 'annuel';
  setActiveMoyenneTab: (t: 'trimestriel' | 'annuel') => void;
}) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [trimesterData, setTrimesterData] = useState<any[]>([]);
  const [annualData, setAnnualData] = useState<any[]>([]);

  // Load trimester averages
  const loadTrimesterAverages = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    setLoading(true);
    try {
      // Fetch all evaluations for this class (VALIDATED only)
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      // Fetch periods (trimesters)
      const periodsRes = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
      const periodsData = await periodsRes.json();
      const periods = Array.isArray(periodsData) ? periodsData : [];

      // For each trimester, compute averages per student
      const results: any[] = [];
      for (const period of periods) {
        const periodEvals = allEvals.filter((ev: any) => ev.period?.id === period.id);
        if (periodEvals.length === 0) continue;

        // Group by evaluation type (EM1, EM2, EC, EP)
        const evalTypeMap = new Map<string, any[]>();
        for (const ev of periodEvals) {
          const typeId = ev.evaluationType?.id || '_no_type';
          if (!evalTypeMap.has(typeId)) evalTypeMap.set(typeId, []);
          evalTypeMap.get(typeId)!.push(ev);
        }

        // For each eval type, compute student averages (same pattern as bulletin)
        const evalTypeAverages: Record<string, Record<string, number | null>> = {}; // studentId → { evalTypeId: avg }
        for (const [typeId, evals] of evalTypeMap) {
          // Filter by language
          const langEvals = scopeLang
            ? evals.filter((ev: any) => !ev.subject?.language || ev.subject.language === scopeLang || ev.subject.language === 'FR')
            : evals;

          // Get grades for each eval
          const evalGradesMap = new Map<string, any[]>();
          await Promise.all(langEvals.map(async (ev: any) => {
            try {
              const res = await apiClient.get(`/institutional-exams/grades/evaluation/${ev.id}`);
              evalGradesMap.set(ev.id, Array.isArray(res.data) ? res.data : []);
            } catch { evalGradesMap.set(ev.id, []); }
          }));

          // Compute per-student average for this eval type
          const studentScores = new Map<string, { total: number; count: number; tsCount: number; sCount: number; psCount: number }>();
          for (const ev of langEvals) {
            const grades = evalGradesMap.get(ev.id) || [];
            for (const grade of grades) {
              if (!studentScores.has(grade.studentId)) {
                studentScores.set(grade.studentId, { total: 0, count: 0, tsCount: 0, sCount: 0, psCount: 0 });
              }
              const s = studentScores.get(grade.studentId)!;
              if (grade.isAbsent) continue;
              if (isMaternelle) {
                if (grade.qualitativeCode === 'TS') { s.tsCount++; s.count++; }
                else if (grade.qualitativeCode === 'S') { s.sCount++; s.count++; }
                else if (grade.qualitativeCode === 'PS') { s.psCount++; s.count++; }
              } else {
                if (grade.score !== null) { s.total += Number(grade.score); s.count++; }
              }
            }
          }

          for (const [studentId, s] of studentScores) {
            if (!evalTypeAverages[studentId]) evalTypeAverages[studentId] = {};
            if (isMaternelle && s.count > 0) {
              evalTypeAverages[studentId][typeId] = (s.tsCount * 3 + s.sCount * 2 + s.psCount * 1) / s.count;
            } else if (!isMaternelle && s.count > 0) {
              evalTypeAverages[studentId][typeId] = s.total / s.count;
            } else {
              evalTypeAverages[studentId][typeId] = null;
            }
          }
        }

        // Now compute trimester average per student
        // Formula: ((EM1 + EM2) / 2 + EC) / 2
        const evalTypeIds = Array.from(evalTypeMap.keys());
        const em1Id = evalTypeIds.find(id => {
          const ev = evalTypeMap.get(id)?.[0];
          return ev?.evaluationType?.code === 'EM1';
        });
        const em2Id = evalTypeIds.find(id => {
          const ev = evalTypeMap.get(id)?.[0];
          return ev?.evaluationType?.code === 'EM2';
        });
        const ecId = evalTypeIds.find(id => {
          const ev = evalTypeMap.get(id)?.[0];
          return ev?.evaluationType?.code === 'EC';
        });

        const studentNames = new Map<string, string>();
        for (const evals of evalTypeMap.values()) {
          for (const ev of evals) {
            // Get student names from grades
          }
        }

        // Get student names from the first eval's grades
        const firstEvals = Array.from(evalTypeMap.values())[0] || [];
        for (const ev of firstEvals) {
          const grades = evalGradesMap.get(ev.id) || [];
          for (const g of grades) {
            if (!studentNames.has(g.studentId)) {
              studentNames.set(g.studentId, g.studentName || 'Inconnu');
            }
          }
        }

        for (const [studentId, name] of studentNames) {
          const avgs = evalTypeAverages[studentId] || {};
          const em1Avg = em1Id ? avgs[em1Id] : null;
          const em2Avg = em2Id ? avgs[em2Id] : null;
          const ecAvg = ecId ? avgs[ecId] : null;

          let trimesterAvg: number | null = null;
          let appreciation = '—';
          if (em1Avg !== null && em2Avg !== null && ecAvg !== null) {
            const emAvg = (em1Avg + em2Avg) / 2;
            trimesterAvg = (emAvg + ecAvg) / 2;
          } else if (em1Avg !== null && em2Avg !== null) {
            trimesterAvg = (em1Avg + em2Avg) / 2;
          } else if (ecAvg !== null) {
            trimesterAvg = ecAvg;
          }

          if (isMaternelle && trimesterAvg !== null) {
            appreciation = trimesterAvg >= 2.5 ? 'Très Satisfaisant' : trimesterAvg >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';
          }

          results.push({
            studentId,
            studentName: name,
            periodName: period.name,
            em1Avg, em2Avg, ecAvg,
            trimesterAvg,
            appreciation,
          });
        }
      }

      // Sort by student name
      results.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
      setTrimesterData(results);
    } catch (err) {
      console.error('Error loading trimester averages:', err);
      setTrimesterData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, academicYear?.id, scopeLang, isMaternelle]);

  useEffect(() => {
    if (activeMoyenneTab === 'trimestriel') loadTrimesterAverages();
  }, [loadTrimesterAverages, activeMoyenneTab]);

  return (
    <div className="space-y-4">
      {/* Sub-sub-tabs: Trimestriel | Annuel */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveMoyenneTab('trimestriel')}
          className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
            activeMoyenneTab === 'trimestriel' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}
        >
          Moyennes trimestrielles
        </button>
        <button
          onClick={() => setActiveMoyenneTab('annuel')}
          className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
            activeMoyenneTab === 'annuel' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}
        >
          Moyennes annuelles
        </button>
      </div>

      {/* Class selector */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-sm font-semibold text-slate-700">Classe:</span>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
        >
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-slate-500">Calcul des moyennes…</span>
        </div>
      ) : activeMoyenneTab === 'trimestriel' ? (
        <MoyennesTrimestrielTable data={trimesterData} isMaternelle={isMaternelle} />
      ) : (
        <MoyennesAnnuelTable data={[]} isMaternelle={isMaternelle} />
      )}
    </div>
  );
}

// ─── Moyennes Trimestrielles Table ───────────────────────────────────────────

function MoyennesTrimestrielTable({ data, isMaternelle }: { data: any[]; isMaternelle: boolean }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune donnée disponible. Sélectionnez une classe.</p>
      </div>
    );
  }

  // Group by student
  const studentMap = new Map<string, any>();
  for (const row of data) {
    if (!studentMap.has(row.studentId)) {
      studentMap.set(row.studentId, { studentName: row.studentName, periods: {} });
    }
    studentMap.get(row.studentId).periods[row.periodName] = row;
  }
  const students = Array.from(studentMap.values());

  // Get all period names
  const periodNames = [...new Set(data.map(r => r.periodName))].sort();

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <h3 className="text-sm font-bold text-slate-900">Moyennes trimestrielles</h3>
        <p className="text-xs text-slate-500">Formule: ((EM1 + EM2) / 2 + EC) / 2</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr style={{ backgroundColor: '#0A2A5E', color: 'white' }}>
              <th className="border px-2 py-2 font-bold uppercase text-left" style={{ borderColor: '#0D3B85', minWidth: '180px' }}>Nom et prénom</th>
              {periodNames.map(p => (
                <th key={p} className="border px-2 py-2 font-bold uppercase text-center" style={{ borderColor: '#0D3B85' }}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, idx) => (
              <tr key={idx} className={cn(idx % 2 === 1 && 'bg-slate-50/50')}>
                <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">{student.studentName}</td>
                {periodNames.map(p => {
                  const row = student.periods[p];
                  if (!row) return <td key={p} className="border border-slate-300 px-2 py-1 text-center text-slate-300">—</td>;
                  if (isMaternelle) {
                    return (
                      <td key={p} className="border border-slate-300 px-2 py-1 text-center">
                        <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-bold',
                          row.appreciation === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
                          row.appreciation === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
                          row.appreciation === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
                        )}>{row.appreciation || '—'}</span>
                      </td>
                    );
                  }
                  return (
                    <td key={p} className="border border-slate-300 px-2 py-1 text-center font-bold">
                      <span className={cn((row.trimesterAvg || 0) >= 10 ? 'text-emerald-700' : 'text-red-600')}>
                        {row.trimesterAvg !== null ? row.trimesterAvg.toFixed(2) : '—'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Moyennes Annuelles Table ────────────────────────────────────────────────

function MoyennesAnnuelTable({ data, isMaternelle }: { data: any[]; isMaternelle: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-500 font-medium">Moyennes annuelles</p>
      <p className="text-xs text-slate-400 mt-1">
        Formule: ((Moyenne EM annuelle + Moyenne EC annuelle) / 2 + Moyenne EP) / 2
      </p>
      <p className="text-xs text-slate-400 mt-2 italic">
        Les moyennes annuelles seront calculées à la fin de l'année scolaire, après l'évaluation de passage (EP).
      </p>
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
  evalTypeCode?: string,
  evalTypeName?: string,
  className?: string,
): string {
  const periodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
  // Generate a verification token for QR code
  const qrToken = `${student.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('BULLETIN:' + qrToken + ':' + student.id)}`;

  const subjectRows = data.subjects.map((subject, idx) => {
    const score = student.subjectScores[subject.id];
    let scoreCell = '—';
    if (score?.isAbsent) {
      scoreCell = '<span style="color:red;font-weight:bold">ABS</span>';
    } else if (isMaternelle) {
      const color = score?.qualitativeCode === 'TS' ? '#059669' : score?.qualitativeCode === 'S' ? '#2563eb' : score?.qualitativeCode === 'PS' ? '#d97706' : '#666';
      scoreCell = `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-weight:bold">${score?.qualitativeCode || '—'}</span>`;
    } else {
      const val = score?.score !== null ? Number(score.score).toFixed(2) : '—';
      const color = (score?.score || 0) >= 10 ? '#059669' : '#dc2626';
      scoreCell = `<span style="color:${color};font-weight:bold">${val}</span>`;
    }
    return `<tr><td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${idx + 1}</td><td style="border:1px solid #ccc;padding:4px 8px;font-weight:500">${subject.name}</td><td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${scoreCell}</td><td style="border:1px solid #ccc;padding:4px 8px;text-align:center;font-size:11px">${score?.appreciation || '—'}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bulletin - ${student.studentName}</title><style>
  @page { size: A4 landscape; margin: 1.2cm; }
  body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; color: #1a1a1a; }
  /* ─── Official header (like Module Élèves) ─── */
  .official-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #0A2A5E; padding-bottom: 10px; margin-bottom: 12px; }
  .header-left { display: flex; align-items: center; gap: 8px; }
  .benin-flag { width: 24px; height: 16px; display: inline-block; vertical-align: middle; }
  .benin-flag .green { float: left; width: 33%; height: 100%; background: #00803D; }
  .benin-flag .yellow { float: right; width: 67%; height: 50%; background: #FCDE16; }
  .benin-flag .red { float: right; width: 67%; height: 50%; background: #E8112D; }
  .header-center { text-align: center; flex: 1; }
  .header-center .republique { font-size: 11px; font-weight: bold; }
  .header-center .ministry { font-size: 8px; margin-top: 2px; }
  .header-center .school-name { font-size: 13px; font-weight: bold; color: #0A2A5E; margin-top: 4px; }
  .header-center .school-contact { font-size: 7px; color: #666; margin-top: 2px; font-style: italic; }
  .header-right { text-align: right; }
  .header-right img.logo { max-height: 50px; max-width: 50px; }
  /* ─── Bulletin title ─── */
  .bulletin-title { text-align: center; background: #0A2A5E; color: white; padding: 6px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
  /* ─── Student info ─── */
  .student-info { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; margin-bottom: 10px; font-size: 10px; }
  .student-info div { flex: 1; }
  .student-info strong { color: #0A2A5E; }
  /* ─── Table ─── */
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th { background: #0A2A5E; color: white; padding: 6px 8px; border: 1px solid #0D3B85; text-align: center; font-size: 9px; }
  thead tr:nth-child(2) th { background: #0D3B85; }
  tbody td { border: 1px solid #cbd5e1; padding: 4px 8px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  /* ─── Synthèse ─── */
  .synthesis { display: flex; justify-content: space-around; margin-top: 12px; gap: 8px; }
  .synthesis div { text-align: center; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px; flex: 1; background: #f8fafc; }
  .synthesis .label { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: bold; }
  .synthesis .value { font-size: 14px; font-weight: bold; margin-top: 2px; }
  /* ─── Signatures ─── */
  .signatures { display: flex; justify-content: space-between; margin-top: 30px; gap: 16px; }
  .sig-box { flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 6px; }
  .sig-box .sig-label { font-size: 9px; font-weight: bold; color: #0A2A5E; }
  .sig-box .sig-line { margin-top: 35px; font-size: 8px; color: #94a3b8; }
  /* ─── QR Code ─── */
  .qr-section { display: flex; justify-content: flex-end; margin-top: 15px; align-items: center; gap: 8px; }
  .qr-section img { width: 60px; height: 60px; }
  .qr-section .qr-text { font-size: 7px; color: #94a3b8; text-align: right; }
  </style></head><body>

  <!-- Official Header -->
  <div class="official-header">
    <div class="header-left">
      <div class="benin-flag"><div class="green"></div><div class="yellow"></div><div class="red"></div></div>
    </div>
    <div class="header-center">
      <div class="republique">République du Bénin</div>
      <div class="ministry">Ministère des Enseignements Maternel et Primaire</div>
      <div class="school-name">${school?.schoolName || 'Établissement'}</div>
      <div class="school-contact">${school?.address || ''} · Tél: ${school?.phone || ''} · ${school?.email || ''}</div>
    </div>
    <div class="header-right">
      ${school?.logoUrl ? `<img class="logo" src="${school.logoUrl}" />` : ''}
    </div>
  </div>

  <!-- Bulletin Title -->
  <div class="bulletin-title">
    Bulletin de ${evalTypeName || 'Évaluation'} ${evalTypeCode ? '(' + evalTypeCode + ')' : ''} — ${periodName} ${academicYear?.label || ''}
  </div>

  <!-- Student Info -->
  <div class="student-info">
    <div>Élève: <strong>${student.studentName}</strong></div>
    <div>Matricule: <strong>${student.matricule || '—'}</strong></div>
    <div>Classe: <strong>${className || '—'}</strong></div>
    <div>Rang: <strong>${student.classRank}</strong></div>
  </div>

  <!-- Notes Table -->
  <table>
    <thead><tr><th style="width:30px">N°</th><th style="text-align:left">Matière</th><th>${isMaternelle ? 'Appréciation (TS/S/PS)' : 'Note /20'}</th><th>Observation</th></tr></thead>
    <tbody>${subjectRows}</tbody>
  </table>

  <!-- Synthèse -->
  <div class="synthesis">
    ${!isMaternelle ? `<div><div class="label">Moyenne</div><div class="value" style="color:#0A2A5E">${student.generalAverage?.toFixed(2) || '—'}/20</div></div>` : ''}
    <div><div class="label">Rang</div><div class="value" style="color:#334155">${student.classRank}</div></div>
    <div><div class="label">${isMaternelle ? 'Appréciation' : 'Mention'}</div><div class="value" style="color:#059669;font-size:12px">${isMaternelle ? (student.appreciationGlobale || '—') : (student.generalAverage !== null ? (student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' : student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant') : '—')}</div></div>
    <div><div class="label">Moy. classe</div><div class="value" style="color:#CFA63A">${data.stats.classAverage?.toFixed(2) || '—'}</div></div>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-box"><div class="sig-label">Titulaire de la classe</div><div class="sig-line">Signature</div></div>
    <div class="sig-box"><div class="sig-label">Le Directeur(trice)</div><div class="sig-line">Visa</div></div>
    <div class="sig-box"><div class="sig-label">Les Parents</div><div class="sig-line">Nom, Prénoms et Signature</div></div>
  </div>

  <!-- QR Code de vérification -->
  <div class="qr-section">
    <div class="qr-text">Code de vérification<br/>${qrToken.substring(0, 20)}…</div>
    <img src="${qrUrl}" alt="QR Code vérification" />
  </div>

  </body></html>`;
}
