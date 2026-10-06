'use client';

/**
 * ============================================================================
 * PROCÈS-VERBAL — Module Examen
 * ============================================================================
 *
 * Onglet Procès-verbal avec 3 sous-onglets :
 *   1. PV d'évaluation — pour une seule évaluation
 *   2. PV trimestriel — données trimestrielles consolidées
 *   3. PV annuel — données annuelles
 *
 * Interface :
 *   - Sélecteur classe + période/évaluation
 *   - Filtre : ordre alphabétique / ordre de mérite
 *   - Grand tableau principal : Matricule | Nom | [Matières dynamiques:
 *     nom + coefficient en sous-titre, moyenne de l'élève] | Total |
 *     Coefficient | Moyenne | Rang
 *   - 2 petits tableaux en bas : 3 premiers + 3 derniers
 *   - Génération PDF
 *
 * Compatible primaire, secondaire. Maternelle = qualitatif (adapté).
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScrollText, Loader2, Download, Users, Award, TrendingUp,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import apiClient from '@/lib/api/client';
import { EXAMS_SUB_MODULES } from '@/app/app/exams/sub-modules';
import { useExamSubModules, useExamScope } from '@/app/app/exams/layout';
import { filterClassesForLevel, matchesLevelLanguage } from '@/app/app/exams/level-isolation';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ─── Pedagogical class ordering ──────────────────────────────────────────
const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (let i = 0; i < PEDAGOGICAL_ORDER.length; i++) {
    if (upper.startsWith(PEDAGOGICAL_ORDER[i])) return i;
  }
  return PEDAGOGICAL_ORDER.length;
};

// ─── Types ────────────────────────────────────────────────────────────────
interface SubjectInfo { id: string; name: string; code?: string; abbreviation?: string; coefficient?: number; }
interface StudentRow {
  id: string;
  matricule: string;
  name: string;
  gender?: string;
  subjectScores: Record<string, number | null>;
  total: number;
  totalCoef: number;
  moyenne: number | null;
  rang: number;
}

type PVMode = 'evaluation' | 'trimestriel' | 'annuel';
type SortMode = 'alphabetique' | 'merite';

export default function ProcVerbalWorkspace() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  const isMaternelle = scopeLevel === 'MATERNELLE';

  // ⭐ Dériver schoolLevelUuid depuis scopeLevel (même pattern que bulletins)
  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find((l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL');
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  const [pvMode, setPvMode] = useState<PVMode>('evaluation');
  const [sortMode, setSortMode] = useState<SortMode>('merite');
  const [classes, setClasses] = useState<any[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [periods, setPeriods] = useState<any[]>([]);
  const [evalTypes, setEvalTypes] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedEvalTypeId, setSelectedEvalTypeId] = useState<string>('');
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const subModules = useExamSubModules(EXAMS_SUB_MODULES);
  const examScope = useExamScope();

  // ── Load classes ──
  useEffect(() => {
    if (!academicYear?.id || !schoolLevelUuid) return;
    (async () => {
      try {
        const res = await fetch(`/api/all-classes?academicYearId=${academicYear.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const all = Array.isArray(data) ? data : [];
          const filtered = filterClassesForLevel(all, schoolLevelUuid, scopeLang);
          filtered.sort((a: any, b: any) => {
            const idxA = pedagogicalSortIndex(a.name);
            const idxB = pedagogicalSortIndex(b.name);
            if (idxA !== idxB) return idxA - idxB;
            return (a.name || '').localeCompare(b.name || '', 'fr');
          });
          setClasses(filtered);
          if (filtered.length > 0 && !selectedClassId) setSelectedClassId(filtered[0].id);
        }
      } catch { setClasses([]); }
    })();
  }, [academicYear?.id, schoolLevelUuid, scopeLang]);

  // ── Load periods ──
  useEffect(() => {
    if (!academicYear?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.items || []);
          setPeriods(list);
          if (list.length > 0 && !selectedPeriodId) setSelectedPeriodId(list[0].id);
        }
      } catch { setPeriods([]); }
    })();
  }, [academicYear?.id]);

  // ── Load evaluation types ──
  useEffect(() => {
    if (!schoolLevelUuid) return;
    (async () => {
      try {
        const types = await institutionalExamsService.getEvaluationTypes(schoolLevelUuid);
        const list = Array.isArray(types) ? types : [];
        setEvalTypes(list);
        // ⭐ FIX 2026-09-29 — première évaluation sélectionnée par défaut
        // (exigence promoteur : « lorsque la classe est sélectionnée, le trimestre
        // est sélectionné, par défaut la première évaluation soit sélectionnée par
        // défaut pour n'importe quel niveau scolaire »).
        if (list.length > 0 && !selectedEvalTypeId) setSelectedEvalTypeId(list[0].id);
      } catch { setEvalTypes([]); }
    })();
  }, [schoolLevelUuid, selectedEvalTypeId]);

  // ── Load PV data ──
  //    ⭐ FIX 2026-09-29 — PV annuel ≠ PV trimestriel :
  //    Avant : tous les modes filtraient par `period?.id === selectedPeriodId`,
  //    donc PV annuel == PV trimestriel (bug). Désormais :
  //      • « evaluation »  → filtre par period + eval type (1 évaluation)
  //      • « trimestriel » → filtre par period uniquement (toutes eval types)
  //      • « annuel »       → AUCUN filtre période (regroupe les 3 trimestres,
  //                         notes annuelles consolidées)
  const loadPV = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    if (pvMode === 'evaluation' && !selectedEvalTypeId) return;
    if (pvMode !== 'annuel' && !selectedPeriodId) return;
    setLoading(true);
    try {
      // Fetch validated evaluations
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      // Filter by period + eval type selon le mode
      let filtered = allEvals;
      if (pvMode === 'annuel') {
        // Toutes les évaluations de l'année (3 trimestres regroupés)
        // → pas de filtre period
      } else {
        filtered = allEvals.filter((ev: any) => ev.period?.id === selectedPeriodId);
        if (pvMode === 'evaluation') {
          filtered = filtered.filter((ev: any) => ev.evaluationType?.id === selectedEvalTypeId);
        }
        // trimestriel → on garde tous les eval types du trimestre
      }

      // Filter by language
      const langFiltered = scopeLang
        ? filtered.filter((ev: any) => {
            const lang = ev.subject?.language;
            return !lang || lang === scopeLang || lang === 'FR';
          })
        : filtered;

      // Build subjects list
      const subjList: SubjectInfo[] = [];
      const seenIds = new Set<string>();
      for (const ev of langFiltered) {
        if (ev.subject?.id && !seenIds.has(ev.subject.id)) {
          subjList.push({
            id: ev.subject.id,
            name: ev.subject.name,
            code: ev.subject.code,
            abbreviation: ev.subject.abbreviation,
            coefficient: typeof ev.subject.coefficient === 'number' ? ev.subject.coefficient : 1,
          });
          seenIds.add(ev.subject.id);
        }
      }
      setSubjects(subjList);

      // Fetch grades in batch
      const sheetsMap = await institutionalExamsService
        .getGradingSheetsBatch(langFiltered.map((ev: any) => ev.id))
        .catch(() => ({}));

      // Build student rows
      //    ⭐ 2026-10-06 — EN track trimestriel: subject score = CA1 + CA2 + Exam
      //    (total /100), NOT average. We accumulate components separately
      //    (FCA/SCA/EXAM) and sum them at the end — identical to Report Card.
      //    FR track: accumulation sum/count, average = sum / count.
      const studentMap = new Map<string, StudentRow>();
      // FR: accumulator (sum, count) per subjectId
      const accumMap = new Map<string, Record<string, { sum: number; count: number }>>();
      // ⭐ EN: accumulator per component (fca, sca, exam) per subjectId
      const enAccumMap = new Map<string, Record<string, { fca: number | null; sca: number | null; exam: number | null }>>();

      // ⭐ EN: map eval type code → component
      const enComponentForCode = (code: string): 'fca' | 'sca' | 'exam' | null => {
        const c = (code || '').toUpperCase();
        if (c === 'FCA' || c === 'FIRST_CA') return 'fca';
        if (c === 'SCA' || c === 'SECOND_CA') return 'sca';
        if (c === 'EXAM' || c === 'EXAMINATION') return 'exam';
        return null;
      };

      for (const ev of langFiltered) {
        const grades = sheetsMap[ev.id] || [];
        const subjectId = ev.subject?.id;
        if (!subjectId) continue;

        for (const grade of grades) {
          if (!studentMap.has(grade.studentId)) {
            studentMap.set(grade.studentId, {
              id: grade.studentId,
              matricule: grade.matricule || '',
              name: grade.studentName || 'Inconnu',
              gender: grade.gender,
              subjectScores: {},
              total: 0,
              totalCoef: 0,
              moyenne: null,
              rang: 0,
            });
            accumMap.set(grade.studentId, {});
            enAccumMap.set(grade.studentId, {});
          }
          const st = studentMap.get(grade.studentId)!;
          const acc = accumMap.get(grade.studentId)!;
          const enAcc = enAccumMap.get(grade.studentId)!;
          const score = grade.isAbsent ? null : (grade.score !== null ? Number(grade.score) : null);

          if (pvMode === 'evaluation') {
            // 1 seule évaluation → on prend la note telle quelle
            st.subjectScores[subjectId] = score;
          } else if (isEN) {
            // ⭐ EN: accumulate components (FCA, SCA, EXAM) separately
            const comp = enComponentForCode(ev.evaluationType?.code || '');
            if (comp && score !== null) {
              if (!enAcc[subjectId]) enAcc[subjectId] = { fca: null, sca: null, exam: null };
              if (enAcc[subjectId][comp] === null) {
                enAcc[subjectId][comp] = score;
              }
            } else if (!enAcc[subjectId]) {
              enAcc[subjectId] = { fca: null, sca: null, exam: null };
            }
          } else {
            // FR trimestriel / annuel → accumulation sum/count
            if (score !== null) {
              if (!acc[subjectId]) acc[subjectId] = { sum: 0, count: 0 };
              acc[subjectId].sum += score;
              acc[subjectId].count += 1;
            } else if (!acc[subjectId]) {
              acc[subjectId] = { sum: 0, count: 0 };
            }
          }
        }
      }

      // Finalize subject scores
      if (pvMode !== 'evaluation') {
        for (const [studentId] of accumMap.entries()) {
          const st = studentMap.get(studentId)!;
          if (isEN) {
            // ⭐ EN: subject score = FCA + SCA + EXAM (total /100)
            const enAcc = enAccumMap.get(studentId)!;
            for (const [subjectId, comps] of Object.entries(enAcc)) {
              if (comps.fca === null && comps.sca === null && comps.exam === null) {
                st.subjectScores[subjectId] = null;
              } else {
                st.subjectScores[subjectId] = (comps.fca ?? 0) + (comps.sca ?? 0) + (comps.exam ?? 0);
              }
            }
          } else {
            // FR: moyenne = sum / count
            const acc = accumMap.get(studentId)!;
            for (const [subjectId, { sum, count }] of Object.entries(acc)) {
              st.subjectScores[subjectId] = count > 0 ? sum / count : null;
            }
          }
        }
      }

      // Calculate totals + moyenne
      //    ⭐ 2026-10-06 — EN: subject scores are already /100 totals (CA1+CA2+Exam).
      //    General average = sum of subject totals / number of subjects. No coefficient.
      //    FR: moyenne = total / totalCoef (with coefficient).
      const rows = Array.from(studentMap.values());
      for (const st of rows) {
        let total = 0;
        let totalCoef = 0;
        let validCount = 0;
        for (const subj of subjList) {
          const score = st.subjectScores[subj.id];
          if (typeof score === 'number' && !isNaN(score)) {
            if (isEN) {
              total += score;
              validCount++;
            } else {
              const coef = subj.coefficient ?? 1;
              total += score * coef;
              totalCoef += coef;
              validCount++;
            }
          }
        }
        st.total = total;
        st.totalCoef = isEN ? validCount : totalCoef;
        st.moyenne = isEN
          ? (validCount > 0 ? total / validCount : null)
          : (totalCoef > 0 ? total / totalCoef : null);
      }

      // Calculate ranks (by moyenne descending, ex-aequo handled)
      const ranked = [...rows].sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
      let lastRank = 0;
      let lastVal: number | null = null;
      ranked.forEach((st, i) => {
        const r = (i > 0 && st.moyenne === lastVal) ? lastRank : i + 1;
        lastRank = r;
        lastVal = st.moyenne;
        st.rang = r;
      });

      setStudents(rows);
    } catch (err) {
      console.error('PV load error:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedPeriodId, selectedEvalTypeId, academicYear?.id, pvMode, scopeLang]);

  useEffect(() => { loadPV(); }, [loadPV]);

  // ── Sorted students ──
  const sortedStudents = useMemo(() => {
    if (sortMode === 'alphabetique') {
      return [...students].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return [...students].sort((a, b) => a.rang - b.rang);
  }, [students, sortMode]);

  const top3 = useMemo(() => [...students].sort((a, b) => a.rang - b.rang).slice(0, 3), [students]);
  const bottom3 = useMemo(() => [...students].sort((a, b) => b.rang - a.rang).slice(0, 3), [students]);

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';
  const selectedPeriodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
  const selectedEvalTypeName = evalTypes.find(t => t.id === selectedEvalTypeId)?.name || '';
  // ⭐ En mode annuel : on affiche « Année scolaire » au lieu du trimestre
  const periodLabel = pvMode === 'annuel' ? (academicYear?.label || 'Année scolaire') : selectedPeriodName;

  // ── Generate PDF (calls backend /institutional-exams/pv-stats-promotion/proces-verbal) ──
  //    A4 paysage + en-tête officiel + tableau principal + 3 premiers/derniers + pied de page.
  const handleGeneratePdf = async () => {
    if (!selectedClassId || students.length === 0) {
      alert('Veuillez sélectionner une classe et avoir des données à exporter.');
      return;
    }
    setGeneratingPdf(true);
    try {
      const payload = {
        academicYearName: academicYear?.label || '',
        periodName: periodLabel,
        evalTypeName: pvMode === 'evaluation' ? selectedEvalTypeName : undefined,
        className: selectedClassName,
        pvMode,
        sortMode,
        subjects: subjects.map(s => ({
          id: s.id,
          name: s.name,
          abbreviation: (s as any).abbreviation || null,
          code: (s as any).code || null,
          coefficient: s.coefficient ?? 1,
        })),
        students: students.map(st => ({
          id: st.id,
          matricule: st.matricule,
          name: st.name,
          gender: st.gender,
          subjectScores: st.subjectScores,
          total: st.total,
          totalCoef: st.totalCoef,
          moyenne: st.moyenne,
          rang: st.rang,
        })),
        top3,
        bottom3,
        scopeLang: scopeLang || 'FR',
        scopeLevel: scopeLevel || null,
      };

      // ⭐ 2026-09-30 — FIX : utiliser apiClient (axios avec baseURL) au lieu de
      //    fetch (qui allait vers Next.js au lieu du backend → pas de route BFF
      //    → 404 → "Échec de chargement du document PDF").
      const response = await apiClient.post('/institutional-exams/pv-stats-promotion/proces-verbal', payload, {
        responseType: 'blob',
        timeout: 120000,
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeClass = selectedClassName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const safePeriod = periodLabel.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const prefix = pvMode === 'annuel' ? 'pv_annuel' : pvMode === 'trimestriel' ? 'pv_trimestriel' : 'pv_evaluation';
      link.download = `${prefix}_${safeClass}_${safePeriod}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erreur lors de la génération du PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <ModuleContainer
      header={{ title: isEN ? 'Proceedings' : 'Procès-verbal', description: isEN ? 'Quarterly and annual proceedings' : "Procès-verbal d'évaluation, trimestriel et annuel", icon: 'scrollText' }}
      subModules={{ modules: subModules, activeModuleId: 'proc-verbal' }}
      content={{
        layout: 'full',
        children: (
      <div className="space-y-4">
        {/* Header + selectors */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          {/* PV mode tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            {[
              { id: 'evaluation' as PVMode, label: 'PV d\'évaluation' },
              { id: 'trimestriel' as PVMode, label: 'PV trimestriel' },
              { id: 'annuel' as PVMode, label: 'PV annuel' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPvMode(tab.id)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  pvMode === tab.id ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Selectors */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Classe</label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[150px]"
              >
                <option value="">— Sélectionner —</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* ⭐ FIX 2026-09-29 — sélecteur période masqué en mode annuel
                (regroupe déjà les 3 trimestres, pas de sens à filtrer) */}
            {pvMode !== 'annuel' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Période</label>
                <select
                  value={selectedPeriodId}
                  onChange={e => setSelectedPeriodId(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[150px]"
                >
                  <option value="">— Sélectionner —</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            {pvMode === 'evaluation' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Évaluation</label>
                <select
                  value={selectedEvalTypeId}
                  onChange={e => setSelectedEvalTypeId(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[150px]"
                >
                  <option value="">— Sélectionner —</option>
                  {evalTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Classement</label>
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[150px]"
              >
                <option value="merite">Ordre de mérite</option>
                <option value="alphabetique">Ordre alphabétique</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-slate-500">
            Aucune donnée disponible. Sélectionnez une classe et une période.
          </div>
        ) : (
          <>
            {/* Grand tableau principal */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  {isEN ? 'Proceedings' : 'Procès-verbal'} — {isEN ? translateClassName(selectedClassName) : selectedClassName} — {periodLabel}
                  {pvMode === 'evaluation' && selectedEvalTypeName ? ` — ${selectedEvalTypeName}` : ''}
                </h3>
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {students.length} élèves
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="text-xs whitespace-nowrap" rowSpan={2}>Matricule</TableHead>
                    <TableHead className="text-xs whitespace-nowrap" rowSpan={2}>Nom et prénoms</TableHead>
                    {subjects.map(subj => {
                      // ⭐ Abréviation (priorité : abbreviation école > code > mapping auto)
                      const abbr = subj.abbreviation || (subj.code ? (subj.code.match(/^([A-Z]{2,6})/)?.[1] || subj.name) : null) || subj.name;
                      return (
                      <TableHead key={subj.id} className="text-xs text-center whitespace-nowrap min-w-[60px]">
                        <div className="font-bold" title={subj.name}>{abbr}</div>
                        <div className="font-normal text-[9px] text-slate-500">Coef: {subj.coefficient ?? 1}</div>
                      </TableHead>
                      );
                    })}
                    <TableHead className="text-xs text-center whitespace-nowrap" rowSpan={2}>Total</TableHead>
                    <TableHead className="text-xs text-center whitespace-nowrap" rowSpan={2}>Coef</TableHead>
                    <TableHead className="text-xs text-center whitespace-nowrap" rowSpan={2}>Moyenne</TableHead>
                    <TableHead className="text-xs text-center whitespace-nowrap" rowSpan={2}>Rang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudents.map((st, idx) => (
                    <TableRow key={st.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : undefined}>
                      <TableCell className="text-xs whitespace-nowrap">{st.matricule || '—'}</TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{st.name}</TableCell>
                      {subjects.map(subj => {
                        const score = st.subjectScores[subj.id];
                        return (
                          <TableCell key={subj.id} className="text-xs text-center">
                            {typeof score === 'number' && !isNaN(score) ? (
                              <span className={score >= 10 ? 'text-slate-900 font-semibold' : 'text-red-600 font-semibold'}>
                                {score.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-xs text-center font-bold">{st.total.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-center font-bold text-amber-700">{st.totalCoef}</TableCell>
                      <TableCell className={cn('text-xs text-center font-bold', st.moyenne !== null && st.moyenne >= 10 ? 'text-emerald-700' : 'text-red-600')}>
                        {st.moyenne !== null ? st.moyenne.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-center font-bold">{st.rang}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 2 petits tableaux : 3 premiers + 3 derniers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 3 premiers */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-emerald-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <Award className="w-4 h-4" /> Trois premiers
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs">Matricule</TableHead>
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs text-center">Moyenne</TableHead>
                      <TableHead className="text-xs text-center">Rang</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top3.map((st, idx) => (
                      <TableRow key={st.id}>
                        <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{st.name}</TableCell>
                        <TableCell className="text-xs text-center font-bold text-emerald-700">{st.moyenne?.toFixed(2) ?? '—'}</TableCell>
                        <TableCell className="text-xs text-center font-bold">{st.rang}</TableCell>
                      </TableRow>
                    ))}
                    {top3.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-slate-400 text-xs py-4">Aucune donnée</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 3 derniers */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-red-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-red-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 rotate-180" /> Trois derniers
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs">Matricule</TableHead>
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs text-center">Moyenne</TableHead>
                      <TableHead className="text-xs text-center">Rang</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bottom3.map((st, idx) => (
                      <TableRow key={st.id}>
                        <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{st.name}</TableCell>
                        <TableCell className="text-xs text-center font-bold text-red-600">{st.moyenne?.toFixed(2) ?? '—'}</TableCell>
                        <TableCell className="text-xs text-center font-bold">{st.rang}</TableCell>
                      </TableRow>
                    ))}
                    {bottom3.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-slate-400 text-xs py-4">Aucune donnée</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Bouton génération PDF */}
            <div className="flex justify-end">
              <Button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {generatingPdf ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {generatingPdf ? 'Génération…' : 'Générer PDF'}
              </Button>
            </div>
          </>
        )}
      </div>
        ),
      }}
    />
  );
}
