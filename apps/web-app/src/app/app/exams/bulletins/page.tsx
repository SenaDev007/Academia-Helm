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
  Calculator, Shield, PenTool, Send, Mail, Undo, CheckCircle, ShieldAlert, Settings, Save, Sparkles,
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
import { useAppSessionOptional } from '@/contexts/AppSessionContext';
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
  directorVisa?: string | null;
}

/**
 * ⭐ Formate un rang en ordinal français :
 *   1 → "1er", 2 → "2ème", 3 → "3ème", 4 → "4ème", etc.
 *   Pour le féminin (utilisé si l'élève est une fille), on peut passer
 *   `feminine=true` : 1 → "1ère", 2 → "2ème", etc.
 */
function formatRank(rank: number | null | undefined, feminine: boolean = false): string {
  if (rank === null || rank === undefined) return '—';
  if (rank === 1) return feminine ? '1ère' : '1er';
  return `${rank}ème`;
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
  const session = useAppSessionOptional();
  const user = session?.user;
  const effectiveTenantId = session?.tenant?.id;

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
  // ⭐ Sub-tabs: 'bulletin' | 'moyennes' | 'criteria' | 'received'
  const [activeSubTab, setActiveSubTab] = useState<'bulletin' | 'moyennes' | 'criteria' | 'received'>('bulletin');
  // ⭐ Sub-sub-tabs within 'moyennes': 'trimestriel' | 'annuel'
  const [activeMoyenneTab, setActiveMoyenneTab] = useState<'trimestriel' | 'annuel'>('trimestriel');

  const isMaternelle = scopeLevel === 'MATERNELLE';

  // ⭐ Anti-screenshot protection for teachers
  const isTeacher = ['TEACHER', 'TEACHER_RESP', 'ENSEIGNANT', 'PEDAGOGIC_COORDINATOR'].includes(user?.role || '');
  useAntiScreenshot(isTeacher);

  // ⭐ Workflow signatures — loaded from backend to display in bulletin preview
  const [workflowSignatures, setWorkflowSignatures] = useState<Record<string, { directorSig?: string; teacherSig?: string }>>({});

  // Load workflow status to get signatures per student
  useEffect(() => {
    if (!effectiveTenantId || !academicYear?.id || !selectedClassId || !selectedPeriodId) return;
    apiClient.get(`/institutional-exams/bulletins/class/${selectedClassId}/workflow-status?periodId=${selectedPeriodId}`)
      .then((res) => {
        const sigs: Record<string, { directorSig?: string; teacherSig?: string }> = {};
        for (const b of (res.data?.bulletins || [])) {
          // ⭐ b.student.id is the studentId (Prisma includes relation as nested object)
          const studentId = b.studentId || b.student?.id;
          if (studentId) {
            sigs[studentId] = {
              directorSig: b.directorSignature || undefined,
              teacherSig: b.teacherSignature || undefined,
            };
          }
        }
        setWorkflowSignatures(sigs);
      })
      .catch(() => {});
  }, [effectiveTenantId, academicYear?.id, selectedClassId, selectedPeriodId]);

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
              appreciation: code === 'TS' ? (scopeLang === 'EN' ? 'Very Satisfactory' : 'Très Satisfaisant')
                : code === 'S' ? (scopeLang === 'EN' ? 'Satisfactory' : 'Satisfaisant')
                : code === 'PS' ? (scopeLang === 'EN' ? 'Less Satisfactory' : 'Peu Satisfaisant') : '—',
            };
          } else {
            const score = grade.score !== null ? Number(grade.score) : null;
            // ⭐ En anglophone, les mentions sont basées sur /100 (converties depuis le barème)
            const score100 = score !== null && grade.maxScore ? (score / Number(grade.maxScore || 20)) * 100 : null;
            student.subjectScores[subjectId] = {
              score, qualitativeCode: null, isAbsent: false,
              appreciation: scopeLang === 'EN'
                ? (score100 === null ? '—'
                  : score100 >= 90 ? 'Outstanding'
                  : score100 >= 80 ? 'Very Good'
                  : score100 >= 70 ? 'Good'
                  : score100 >= 60 ? 'Fair'
                  : score100 >= 50 ? 'Pass'
                  : score100 >= 40 ? 'Weak'
                  : 'Very Weak')
                : (score === null ? '—' : score >= 16 ? 'Très Bien' : score >= 14 ? 'Bien' : score >= 12 ? 'Assez Bien' : score >= 10 ? 'Passable' : 'Insuffisant'),
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
            student.appreciationGlobale = student.generalAverage >= 2.5
              ? (scopeLang === 'EN' ? 'Very Satisfactory' : 'Très Satisfaisant')
              : student.generalAverage >= 1.5
                ? (scopeLang === 'EN' ? 'Satisfactory' : 'Satisfaisant')
                : (scopeLang === 'EN' ? 'Less Satisfactory' : 'Peu Satisfaisant');
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
        assiduite: (window as any).__bulletinAnnotations?.[student.id]?.assiduite || null,
        discipline: (window as any).__bulletinAnnotations?.[student.id]?.discipline || null,
        defautsMajeurs: (window as any).__bulletinAnnotations?.[student.id]?.defautsMajeurs || null,
        qualitesRemarquables: (window as any).__bulletinAnnotations?.[student.id]?.qualitesRemarquables || null,
        analyseRecommandations: (window as any).__bulletinAnnotations?.[student.id]?.analyseRecommandations || null,
        teacherSignature: signatures?.teacherSig ?? null,
        directorSignature: signatures?.directorSig ?? null,
        parentSignature: signatures?.parentSig ?? null,
      };

      // ⭐ Load annotations from backend before generating PDF
      try {
        const annRes = await apiClient.get(`/institutional-exams/bulletins/annotations?studentId=${student.id}&periodId=${selectedPeriodId}`);
        const ann = annRes.data || {};
        payload.assiduite = ann.assiduite || null;
        payload.discipline = ann.discipline || null;
        payload.defautsMajeurs = ann.defautsMajeurs || null;
        payload.qualitesRemarquables = ann.qualitesRemarquables || null;
        payload.analyseRecommandations = ann.analyseRecommandations || null;
        payload.directorVisa = ann.directorVisa || null;
      } catch {}

      const response = await apiClient.post('/institutional-exams/bulletins/generate-pdf', payload, {
        responseType: 'blob',
        timeout: 120000, // ⭐ 2 minutes — la génération PDF via Puppeteer peut prendre du temps
      });

      // Download the PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // ⭐ Nom du fichier : bulletin_[élève]_[type éval]_[trimestre].pdf
      const safeStudentName = student.studentName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const safeEvalType = (selectedEvalTypeCode || selectedEvalTypeName || 'eval').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const safePeriod = (selectedPeriodName || 'periode').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `bulletin_${safeStudentName}_${safeEvalType}_${safePeriod}.pdf`;
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
        <button
          onClick={() => setActiveSubTab('criteria')}
          className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            activeSubTab === 'criteria' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
        >
          <Settings className="w-4 h-4" />
          Critères d'envoi
        </button>
        {isTeacher && (
          <button
            onClick={() => setActiveSubTab('received')}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              activeSubTab === 'received' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            <Mail className="w-4 h-4" />
            Bulletins reçus
          </button>
        )}
      </div>

      {/* ═══ Sub-tab: Bulletin d'évaluation ═══ */}
      {activeSubTab === 'bulletin' && (
        <>

      {/* ⭐ Workflow Bar — Signature + Distribution + Envoi parents */}
      {bulletinData && bulletinData.results.length > 0 && selectedClassId && selectedPeriodId && (
        <WorkflowBar
          tenantId={effectiveTenantId}
          academicYearId={academicYear?.id}
          classId={selectedClassId}
          periodId={selectedPeriodId}
          userRole={user?.role}
          evaluationTypeId={selectedEvalTypeId || undefined}
          evaluationTypeName={selectedEvalTypeName || undefined}
          evaluationTypeCode={selectedEvalTypeCode || undefined}
          onRefresh={() => {
            loadBulletins();
            // ⭐ Force re-load of workflow signatures
            if (effectiveTenantId && academicYear?.id && selectedClassId && selectedPeriodId) {
              apiClient.get(`/institutional-exams/bulletins/class/${selectedClassId}/workflow-status?periodId=${selectedPeriodId}`)
                .then((res) => {
                  const sigs: Record<string, { directorSig?: string; teacherSig?: string }> = {};
                  for (const b of (res.data?.bulletins || [])) {
                    const studentId = b.studentId || b.student?.id;
                    if (studentId) {
                      sigs[studentId] = {
                        directorSig: b.directorSignature || undefined,
                        teacherSig: b.teacherSignature || undefined,
                      };
                    }
                  }
                  setWorkflowSignatures(sigs);
                })
                .catch(() => {});
            }
          }}
        />
      )}

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
          {bulletinData && bulletinData.results.length > 0 && !isTeacher && (
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
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">{formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}</div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{student.studentName}</div>
                      <div className="text-xs text-slate-500">
                        {student.matricule || '—'} · Rang {formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}
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
                      canDownload={!isTeacher}
                      directorSignature={workflowSignatures[student.id]?.directorSig}
                      teacherSignature={workflowSignatures[student.id]?.teacherSig}
                      selectedPeriodId={selectedPeriodId}
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

      {/* ═══ Sub-tab: Critères d'envoi ═══ */}
      {activeSubTab === 'criteria' && (
        <SendingCriteriaTab tenantId={effectiveTenantId} />
      )}

      {/* ═══ Sub-tab: Bulletins reçus (enseignants) ═══ */}
      {activeSubTab === 'received' && isTeacher && (
        <ReceivedBulletinsTab
          tenantId={effectiveTenantId}
          academicYearId={academicYear?.id}
          user={user}
        />
      )}
    </div>
  );
}

// ─── Bulletin 2-Page Component (with flip animation) ────────────────────────

function BulletinTwoPage({
  student, bulletinData, isMaternelle, school, academicYear,
  selectedPeriodName, selectedClassName, selectedEvalTypeCode, selectedEvalTypeName,
  onGeneratePdf, generatingPdf, canDownload = true, directorSignature, teacherSignature,
  selectedPeriodId,
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
  canDownload?: boolean;
  directorSignature?: string | null;
  teacherSignature?: string | null;
  selectedPeriodId?: string;
}) {
  const [page, setPage] = useState<1 | 2>(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  // ⭐ Signature state — initialized from workflow signatures (backend) if available
  const [teacherSig, setTeacherSig] = useState<string | null>(teacherSignature ?? null);
  const [directorSig, setDirectorSig] = useState<string | null>(directorSignature ?? null);
  const [parentSig, setParentSig] = useState<string | null>(null);

  // ⭐ Update signatures when backend data changes (e.g. after director signs)
  useEffect(() => {
    if (directorSignature) setDirectorSig(directorSignature);
  }, [directorSignature]);
  useEffect(() => {
    if (teacherSignature) setTeacherSig(teacherSignature);
  }, [teacherSignature]);

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
            <BulletinPage2 student={student} isMaternelle={isMaternelle} signatures={{ teacherSig, directorSig, parentSig, setTeacherSig, setDirectorSig, setParentSig }} periodId={selectedPeriodId} />
          )}
        </div>
      </div>

      {/* PDF button — hidden for teachers (anti-download protection) */}
      {canDownload && (
      <div className="flex justify-end">
        <Button onClick={() => onGeneratePdf({ teacherSig, directorSig, parentSig })} disabled={generatingPdf} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
          {generatingPdf ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération…</> : <><Download className="w-4 h-4 mr-2" />Générer PDF</>}
        </Button>
      </div>
      )}
    </div>
  );
}

// ─── Maternelle Page 1: Notes table (TS/S/PS columns) ──────────────────────

function BulletinMaternellePage1({ student, bulletinData }: { student: StudentResult; bulletinData: BulletinData }) {
  // ⭐ Visa du directeur par matière — éditable, auto-save on blur
  // Auto-rempli depuis l'appréciation enseignant si vide
  const [directorVisas, setDirectorVisas] = useState<Record<string, string>>({});

  // Charge les visas existants au montage
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const subject of bulletinData.subjects) {
      const score = student.subjectScores[subject.id];
      initial[subject.id] = score?.directorVisa || score?.appreciation || '';
    }
    setDirectorVisas(initial);
  }, [student.id, bulletinData.subjects]);

  const handleVisaBlur = async (subjectId: string, value: string) => {
    // Auto-save : on envoie au backend via le BulletinPdfData.directorVisa par matière
    // (le frontend garde l'état local, le PDF utilise les valeurs en mémoire)
    setDirectorVisas(prev => ({ ...prev, [subjectId]: value }));
  };

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
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '80px', borderColor: '#0D3B85', backgroundColor: '#0D3B85' }}>Visa Directeur</th>
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
                {/* ⭐ Visa Directeur éditable — auto-save on blur */}
                <td className="border border-slate-300 px-1 py-0.5 text-center bg-blue-50/30">
                  <input
                    type="text"
                    value={directorVisas[subject.id] ?? ''}
                    onChange={(e) => setDirectorVisas(prev => ({ ...prev, [subject.id]: e.target.value }))}
                    onBlur={(e) => handleVisaBlur(subject.id, e.target.value)}
                    placeholder="—"
                    className="w-full bg-transparent text-center text-[9px] text-blue-900 font-semibold outline-none focus:bg-blue-100 rounded px-1 py-0.5"
                    title="Visa du directeur (auto-enregistré à la sortie de la ligne)"
                  />
                </td>
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
      {/* ⭐ Symbole mérité (emoji) — distinct de l'appréciation globale */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Symbole mérité par l'élève</p>
          <span className="inline-block mt-1 text-2xl">
            {student.appreciationGlobale === 'Très Satisfaisant' ? '😄' :
             student.appreciationGlobale === 'Satisfaisant' ? '😊' :
             student.appreciationGlobale === 'Peu Satisfaisant' ? '😞' : '—'}
          </span>
        </div>
        <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Appréciation globale</p>
          <span className={cn('inline-block mt-1 px-3 py-1 rounded text-xs font-bold',
            student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
            student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
            student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
          )}>{student.appreciationGlobale || '—'}</span>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 mt-1 italic">
        💡 Le visa du directeur est auto-rempli depuis l'appréciation de l'enseignant mais reste éditable. Modifications enregistrées automatiquement à la sortie de la ligne.
      </p>
    </div>
  );
}

