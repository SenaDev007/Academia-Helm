'use client';

/**
 * ============================================================================
 * MODULE EXAMENS — RÉCAPITULATIF TRIMESTRIEL (⭐ V10g — piste anglophone)
 * ============================================================================
 *
 * Onglet « Termly Recap » (à côté du « Grades Register ») — Nursery & Primary.
 *
 * Règle métier (confirmée par l'utilisateur) :
 *   Dans chaque trimestre (T1, T2 ou T3) :
 *     - First CA      : noté /20
 *     - Second CA     : noté /20
 *     - Examination   : noté /60
 *   Récapitulatif trimestriel par matière : First CA + Second CA + Examination
 *   = 20 + 20 + 60 = /100.
 *
 * Affiche EXACTEMENT le même tableau que l'onglet « Grade Register » /
 * broadsheet « Examination Results » (page 1 du modèle PDF nigérian) :
 *   No | NAMES OF SCHOLARS | matières (/100) | AVERAGE | POSITION | TOTAL
 *   + lignes MARKS OBTAINABLE / MARKS OBTAINED AVANT la liste des élèves.
 * Chaque cellule matière = CA1 + CA2 + Exam de l'élève (infobulle du détail
 * des 3 composantes). Lecture seule — la saisie se fait dans « Grading ».
 *
 * Flux :
 *   1. Sélection de la classe (auto-sélection de la première)
 *   2. Sélection du trimestre (auto-sélection du trimestre courant)
 *   3. Chargement des évaluations EN de la classe (tous statuts sauf CANCELLED)
 *      → regroupement par composante (CA1 / CA2 / EXAM) pour le trimestre choisi
 *   4. Chargement des notes de chaque évaluation → agrégation par élève × matière
 * ============================================================================
 */

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import {
  Loader2, Calculator, AlertCircle, Users, BookOpen,
  Search, Info, CheckCircle2,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { getAcademicYearPeriods } from '@/services/settings.service';
import apiClient from '@/lib/api/client';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { filterClassesForLevel } from '../level-isolation';
import {
  enComponentForCode, EN_TERM_TOTAL_PER_SUBJECT,
  translatePeriodName,
} from '@/lib/exam-anglophone-config';
import { cn } from '@/lib/utils';

// Ordre d'affichage pédagogique des classes (miroir de la page registre)
const PEDAGOGICAL_ORDER = ['NURSERY 1', 'NURSERY 2', 'NURSERY 3', 'PRIMARY 1', 'PRIMARY 2', 'PRIMARY 3', 'PRIMARY 4', 'PRIMARY 5', 'PRIMARY 6', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];

const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (const prefix of PEDAGOGICAL_ORDER) {
    if (upper.startsWith(prefix)) return PEDAGOGICAL_ORDER.indexOf(prefix);
  }
  return PEDAGOGICAL_ORDER.length;
};

// ─── Types locaux ────────────────────────────────────────────────────────────

interface RecSubject {
  id: string;
  name: string;
}

/** Notes d'un élève pour une matière : les 3 composantes du trimestre */
interface TermScore {
  CA1: number | null;
  CA2: number | null;
  EXAM: number | null;
  /** Au moins une composante saisie */
  hasAny: boolean;
  /** Composantes attendues mais encore sans aucune évaluation/note */
  isAbsent: boolean;
}

interface TermRow {
  studentId: string;
  studentName: string;
  matricule?: string;
  gender?: string;
  scores: Record<string, TermScore>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TermRecapPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);

  return (
    <ModuleContainer
      header={{
        title: 'Récapitulatif trimestriel',
        description: 'Piste anglophone — First CA /20 + Second CA /20 + Examination /60 = /100 par matière.',
        icon: 'calculator',
      }}
      subModules={{
        modules: scopedSubModules,
        activeModuleId: 'term-recap',
      }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
            <TermRecapContent />
          </Suspense>
        ),
      }}
    />
  );
}

// ─── Content (client component with useSearchParams) ────────────────────────

