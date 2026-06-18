/**
 * ============================================================================
 * MODULE EXAMENS — BULLETINS & SYNTHÈSES (100% Dynamique)
 * ============================================================================
 *
 * PRINCIPE : Les colonnes du tableau, les mentions, la décision de passage,
 * l'appréciation du conseil de classe — tout provient du paramétrage académique.
 *
 * Le modèle de bulletin (colonnes visibles, rang visible, mention visible,
 * coefficients, etc.) est fourni par config.reportCard (depuis AcademicSettings).
 *
 * Les matières éliminatoires, le seuil de passage et les règles de promotion
 * sont tous configurés dans le SchoolAcademicSettings actif.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileCheck,
  RefreshCcw,
  Printer,
  Share2,
  Download,
  Eye,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Settings,
  Loader2,
  Lock,
  Award,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicSettings } from '@/hooks/useAcademicSettings';
import { useBilingual } from '@/contexts/BilingualContext';
import { toast } from '@/components/ui/toast';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulletinEntry {
  id: string;
  studentId: string;
  student: { lastName: string; firstName: string; matricule?: string };
  classRank: number;
  generalAverage: number | string;
  totalCoefficient?: number;
  subjectAverages?: Array<{ subjectName: string; average: number; coefficient: number; maxScore: number }>;
  isPublished: boolean;
  promotionDecision?: string;
  teacherComment?: string;
  directorDecision?: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BulletinsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const {
    config: academicConfig,
    loading: configLoading,
    getAppreciation,
    getScoreColor,
    isPassingGrade,
    maxScore,
    passingScore,
    decimals,
  } = useAcademicSettings();
  const { isEnabled: isBilingual, currentTrack, setCurrentTrack } = useBilingual();

  const [bulletins, setBulletins] = useState<BulletinEntry[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Load classes ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadClasses() {
      if (!schoolLevel?.id || !academicYear?.id) return;
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
      }
    }
    loadClasses();
  }, [schoolLevel?.id, academicYear?.id]);

  // ── Derive periods from config ──────────────────────────────────────────────
  useEffect(() => {
    if (!academicConfig) return;
    const configPeriods: any[] = (academicConfig as any).periods ?? [];
    if (configPeriods.length > 0) {
      const mapped = configPeriods.map((p: any) => ({ id: p.id ?? p.code, label: p.name ?? p.label }));
      setPeriods(mapped);
      setSelectedPeriodId(mapped[0]?.id ?? '');
    } else {
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

  // ── Load bulletins ──────────────────────────────────────────────────────────
  const loadBulletins = useCallback(async () => {
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
        `/api/exams/bulletins?${params.toString()}`,
        { credentials: 'include' }
      ).then((r) => r.json());
      setBulletins(Array.isArray(res) ? res : []);
    } catch {
      setBulletins([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedPeriodId, academicYear?.id, isBilingual, currentTrack]);

  useEffect(() => { if (selectedClassId && selectedPeriodId) loadBulletins(); }, [loadBulletins]);

  // ── Generate (recalculate) ──────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedClassId || !selectedPeriodId) return;
    setGenerating(true);
    try {
      const payload: any = {
        classId: selectedClassId,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
      };
      if (isBilingual) payload.language = currentTrack;
      await fetch('/api/exams/generate-report-cards', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast({ title: 'Bulletins générés', description: 'Les bulletins ont été calculés selon le paramétrage actif.' });
      loadBulletins();
    } catch {
      toast({ title: 'Erreur', description: 'Échec de la génération des bulletins.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ── Publish all ─────────────────────────────────────────────────────────────
  const handlePublishAll = async () => {
    if (!selectedClassId || !selectedPeriodId) return;
    setPublishingAll(true);
    try {
      const payload: any = {
        classId: selectedClassId,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
      };
      if (isBilingual) payload.language = currentTrack;
      await fetch('/api/exams/bulletins/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast({ title: 'Bulletins publiés', description: 'Les bulletins sont maintenant accessibles.' });
      loadBulletins();
    } catch {
      toast({ title: 'Erreur', description: 'Échec de la publication.', variant: 'destructive' });
    } finally {
      setPublishingAll(false);
    }
  };

  // ── Download PDF ────────────────────────────────────────────────────────────
  const handleDownload = async (bulletinId: string, studentName: string) => {
    setDownloadingId(bulletinId);
    try {
      const params = new URLSearchParams({ periodId: selectedPeriodId });
      if (isBilingual) params.append('language', currentTrack);
      const res = await fetch(
        `/api/exams/bulletins/${bulletinId}/pdf?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Téléchargement impossible');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bulletin_${studentName.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Téléchargement réussi', description: `Bulletin de ${studentName} téléchargé.` });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message ?? 'Génération PDF impossible.', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  // ─── Derived report card config ─────────────────────────────────────────────
  const reportCardCfg = (academicConfig as any)?.reportCard ?? {};
  const showRank = reportCardCfg.showRank !== false;
  const showClassAverage = reportCardCfg.showClassAverage !== false;
  const showAppreciation = reportCardCfg.showTeacherComment !== false;
  const showDecision = reportCardCfg.showDirectorDecision !== false;

  const noConfig = !configLoading && !academicConfig?.assessmentTypes?.length;
  const publishedCount = bulletins.filter((b) => b.isPublished).length;
  const periodLabel = periods.find((p) => p.id === selectedPeriodId)?.label ?? selectedPeriodId;

  return (
    <ModuleContainer
      header={{
        title: 'Bulletins & Synthèses',
        description: 'Génération et publication des bulletins selon le paramétrage académique actif.',
        icon: 'fileCheck',
      }}
      subModules={{ modules: EXAMS_SUB_MODULES, activeModuleId: 'bulletins' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-5">
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
                    Les bulletins ne peuvent pas être générés sans configuration active.{' '}
                    <a href="/app/exams/settings" className="underline font-bold">Configurer →</a>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Config info */}
            {academicConfig && !noConfig && (
              <div className="flex items-center gap-2 text-xs px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 flex-wrap">
                <Settings className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-bold text-blue-700">Bulletin configuré :</span>
                <span className="text-blue-600">{academicConfig.country} · {academicConfig.periodType}</span>
                {showRank && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600">Rang affiché</Badge>}
                {showAppreciation && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600">Appréciation</Badge>}
                {showDecision && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600">Décision</Badge>}
                <a href="/app/exams/settings" className="ml-auto text-blue-600 hover:underline font-bold text-[10px]">
                  Modifier le modèle →
                </a>
              </div>
            )}

            {/* Filters + Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Classe</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="block text-sm font-bold border border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-400 py-2 px-3 min-w-[140px]"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Dynamic period — from config */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Période</label>
                  <select
                    value={selectedPeriodId}
                    onChange={(e) => setSelectedPeriodId(e.target.value)}
                    className="block text-sm font-bold border border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-400 py-2 px-3 min-w-[140px]"
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {bulletins.length > 0 && (
                  <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                    <span className="font-bold text-emerald-600">{publishedCount}</span> / {bulletins.length} publiés
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={handleGenerate}
                  disabled={generating || noConfig}
                  variant="outline"
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  {generating
                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Génération…</>
                    : <><RefreshCcw className="w-4 h-4 mr-1" />Recalculer</>}
                </Button>
                <Button
                  onClick={handlePublishAll}
                  disabled={publishingAll || bulletins.length === 0}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                >
                  {publishingAll
                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Publication…</>
                    : <><Share2 className="w-4 h-4 mr-1" />Publier Tout</>}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulletins.length === 0}
                  className="border-gray-200"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Impression Masse
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                      {showRank && (
                        <TableHead className="w-16 text-center text-xs font-black uppercase tracking-wider">Rang</TableHead>
                      )}
                      <TableHead className="text-xs font-black uppercase tracking-wider">Élève</TableHead>
                      <TableHead className="text-center text-xs font-black uppercase tracking-wider">
                        Moy. /{maxScore}
                      </TableHead>
                      {academicConfig && (
                        <TableHead className="text-xs font-black uppercase tracking-wider">Mention</TableHead>
                      )}
                      {showDecision && (
                        <TableHead className="text-xs font-black uppercase tracking-wider">Décision</TableHead>
                      )}
                      <TableHead className="text-xs font-black uppercase tracking-wider">Statut</TableHead>
                      <TableHead className="text-right pr-6 text-xs font-black uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {bulletins.map((b) => {
                        const avg = Number(b.generalAverage);
                        const passing = isPassingGrade(avg);
                        const isExpanded = expandedId === b.id;

                        return (
                          <>
                            <motion.tr
                              key={b.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className={cn(
                                'group transition-colors hover:bg-blue-50/20 cursor-pointer',
                                !passing && 'bg-rose-50/10'
                              )}
                              onClick={() => setExpandedId(isExpanded ? null : b.id)}
                            >
                              {showRank && (
                                <TableCell className="text-center py-3">
                                  <div className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-xs font-black',
                                    b.classRank === 1 ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' :
                                    b.classRank === 2 ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' :
                                    b.classRank === 3 ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' :
                                    'bg-gray-50 text-gray-400'
                                  )}>
                                    {b.classRank}
                                  </div>
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">
                                    {b.student.lastName} {b.student.firstName}
                                  </span>
                                  {b.student.matricule && (
                                    <span className="text-[10px] text-gray-400 font-mono">{b.student.matricule}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={cn('font-black text-sm px-3 border-none', getScoreColor(avg))}>
                                  {avg.toFixed(decimals)}
                                </Badge>
                              </TableCell>
                              {academicConfig && (
                                <TableCell>
                                  <span className="text-xs font-semibold text-gray-600">
                                    {getAppreciation(avg) || '—'}
                                  </span>
                                </TableCell>
                              )}
                              {showDecision && (
                                <TableCell>
                                  {b.promotionDecision ? (
                                    <Badge
                                      className={cn(
                                        'text-xs border-none',
                                        b.promotionDecision === 'ADMITTED'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : b.promotionDecision === 'REVIEW_REQUIRED'
                                            ? 'bg-amber-50 text-amber-700'
                                            : 'bg-rose-50 text-rose-700'
                                      )}
                                    >
                                      {b.promotionDecision === 'ADMITTED' ? (
                                        <><CheckCircle className="w-3 h-3 mr-1" />Admis</>
                                      ) : b.promotionDecision === 'REVIEW_REQUIRED' ? (
                                        <><AlertCircle className="w-3 h-3 mr-1" />À revoir</>
                                      ) : (
                                        <><XCircle className="w-3 h-3 mr-1" />{b.promotionDecision}</>
                                      )}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell>
                                {b.isPublished ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-xs">
                                    <CheckCircle className="w-3 h-3 mr-1" />Publié
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-gray-400 text-xs">Brouillon</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                    onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : b.id); }}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(b.id, `${b.student.lastName} ${b.student.firstName}`);
                                    }}
                                    disabled={downloadingId === b.id}
                                  >
                                    {downloadingId === b.id
                                      ? <Loader2 className="w-4 h-4 animate-spin" />
                                      : <Download className="w-4 h-4" />}
                                  </Button>
                                </div>
                              </TableCell>
                            </motion.tr>

                            {/* Expanded row — subject details */}
                            <AnimatePresence>
                              {isExpanded && b.subjectAverages && (
                                <tr key={`${b.id}-detail`}>
                                  <td colSpan={showRank ? 7 : 6} className="p-0">
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden bg-blue-50/30 border-t border-blue-100"
                                    >
                                      <div className="p-4">
                                        <p className="text-xs font-black uppercase tracking-wider text-blue-700 mb-3 flex items-center gap-1.5">
                                          <Award className="w-3.5 h-3.5" />
                                          Détail par matière
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                          {b.subjectAverages.map((s: any) => (
                                            <div
                                              key={s.subjectName}
                                              className="bg-white rounded-lg p-3 border border-blue-100 space-y-1"
                                            >
                                              <p className="text-[10px] font-black text-gray-500 uppercase truncate">
                                                {s.subjectName}
                                              </p>
                                              <p className={cn('text-lg font-black', getScoreColor(s.average))}>
                                                {Number(s.average).toFixed(decimals)}
                                                <span className="text-xs text-gray-400 ml-1">/{s.maxScore ?? maxScore}</span>
                                              </p>
                                              <p className="text-[10px] text-gray-400">Coeff. ×{s.coefficient}</p>
                                            </div>
                                          ))}
                                        </div>
                                        {b.teacherComment && showAppreciation && (
                                          <div className="mt-3 p-3 bg-white rounded-lg border border-blue-100">
                                            <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Appréciation</p>
                                            <p className="text-xs text-gray-700 italic">"{b.teacherComment}"</p>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </>
                        );
                      })}
                    </AnimatePresence>

                    {bulletins.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-20">
                          <div className="max-w-sm mx-auto flex flex-col items-center gap-3">
                            <FileCheck className="w-12 h-12 text-gray-200" />
                            <p className="text-gray-500 text-sm font-semibold">
                              Aucun bulletin pour cette période
                            </p>
                            <p className="text-xs text-gray-400">
                              Lancez d'abord le calcul des moyennes, puis générez les bulletins.
                            </p>
                            {!noConfig && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGenerate}
                                disabled={generating}
                                className="border-blue-200 text-blue-600 hover:bg-blue-50"
                              >
                                <RefreshCcw className="w-4 h-4 mr-1" />
                                Générer maintenant
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        ),
      }}
    />
  );
}