// ─── Primaire Page 1: Notes table (CM/18, CP/2, Total/20, Seuil, Appréciation) ─

function BulletinPrimairePage1({ student, bulletinData }: { student: StudentResult; bulletinData: BulletinData }) {
  // ⭐ Visa du directeur par matière — éditable, auto-save on blur
  const [directorVisas, setDirectorVisas] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const subject of bulletinData.subjects) {
      const score = student.subjectScores[subject.id];
      initial[subject.id] = score?.directorVisa || score?.appreciation || '';
    }
    setDirectorVisas(initial);
  }, [student.id, bulletinData.subjects]);

  const totalGeneral = bulletinData.subjects.reduce((sum, subj) => {
    const s = student.subjectScores[subj.id];
    return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
  }, 0);
  const seuilAtteint = totalGeneral >= (10 * bulletinData.subjects.length);
  const validSubjects = bulletinData.subjects.filter(subj => {
    const s = student.subjectScores[subj.id];
    return s && !s.isAbsent && s.score !== null;
  }).length;

  // ⭐ Symbole mérité (emoji) basé sur la moyenne générale
  const symboleMerite = student.generalAverage === null ? '—' :
    student.generalAverage >= 16 ? '🏆' :
    student.generalAverage >= 14 ? '😄' :
    student.generalAverage >= 12 ? '😊' :
    student.generalAverage >= 10 ? '😐' : '😞';
  const mentionGenerale = student.generalAverage === null ? '—' :
    student.generalAverage >= 16 ? 'Très Bien' :
    student.generalAverage >= 14 ? 'Bien' :
    student.generalAverage >= 12 ? 'Assez Bien' :
    student.generalAverage >= 10 ? 'Passable' : 'Insuffisant';

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
            <th rowSpan={2} className="border px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '70px', borderColor: '#0D3B85', backgroundColor: '#0D3B85' }}>Visa Directeur</th>
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
                {/* ⭐ Visa Directeur éditable — auto-save on blur */}
                <td className="border border-slate-300 px-1 py-0.5 text-center bg-blue-50/30">
                  <input
                    type="text"
                    value={directorVisas[subject.id] ?? ''}
                    onChange={(e) => setDirectorVisas(prev => ({ ...prev, [subject.id]: e.target.value }))}
                    onBlur={(e) => setDirectorVisas(prev => ({ ...prev, [subject.id]: e.target.value }))}
                    placeholder="—"
                    className="w-full bg-transparent text-center text-[9px] text-blue-900 font-semibold outline-none focus:bg-blue-100 rounded px-1 py-0.5"
                    title="Visa du directeur (auto-enregistré à la sortie de la ligne)"
                  />
                </td>
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
            <td className="border border-slate-300 px-1 py-0.5 text-center bg-blue-100 text-blue-900 text-[9px]">{mentionGenerale}</td>
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
      {/* ⭐ Symbole mérité (emoji) — distinct de l'appréciation globale */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Symbole mérité par l'élève</p>
          <span className="inline-block mt-1 text-2xl">{symboleMerite}</span>
        </div>
        <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Appréciation globale</p>
          <span className={cn('inline-block mt-1 px-3 py-1 rounded text-xs font-bold',
            student.generalAverage !== null && student.generalAverage >= 12 && 'bg-emerald-100 text-emerald-700',
            student.generalAverage !== null && student.generalAverage >= 10 && student.generalAverage < 12 && 'bg-blue-100 text-blue-700',
            student.generalAverage !== null && student.generalAverage < 10 && 'bg-amber-100 text-amber-700',
          )}>{mentionGenerale}</span>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 mt-1 italic">
        Le visa du directeur est auto-rempli depuis l'appréciation de l'enseignant mais reste éditable. Modifications enregistrées automatiquement à la sortie de la ligne.
      </p>
    </div>
  );
}

