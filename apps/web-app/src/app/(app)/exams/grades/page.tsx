/**
 * ============================================================================
 * MODULE EXAMENS — SAISIE DES NOTES (100% Dynamique)
 * ============================================================================
 *
 * PRINCIPE : Aucune colonne n'est codée en dur.
 * Les colonnes proviennent du schéma dynamique retourné par le backend
 * (endpoint GET /api/exams/settings/score-entry-schema) en fonction de :
 *   - L'année scolaire
 *   - Le cycle / niveau / classe / matière / période
 *
 * Le moteur de calcul de la moyenne est également fourni par la configuration
 * académique active (formule configurable par l'école).
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Save,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Send,
  ShieldCheck,
  Calendar,
  Loader2,
  AlertTriangle,
  Settings,
  RefreshCw,
  User,
  BookOpen,
  Calculator,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicSettings } from '@/hooks/useAcademicSettings';
import { academicSettingsService } from '@/services/academic-settings.service';
import { useBilingual } from '@/contexts/BilingualContext';
import { toast } from '@/components/ui/toast';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchemaColumn {
  key: string;
  label: string;
  type: string;
  max: number;
  required: boolean;
  weight: number;
  includedInAverage: boolean;
  visibleOnReportCard: boolean;
}

interface GradingRow {
  studentId: string;
  studentName: string;
  matricule?: string;
  scores: Record<string, number | null>; // key = column.key
  computedAverage: number | null;
  isAbsent: boolean;
  comment: string;
}

interface Evaluation {
  id: string;
  title: string;
  subjectName: string;
  className: string;
  levelCode?: string;
  cycleCode?: string;
  periodId?: string;
  status: string;
  evaluationDate: string;
  studentCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    PLANNED: { label: 'Planifiée', className: 'bg-blue-50 text-blue-600 border-blue-100' },
    OPEN_FOR_GRADING: { label: 'En saisie', className: 'bg-amber-50 text-amber-600 border-amber-100' },
    SUBMITTED: { label: 'Soumise', className: 'bg-violet-50 text-violet-600 border-violet-100' },
    VALIDATED: { label: 'Validée', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  };
  const cfg = map[status] ?? { label: status, className: 'bg-gray-50 text-gray-600 border-gray-100' };
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GradesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { config: academicConfig, getScoreColor, getAppreciation } = useAcademicSettings();
  const { isEnabled: isBilingual, currentTrack, setCurrentTrack } = useBilingual();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [gradingSheet, setGradingSheet] = useState<GradingRow[]>([]);
  const [schemaColumns, setSchemaColumns] = useState<SchemaColumn[]>([]);
  const [subjectFormula, setSubjectFormula] = useState<string>('');
  const [loadingEvals, setLoadingEvals] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noConfig, setNoConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Load evaluations list ───────────────────────────────────────────────────

  const loadEvaluations = useCallback(async () => {
    if (!schoolLevel?.id || !academicYear?.id) return;
    setLoadingEvals(true);
    try {
      const params = new URLSearchParams({
        schoolLevelId: schoolLevel.id,
        academicYearId: academicYear.id,
      });
      if (isBilingual) params.append('language', currentTrack);
      const res = await fetch(
        `/api/exams/evaluations?${params.toString()}`,
        { credentials: 'include' }
      ).then((r) => r.json());
      setEvaluations(Array.isArray(res) ? res : []);
    } catch {
      setEvaluations([]);
    } finally {
      setLoadingEvals(false);
    }
  }, [schoolLevel?.id, academicYear?.id, isBilingual, currentTrack]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // ── Load grading sheet + dynamic schema when evaluation selected ────────────

  const handleSelectEvaluation = async (ev: Evaluation) => {
    setSelectedEvaluation(ev);
    setLoadingSheet(true);
    setNoConfig(false);
    setGradingSheet([]);
    setSchemaColumns([]);

    try {
      // 1. Fetch dynamic score entry schema from configuration
      const schema = await academicSettingsService.getScoreEntrySchema({
        schoolYearId: academicYear!.id,
        cycleCode: ev.cycleCode,
        levelCode: ev.levelCode,
        periodId: ev.periodId,
      });

      if (!schema.columns || schema.columns.length === 0) {
        setNoConfig(true);
        setLoadingSheet(false);
        return;
      }

      setSchemaColumns(schema.columns);
      setSubjectFormula(schema.formula);

      // 2. Fetch the student list for this evaluation
      const sheetRes = await fetch(
        `/api/exams/evaluations/${ev.id}/grading-sheet`,
        { credentials: 'include' }
      ).then((r) => r.json()).catch(() => []);

      const students: GradingRow[] = (Array.isArray(sheetRes) ? sheetRes : []).map((row: any) => {
        const scores: Record<string, number | null> = {};
        schema.columns.forEach((col: SchemaColumn) => {
          scores[col.key] = row.scores?.[col.key] ?? null;
        });
        return {
          studentId: row.studentId ?? row.id,
          studentName: row.studentName ?? `${row.student?.lastName ?? ''} ${row.student?.firstName ?? ''}`.trim(),
          matricule: row.matricule ?? row.student?.matricule,
          scores,
          computedAverage: null,
          isAbsent: row.isAbsent ?? false,
          comment: row.comment ?? '',
        };
      });

      // Compute initial averages
      const rowsWithAvg = students.map((s) =>
        recomputeAverage(s, schema.columns, schema.formula)
      );
      setGradingSheet(rowsWithAvg);
    } catch (err) {
      toast({ title: 'Erreur', description: 'Impossible de charger la grille de saisie.', variant: 'destructive' });
    } finally {
      setLoadingSheet(false);
    }
  };

  // ── Recompute average locally ───────────────────────────────────────────────

  function recomputeAverage(row: GradingRow, cols: SchemaColumn[], formula: string): GradingRow {
    if (row.isAbsent) return { ...row, computedAverage: null };

    const scores: Record<string, number> = {};
    cols.filter((c) => c.includedInAverage).forEach((c) => {
      scores[c.key] = row.scores[c.key] ?? 0;
    });

    const avg = academicSettingsService.computeAverage(scores, formula);
    return { ...row, computedAverage: avg };
  }

  // ── Score change handler ────────────────────────────────────────────────────

  const handleScoreChange = (studentId: string, colKey: string, value: string) => {
    const parsed = value === '' ? null : parseFloat(value);
    setGradingSheet((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const updated: GradingRow = {
          ...row,
          scores: { ...row.scores, [colKey]: parsed },
        };
        return recomputeAverage(updated, schemaColumns, subjectFormula);
      })
    );
  };

  const handleAbsentToggle = (studentId: string, absent: boolean) => {
    setGradingSheet((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const updated: GradingRow = { ...row, isAbsent: absent };
        return recomputeAverage(updated, schemaColumns, subjectFormula);
      })
    );
  };

  // ── Save grades ─────────────────────────────────────────────────────────────

  const handleSave = async (submit = false) => {
    if (!selectedEvaluation) return;
    setSaving(true);
    try {
      const payload = {
        grades: gradingSheet.map((row) => ({
          studentId: row.studentId,
          scores: row.scores,
          computedAverage: row.computedAverage,
          isAbsent: row.isAbsent,
          comment: row.comment,
        })),
        formula: subjectFormula,
        submit,
      };
      await fetch(`/api/exams/evaluations/${selectedEvaluation.id}/grades`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast({
        title: submit ? 'Notes soumises' : 'Notes enregistrées',
        description: submit
          ? 'Les notes ont été envoyées pour validation.'
          : 'Brouillon sauvegardé avec succès.',
      });
      if (submit) setSelectedEvaluation(null);
    } catch {
      toast({ title: 'Erreur', description: "Échec de l'enregistrement.", variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredSheet = gradingSheet.filter((r) =>
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.matricule ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLocked = selectedEvaluation?.status === 'VALIDATED' || selectedEvaluation?.status === 'SUBMITTED';

  // ─── VIEW: Grading sheet ────────────────────────────────────────────────────

  if (selectedEvaluation) {
    return (
      <ModuleContainer
        header={{
          title: `Saisie — ${selectedEvaluation.title}`,
          description: `${selectedEvaluation.className} · ${selectedEvaluation.subjectName}`,
          icon: 'clipboardList',
        }}
        subModules={{ modules: EXAMS_SUB_MODULES, activeModuleId: 'grades' }}
        content={{
          layout: 'full',
          children: (
            <div className="space-y-4">
              {/* Action Bar */}
              <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
                <Button variant="ghost" onClick={() => setSelectedEvaluation(null)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Retour à la liste
                </Button>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Schema info badge */}
                  {schemaColumns.length > 0 && (
                    <Badge variant="outline" className="border-blue-200 text-blue-600 text-xs gap-1">
                      <Settings className="w-3 h-3" />
                      {schemaColumns.length} type(s) · Barème /{academicConfig?.scoreMax ?? 20}
                    </Badge>
                  )}

                  {isLocked ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-3 py-2">
                      <ShieldCheck className="w-4 h-4 mr-1" /> Verrouillée
                    </Badge>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                        Sauvegarder
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(true)}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Soumettre
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* No config warning */}
              {noConfig && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">Aucun paramétrage académique actif</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Le tableau de saisie ne peut pas être généré car aucune configuration n'est activée pour cette année scolaire.{' '}
                      <a href="/app/exams/settings" className="underline font-bold">
                        Configurer maintenant →
                      </a>
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Formula display */}
              {subjectFormula && (
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50/50 border border-blue-100 px-4 py-2.5 rounded-xl">
                  <Calculator className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-semibold text-blue-700">Formule active :</span>
                  <code className="font-mono text-blue-600">{subjectFormula}</code>
                </div>
              )}

              {/* Loading sheet */}
              {loadingSheet && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="ml-3 text-sm text-gray-500">Chargement du schéma et des élèves…</p>
                </div>
              )}

              {/* Dynamic grading table */}
              {!loadingSheet && !noConfig && schemaColumns.length > 0 && (
                <div className="space-y-3">
                  {/* Search */}
                  <div className="relative max-w-xs">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher un élève…"
                      className="pl-9 text-sm border-gray-200 bg-white"
                    />
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                          <TableHead className="w-10 text-center text-xs font-black text-gray-400">#</TableHead>
                          <TableHead className="text-xs font-black text-gray-600 uppercase tracking-wider">Élève</TableHead>

                          {/* Dynamic columns from schema */}
                          {schemaColumns.map((col) => (
                            <TableHead
                              key={col.key}
                              className="text-center text-xs font-black text-gray-600 uppercase tracking-wider min-w-[100px]"
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <span>{col.label}</span>
                                <span className="text-[9px] text-gray-400 font-normal">
                                  /{col.max} · ×{col.weight}
                                </span>
                              </div>
                            </TableHead>
                          ))}

                          <TableHead className="text-center text-xs font-black text-blue-600 uppercase tracking-wider min-w-[90px]">
                            Moyenne
                          </TableHead>
                          <TableHead className="text-xs font-black text-gray-600 uppercase tracking-wider">Mention</TableHead>
                          <TableHead className="text-center text-xs font-black text-gray-600">Absent</TableHead>
                          <TableHead className="text-xs font-black text-gray-600">Observation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {filteredSheet.map((row, idx) => (
                            <motion.tr
                              key={row.studentId}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className={cn(
                                'group transition-colors',
                                row.isAbsent ? 'bg-red-50/40' : 'hover:bg-blue-50/20'
                              )}
                            >
                              <TableCell className="text-center text-xs text-gray-400 font-mono">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-sm">{row.studentName}</span>
                                  {row.matricule && (
                                    <span className="text-[10px] text-gray-400 font-mono">{row.matricule}</span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Dynamic score inputs */}
                              {schemaColumns.map((col) => (
                                <TableCell key={col.key} className="text-center py-2">
                                  <Input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    max={col.max}
                                    value={row.isAbsent ? '' : (row.scores[col.key] ?? '')}
                                    onChange={(e) => handleScoreChange(row.studentId, col.key, e.target.value)}
                                    disabled={isLocked || row.isAbsent}
                                    placeholder="—"
                                    className={cn(
                                      'w-20 h-9 text-center font-bold text-sm border-gray-200',
                                      'focus:border-blue-400 focus:ring-1 focus:ring-blue-200',
                                      row.isAbsent && 'opacity-40 cursor-not-allowed',
                                      !row.isAbsent && row.scores[col.key] !== null &&
                                        (row.scores[col.key]! < col.max * 0.5
                                          ? 'text-rose-600'
                                          : row.scores[col.key]! >= col.max * 0.8
                                            ? 'text-emerald-600'
                                            : 'text-gray-900')
                                    )}
                                  />
                                </TableCell>
                              ))}

                              {/* Computed average */}
                              <TableCell className="text-center">
                                {row.isAbsent ? (
                                  <Badge className="bg-red-100 text-red-600 border-none text-xs">Absent</Badge>
                                ) : row.computedAverage !== null ? (
                                  <Badge
                                    className={cn(
                                      'font-black text-sm px-3 border-none',
                                      getScoreColor(row.computedAverage)
                                    )}
                                  >
                                    {row.computedAverage.toFixed(academicConfig?.scoreDecimals ?? 2)}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </TableCell>

                              {/* Mention */}
                              <TableCell>
                                <span className="text-xs font-semibold text-gray-500">
                                  {row.computedAverage !== null && !row.isAbsent
                                    ? getAppreciation(row.computedAverage)
                                    : '—'}
                                </span>
                              </TableCell>

                              {/* Absent checkbox */}
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={row.isAbsent}
                                  onChange={(e) => handleAbsentToggle(row.studentId, e.target.checked)}
                                  disabled={isLocked}
                                  className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-300"
                                />
                              </TableCell>

                              {/* Comment */}
                              <TableCell>
                                <Input
                                  value={row.comment}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGradingSheet((prev) =>
                                      prev.map((r) =>
                                        r.studentId === row.studentId ? { ...r, comment: val } : r
                                      )
                                    );
                                  }}
                                  disabled={isLocked}
                                  placeholder="Observation…"
                                  className="text-xs bg-transparent border-none focus:bg-gray-50 h-8 w-40"
                                />
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>

                        {filteredSheet.length === 0 && !loadingSheet && (
                          <TableRow>
                            <TableCell colSpan={schemaColumns.length + 6} className="text-center py-12 text-gray-400 text-sm">
                              Aucun élève trouvé.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary stats */}
                  {gradingSheet.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {
                          label: 'Élèves saisis',
                          value: `${gradingSheet.filter((r) => !r.isAbsent && r.computedAverage !== null).length}/${gradingSheet.length}`,
                          color: 'text-blue-700',
                          bg: 'bg-blue-50',
                        },
                        {
                          label: 'Moyenne classe',
                          value: (() => {
                            const avgs = gradingSheet
                              .filter((r) => !r.isAbsent && r.computedAverage !== null)
                              .map((r) => r.computedAverage!);
                            if (avgs.length === 0) return '—';
                            return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2);
                          })(),
                          color: 'text-emerald-700',
                          bg: 'bg-emerald-50',
                        },
                        {
                          label: 'Admis (provisoire)',
                          value: gradingSheet.filter(
                            (r) =>
                              !r.isAbsent &&
                              r.computedAverage !== null &&
                              r.computedAverage >= (academicConfig?.promotionThreshold ?? 10)
                          ).length,
                          color: 'text-blue-700',
                          bg: 'bg-blue-50',
                        },
                        {
                          label: 'Absents',
                          value: gradingSheet.filter((r) => r.isAbsent).length,
                          color: 'text-rose-700',
                          bg: 'bg-rose-50',
                        },
                      ].map((stat) => (
                        <Card key={stat.label} className={cn('border-none shadow-sm', stat.bg)}>
                          <CardContent className="p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{stat.label}</p>
                            <p className={cn('text-2xl font-black mt-1', stat.color)}>{stat.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ),
        }}
      />
    );
  }

  // ─── VIEW: Evaluation list ──────────────────────────────────────────────────

  return (
    <ModuleContainer
      header={{
        title: 'Saisie des Notes',
        description: 'Sélectionnez une évaluation. Les colonnes s\'afficheront selon votre paramétrage académique actif.',
        icon: 'clipboardList',
      }}
      subModules={{ modules: EXAMS_SUB_MODULES, activeModuleId: 'grades' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
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

            {/* Config status */}
            {academicConfig && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100"
              >
                <Settings className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  <span className="font-bold">Config active :</span>{' '}
                  {academicConfig.country} · {academicConfig.periodType} ·{' '}
                  {academicConfig.assessmentTypes.length} type(s) d'évaluation · Barème /{academicConfig.scoreMax}
                </p>
                <a href="/app/exams/settings" className="ml-auto text-xs text-blue-600 hover:underline font-bold flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Modifier
                </a>
              </motion.div>
            )}

            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-700">Évaluations disponibles</h3>
              <Button variant="ghost" size="sm" onClick={loadEvaluations} disabled={loadingEvals}>
                <RefreshCw className={cn('w-4 h-4 mr-1', loadingEvals && 'animate-spin')} />
                Actualiser
              </Button>
            </div>

            {loadingEvals ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : evaluations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"
              >
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-semibold">Aucune évaluation disponible</p>
                <p className="text-xs text-gray-400 mt-1">
                  Créez des évaluations dans l'onglet <span className="font-bold">Évaluations</span>.
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {evaluations.map((ev) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -2 }}
                    className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => handleSelectEvaluation(ev)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      {getStatusBadge(ev.status)}
                    </div>
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                      {ev.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {ev.className} · {ev.subjectName}
                    </p>
                    <div className="flex items-center text-xs text-gray-400 gap-3">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {ev.studentCount ?? 0} élèves
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(ev.evaluationDate)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ),
      }}
    />
  );
}