function TermRecapContent() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  const language = (scopeLang || 'FR') as 'FR' | 'EN';
  const isEN = language === 'EN';

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [evalsLoading, setEvalsLoading] = useState(false);

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find(
      (l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL'
    );
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  // ── Load classes (isolation niveau + piste, ordre pédagogique) ─────────────
  const loadClasses = useCallback(async () => {
    if (!schoolLevelUuid) return;
    try {
      const res = await fetch('/api/all-classes', { credentials: 'include' });
      const data = await res.json();
      const allClasses = Array.isArray(data) ? data : (data?.items || []);
      const langClasses = filterClassesForLevel(allClasses, schoolLevelUuid, language);
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
    }
  }, [schoolLevelUuid, language, selectedClassId]);

  // ── Load periods (trimestres de l'année active) ─────────────────────────────
  useEffect(() => {
    if (!academicYear?.id) return;
    (async () => {
      try {
        const res = await getAcademicYearPeriods(academicYear.id);
        const list = Array.isArray(res) ? res : [];
        setPeriods(list);
        // ⭐ Auto-sélection du trimestre COURANT (dont les dates englobent
        // aujourd'hui), sinon le premier trimestre.
        const now = new Date();
        const current = list.find((p: any) => {
          const s = p.startDate ? new Date(p.startDate) : null;
          const e = p.endDate ? new Date(p.endDate) : null;
          return s && e && now >= s && now <= e;
        });
        setSelectedPeriodId((prev: string) => prev || (current?.id || list[0]?.id || ''));
      } catch {
        setPeriods([]);
      }
    })();
  }, [academicYear?.id]);

  // ── Load EN evaluations for the selected class (tous statuts sauf annulés) ─
  const loadEvaluations = useCallback(async () => {
    if (!academicYear?.id || !selectedClassId) {
      setEvaluations([]);
      setLoading(false);
      return;
    }
    setEvalsLoading(true);
    try {
      const res = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
      });
      const list = Array.isArray(res) ? res : [];
      // ⭐ Seules les évaluations anglophones (codes CA1/CA2/EXAM) et non annulées
      setEvaluations(list.filter((ev: any) => {
        const code = ev.evaluationType?.code || '';
        if (!enComponentForCode(code)) return false;
        return ev.status !== 'CANCELLED';
      }));
    } catch (err) {
      console.error('Error loading evaluations for term recap', err);
      setEvaluations([]);
    } finally {
      setEvalsLoading(false);
      setLoading(false);
    }
  }, [academicYear?.id, selectedClassId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // ── Regroupement : évaluations du trimestre sélectionné par composante ────
  const periodEvals = useMemo(() => {
    const byComp: Record<'CA1' | 'CA2' | 'EXAM', any[]> = { CA1: [], CA2: [], EXAM: [] };
    if (!selectedPeriodId) return byComp;
    evaluations.forEach((ev: any) => {
      if ((ev.period?.id || '') !== selectedPeriodId) return;
      const comp = enComponentForCode(ev.evaluationType?.code || '');
      if (comp) byComp[comp.key].push(ev);
    });
    return byComp;
  }, [evaluations, selectedPeriodId]);

  const selectedClass = classes.find((c: any) => c.id === selectedClassId);
  const selectedPeriod = periods.find((p: any) => p.id === selectedPeriodId);

  // ── Onglet anglophone uniquement : message d'information pour la piste FR ──
  if (!isEN) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <Calculator className="w-10 h-10 mx-auto mb-3 text-blue-300" />
        <p className="font-semibold text-gray-700">
          Le récapitulatif trimestriel est propre à la piste anglophone.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Sélectionnez un niveau <strong>Nursery</strong> ou <strong>Primary</strong> pour y accéder
          (First CA /20 + Second CA /20 + Examination /60 = /100 par matière).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + selectors */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Termly Recap</h2>
          <Badge variant="outline" className="text-xs">
            {scopeLevel || '—'} · EN
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedClassId}
            onChange={(e) => { setSelectedClassId(e.target.value); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">— Select class —</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">— Select term —</option>
            {periods.map((p: any) => (
              <option key={p.id} value={p.id}>
                {translatePeriodName(p.name, language) || p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Règle de calcul */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800 flex items-start gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Termly total per subject = First CA (/20) + Second CA (/20) + Examination (/60) = /100.</strong>{' '}
          Marks appear here as soon as they are saved in « Grading » (read-only consolidation view).
        </div>
      </div>

      {/* Composantes disponibles */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['CA1', 'CA2', 'EXAM'] as const).map((key) => {
          const comp = enComponentForCode(key === 'CA1' ? 'FIRST_CA' : key === 'CA2' ? 'SECOND_CA' : 'EXAM')!;
          const evs = periodEvals[key];
          return (
            <Badge
              key={key}
              variant="outline"
              className={cn(
                'text-xs gap-1',
                evs.length > 0
                  ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                  : 'border-gray-200 text-gray-400 bg-gray-50',
              )}
            >
              {evs.length > 0 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {comp.label} /{comp.maxScore} · {evs.length > 0 ? `${evs.length} subject(s)` : 'no assessment yet'}
            </Badge>
          );
        })}
      </div>

      {/* Contenu */}
      {!selectedClassId || !selectedPeriodId ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <Calculator className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="font-medium text-gray-500">Select a class and a term to display the recap</p>
        </div>
      ) : evalsLoading || loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading termly recap…</span>
        </div>
      ) : (
        <TermRecapSheet
          classId={selectedClassId}
          className={selectedClass?.name || ''}
          periodId={selectedPeriodId}
          periodName={selectedPeriod?.name || ''}
          periodEvals={periodEvals}
        />
      )}
    </div>
  );
}

// ─── Feuille de récap (tableau broadsheet /100 — lecture seule) ─────────────

function TermRecapSheet({
  classId,
  className,
  periodId,
  periodName,
  periodEvals,
}: {
  classId: string;
  className: string;
  periodId: string;
  periodName: string;
  periodEvals: Record<'CA1' | 'CA2' | 'EXAM', any[]>;
}) {
  const [rows, setRows] = useState<TermRow[]>([]);
  const [subjects, setSubjects] = useState<RecSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Chargement + agrégation des notes des 3 composantes ───────────────────
  useEffect(() => {
    const load = async () => {
      const comps = (['CA1', 'CA2', 'EXAM'] as const);
      const hasAnyEval = comps.some((k) => periodEvals[k].length > 0);
      if (!hasAnyEval) {
        setRows([]);
        setSubjects([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Notes par évaluation : Map<evaluationId, students[]>
        const gradesByEval = new Map<string, any[]>();
        const allEvals = comps.flatMap((k) => periodEvals[k]);
        await Promise.all(allEvals.map(async (ev: any) => {
          try {
            const response = await apiClient.get(`/institutional-exams/grades/evaluation/${ev.id}`);
            gradesByEval.set(ev.id, Array.isArray(response.data) ? response.data : []);
          } catch {
            gradesByEval.set(ev.id, []);
          }
        }));

        // Matières = UNION des matières des évaluations (ordre d'apparition)
        const subjectMap = new Map<string, string>();
        allEvals.forEach((ev: any) => {
          if (ev.subject && !subjectMap.has(ev.subject.id)) {
            subjectMap.set(ev.subject.id, ev.subject.name);
          }
        });
        const subjectList: RecSubject[] = Array.from(subjectMap.entries()).map(([id, name]) => ({ id, name }));

        // Agrégation par élève × matière × composante
        // (logique « première valeur non vide gagne » — robuste aux doublons
        // de session, même règle que GradingSheet V10d)
        const studentMap = new Map<string, TermRow>();
        comps.forEach((compKey) => {
          periodEvals[compKey].forEach((ev: any) => {
            const subjectId = ev.subject?.id;
            if (!subjectId) return;
            const students = gradesByEval.get(ev.id) || [];
            students.forEach((student: any) => {
              if (!studentMap.has(student.studentId)) {
                studentMap.set(student.studentId, {
                  studentId: student.studentId,
                  studentName: student.studentName || 'Unknown',
                  matricule: student.matricule,
                  gender: student.gender,
                  scores: {},
                });
              }
              const row = studentMap.get(student.studentId)!;
              if (!row.scores[subjectId]) {
                row.scores[subjectId] = { CA1: null, CA2: null, EXAM: null, hasAny: false, isAbsent: false };
              }
              const cell = row.scores[subjectId];
              const incomingAbsent = !!student.isAbsent;
              const incomingScore = typeof student.score === 'number' ? student.score : null;
              // Première valeur non vide gagne (doublons de session)
              if (cell[compKey] === null && (incomingScore !== null || incomingAbsent)) {
                cell[compKey] = incomingScore;
                if (incomingAbsent && incomingScore === null) cell.isAbsent = true;
              }
            });
          });
        });

        // Finalisation : hasAny + remplissage des cellules manquantes
        const rowsArray = Array.from(studentMap.values());
        rowsArray.forEach((row) => {
          subjectList.forEach((subj) => {
            const cell = row.scores[subj.id];
            if (!cell) {
              row.scores[subj.id] = { CA1: null, CA2: null, EXAM: null, hasAny: false, isAbsent: false };
              return;
            }
            cell.hasAny = cell.CA1 !== null || cell.CA2 !== null || cell.EXAM !== null;
          });
        });
        rowsArray.sort((a, b) => a.studentName.localeCompare(b.studentName, 'en'));
        setSubjects(subjectList);
        setRows(rowsArray);
      } catch (err) {
        console.error('Error loading term recap sheet', err);
        setRows([]);
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [classId, periodId, periodEvals]);

  // ── Recherche ──────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((r) =>
      r.studentName.toLowerCase().includes(q) ||
      (r.matricule || '').toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // ── Calculs broadsheet (même logique que GradingSheet EN, sur /100) ────────
  const cellTotal = useCallback((cell: TermScore): number | null => {
    if (!cell.hasAny) return null;
    return (cell.CA1 ?? 0) + (cell.CA2 ?? 0) + (cell.EXAM ?? 0);
  }, []);

  const rowTotal = useCallback((row: TermRow): number => {
    return subjects.reduce((sum, subj) => {
      const t = cellTotal(row.scores[subj.id]);
      return sum + (t ?? 0);
    }, 0);
  }, [subjects, cellTotal]);

  const rowAverage = useCallback((row: TermRow): number | null => {
    const scored = subjects.filter((subj) => row.scores[subj.id]?.hasAny);
    if (!scored.length) return null;
    return rowTotal(row) / scored.length;
  }, [subjects, rowTotal]);

  const rankMap = useMemo(() => {
    const totals = filteredRows.map((r) => ({ id: r.studentId, total: rowTotal(r) }));
    totals.sort((a, b) => b.total - a.total);
    const map: Record<string, number> = {};
    let lastTotal: number | null = null;
    let lastRank = 0;
    totals.forEach((t, i) => {
      const rank = lastTotal !== null && t.total === lastTotal ? lastRank : i + 1;
      map[t.id] = rank;
      lastTotal = t.total;
      lastRank = rank;
    });
    return map;
  }, [filteredRows, rowTotal]);

  const subjectMaxOf = useCallback((subjectId: string): number | null => {
    let max: number | null = null;
    rows.forEach((r) => {
      const t = cellTotal(r.scores[subjectId]);
      if (t !== null && (max === null || t > max)) max = t;
    });
    return max;
  }, [rows, cellTotal]);

  // Suffixe ordinal anglais : 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st…
  const formatOrdinalEn = (n: number): string => {
    if (n <= 0) return '—';
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-gray-600">Loading termly recap…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
        <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        <p className="font-medium text-gray-500">No marks recorded for this class and term yet</p>
        <p className="text-xs mt-1 text-gray-400">
          Enter First CA, Second CA and Examination marks in the « Grading » tab — the recap builds itself.
        </p>
      </div>
    );
  }

  const nbSubjects = subjects.length;

  return (
    <div className="space-y-3">
      {/* Recherche */}
      <div className="relative max-w-xs">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search a pupil…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="border-blue-200 text-blue-600 text-xs gap-1">
          <Users className="w-3 h-3" />
          {filteredRows.length} pupil(s)
        </Badge>
        <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
          <BookOpen className="w-3 h-3" />
          {nbSubjects} subject(s)
        </Badge>
        <Badge variant="outline" className="border-amber-200 text-amber-600 text-xs">
          /{EN_TERM_TOTAL_PER_SUBJECT} per subject
        </Badge>
      </div>

      {/* ═══ Tableau broadsheet — même structure que le Grade Register ═══ */}
      <div className="bg-white border-2 border-slate-800 rounded-xl overflow-x-auto">
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-semibold flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Termly recap — read-only consolidation (First CA + Second CA + Examination)
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th
                colSpan={2 + nbSubjects + 3}
                className="border border-slate-700 px-3 py-2 text-center font-black uppercase tracking-wider text-sm"
              >
                {'Termly Recap — ' + (translatePeriodName(periodName, 'EN') || periodName)}
                {' — ' + className}
              </th>
            </tr>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">No</th>
              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase min-w-[180px]">Names of Scholars</th>
              {subjects.map((subject) => (
                <th key={subject.id} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                  {subject.name}
                  <div className="text-[9px] text-slate-400 font-normal">/{EN_TERM_TOTAL_PER_SUBJECT}</div>
                </th>
              ))}
              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-blue-50">Average</th>
              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-violet-50">Position</th>
              <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-emerald-50">Total</th>
            </tr>
            {/* ⭐ MARKS OBTAINABLE — barème par matière — AVANT la liste des élèves (modèle PDF) */}
            <tr className="bg-slate-100 font-bold">
              <th colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right uppercase text-[11px] text-slate-600">Marks Obtainable</th>
              {subjects.map((s) => (
                <th key={`ob-${s.id}`} className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{EN_TERM_TOTAL_PER_SUBJECT}</th>
              ))}
              <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-600 bg-blue-50">{EN_TERM_TOTAL_PER_SUBJECT}</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-400 bg-violet-50">—</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-600 bg-emerald-50">{EN_TERM_TOTAL_PER_SUBJECT * nbSubjects}</th>
            </tr>
            {/* ⭐ MARKS OBTAINED — meilleur total de la classe par matière — AVANT la liste des élèves (modèle PDF) */}
            <tr className="bg-slate-50 font-bold">
              <th colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right uppercase text-[11px] text-slate-600">Marks Obtained</th>
              {subjects.map((s) => {
                const max = subjectMaxOf(s.id);
                return (
                  <th key={`mo-${s.id}`} className="border border-slate-300 px-2 py-1.5 text-center text-slate-700">
                    {max !== null ? Number(max).toFixed(2).replace(/\.00$/, '') : '—'}
                  </th>
                );
              })}
              {(() => {
                const maxes = subjects.map((s) => subjectMaxOf(s.id)).filter((m): m is number => m !== null);
                const sum = maxes.reduce((a, b) => a + b, 0);
                const avg = maxes.length ? sum / maxes.length : null;
                return (
                  <>
                    <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-700 bg-blue-50">{avg !== null ? avg.toFixed(2) : '—'}</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-400 bg-violet-50">—</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-700 bg-emerald-50">{maxes.length ? Number(sum).toFixed(2).replace(/\.00$/, '') : '—'}</th>
                  </>
                );
              })()}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => {
              const total = rowTotal(row);
              const average = rowAverage(row);
              const position = rankMap[row.studentId] || 0;
              const hasAnyScore = subjects.some((subj) => row.scores[subj.id]?.hasAny);
              return (
                <tr
                  key={row.studentId}
                  className={cn(
                    'hover:bg-slate-50 transition-colors',
                    idx % 2 === 1 && 'bg-slate-50/50',
                    !hasAnyScore && 'bg-amber-50/30',
                  )}
                >
                  <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">{row.studentName}</td>
                  {subjects.map((subject) => {
                    const cell = row.scores[subject.id] || { CA1: null, CA2: null, EXAM: null, hasAny: false, isAbsent: false };
                    const t = cellTotal(cell);
                    // Infobulle : détail des 3 composantes (CA1 / CA2 / Exam)
                    const tooltip = cell.hasAny
                      ? `First CA: ${cell.CA1 ?? '—'}/20 · Second CA: ${cell.CA2 ?? '—'}/20 · Exam: ${cell.EXAM ?? '—'}/60`
                      : 'No marks yet';
                    return (
                      <td
                        key={subject.id}
                        title={tooltip}
                        className={cn(
                          'border border-slate-300 px-2 py-1 text-center font-bold cursor-help',
                          t === null && 'text-slate-300 font-normal',
                          t !== null && t < 50 ? 'text-rose-600' : t !== null && t >= 70 ? 'text-emerald-600' : 'text-slate-900',
                        )}
                      >
                        {t !== null ? t.toFixed(2).replace(/\.00$/, '') : '—'}
                      </td>
                    );
                  })}
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                    {average !== null ? average.toFixed(2) : '—'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-violet-700 bg-violet-50">
                    {hasAnyScore ? formatOrdinalEn(position) : '—'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-emerald-700 bg-emerald-50">
                    {hasAnyScore ? total.toFixed(2).replace(/\.00$/, '') : '—'}
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={2 + nbSubjects + 3}
                  className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm"
                >
                  No pupil found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {/* Pied de fiche */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">
            Termly total per subject = First CA (/20) + Second CA (/20) + Examination (/60) = /100
          </span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
            {className} · {translatePeriodName(periodName, 'EN') || periodName}
          </span>
        </div>
      </div>
    </div>
  );
}
