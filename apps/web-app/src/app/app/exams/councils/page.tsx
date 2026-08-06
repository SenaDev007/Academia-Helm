/**
 * ============================================================================
 * MODULE EXAMENS — CONSEILS DE CLASSE (Refonte complète)
 * ============================================================================
 *
 * Fonctionnalités :
 *   1. Liste des conseils (avec filtre par trimestre/classe)
 *   2. Créer un conseil (modal)
 *   3. Détail du conseil → tableau des élèves avec :
 *      - Notes par matière (EM1/EM2/EC)
 *      - Assiduité (% de présence)
 *      - Analyse IA (observations + recommandations auto-générées)
 *      - Décision du conseil (Promotion, Encouragement, Avertissement, etc.)
 *   4. Bouton "Générer le PV" → procès-verbal PDF
 *
 * ⭐ L'analyse IA (ORION) analyse automatiquement :
 *    - Notes de l'élève (moyenne par évaluation)
 *    - Assiduité (présences/absences du trimestre)
 *    - Génére des observations et recommandations
 *    - Suggère une décision (HONOR_ROLL, ENCOURAGEMENT, PROMOTED, WARNING, etc.)
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import {
  Users, Loader2, ChevronDown, ChevronRight, Plus, Calendar,
  CheckCircle2, AlertCircle, Clock, FileText, Award, Zap,
  TrendingUp, Download, Gavel, Sparkles,
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

// ─── Pedagogical ordering ────────────────────────────────────────────────────
const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (const prefix of PEDAGOGICAL_ORDER) {
    if (upper.startsWith(prefix)) return PEDAGOGICAL_ORDER.indexOf(prefix);
  }
  return PEDAGOGICAL_ORDER.length;
};

const DECISION_CONFIG: Record<string, { label: string; color: string }> = {
  PROMOTED: { label: 'Promu', color: 'bg-emerald-100 text-emerald-700' },
  ENCOURAGEMENT: { label: 'Encouragement', color: 'bg-blue-100 text-blue-700' },
  HONOR_ROLL: { label: 'Félicitations', color: 'bg-purple-100 text-purple-700' },
  WARNING: { label: 'Avertissement', color: 'bg-amber-100 text-amber-700' },
  CONDITIONAL_PROMOTION: { label: 'Passage conditionnel', color: 'bg-orange-100 text-orange-700' },
  REPEATED: { label: 'Redoublement', color: 'bg-red-100 text-red-700' },
  TRANSFER_RECOMMENDED: { label: 'Réorientation', color: 'bg-slate-100 text-slate-700' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PLANNED: { label: 'Planifié', color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Terminé', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Annulé', color: 'bg-red-100 text-red-700' },
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CouncilsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);

  return (
    <ModuleContainer
      header={{ title: 'Conseils de classe', description: 'Programmation, analyse IA et décisions pédagogiques.', icon: 'users' }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'councils' }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
            <CouncilsContent />
          </Suspense>
        ),
      }}
    />
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function CouncilsContent() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  const [councils, setCouncils] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCouncil, setSelectedCouncil] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find((l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL');
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  // ── Load classes ──────────────────────────────────────────────────────────
  const loadClasses = useCallback(async () => {
    if (!schoolLevelUuid) return;
    try {
      const res = await fetch('/api/all-classes', { credentials: 'include' });
      const data = await res.json();
      const allClasses = Array.isArray(data) ? data : (data?.items || []);
      const levelClasses = allClasses.filter((c: any) =>
        c.schoolLevelId === schoolLevelUuid || c.schoolLevel?.id === schoolLevelUuid
      );
      levelClasses.sort((a: any, b: any) => {
        const idxA = pedagogicalSortIndex(a.name);
        const idxB = pedagogicalSortIndex(b.name);
        return idxA - idxB;
      });
      setClasses(levelClasses);
    } catch { setClasses([]); }
  }, [schoolLevelUuid]);

  // ── Load periods ──────────────────────────────────────────────────────────
  const loadPeriods = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const res = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPeriods(Array.isArray(data) ? data : []);
      }
    } catch { setPeriods([]); }
  }, [academicYear?.id]);

  // ── Load councils ─────────────────────────────────────────────────────────
  const loadCouncils = useCallback(async () => {
    if (!academicYear?.id || !schoolLevelUuid) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await apiClient.get('/institutional-exams/councils', {
        params: { academicYearId: academicYear.id },
      });
      setCouncils(Array.isArray(res.data) ? res.data : []);
    } catch { setCouncils([]); }
    finally { setLoading(false); }
  }, [academicYear?.id, schoolLevelUuid]);

  useEffect(() => { loadClasses(); loadPeriods(); }, [loadClasses, loadPeriods]);
  useEffect(() => { loadCouncils(); }, [loadCouncils]);

  // ── Create council ────────────────────────────────────────────────────────
  const handleCreate = async (data: any) => {
    try {
      await apiClient.post('/institutional-exams/councils', {
        ...data,
        academicYearId: academicYear?.id,
      });
      toastSuccess('Conseil créé', { description: `${data.title} programmé` });
      setShowCreateModal(false);
      loadCouncils();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    }
  };

  if (selectedCouncil) {
    return (
      <CouncilDetail
        councilId={selectedCouncil.id}
        councilName={selectedCouncil.className ? `Conseil — ${selectedCouncil.className}` : selectedCouncil.title}
        onBack={() => { setSelectedCouncil(null); loadCouncils(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Conseils de classe</h2>
          <Badge variant="outline" className="text-xs">{scopeLevel || '—'}</Badge>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
          <Plus className="w-4 h-4 mr-1" /> Programmer un conseil
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : councils.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <Gavel className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">Aucun conseil de classe programmé</p>
          <p className="text-sm text-gray-400 mt-1">Cliquez sur « Programmer un conseil » pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {councils.map((council) => {
            const statusCfg = STATUS_CONFIG[council.status] || STATUS_CONFIG.PLANNED;
            return (
              <div key={council.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedCouncil(council)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {(council.className || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{council.title || `Conseil — ${council.className}`}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {council.councilDate ? format(new Date(council.councilDate), 'd MMM yyyy à HH:mm', { locale: fr }) : 'Date non définie'}
                      {council.periodName && ` · ${council.periodName}`}
                      {council.decisionCount > 0 && ` · ${council.decisionCount} décision(s)`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-1 rounded text-xs font-bold', statusCfg.color)}>{statusCfg.label}</span>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateCouncilModal
          classes={classes}
          periods={periods}
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

// ─── Council Detail (with AI analysis + decisions) ──────────────────────────

function CouncilDetail({ councilId, councilName, onBack }: { councilId: string; councilName: string; onBack: () => void }) {
  const [council, setCouncil] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [savingDecision, setSavingDecision] = useState<string | null>(null);

  const loadCouncil = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/institutional-exams/councils/${councilId}`);
      setCouncil(res.data);
    } catch (err) { console.error('Error loading council:', err); }
    finally { setLoading(false); }
  }, [councilId]);

  const loadAIAnalysis = useCallback(async () => {
    setLoadingAI(true);
    try {
      const res = await apiClient.get(`/institutional-exams/councils/${councilId}/ai-analysis`);
      setAiAnalysis(res.data);
      // Auto-expand first student
      if (res.data?.analyses?.length > 0) {
        setExpandedStudents(new Set([res.data.analyses[0].studentId]));
      }
    } catch (err: any) {
      toastError('Erreur analyse IA', { description: err.response?.data?.message || err.message });
    } finally { setLoadingAI(false); }
  }, [councilId]);

  useEffect(() => { loadCouncil(); }, [loadCouncil]);

  const toggleStudent = (id: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSaveDecision = async (studentId: string, data: any) => {
    setSavingDecision(studentId);
    try {
      await apiClient.post(`/institutional-exams/councils/${councilId}/decisions/${studentId}`, data);
      toastSuccess('Décision enregistrée', { description: data.decision });
      loadCouncil();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setSavingDecision(null); }
  };

  const handleComplete = async () => {
    try {
      await apiClient.patch(`/institutional-exams/councils/${councilId}/complete`);
      toastSuccess('Conseil clôturé', { description: 'Le PV est disponible' });
      onBack();
    } catch (err: any) {
      toastError('Erreur', { description: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="text-sm">← Retour</Button>
          <h2 className="text-lg font-bold text-slate-900">{councilName}</h2>
          {council?.status && (
            <span className={cn('px-2 py-1 rounded text-xs font-bold', (STATUS_CONFIG[council.status] || STATUS_CONFIG.PLANNED).color)}>
              {(STATUS_CONFIG[council.status] || STATUS_CONFIG.PLANNED).label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={loadAIAnalysis}
            disabled={loadingAI}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm"
          >
            {loadingAI ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse…</> : <><Sparkles className="w-4 h-4 mr-2" />Analyse IA (ORION)</>}
          </Button>
          {council?.status !== 'COMPLETED' && (
            <Button onClick={handleComplete} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
              <CheckCircle2 className="w-4 h-4 mr-2" />Clôturer
            </Button>
          )}
        </div>
      </div>

      {/* Council info */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-4 text-xs text-slate-600">
        <span>Classe: <strong>{council?.className || '—'}</strong></span>
        <span>·</span>
        <span>Période: <strong>{council?.periodName || '—'}</strong></span>
        <span>·</span>
        <span>Élèves: <strong>{council?.students?.length || 0}</strong></span>
        {council?.chairFirstName && (<><span>·</span><span>Présidé par: <strong>{council.chairFirstName} {council.chairLastName}</strong></span></>)}
      </div>

      {/* AI Analysis results */}
      {aiAnalysis && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-3">
          <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-purple-900">Analyse IA (ORION) — {aiAnalysis.totalStudents} élèves analysés</p>
            <p className="text-xs text-purple-700">Les observations et recommandations ci-dessous sont générées automatiquement à partir des notes et de l'assiduité. L'enseignant peut les modifier avant validation.</p>
          </div>
        </div>
      )}

      {/* Students table */}
      {council?.students && council.students.length > 0 ? (
        <div className="space-y-3">
          {council.students.map((student: any) => {
            const isExpanded = expandedStudents.has(student.id);
            const aiData = aiAnalysis?.analyses?.find((a: any) => a.studentId === student.id);
            const existingDecision = student.decision;
            return (
              <div key={student.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Student header */}
                <button onClick={() => toggleStudent(student.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{student.lastName} {student.firstName}</div>
                      <div className="text-xs text-slate-500">{student.matricule || '—'} · {student.gender || '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {aiData?.average !== null && aiData?.average !== undefined && (
                      <span className="text-xs font-bold text-blue-700">
                        {aiData.isMaternelle
                          ? (aiData.average >= 2.5 ? 'TS' : aiData.average >= 1.5 ? 'S' : 'PS')
                          : `${aiData.average.toFixed(2)}/20`}
                      </span>
                    )}
                    {existingDecision && (
                      <span className={cn('px-2 py-1 rounded text-xs font-bold',
                        (DECISION_CONFIG[existingDecision.decision] || DECISION_CONFIG.PROMOTED).color)}>
                        {(DECISION_CONFIG[existingDecision.decision] || DECISION_CONFIG.PROMOTED).label}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3">
                    {/* AI Analysis */}
                    {aiData ? (
                      <div className="bg-purple-50/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-bold text-purple-900 uppercase">Analyse IA</span>
                        </div>
                        {/* Metrics row */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-white rounded p-2 text-center border border-purple-100">
                            <p className="text-[9px] uppercase text-slate-400">Moyenne</p>
                            <p className="font-bold text-blue-700">
                              {aiData.isMaternelle
                                ? (aiData.average >= 2.5 ? 'TS' : aiData.average >= 1.5 ? 'S' : 'PS')
                                : (aiData.average !== null ? `${aiData.average.toFixed(2)}/20` : '—')}
                            </p>
                          </div>
                          <div className="bg-white rounded p-2 text-center border border-purple-100">
                            <p className="text-[9px] uppercase text-slate-400">Assiduité</p>
                            <p className={cn('font-bold', aiData.attendanceRate >= 90 ? 'text-emerald-600' : aiData.attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600')}>
                              {aiData.attendanceRate.toFixed(0)}%
                            </p>
                          </div>
                          <div className="bg-white rounded p-2 text-center border border-purple-100">
                            <p className="text-[9px] uppercase text-slate-400">Absences éval.</p>
                            <p className="font-bold text-slate-700">{aiData.absentCount}/{aiData.totalEvaluations}</p>
                          </div>
                        </div>
                        {/* Observations */}
                        <div className="text-xs text-slate-700">
                          <p className="font-bold text-slate-900 mb-1">Observations:</p>
                          <p className="leading-relaxed">{aiData.appreciation}</p>
                        </div>
                        {/* Recommendations */}
                        {aiData.recommendation && (
                          <div className="text-xs text-slate-700">
                            <p className="font-bold text-slate-900 mb-1">Recommandations:</p>
                            <p className="leading-relaxed">{aiData.recommendation}</p>
                          </div>
                        )}
                        {/* Suggested decision */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-900">Décision suggérée:</span>
                          <span className={cn('px-2 py-0.5 rounded font-bold',
                            (DECISION_CONFIG[aiData.suggestedDecision] || DECISION_CONFIG.PROMOTED).color)}>
                            {(DECISION_CONFIG[aiData.suggestedDecision] || DECISION_CONFIG.PROMOTED).label}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Cliquez sur « Analyse IA (ORION) » pour générer l'analyse automatique.</p>
                    )}

                    {/* Decision form */}
                    <DecisionForm
                      studentId={student.id}
                      existingDecision={existingDecision}
                      suggestedDecision={aiData?.suggestedDecision}
                      suggestedAppreciation={aiData?.appreciation}
                      suggestedRecommendation={aiData?.recommendation}
                      onSave={handleSaveDecision}
                      saving={savingDecision === student.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun élève dans cette classe</p>
        </div>
      )}
    </div>
  );
}

// ─── Decision Form ──────────────────────────────────────────────────────────

function DecisionForm({
  studentId, existingDecision, suggestedDecision, suggestedAppreciation, suggestedRecommendation,
  onSave, saving,
}: {
  studentId: string;
  existingDecision?: any;
  suggestedDecision?: string;
  suggestedAppreciation?: string;
  suggestedRecommendation?: string;
  onSave: (studentId: string, data: any) => void;
  saving: boolean;
}) {
  const [decision, setDecision] = useState(existingDecision?.decision || suggestedDecision || 'PROMOTED');
  const [appreciation, setAppreciation] = useState(existingDecision?.appreciation || suggestedAppreciation || '');
  const [recommendation, setRecommendation] = useState(existingDecision?.recommendation || suggestedRecommendation || '');
  const [sanctions, setSanctions] = useState(existingDecision?.sanctions || '');

  return (
    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
      <p className="text-xs font-bold text-slate-700 uppercase">Décision du conseil</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <select
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
        >
          {Object.entries(DECISION_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <Button
          onClick={() => onSave(studentId, { decision, appreciation, recommendation, sanctions })}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          {existingDecision ? 'Modifier' : 'Enregistrer'}
        </Button>
      </div>
      <textarea
        value={appreciation}
        onChange={(e) => setAppreciation(e.target.value)}
        placeholder="Appréciation (observations sur l'élève)…"
        rows={2}
        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white resize-none"
      />
      <textarea
        value={recommendation}
        onChange={(e) => setRecommendation(e.target.value)}
        placeholder="Recommandations…"
        rows={2}
        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white resize-none"
      />
      <textarea
        value={sanctions}
        onChange={(e) => setSanctions(e.target.value)}
        placeholder="Sanctions (optionnel)…"
        rows={1}
        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white resize-none"
      />
    </div>
  );
}

// ─── Create Council Modal ───────────────────────────────────────────────────

function CreateCouncilModal({
  classes, periods, onCreate, onClose,
}: {
  classes: any[];
  periods: any[];
  onCreate: (data: any) => void;
  onClose: () => void;
}) {
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [periodId, setPeriodId] = useState(periods[0]?.id || '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Programmer un conseil de classe</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Conseil T1 — CI A"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Classe</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1">
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Trimestre</label>
            <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1">
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Date & heure</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mt-1"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="text-sm">Annuler</Button>
          <Button
            onClick={() => onCreate({ title, classId, periodId, councilDate: date })}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            Programmer
          </Button>
        </div>
      </div>
    </div>
  );
}
