/**
 * ============================================================================
 * MODULE EXAMENS — MOYENNES & CLASSEMENTS (100% Dynamique)
 * ============================================================================
 *
 * PRINCIPE : Aucun seuil, mention, coefficient ou formule n'est codé en dur.
 * Tout provient de la configuration académique active via useAcademicSettings().
 *
 * Le calcul des moyennes est déclenché via l'API backend qui utilise le
 * AcademicRulesEngine avec les formules configurées par l'école.
 *
 * La répartition des mentions est générée dynamiquement depuis config.mentions.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Calculator,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Settings,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicSettings } from '@/hooks/useAcademicSettings';
import { useBilingual } from '@/contexts/BilingualContext';
import { toast } from '@/components/ui/toast';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentResult {
  id: string;
  student: { lastName: string; firstName: string; matricule?: string };
  classRank: number;
  generalAverage: number | string;
  totalWeighted?: number;
  previousAverage?: number;
  subjectAverages?: Record<string, number>;
  decision?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTrendIcon(current: number, previous?: number) {
  if (previous === undefined) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return <span className="text-xs text-gray-400">—</span>;
  return diff > 0
    ? <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600"><TrendingUp className="w-3 h-3" />+{diff.toFixed(2)}</span>
    : <span className="flex items-center gap-0.5 text-xs font-bold text-rose-600"><TrendingDown className="w-3 h-3" />{diff.toFixed(2)}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AveragesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const {
    config: academicConfig,
    loading: configLoading,
    getScoreColor,
    getAppreciation,
    isPassingGrade,
    maxScore,
    passingScore,
    decimals,
  } = useAcademicSettings();
  const { isEnabled: isBilingual, currentTrack, setCurrentTrack } = useBilingual();

  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // ── Load classes ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadClasses() {
      if (!schoolLevel?.id || !academicYear?.id) return;
      setLoadingClasses(true);
      try {
        const res = await fetch(
          `/api/classes?schoolLevelId=${schoolLevel.id}&academicYearId=${academicYear.id}`,
          { credentials: 'include' }
        ).then((r) => r.json());
        if (Array.isArray(res) && res.length > 0) {
          setClasses(res);
          setSelectedClassId(res[0].id);
        }
      } catch {
        setClasses([]);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadClasses();
  }, [schoolLevel?.id, academicYear?.id]);

  // ── Load periods from config ────────────────────────────────────────────────
  useEffect(() => {
    if (!academicConfig) return;
    // Periods come from the academic config (not hardcoded)
    const configPeriods: any[] = (academicConfig as any).periods ?? [];
    if (configPeriods.length > 0) {
      setPeriods(configPeriods);
      setSelectedPeriodId(configPeriods[0]?.id ?? configPeriods[0]?.code ?? '');
    } else {
      // Fallback: derive from periodType configured
      const type = academicConfig.periodType;
      const generated =
        type === 'Trimestre' ? [
          { id: 'T1', label: 'Trimestre 1' },
          { id: 'T2', label: 'Trimestre 2' },
          { id: 'T3', label: 'Trimestre 3' },
        ] : type === 'Semestre' ? [
          { id: 'S1', label: 'Semestre 1' },
          { id: 'S2', label: 'Semestre 2' },
        ] : type === 'Séquence' ? [
          { id: 'SEQ1', label: 'Séquence 1' },
          { id: 'SEQ2', label: 'Séquence 2' },
          { id: 'SEQ3', label: 'Séquence 3' },
          { id: 'SEQ4', label: 'Séquence 4' },
          { id: 'SEQ5', label: 'Séquence 5' },
          { id: 'SEQ6', label: 'Séquence 6' },
        ] : [{ id: 'P1', label: 'Période 1' }];
      setPeriods(generated);
      setSelectedPeriodId(generated[0].id);
    }
  }, [academicConfig]);

  // ── Load results ────────────────────────────────────────────────────────────
  const loadResults = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        classId: selectedClassId,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id ?? '',
      });
      if (isBilingual) params.append('language', currentTrack);
      const res = await fetch(
        `/api/exams/averages?${params.toString()}`,
        { credentials: 'include' }
      ).then((r) => r.json());
      setResults(Array.isArray(res) ? res : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedPeriodId, academicYear?.id, isBilingual, currentTrack]);

  useEffect(() => { if (selectedClassId && selectedPeriodId) loadResults(); }, [loadResults]);

  // ── Calculate averages via backend engine ──────────────────────────────────
  const handleCalculate = async () => {
    if (!selectedClassId || !selectedPeriodId || !academicYear?.id) return;
    setCalculating(true);
    try {
      const payload: any = {
        classId: selectedClassId,
        periodId: selectedPeriodId,
        academicYearId: academicYear.id,
      };
      if (isBilingual) payload.language = currentTrack;
      const res = await fetch('/api/exams/calculate-averages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Calcul échoué');
      }
      toast({ title: 'Calcul terminé', description: 'Les moyennes et rangs ont été recalculés selon votre paramétrage.' });
      loadResults();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message ?? 'Échec du calcul.', variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const numericResults = results.map((r) => ({
    ...r,
    avg: Number(r.generalAverage),
  }));

  const classAverage = numericResults.length > 0
    ? numericResults.reduce((s, r) => s + r.avg, 0) / numericResults.length
    : null;

  const passingCount = numericResults.filter((r) => isPassingGrade(r.avg)).length;
  const failingCount = numericResults.length - passingCount;

  // Dynamic mention distribution from config
  const mentionDistribution = (academicConfig?.mentions ?? []).map((m) => ({
    label: m.label,
    color: m.color,
    count: numericResults.filter((r) => r.avg >= m.min && r.avg <= m.max).length,
  }));

  const periodLabel = periods.find((p) => p.id === selectedPeriodId)?.label ?? selectedPeriodId;

  // ─── No config warning ─────────────────────────────────────────────────────
  const noConfig = !configLoading && !academicConfig?.assessmentTypes?.length;

  return (
    <ModuleContainer
      header={{
        title: 'Moyennes & Classements',
        description: 'Consolidation des résultats. Les calculs utilisent les formules de votre paramétrage académique.',
        icon: 'calculator',
      }}
      subModules={{ modules: EXAMS_SUB_MODULES, activeModuleId: 'averages' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6 p-1">
            {/* Bilingual track selector */}
            {isBilingual && (
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 mb-4">
                <button
                  type="button"
                  onClick={() => setCurrentTrack('FR')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentTrack === 'FR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Français
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentTrack('EN')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentTrack === 'EN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  English
                </button>
              </div>
            )}

            {/* No config banner */}
            {noConfig && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200"
              >
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">Aucun paramétrage académique actif</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Les calculs de moyennes nécessitent un paramétrage actif avec au moins un type d'évaluation et une formule de calcul.{' '}
                    <a href="/app/exams/settings" className="underline font-bold">Configurer →</a>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Config info bar */}
            {academicConfig && !noConfig && (
              <div className="flex items-center gap-2 text-xs px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 flex-wrap">
                <Settings className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-bold text-blue-700">Config active :</span>
                <span className="text-blue-600">{academicConfig.country} · {academicConfig.educationSystem}</span>
                <span className="text-blue-400">·</span>
                <span className="text-blue-600 font-mono">Seuil de passage : {passingScore}/{maxScore}</span>
                <span className="text-blue-400">·</span>
                <span className="text-blue-600">{academicConfig.assessmentTypes.length} types d'évaluation</span>
                <a href="/app/exams/settings" className="ml-auto text-blue-600 hover:underline font-bold">
                  Modifier →
                </a>
              </div>
            )}

            {/* Control Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 leading-none mb-1">Moteur de Calcul</h3>
                  <p className="text-xs text-gray-500">
                    Période : <span className="font-bold text-blue-600">{periodLabel}</span>
                    {academicConfig?.subjectAverageFormula && (
                      <span className="ml-2 font-mono text-gray-400 text-[10px]">
                        ({academicConfig.subjectAverageFormula})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                {/* Class selector */}
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="text-sm font-bold border border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 py-2.5 px-3 min-w-[160px]"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* Period selector — dynamic from config */}
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="text-sm font-bold border border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 py-2.5 px-3 min-w-[140px]"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.label ?? p.name}</option>
                  ))}
                </select>

                <Button
                  onClick={handleCalculate}
                  disabled={calculating || !selectedClassId || noConfig}
                  className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 px-6 font-bold"
                >
                  {calculating
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calcul en cours…</>
                    : <><RefreshCcw className="w-4 h-4 mr-2" />Lancer le Calcul</>}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Ranking Table */}
              <Card className="lg:col-span-3 border-none shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    Classement — {periodLabel}
                    {results.length > 0 && (
                      <Badge variant="outline" className="text-xs border-gray-200 text-gray-500">
                        {results.length} élèves
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Résultats calculés selon la formule configurée.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                          <TableHead className="w-20 text-center font-black text-xs uppercase tracking-wider">Rang</TableHead>
                          <TableHead className="font-black text-xs uppercase tracking-wider">Élève</TableHead>
                          <TableHead className="text-center font-black text-xs uppercase tracking-wider">
                            Moy. /{maxScore}
                          </TableHead>
                          <TableHead className="font-black text-xs uppercase tracking-wider">Mention</TableHead>
                          <TableHead className="font-black text-xs uppercase tracking-wider">Décision</TableHead>
                          <TableHead className="font-black text-xs uppercase tracking-wider">Évolution</TableHead>
                          <TableHead className="text-right px-6 font-black text-xs uppercase tracking-wider">Détail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {numericResults.map((item, index) => {
                            const passing = isPassingGrade(item.avg);
                            return (
                              <motion.tr
                                key={item.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={cn(
                                  'group transition-colors hover:bg-blue-50/30',
                                  !passing && 'bg-rose-50/20'
                                )}
                              >
                                <TableCell className="text-center py-3">
                                  <div className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-sm font-black',
                                    index === 0 ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' :
                                    index === 1 ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' :
                                    index === 2 ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' :
                                    'bg-gray-50 text-gray-400'
                                  )}>
                                    {item.classRank}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">
                                      {item.student.lastName} {item.student.firstName}
                                    </span>
                                    {item.student.matricule && (
                                      <span className="text-[10px] text-gray-400 font-mono">{item.student.matricule}</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={cn('font-black text-sm px-3 border-none', getScoreColor(item.avg))}>
                                    {item.avg.toFixed(decimals)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs font-semibold text-gray-600">
                                    {getAppreciation(item.avg)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {passing ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-xs">
                                      <CheckCircle className="w-3 h-3 mr-1" />Admis
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-rose-50 text-rose-700 border-rose-100 text-xs">
                                      <AlertCircle className="w-3 h-3 mr-1" />À revoir
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {getTrendIcon(item.avg, item.previousAverage)}
                                </TableCell>
                                <TableCell className="text-right px-6">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600">
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>

                        {numericResults.length === 0 && !loading && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-20 bg-gray-50/50">
                              <div className="flex flex-col items-center opacity-40">
                                <Calculator className="w-12 h-12 mb-2" />
                                <p className="text-sm italic">
                                  {noConfig
                                    ? 'Configurez le paramétrage académique avant de calculer.'
                                    : 'Lancez le calcul pour afficher les moyennes.'}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Sidebar Stats */}
              <div className="space-y-5">
                {/* Class average card */}
                <Card className="border-none shadow-sm bg-gradient-to-br from-blue-600 to-blue-800 text-white overflow-hidden relative group">
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider opacity-80">
                      Moyenne de Classe
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black mb-1">
                      {classAverage !== null ? classAverage.toFixed(decimals) : '—'}
                    </div>
                    <p className="text-[10px] text-blue-200 font-bold uppercase">
                      Seuil de passage : {passingScore}/{maxScore}
                    </p>
                    {classAverage !== null && (
                      <div className="h-1.5 w-full bg-white/10 rounded-full mt-4 overflow-hidden">
                        <motion.div
                          className="h-full bg-white rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(classAverage / maxScore) * 100}%` }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pass/Fail */}
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest">Résultats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                        <CheckCircle className="w-4 h-4" /> Admis
                      </span>
                      <span className="text-sm font-black text-emerald-700">{passingCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-rose-700">
                        <AlertCircle className="w-4 h-4" /> À revoir
                      </span>
                      <span className="text-sm font-black text-rose-700">{failingCount}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Dynamic mention distribution */}
                <Card className="border-none shadow-sm overflow-hidden bg-white/60 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Répartition des Mentions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {mentionDistribution.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Aucune mention configurée.</p>
                    ) : (
                      mentionDistribution.map((m) => (
                        <DistributionRow
                          key={m.label}
                          label={m.label}
                          count={m.count}
                          color={m.color}
                          total={results.length}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* ORION coherence */}
                {results.length > 0 && (
                  <Card className="border-none shadow-sm bg-amber-50 border border-amber-100">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-900">Vérification ORION</p>
                          <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                            Toutes les moyennes sont calculées selon la formule active.
                            Vérifiez visuellement avant publication.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        ),
      }}
    />
  );
}

// ─── Distribution Row ─────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  cyan: 'bg-cyan-500',
  indigo: 'bg-blue-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  rose: 'bg-rose-500',
};

function DistributionRow({ label, count, color, total }: {
  label: string; count: number; color: string; total: number;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end text-[10px] font-bold">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900">{count} élève{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', COLOR_MAP[color] ?? 'bg-blue-500')}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1 }}
        />
      </div>
    </div>
  );
}
