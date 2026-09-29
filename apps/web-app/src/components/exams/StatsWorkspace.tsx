'use client';

/**
 * ============================================================================
 * STATISTIQUES — Module Examen
 * ============================================================================
 *
 * 2 sous-onglets principaux :
 *   1. Statistiques des notes
 *      - Taux de réussite : tableau (matières, effectifs présents G/F/T,
 *        admis G/F/T, % réussite G/F/T, % échec G/F/T) + graphique
 *        (barres : nombre d'admis par matière)
 *      - Intervalle des notes : tableau dénombrement par intervalle
 *        (0-3, 3-7, 7-9, 9-10, 10-12, 12-14, 14-16, 16-20)
 *      - Meilleures notes : tableau hiérarchique par classe
 *        (Matricule | Nom | Classe | Note | Appréciation)
 *
 *   2. Statistiques des moyennes
 *      - Taux de réussite (sur les moyennes)
 *      - Intervalle des moyennes
 *      - Meilleures moyennes (avec filtre top 3, top 5, par classe, par niveau)
 *
 * Compatible primaire, secondaire. Maternelle = qualitatif.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BarChart3, Loader2, Download, TrendingUp, Users,
  Target, Trophy, Filter,
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
import { filterClassesForLevel } from '@/app/app/exams/level-isolation';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ─── Pedagogical ordering ─────────────────────────────────────────────────
const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (let i = 0; i < PEDAGOGICAL_ORDER.length; i++) {
    if (upper.startsWith(PEDAGOGICAL_ORDER[i])) return i;
  }
  return PEDAGOGICAL_ORDER.length;
};

// ─── Grade intervals ──────────────────────────────────────────────────────
const INTERVALS = [
  { label: '0 — 3', min: 0, max: 3 },
  { label: '3 — 7', min: 3, max: 7 },
  { label: '7 — 9', min: 7, max: 9 },
  { label: '9 — 10', min: 9, max: 10 },
  { label: '10 — 12', min: 10, max: 12 },
  { label: '12 — 14', min: 12, max: 14 },
  { label: '14 — 16', min: 14, max: 16 },
  { label: '16 — 20', min: 16, max: 20 },
];

type MainTab = 'notes' | 'moyennes';
type SubTab = 'taux-reussite' | 'intervalle' | 'meilleurs';
type StatMode = 'evaluation' | 'trimestriel' | 'annuel';

export default function StatsWorkspace() {
  const { academicYear, tenant, schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const schoolLevelUuid = schoolLevel?.schoolLevelId || schoolLevel?.id;
  const scopeLevel = availableLevels.find(l => l.id === schoolLevelUuid)?.code || '';
  const scopeLang = availableLevels.find(l => l.id === schoolLevelUuid)?.language || 'FR';
  const isMaternelle = scopeLevel === 'MATERNELLE';

  const [mainTab, setMainTab] = useState<MainTab>('notes');
  const [subTab, setSubTab] = useState<SubTab>('taux-reussite');
  const [statMode, setStatMode] = useState<StatMode>('evaluation');
  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [evalTypes, setEvalTypes] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedEvalTypeId, setSelectedEvalTypeId] = useState<string>('');
  const [topN, setTopN] = useState<number>(3);
  const [loading, setLoading] = useState(false);

  // Data
  const [subjects, setSubjects] = useState<any[]>([]);
  const [gradeData, setGradeData] = useState<Record<string, any[]>>({}); // subjectId → grades[]

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
            return idxA !== idxB ? idxA - idxB : (a.name || '').localeCompare(b.name || '', 'fr');
          });
          setClasses(filtered);
          if (filtered.length > 0) setSelectedClassId(filtered[0].id);
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
          if (list.length > 0) setSelectedPeriodId(list[0].id);
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
        setEvalTypes(Array.isArray(types) ? types : []);
      } catch { setEvalTypes([]); }
    })();
  }, [schoolLevelUuid]);

  // ── Load stats data ──
  const loadStats = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    if (statMode === 'evaluation' && !selectedEvalTypeId) return;
    setLoading(true);
    try {
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      let allEvals = Array.isArray(evaluations) ? evaluations : [];
      let filtered = allEvals.filter((ev: any) => ev.period?.id === selectedPeriodId);
      if (statMode === 'evaluation') {
        filtered = filtered.filter((ev: any) => ev.evaluationType?.id === selectedEvalTypeId);
      }
      const langFiltered = scopeLang
        ? filtered.filter((ev: any) => {
            const lang = ev.subject?.language;
            return !lang || lang === scopeLang || lang === 'FR';
          })
        : filtered;

      const subjList: any[] = [];
      const seenIds = new Set<string>();
      for (const ev of langFiltered) {
        if (ev.subject?.id && !seenIds.has(ev.subject.id)) {
          subjList.push({ id: ev.subject.id, name: ev.subject.name, coefficient: ev.subject.coefficient ?? 1 });
          seenIds.add(ev.subject.id);
        }
      }
      setSubjects(subjList);

      const sheetsMap = await institutionalExamsService
        .getGradingSheetsBatch(langFiltered.map((ev: any) => ev.id))
        .catch(() => ({}));

      const gradeMap: Record<string, any[]> = {};
      for (const ev of langFiltered) {
        const grades = sheetsMap[ev.id] || [];
        const subjectId = ev.subject?.id;
        if (!subjectId) continue;
        if (!gradeMap[subjectId]) gradeMap[subjectId] = [];
        gradeMap[subjectId].push(...grades);
      }
      setGradeData(gradeMap);
    } catch (err) {
      console.error('Stats load error:', err);
      setSubjects([]);
      setGradeData({});
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedPeriodId, selectedEvalTypeId, academicYear?.id, statMode, scopeLang]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Compute: Taux de réussite (per subject) ──
  const successRateData = useMemo(() => {
    return subjects.map(subj => {
      const grades = gradeData[subj.id] || [];
      const present = grades.filter((g: any) => !g.isAbsent);
      const boys = present.filter((g: any) => g.gender === 'M');
      const girls = present.filter((g: any) => g.gender === 'F' || g.gender === 'FEMALE');
      const admitted = present.filter((g: any) => typeof g.score === 'number' && g.score >= 10);
      const admittedBoys = admitted.filter((g: any) => g.gender === 'M');
      const admittedGirls = admitted.filter((g: any) => g.gender === 'F' || g.gender === 'FEMALE');
      const total = present.length;
      const passRate = total > 0 ? (admitted.length / total) * 100 : 0;
      const failRate = total > 0 ? ((total - admitted.length) / total) * 100 : 0;
      return {
        subjectName: subj.name,
        present: { boys: boys.length, girls: girls.length, total },
        admitted: { boys: admittedBoys.length, girls: admittedGirls.length, total: admitted.length },
        passRate: {
          boys: boys.length > 0 ? (admittedBoys.length / boys.length) * 100 : 0,
          girls: girls.length > 0 ? (admittedGirls.length / girls.length) * 100 : 0,
          total: passRate,
        },
        failRate: {
          boys: boys.length > 0 ? ((boys.length - admittedBoys.length) / boys.length) * 100 : 0,
          girls: girls.length > 0 ? ((girls.length - admittedGirls.length) / girls.length) * 100 : 0,
          total: failRate,
        },
      };
    });
  }, [subjects, gradeData]);

  // ── Compute: Intervalle des notes (per subject) ──
  const intervalData = useMemo(() => {
    return subjects.map(subj => {
      const grades = gradeData[subj.id] || [];
      const present = grades.filter((g: any) => !g.isAbsent && typeof g.score === 'number');
      const counts = INTERVALS.map(interval => {
        const count = present.filter((g: any) => {
          const score = Number(g.score);
          return score >= interval.min && (interval.max === 20 ? score <= interval.max : score < interval.max);
        }).length;
        return { label: interval.label, count };
      });
      return { subjectName: subj.name, effectif: present.length, intervals: counts };
    });
  }, [subjects, gradeData]);

  // ── Compute: Meilleures notes (all subjects, top N) ──
  const bestNotesData = useMemo(() => {
    const allNotes: any[] = [];
    for (const subj of subjects) {
      const grades = gradeData[subj.id] || [];
      for (const g of grades) {
        if (!g.isAbsent && typeof g.score === 'number') {
          allNotes.push({
            matricule: g.matricule || '',
            name: g.studentName || '',
            className: classes.find(c => c.id === selectedClassId)?.name || '',
            subject: subj.name,
            score: Number(g.score),
            appreciation: g.score >= 16 ? 'Très Bien' : g.score >= 14 ? 'Bien' : g.score >= 12 ? 'Assez Bien' : g.score >= 10 ? 'Passable' : 'Insuffisant',
          });
        }
      }
    }
    return allNotes.sort((a, b) => b.score - a.score).slice(0, topN * subjects.length || 20);
  }, [subjects, gradeData, topN, classes, selectedClassId]);

  // ── Compute: Moyennes par élève (for moyennes tabs) ──
  const studentAverages = useMemo(() => {
    const studentMap = new Map<string, { id: string; matricule: string; name: string; gender?: string; scores: number[]; coefs: number[]; moyenne: number | null }>();
    for (const subj of subjects) {
      const grades = gradeData[subj.id] || [];
      const coef = subj.coefficient ?? 1;
      for (const g of grades) {
        if (g.isAbsent || typeof g.score !== 'number') continue;
        if (!studentMap.has(g.studentId)) {
          studentMap.set(g.studentId, {
            id: g.studentId,
            matricule: g.matricule || '',
            name: g.studentName || '',
            gender: g.gender,
            scores: [],
            coefs: [],
            moyenne: null,
          });
        }
        const st = studentMap.get(g.studentId)!;
        st.scores.push(Number(g.score));
        st.coefs.push(coef);
      }
    }
    const rows = Array.from(studentMap.values());
    for (const st of rows) {
      const total = st.scores.reduce((sum, s, i) => sum + s * st.coefs[i], 0);
      const totalCoef = st.coefs.reduce((sum, c) => sum + c, 0);
      st.moyenne = totalCoef > 0 ? total / totalCoef : null;
    }
    return rows.sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
  }, [subjects, gradeData]);

  // ── Compute: Taux de réussite des moyennes ──
  const moyennesSuccessData = useMemo(() => {
    const total = studentAverages.length;
    const boys = studentAverages.filter(s => s.gender === 'M');
    const girls = studentAverages.filter(s => s.gender === 'F' || s.gender === 'FEMALE');
    const admitted = studentAverages.filter(s => s.moyenne !== null && s.moyenne >= 10);
    const admittedBoys = admitted.filter(s => s.gender === 'M');
    const admittedGirls = admitted.filter(s => s.gender === 'F' || s.gender === 'FEMALE');
    return [{
      subjectName: 'Moyenne générale',
      present: { boys: boys.length, girls: girls.length, total },
      admitted: { boys: admittedBoys.length, girls: admittedGirls.length, total: admitted.length },
      passRate: {
        boys: boys.length > 0 ? (admittedBoys.length / boys.length) * 100 : 0,
        girls: girls.length > 0 ? (admittedGirls.length / girls.length) * 100 : 0,
        total: total > 0 ? (admitted.length / total) * 100 : 0,
      },
      failRate: {
        boys: boys.length > 0 ? ((boys.length - admittedBoys.length) / boys.length) * 100 : 0,
        girls: girls.length > 0 ? ((girls.length - admittedGirls.length) / girls.length) * 100 : 0,
        total: total > 0 ? ((total - admitted.length) / total) * 100 : 0,
      },
    }];
  }, [studentAverages]);

  // ── Compute: Intervalle des moyennes ──
  const moyennesIntervalData = useMemo(() => {
    const present = studentAverages.filter(s => s.moyenne !== null);
    const counts = INTERVALS.map(interval => {
      const count = present.filter(s => {
        const moy = s.moyenne!;
        return moy >= interval.min && (interval.max === 20 ? moy <= interval.max : moy < interval.max);
      }).length;
      return { label: interval.label, count };
    });
    return [{ subjectName: 'Moyenne générale', effectif: present.length, intervals: counts }];
  }, [studentAverages]);

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';

  return (
    <ModuleContainer
      title="Statistiques"
      subtitle="Statistiques des notes et des moyennes"
      subModules={subModules}
      examScope={examScope}
    >
      <div className="space-y-4">
        {/* Main tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: 'notes' as MainTab, label: 'Statistiques des notes', icon: BarChart3 },
            { id: 'moyennes' as MainTab, label: 'Statistiques des moyennes', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                mainTab === tab.id ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Sub tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: 'taux-reussite' as SubTab, label: 'Taux de réussite', icon: Target },
            { id: 'intervalle' as SubTab, label: 'Intervalle', icon: BarChart3 },
            { id: 'meilleurs' as SubTab, label: mainTab === 'notes' ? 'Meilleures notes' : 'Meilleures moyennes', icon: Trophy },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1',
                subTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600',
              )}
            >
              <tab.icon className="w-3 h-3" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap gap-3 items-end bg-white rounded-lg border border-slate-200 p-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Classe</label>
            <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[150px]">
              <option value="">—</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Période</label>
            <select value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[150px]">
              <option value="">—</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Données</label>
            <select value={statMode} onChange={e => setStatMode(e.target.value as StatMode)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[150px]">
              <option value="evaluation">Évaluation</option>
              <option value="trimestriel">Trimestriel</option>
              <option value="annuel">Annuel</option>
            </select>
          </div>
          {statMode === 'evaluation' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Évaluation</label>
              <select value={selectedEvalTypeId} onChange={e => setSelectedEvalTypeId(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[150px]">
                <option value="">—</option>
                {evalTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {subTab === 'meilleurs' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Top</label>
              <select value={topN} onChange={e => setTopN(Number(e.target.value))} className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[80px]">
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <>
            {/* ═══ TAUX DE RÉUSSITE ═══ */}
            {subTab === 'taux-reussite' && (
              <div className="space-y-4">
                {/* Tableau */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900">
                      Taux de réussite — {selectedClassName}
                    </h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100">
                        <TableHead className="text-xs" rowSpan={2}>Matière</TableHead>
                        <TableHead className="text-xs text-center" colSpan={3}>Effectif présents</TableHead>
                        <TableHead className="text-xs text-center" colSpan={3}>Total admis</TableHead>
                        <TableHead className="text-xs text-center" colSpan={3}>% Réussite</TableHead>
                        <TableHead className="text-xs text-center" colSpan={3}>% Échec</TableHead>
                      </TableRow>
                      <TableRow className="bg-slate-100">
                        {[0,1,2].map(i => <TableHead key={`p${i}`} className="text-[10px] text-center">{['G','F','T'][i]}</TableHead>)}
                        {[0,1,2].map(i => <TableHead key={`a${i}`} className="text-[10px] text-center">{['G','F','T'][i]}</TableHead>)}
                        {[0,1,2].map(i => <TableHead key={`r${i}`} className="text-[10px] text-center">{['G','F','T'][i]}</TableHead>)}
                        {[0,1,2].map(i => <TableHead key={`f${i}`} className="text-[10px] text-center">{['G','F','T'][i]}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(mainTab === 'notes' ? successRateData : moyennesSuccessData).map((row, idx) => (
                        <TableRow key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : undefined}>
                          <TableCell className="text-xs font-medium">{row.subjectName}</TableCell>
                          <TableCell className="text-xs text-center">{row.present.boys}</TableCell>
                          <TableCell className="text-xs text-center">{row.present.girls}</TableCell>
                          <TableCell className="text-xs text-center font-bold">{row.present.total}</TableCell>
                          <TableCell className="text-xs text-center">{row.admitted.boys}</TableCell>
                          <TableCell className="text-xs text-center">{row.admitted.girls}</TableCell>
                          <TableCell className="text-xs text-center font-bold text-emerald-700">{row.admitted.total}</TableCell>
                          <TableCell className="text-xs text-center">{row.passRate.boys.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs text-center">{row.passRate.girls.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs text-center font-bold text-emerald-700">{row.passRate.total.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs text-center">{row.failRate.boys.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs text-center">{row.failRate.girls.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs text-center font-bold text-red-600">{row.failRate.total.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Graphique : barres nombre d'admis par matière */}
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Graphique — Nombre d'admis par matière
                  </h3>
                  <div className="flex items-end gap-2 h-48 border-b border-slate-200 pb-1">
                    {(mainTab === 'notes' ? successRateData : moyennesSuccessData).map((row, idx) => {
                      const maxAdmitted = Math.max(...(mainTab === 'notes' ? successRateData : moyennesSuccessData).map(r => r.admitted.total), 1);
                      const heightPct = (row.admitted.total / maxAdmitted) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <div className="text-[9px] font-bold text-slate-700">{row.admitted.total}</div>
                          <div
                            className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                            style={{ height: `${heightPct}%`, minHeight: '4px' }}
                            title={`${row.subjectName}: ${row.admitted.total} admis`}
                          />
                          <div className="text-[8px] text-slate-500 text-center truncate w-full" style={{ maxWidth: '60px' }}>
                            {row.subjectName.length > 8 ? row.subjectName.substring(0, 7) + '…' : row.subjectName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 text-center">
                    Ordonnée : nombre d'admis · Abscisse : matières
                  </div>
                </div>
              </div>
            )}

            {/* ═══ INTERVALLE DES NOTES / MOYENNES ═══ */}
            {subTab === 'intervalle' && (
              <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">
                    {mainTab === 'notes' ? 'Intervalle des notes' : 'Intervalle des moyennes'} — {selectedClassName}
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs">Matière</TableHead>
                      <TableHead className="text-xs text-center">Effectif</TableHead>
                      <TableHead className="text-xs text-center">Présents</TableHead>
                      {INTERVALS.map(intr => (
                        <TableHead key={intr.label} className="text-xs text-center">{intr.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(mainTab === 'notes' ? intervalData : moyennesIntervalData).map((row, idx) => (
                      <TableRow key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : undefined}>
                        <TableCell className="text-xs font-medium">{row.subjectName}</TableCell>
                        <TableCell className="text-xs text-center font-bold">{row.effectif}</TableCell>
                        <TableCell className="text-xs text-center">{row.effectif}</TableCell>
                        {row.intervals.map((intr, i) => (
                          <TableCell key={i} className="text-xs text-center">
                            <span className={cn('font-semibold', intr.count > 0 ? 'text-slate-900' : 'text-slate-400')}>
                              {intr.count}
                            </span>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* ═══ MEILLEURES NOTES / MOYENNES ═══ */}
            {subTab === 'meilleurs' && (
              <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    {mainTab === 'notes' ? 'Meilleures notes' : 'Meilleures moyennes'} — Top {topN}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    <Filter className="w-3 h-3 mr-1" />
                    {selectedClassName}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs">Matricule</TableHead>
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs">Classe</TableHead>
                      <TableHead className="text-xs text-center">{mainTab === 'notes' ? 'Note' : 'Moyenne'}</TableHead>
                      <TableHead className="text-xs text-center">Appréciation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mainTab === 'notes' ? (
                      bestNotesData.slice(0, topN).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{row.matricule || '—'}</TableCell>
                          <TableCell className="text-xs font-medium">{row.name}</TableCell>
                          <TableCell className="text-xs">{row.className}</TableCell>
                          <TableCell className="text-xs text-center font-bold text-emerald-700">{row.score.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-center">{row.appreciation}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      studentAverages.slice(0, topN).map((st, idx) => (
                        <TableRow key={st.id}>
                          <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                          <TableCell className="text-xs font-medium">{st.name}</TableCell>
                          <TableCell className="text-xs">{selectedClassName}</TableCell>
                          <TableCell className="text-xs text-center font-bold text-emerald-700">{st.moyenne?.toFixed(2) ?? '—'}</TableCell>
                          <TableCell className="text-xs text-center">
                            {st.moyenne !== null && st.moyenne >= 16 ? 'Très Bien' : st.moyenne !== null && st.moyenne >= 14 ? 'Bien' : st.moyenne !== null && st.moyenne >= 12 ? 'Assez Bien' : st.moyenne !== null && st.moyenne >= 10 ? 'Passable' : 'Insuffisant'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {(mainTab === 'notes' ? bestNotesData : studentAverages).length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-slate-400 text-xs py-4">Aucune donnée</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* PDF button */}
            <div className="flex justify-end">
              <Button
                onClick={() => alert('Génération PDF des statistiques — à implémenter')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" /> Générer PDF
              </Button>
            </div>
          </>
        )}
      </div>
    </ModuleContainer>
  );
}