// ─── Page 2: Appréciations + Signatures (Maternelle + Primaire) ────────────

function BulletinPage2({ student, isMaternelle, signatures, periodId }: { student: StudentResult; isMaternelle: boolean; signatures: { teacherSig: string | null; directorSig: string | null; parentSig: string | null; setTeacherSig: (v: string | null) => void; setDirectorSig: (v: string | null) => void; setParentSig: (v: string | null) => void }; periodId?: string }) {
  // ⭐ Annotation state — loaded from backend + auto-save on blur
  const [assiduite, setAssiduite] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [defautsMajeurs, setDefautsMajeurs] = useState('');
  const [qualitesRemarquables, setQualitesRemarquables] = useState('');
  const [analyseRecommandations, setAnalyseRecommandations] = useState('');
  const [directorVisa, setDirectorVisa] = useState(student.appreciationGlobale || '');
  const [directorVisaSaved, setDirectorVisaSaved] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);

  // Load annotations from backend when student/period changes
  useEffect(() => {
    if (!student.id || !periodId) return;
    apiClient.get(`/institutional-exams/bulletins/annotations?studentId=${student.id}&periodId=${periodId}`)
      .then((res) => {
        const data = res.data || {};
        setAssiduite(data.assiduite || '');
        setDiscipline(data.discipline || '');
        setDefautsMajeurs(data.defautsMajeurs || '');
        setQualitesRemarquables(data.qualitesRemarquables || '');
        setAnalyseRecommandations(data.analyseRecommandations || '');
        if (data.directorVisa) setDirectorVisa(data.directorVisa);
      })
      .catch(() => {});
  }, [student.id, periodId]);

  // Auto-save a single annotation field on blur
  const saveAnnotation = async (field: string, value: string) => {
    if (!student.id || !periodId) return;
    try {
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        [field]: value,
      });
    } catch (err) {
      // Silent fail — non-blocking
    }
  };

  // ⭐ Director visa auto-save on blur
  const handleDirectorVisaBlur = async () => {
    if (!student.id || !periodId) return;
    try {
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        directorVisa: directorVisa,
      });
      setDirectorVisaSaved(true);
      setTimeout(() => setDirectorVisaSaved(false), 2000);
    } catch {
      // Silent fail — non-blocking
    }
  };

  // ⭐ AI Auto-fill: generate annotations from attendance + grades
  const [autoGenerated, setAutoGenerated] = useState(false); // tracks if annotations were auto-filled (for red handwritten style)

  const handleAutoFill = async () => {
    if (!student.id || !periodId) return;
    setAutoFillLoading(true);
    try {
      const res = await apiClient.get(`/institutional-exams/bulletins/auto-annotations?studentId=${student.id}&periodId=${periodId}`);
      const data = res.data;
      if (data.assiduite) setAssiduite(data.assiduite);
      if (data.discipline) setDiscipline(data.discipline);
      if (data.defautsMajeurs !== undefined) setDefautsMajeurs(data.defautsMajeurs);
      if (data.qualitesRemarquables !== undefined) setQualitesRemarquables(data.qualitesRemarquables);
      if (data.analyseRecommandations) setAnalyseRecommandations(data.analyseRecommandations);
      if (data.directorVisa) setDirectorVisa(data.directorVisa);
      setAutoGenerated(true); // Mark as auto-generated for red handwritten style
      // Save all to backend
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        assiduite: data.assiduite,
        discipline: data.discipline,
        defautsMajeurs: data.defautsMajeurs,
        qualitesRemarquables: data.qualitesRemarquables,
        analyseRecommandations: data.analyseRecommandations,
        directorVisa: data.directorVisa,
      });
      toastSuccess('Annotations auto-générées', { description: 'Basées sur l\'assiduité et les résultats de l\'élève. Modifiables.' });
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setAutoFillLoading(false); }
  };

  // CSS class for auto-generated annotations: red, handwritten font
  // CSS class for auto-generated annotations: red, handwritten font
  const autoStyle = autoGenerated ? 'text-red-600 italic' : '';
  const autoFont = autoGenerated ? 'font-mono' : '';

  return (
    <div className="space-y-3">
      {!isMaternelle && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase mb-2">II — Attitudes</h4>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={autoFillLoading}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              title="Générer automatiquement les annotations basées sur l'assiduité et les notes"
            >
              {autoFillLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Auto-générer
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Assiduité</label>
              <textarea
                value={assiduite}
                onChange={(e) => setAssiduite(e.target.value)}
                onBlur={(e) => saveAnnotation('assiduite', e.target.value)}
                rows={2}
                placeholder="Renseigner l'assiduité de l'élève…"
                className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Discipline</label>
              <textarea
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                onBlur={(e) => saveAnnotation('discipline', e.target.value)}
                rows={2}
                placeholder="Renseigner la discipline de l'élève…"
                className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Défauts majeurs identifiés</label>
              <textarea
                value={defautsMajeurs}
                onChange={(e) => setDefautsMajeurs(e.target.value)}
                onBlur={(e) => saveAnnotation('defautsMajeurs', e.target.value)}
                rows={2}
                placeholder="Renseigner les défauts majeurs…"
                className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Qualités remarquables</label>
              <textarea
                value={qualitesRemarquables}
                onChange={(e) => setQualitesRemarquables(e.target.value)}
                onBlur={(e) => saveAnnotation('qualitesRemarquables', e.target.value)}
                rows={2}
                placeholder="Renseigner les qualités remarquables…"
                className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Analyse pédagogique */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase">
            {isMaternelle
              ? "Analyse Pédagogique Sommaire des Résultats et Recommandations de l'Enseignant(e) aux Parents"
              : 'Analyse des Résultats et Recommandations'}
          </h4>
          {/* ⭐ Auto-générer l'analyse + visa directeur + date — disponible pour MATERNELLE et PRIMAIRE */}
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={autoFillLoading}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
            title="Générer automatiquement l'analyse pédagogique, le visa du directeur et la date, basés sur l'assiduité et les résultats de l'élève."
          >
            {autoFillLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {isMaternelle ? 'Auto-générer (analyse + visa + date)' : 'Auto-générer les recommandations'}
          </button>
        </div>
        <textarea
          value={analyseRecommandations}
          onChange={(e) => setAnalyseRecommandations(e.target.value)}
          onBlur={(e) => saveAnnotation('analyseRecommandations', e.target.value)}
          rows={isMaternelle ? 6 : 4}
          placeholder="Saisir l'analyse pédagogique et les recommandations…"
          className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
        />
      </div>

      {/* ⭐ Symbole mérité (emoji) + Appréciation globale + Visa directeur — séparés */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Symbole mérité (emoji) */}
        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Symbole mérité par l'élève</p>
          {isMaternelle ? (
            <span className="inline-block mt-2 text-3xl">
              {student.appreciationGlobale === 'Très Satisfaisant' ? '😄' :
               student.appreciationGlobale === 'Satisfaisant' ? '😊' :
               student.appreciationGlobale === 'Peu Satisfaisant' ? '😞' : '—'}
            </span>
          ) : (
            <span className="inline-block mt-2 text-3xl">
              {student.generalAverage === null ? '—' :
               student.generalAverage >= 16 ? '🏆' :
               student.generalAverage >= 14 ? '😄' :
               student.generalAverage >= 12 ? '😊' :
               student.generalAverage >= 10 ? '😐' : '😞'}
            </span>
          )}
        </div>
        {/* Appréciation globale (texte) */}
        <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Appréciation globale</p>
          {isMaternelle ? (
            <span className={cn('inline-block mt-2 px-3 py-1 rounded text-xs font-bold',
              student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
              student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
              student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
            )}>{student.appreciationGlobale || '—'}</span>
          ) : (
            <span className={cn('inline-block mt-2 px-3 py-1 rounded text-xs font-bold',
              student.generalAverage !== null && student.generalAverage >= 12 && 'bg-emerald-100 text-emerald-700',
              student.generalAverage !== null && student.generalAverage >= 10 && student.generalAverage < 12 && 'bg-blue-100 text-blue-700',
              student.generalAverage !== null && student.generalAverage < 10 && 'bg-amber-100 text-amber-700',
            )}>
              {student.generalAverage !== null ? (
                student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' :
                student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant'
              ) : '—'}
            </span>
          )}
        </div>
        {/* ⭐ Visa du directeur (global, éditable, auto-save on blur) */}
        <div className="bg-amber-50 rounded-lg p-2 border border-amber-200">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-bold text-amber-900 uppercase">Visa du Directeur</p>
            {/* ⭐ Auto-fill visa + date — disponible pour MATERNELLE et PRIMAIRE */}
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={autoFillLoading}
              className="text-[10px] text-amber-700 hover:text-amber-900 underline flex items-center gap-0.5 disabled:opacity-50"
              title="Générer automatiquement le visa du directeur avec la date du jour."
            >
              {autoFillLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
              Auto-remplir
            </button>
          </div>
          <textarea
            value={directorVisa}
            onChange={(e) => setDirectorVisa(e.target.value)}
            onBlur={handleDirectorVisaBlur}
            rows={2}
            placeholder={student.appreciationGlobale || 'Visa du directeur…'}
            className={`w-full mt-1 text-[10px] bg-white/60 border border-amber-200 rounded px-2 py-1 outline-none focus:bg-white focus:border-amber-400 resize-none ${autoStyle} ${autoFont}`}
            title="Visa global du directeur (auto-enregistré à la sortie du champ)"
          />
          {directorVisaSaved && <p className="text-[9px] text-emerald-600 mt-0.5">✓ Enregistré</p>}
        </div>
      </div>

      {/* Signatures électroniques */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase mb-3">Signatures</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-700 mb-1">Titulaire de la classe</p>
            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
              {signatures.teacherSig ? (
                <div className="flex flex-col items-center">
                  <img src={signatures.teacherSig} alt="Signature de l'enseignant" className="max-h-24 max-w-[280px] object-contain" />
                  <button
                    type="button"
                    onClick={() => signatures.setTeacherSig(null)}
                    className="text-[9px] text-red-500 hover:underline mt-1"
                  >
                    Effacer et resigner
                  </button>
                </div>
              ) : (
                <SignatureCanvas
                  width={280}
                  height={100}
                  onSignatureChange={signatures.setTeacherSig}
                  placeholder="Signature de l'enseignant"
                />
              )}
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-700 mb-1">Le Directeur(trice)</p>
            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
              {signatures.directorSig ? (
                <div className="flex flex-col items-center">
                  <img src={signatures.directorSig} alt="Signature du Directeur" className="max-h-24 max-w-[280px] object-contain" />
                  <button
                    type="button"
                    onClick={() => signatures.setDirectorSig(null)}
                    className="text-[9px] text-red-500 hover:underline mt-1"
                  >
                    Effacer et resigner
                  </button>
                </div>
              ) : (
                <SignatureCanvas
                  width={280}
                  height={100}
                  onSignatureChange={signatures.setDirectorSig}
                  placeholder="Signature du Directeur"
                />
              )}
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
        <textarea
          rows={2}
          placeholder="Zone de réponse des parents…"
          className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
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
    <div>Rang: <strong>${formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}</strong></div>
  </div>

  <!-- Notes Table -->
  <table>
    <thead><tr><th style="width:30px">N°</th><th style="text-align:left">Matière</th><th>${isMaternelle ? 'Appréciation (TS/S/PS)' : 'Note /20'}</th><th>Observation</th></tr></thead>
    <tbody>${subjectRows}</tbody>
  </table>

  <!-- Synthèse -->
  <div class="synthesis">
    ${!isMaternelle ? `<div><div class="label">Moyenne</div><div class="value" style="color:#0A2A5E">${student.generalAverage?.toFixed(2) || '—'}/20</div></div>` : ''}
    <div><div class="label">Rang</div><div class="value" style="color:#334155">${formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}</div></div>
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

// ─── Workflow Bar — Signature + Distribution + Envoi aux parents ─────────────

function WorkflowBar({
  tenantId, academicYearId, classId, periodId, userRole, onRefresh,
  evaluationTypeId, evaluationTypeName, evaluationTypeCode,
}: {
  tenantId?: string;
  academicYearId?: string;
  classId: string;
  periodId: string;
  userRole?: string;
  onRefresh: () => void;
  evaluationTypeId?: string;
  evaluationTypeName?: string;
  evaluationTypeCode?: string;
}) {
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showSignModal, setShowSignModal] = useState<'director' | 'teacher' | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isDirector = ['PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'DIRECTEUR', 'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN'].includes(userRole || '');
  const isTeacher = ['TEACHER', 'TEACHER_RESP', 'ENSEIGNANT', 'PEDAGOGIC_COORDINATOR'].includes(userRole || '');

  // ⭐ Load workflow status
  const loadStatus = useCallback(async () => {
    if (!tenantId || !academicYearId || !classId || !periodId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/institutional-exams/bulletins/class/${classId}/workflow-status?periodId=${periodId}`);
      setWorkflowStatus(res.data);
    } catch { setWorkflowStatus(null); }
    finally { setLoading(false); }
  }, [tenantId, academicYearId, classId, periodId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleSign = async () => {
    if (!signature || !showSignModal) return;
    setActionLoading(true);
    try {
      const endpoint = showSignModal === 'director' ? 'director-sign' : 'teacher-sign';
      // ⭐ Pour la signature du directeur, on envoie aussi evaluationTypeId
      //    pour que le bulletin soit lié au type d'évaluation sélectionné
      const body: any = { periodId, signature };
      if (showSignModal === 'director' && evaluationTypeId) {
        body.evaluationTypeId = evaluationTypeId;
        body.evaluationTypeName = evaluationTypeName;
        body.evaluationTypeCode = evaluationTypeCode;
      }
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/${endpoint}`, body);
      toastSuccess('Signature appliquée', {
        description: showSignModal === 'director'
          ? `Tous les bulletins${evaluationTypeName ? ` de ${evaluationTypeName}` : ''} ont été signés par le directeur.`
          : "Tous les bulletins ont été signés par l'enseignant.",
      });
      setShowSignModal(null);
      setSignature(null);
      loadStatus();
      onRefresh();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/activate`, { periodId });
      toastSuccess('Bulletins activés', { description: 'Distribués aux enseignants titulaires de classe.' });
      loadStatus();
      onRefresh();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const handleReturn = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/teacher-return`, { periodId });
      toastSuccess('Bulletins renvoyés', { description: 'Les bulletins sont de retour dans l\'interface du directeur.' });
      loadStatus();
      onRefresh();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const handleSendToParents = async () => {
    if (!confirm('Confirmer l\'envoi des bulletins aux parents ? Seuls les élèves dont la scolarité est en règle recevront leur bulletin.')) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/institutional-exams/bulletins/class/${classId}/send-to-parents`, {
        periodId,
        criteria: { blockIfArrears: true, minPaymentPercentage: 100 },
      }, {
        timeout: 60000, // ⭐ 1 minute — peut itérer sur de nombreux élèves
      });
      const data = res.data;
      toastSuccess('Envoi terminé', {
        description: `${data.sent} envoyé(s) aux parents, ${data.blocked} bloqué(s) (scolarité impayée).`,
      });
      loadStatus();
      onRefresh();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const summary = workflowStatus?.summary;
  const currentStatus = !summary || summary.total === 0 ? 'NONE'
    : summary.PARENT_SENT > 0 ? 'PARENT_SENT'
    : summary.BLOCKED > 0 ? 'BLOCKED'
    : summary.TEACHER_RETURNED > 0 ? 'TEACHER_RETURNED'
    : summary.TEACHER_SIGNED > 0 ? 'TEACHER_SIGNED'
    : summary.TEACHER_DISTRIBUTED > 0 ? 'TEACHER_DISTRIBUTED'
    : summary.DIRECTOR_SIGNED > 0 ? 'DIRECTOR_SIGNED'
    : 'DRAFT';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Workflow de validation des bulletins</h3>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-4 flex-wrap text-xs">
        <StatusBadge label="Brouillon" active={currentStatus === 'DRAFT'} done={summary && summary.DIRECTOR_SIGNED > 0} />
        <Arrow />
        <StatusBadge label="Signé Directeur" active={currentStatus === 'DIRECTOR_SIGNED'} done={summary && summary.TEACHER_DISTRIBUTED > 0} />
        <Arrow />
        <StatusBadge label="Distribué Enseignants" active={currentStatus === 'TEACHER_DISTRIBUTED'} done={summary && summary.TEACHER_SIGNED > 0} />
        <Arrow />
        <StatusBadge label="Signé Enseignant" active={currentStatus === 'TEACHER_SIGNED'} done={summary && summary.TEACHER_RETURNED > 0} />
        <Arrow />
        <StatusBadge label="Renvoyé Directeur" active={currentStatus === 'TEACHER_RETURNED'} done={summary && summary.PARENT_SENT > 0} />
        <Arrow />
        <StatusBadge label="Envoyé Parents" active={currentStatus === 'PARENT_SENT' || currentStatus === 'BLOCKED'} done={false} />
      </div>

      {/* Summary counts */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="font-bold text-slate-900 text-lg">{summary.total}</div>
            <div className="text-slate-500">Total bulletins</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="font-bold text-blue-700 text-lg">{summary.DIRECTOR_SIGNED + summary.TEACHER_DISTRIBUTED + summary.TEACHER_SIGNED + summary.TEACHER_RETURNED}</div>
            <div className="text-slate-500">En cours</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 text-center">
            <div className="font-bold text-emerald-700 text-lg">{summary.PARENT_SENT}</div>
            <div className="text-slate-500">Envoyés aux parents</div>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center">
            <div className="font-bold text-red-700 text-lg">{summary.BLOCKED}</div>
            <div className="text-slate-500">Bloqués (scolarité)</div>
          </div>
        </div>
      )}

      {/* Action buttons — role-based */}
      <div className="flex flex-wrap gap-2">
        {/* Director/Promoter actions */}
        {isDirector && (
          <>
            {currentStatus === 'NONE' || currentStatus === 'DRAFT' ? (
              <Button onClick={() => setShowSignModal('director')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                <PenTool className="w-4 h-4 mr-2" /> Signer (Directeur)
              </Button>
            ) : null}

            {currentStatus === 'DIRECTOR_SIGNED' && (
              <Button onClick={handleActivate} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Activer — Distribuer aux enseignants
              </Button>
            )}

            {(currentStatus === 'TEACHER_RETURNED' || currentStatus === 'TEACHER_SIGNED') && (
              <Button onClick={handleSendToParents} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Envoyer aux parents
              </Button>
            )}

            {currentStatus === 'PARENT_SENT' && (
              <div className="text-sm text-emerald-700 font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Bulletins envoyés aux parents
              </div>
            )}
          </>
        )}

        {/* Teacher actions */}
        {isTeacher && (
          <>
            {currentStatus === 'TEACHER_DISTRIBUTED' && (
              <Button onClick={() => setShowSignModal('teacher')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                <PenTool className="w-4 h-4 mr-2" /> Signer (Enseignant)
              </Button>
            )}

            {currentStatus === 'TEACHER_SIGNED' && (
              <Button onClick={handleReturn} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo className="w-4 h-4 mr-2" />}
                Renvoyer au directeur
              </Button>
            )}

            {currentStatus === 'TEACHER_RETURNED' && (
              <div className="text-sm text-slate-600 font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Bulletins renvoyés au directeur
              </div>
            )}

            {/* ⭐ Anti-screenshot notice for teachers */}
            {(currentStatus === 'TEACHER_DISTRIBUTED' || currentStatus === 'TEACHER_SIGNED') && (
              <div className="w-full mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span><strong>Protection :</strong> Les captures d'écran et le téléchargement des bulletins sont désactivés. Toute tentative est journalisée.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <SignModal
          role={showSignModal}
          signature={signature}
          setSignature={setSignature}
          onConfirm={handleSign}
          onClose={() => { setShowSignModal(null); setSignature(null); }}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

function StatusBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
      active ? 'bg-blue-600 text-white border-blue-600' :
      done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
      'bg-slate-50 text-slate-400 border-slate-200'
    )}>
      {done && <CheckCircle className="w-3 h-3 mr-1" />}
      {label}
    </span>
  );
}

function Arrow() {
  return <span className="text-slate-300 text-xs">→</span>;
}

function SignModal({
  role, signature, setSignature, onConfirm, onClose, loading,
}: {
  role: 'director' | 'teacher';
  signature: string | null;
  setSignature: (v: string | null) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-sm font-bold text-slate-900 mb-2">
          Signature — {role === 'director' ? 'Le Directeur(trice)' : 'L\'Enseignant(e)'}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Cette signature sera appliquée à <strong>tous les bulletins</strong> de cette classe sans exception.
        </p>
        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 mb-4">
          <SignatureCanvas
            width={340}
            height={120}
            onSignatureChange={setSignature}
            placeholder="Signez ici"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="text-sm">Annuler</Button>
          <Button
            onClick={onConfirm}
            disabled={!signature || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Valider la signature
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Anti-screenshot protection hook for teachers ───────────────────────────

function useAntiScreenshot(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };

    // Disable text selection
    const handleSelectStart = (e: Event) => { e.preventDefault(); };

    // Disable common screenshot shortcuts (Ctrl+P, Ctrl+S, Ctrl+Shift+S, PrintScreen)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P (print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); }
      // Ctrl+S (save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); }
      // Ctrl+Shift+S (save as)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); }
      // PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        // Clear clipboard
        if (navigator.clipboard) navigator.clipboard.writeText('').catch(() => {});
      }
    };

    // Detect screenshot via clipboard (PrintScreen puts image in clipboard)
    const handleCopy = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.types.includes('Files')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);

    // Add CSS to disable user-select
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [enabled]);
}

// ─── Sending Criteria Tab — Configuration des critères d'envoi ──────────────

function SendingCriteriaTab({ tenantId }: { tenantId?: string }) {
  const [criteria, setCriteria] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing criteria
  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    apiClient.get('/institutional-exams/bulletins/sending-criteria')
      .then((res) => setCriteria(res.data))
      .catch(() => setCriteria(null))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/institutional-exams/bulletins/sending-criteria', {
        blockIfArrears: criteria.blockIfArrears,
        minPaymentPercentage: criteria.minPaymentPercentage,
        allowDownloadByParents: criteria.allowDownloadByParents,
        requireDirectorSignature: criteria.requireDirectorSignature,
        requireTeacherSignature: criteria.requireTeacherSignature,
        autoSendAfterTeacherSign: criteria.autoSendAfterTeacherSign,
        notifyParentOnSend: criteria.notifyParentOnSend,
        reminderDaysBeforeBlock: criteria.reminderDaysBeforeBlock,
        customMessage: criteria.customMessage,
      });
      toastSuccess('Critères enregistrés', { description: 'Les règles d\'envoi des bulletins ont été mises à jour.' });
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-slate-500">Chargement des critères…</span>
      </div>
    );
  }

  if (!criteria) {
    return <div className="text-center py-8 text-slate-500">Impossible de charger les critères.</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-900">Critères d'envoi des bulletins aux parents</h3>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Configurez les règles qui déterminent quels élèves reçoivent leur bulletin et dans quelles conditions.
          Ces critères sont appliqués automatiquement lors du clic sur « Envoyer aux parents ».
        </p>

        {/* Section 1: Conditions financières */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-100">
            Conditions financières
          </h4>
          <div className="space-y-3">
            <ToggleRow
              label="Bloquer si arriérés de scolarité impayés"
              description="Les élèves dont le compte présente des arriérés ne recevront pas leur bulletin."
              checked={criteria.blockIfArrears}
              onChange={(v) => setCriteria({ ...criteria, blockIfArrears: v })}
            />
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">Pourcentage minimum de paiement</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Les élèves doivent avoir payé au moins ce pourcentage de leur scolarité pour recevoir le bulletin.
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={criteria.minPaymentPercentage}
                  onChange={(e) => setCriteria({ ...criteria, minPaymentPercentage: parseInt(e.target.value) })}
                  className="w-32 accent-blue-600"
                />
                <span className="font-bold text-blue-700 text-sm w-12 text-right">{criteria.minPaymentPercentage}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">Jours de rappel avant blocage</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nombre de jours avant l'envoi pour rappeler aux parents en retard de paiement.
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={90}
                value={criteria.reminderDaysBeforeBlock}
                onChange={(e) => setCriteria({ ...criteria, reminderDaysBeforeBlock: parseInt(e.target.value) || 0 })}
                className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Signatures requises */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-100">
            Signatures requises
          </h4>
          <div className="space-y-3">
            <ToggleRow
              label="Exiger la signature du Directeur"
              description="Les bulletins ne peuvent être envoyés aux parents qu'après signature du directeur."
              checked={criteria.requireDirectorSignature}
              onChange={(v) => setCriteria({ ...criteria, requireDirectorSignature: v })}
            />
            <ToggleRow
              label="Exiger la signature de l'Enseignant"
              description="Les bulletins ne peuvent être envoyés aux parents qu'après signature de l'enseignant titulaire."
              checked={criteria.requireTeacherSignature}
              onChange={(v) => setCriteria({ ...criteria, requireTeacherSignature: v })}
            />
          </div>
        </div>

        {/* Section 3: Envoi et notification */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-100">
            Envoi et notification
          </h4>
          <div className="space-y-3">
            <ToggleRow
              label="Envoi automatique après signature de l'enseignant"
              description="Les bulletins sont automatiquement envoyés aux parents dès que l'enseignant signe (sans attendre le clic manuel)."
              checked={criteria.autoSendAfterTeacherSign}
              onChange={(v) => setCriteria({ ...criteria, autoSendAfterTeacherSign: v })}
            />
            <ToggleRow
              label="Autoriser le téléchargement par les parents"
              description="Les parents peuvent télécharger le PDF du bulletin depuis leur interface."
              checked={criteria.allowDownloadByParents}
              onChange={(v) => setCriteria({ ...criteria, allowDownloadByParents: v })}
            />
            <ToggleRow
              label="Notifier les parents à l'envoi"
              description="Un email/SMS est envoyé aux parents lors de la mise à disposition du bulletin."
              checked={criteria.notifyParentOnSend}
              onChange={(v) => setCriteria({ ...criteria, notifyParentOnSend: v })}
            />
          </div>
        </div>

        {/* Section 4: Message personnalisé */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-100">
            Message personnalisé (optionnel)
          </h4>
          <textarea
            value={criteria.customMessage || ''}
            onChange={(e) => setCriteria({ ...criteria, customMessage: e.target.value })}
            placeholder="Message accompagnant le bulletin lors de l'envoi aux parents (ex: informations sur la réunion parents-professeurs, dates de reprise, etc.)"
            rows={3}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2.5"
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</> : <><Save className="w-4 h-4 mr-2" />Enregistrer les critères</>}
          </Button>
        </div>

        {criteria.isDefault && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Les valeurs par défaut sont actuellement utilisées. Modifiez et enregistrez pour personnaliser.
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label, description, checked, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4',
          checked ? 'bg-blue-600' : 'bg-slate-300')}
      >
        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}

// ─── Received Bulletins Tab (for teachers) ──────────────────────────────────

function ReceivedBulletinsTab({ tenantId, academicYearId, user }: { tenantId?: string; academicYearId?: string; user?: any }) {
  const [bulletins, setBulletins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [showSignModal, setShowSignModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load periods
  useEffect(() => {
    if (!academicYearId) return;
    fetch(`/api/settings/academic-years/${academicYearId}/periods`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setPeriods(list);
        if (list.length > 0 && !selectedPeriodId) setSelectedPeriodId(list[0].id);
      })
      .catch(() => setPeriods([]));
  }, [academicYearId]);

  // Load received bulletins
  const loadBulletins = useCallback(async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/institutional-exams/bulletins/teacher-bulletins?periodId=${selectedPeriodId}`);
      setBulletins(res.data?.bulletins || []);
    } catch { setBulletins([]); }
    finally { setLoading(false); }
  }, [selectedPeriodId]);

  useEffect(() => { loadBulletins(); }, [loadBulletins]);

  const handleSignAll = async () => {
    if (!signature || bulletins.length === 0) return;
    setActionLoading(true);
    try {
      // Sign all bulletins — use the first student's class
      const firstBulletin = bulletins[0];
      // Find classId from first student
      const classRes = await apiClient.get(`/institutional-exams/bulletins/annotations?studentId=${firstBulletin.studentId}&periodId=${selectedPeriodId}`);
      // Use a class-level sign endpoint
      // We need to find the class — use the workflow endpoint
      // For now, sign each bulletin individually via the annotations endpoint
      // Actually, we need to use teacher-sign which requires classId
      // Let's find the class from the student's enrollment
      const enrollRes = await apiClient.get(`/api/students/${firstBulletin.studentId}/enrollment?academicYearId=${academicYearId}`);
      const classId = enrollRes.data?.classId;
      if (!classId) {
        toastError('Erreur', { description: 'Impossible de déterminer la classe' });
        return;
      }
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/teacher-sign`, {
        periodId: selectedPeriodId,
        signature,
      });
      toastSuccess('Bulletins signés', { description: `${bulletins.length} bulletin(s) signé(s) par l'enseignant.` });
      setShowSignModal(false);
      setSignature(null);
      loadBulletins();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const handleReturn = async () => {
    if (bulletins.length === 0) return;
    setActionLoading(true);
    try {
      const firstBulletin = bulletins[0];
      const enrollRes = await apiClient.get(`/api/students/${firstBulletin.studentId}/enrollment?academicYearId=${academicYearId}`);
      const classId = enrollRes.data?.classId;
      if (!classId) {
        toastError('Erreur', { description: 'Impossible de déterminer la classe' });
        return;
      }
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/teacher-return`, {
        periodId: selectedPeriodId,
      });
      toastSuccess('Bulletins renvoyés', { description: 'Les bulletins sont de retour chez le directeur.' });
      loadBulletins();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const allSigned = bulletins.length > 0 && bulletins.every(b => b.status === 'TEACHER_SIGNED');
  const hasDistributed = bulletins.some(b => b.status === 'TEACHER_DISTRIBUTED');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">Bulletins reçus du Directeur</h3>
          </div>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="text-sm border border-gray-200 bg-gray-50 rounded-lg py-2 px-3"
          >
            <option value="">— Période —</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : bulletins.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600 font-medium">Aucun bulletin reçu</p>
            <p className="text-sm text-gray-400 mt-1">Les bulletins distribués par le directeur apparaîtront ici.</p>
          </div>
        ) : (
          <>
            {/* Summary + Actions */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex gap-2 text-xs">
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                  {bulletins.length} bulletin(s)
                </span>
                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                  {bulletins.filter(b => b.status === 'TEACHER_DISTRIBUTED').length} à signer
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                  {bulletins.filter(b => b.status === 'TEACHER_SIGNED').length} signé(s)
                </span>
              </div>
              <div className="flex gap-2">
                {hasDistributed && !allSigned && (
                  <Button onClick={() => setShowSignModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                    <PenTool className="w-4 h-4 mr-2" /> Signer tous les bulletins
                  </Button>
                )}
                {allSigned && (
                  <Button onClick={handleReturn} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
                    {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo className="w-4 h-4 mr-2" />}
                    Renvoyer au directeur
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Élève</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Matricule</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Statut</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Distribué le</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Signé le</th>
                  </tr>
                </thead>
                <tbody>
                  {bulletins.map((b) => (
                    <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-800">{b.studentName}</td>
                      <td className="py-2 px-3 text-gray-500">{b.matricule || '—'}</td>
                      <td className="py-2 px-3">
                        {b.status === 'TEACHER_DISTRIBUTED' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">À signer</span>
                        ) : b.status === 'TEACHER_SIGNED' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Signé</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{b.status}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">
                        {b.distributedAt ? new Date(b.distributedAt).toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">
                        {b.teacherSignedAt ? new Date(b.teacherSignedAt).toLocaleString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Sign Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Signature — Enseignant(e)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cette signature sera appliquée à <strong>tous les bulletins reçus</strong> sans exception.
            </p>
            <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 mb-4">
              <SignatureCanvas
                width={340}
                height={120}
                onSignatureChange={setSignature}
                placeholder="Signez ici"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowSignModal(false); setSignature(null); }} className="text-sm">Annuler</Button>
              <Button
                onClick={handleSignAll}
                disabled={!signature || actionLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Valider la signature
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
