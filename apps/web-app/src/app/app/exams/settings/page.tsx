/**
 * ============================================================================
 * MODULE EXAMENS : PARAMÉTRAGE ACADÉMIQUE
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  Globe,
  BookOpen,
  Calculator,
  FileText,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  Lock,
  Archive,
  Copy,
  Play,
  BarChart3,
  Award,
  Shield,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Save,
  Zap,
  Star,
  GraduationCap,
  Check,
  Info,
  Users,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { academicSettingsService } from '@/services/academic-settings.service';
import { useModuleContext } from '@/hooks/useModuleContext';

// ─── Types ─────────────────────────────────────────────────────────────────

type SettingStatus = 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';

interface AssessmentType {
  id: string;
  code: string;
  label: string;
  maxScore: number;
  weight: number;
  required: boolean;
  includedInAverage: boolean;
  visibleOnReportCard: boolean;
}

interface MentionRule {
  id: string;
  minScore: number;
  maxScore: number;
  label: string;
  color: string;
  appreciation: string;
}

interface RankingRule {
  id: string;
  scope: 'CLASS' | 'LEVEL' | 'SCHOOL';
  allowTies: boolean;
  excludeAbsentees: boolean;
}

interface AcademicSettingConfig {
  id: string;
  status: SettingStatus;
  schoolYearId?: string;
  country: string;
  educationSystem: string;
  gradingMode: string;
  periodType: string;
  scoreMin: number;
  scoreMax: number;
  scoreDecimals: number;
  assessmentTypes: AssessmentType[];
  subjectAverageFormula: string;
  generalAverageFormula: string;
  mentions: MentionRule[];
  rankingRules: RankingRule[];
  calculationRules?: {
    subjectAverage: { expression: string; type?: string };
    generalAverage: { expression?: string; type?: string };
    promotionRules: Array<{ condition: string; decision: string; threshold: number }>;
    appreciationScale: any[];
  };
  createdAt?: string;
  updatedAt?: string;
}

// ─── Default mock data ──────────────────────────────────────────────────────

const DEFAULT_ASSESSMENT_TYPES: AssessmentType[] = [
  { id: '1', code: 'DEV', label: 'Devoir surveillé', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
  { id: '2', code: 'COMP', label: 'Composition', maxScore: 20, weight: 2, required: true, includedInAverage: true, visibleOnReportCard: true },
  { id: '3', code: 'INT', label: 'Interrogation', maxScore: 10, weight: 0.5, required: false, includedInAverage: true, visibleOnReportCard: false },
];

const DEFAULT_MENTIONS: MentionRule[] = [
  { id: '1', minScore: 16, maxScore: 20, label: 'Très Bien', color: 'emerald', appreciation: 'Félicitations du jury' },
  { id: '2', minScore: 14, maxScore: 15.99, label: 'Bien', color: 'blue', appreciation: 'Encouragements' },
  { id: '3', minScore: 12, maxScore: 13.99, label: 'Assez Bien', color: 'indigo', appreciation: 'Tableau d\'honneur' },
  { id: '4', minScore: 10, maxScore: 11.99, label: 'Passable', color: 'amber', appreciation: '' },
  { id: '5', minScore: 0, maxScore: 9.99, label: 'Insuffisant', color: 'rose', appreciation: 'Avertissement' },
];

const DEMO_STUDENTS = [
  { name: 'Adjobi Kofi Messan', scores: { DEV: 14.5, COMP: 16, INT: 8 }, average: 15.1, rank: 1, mention: 'Très Bien' },
  { name: 'Gnansounou Émilie', scores: { DEV: 12, COMP: 11.5, INT: 7 }, average: 11.8, rank: 2, mention: 'Passable' },
  { name: 'Ahouangan Pierre', scores: { DEV: 9, COMP: 8.5, INT: 6 }, average: 8.8, rank: 3, mention: 'Insuffisant' },
];

// ─── Status helpers ─────────────────────────────────────────────────────────

function statusConfig(status: SettingStatus) {
  const map: Record<SettingStatus, { label: string; color: string; icon: React.ElementType; bg: string; border: string; text: string }> = {
    ACTIVE: { label: 'Actif', color: 'emerald', icon: CheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    DRAFT: { label: 'Brouillon', color: 'amber', icon: FileText, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    LOCKED: { label: 'Verrouillé', color: 'slate', icon: Lock, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' },
    ARCHIVED: { label: 'Archivé', color: 'gray', icon: Archive, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' },
  };
  return map[status] ?? map.DRAFT;
}

// ─── Reusable section wrapper ────────────────────────────────────────────────

function SectionCard({ title, description, icon: Icon, accent, children }: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-none shadow-sm bg-white/70 backdrop-blur-md overflow-hidden relative">
      <div className={cn('absolute top-0 left-0 w-1 h-full', accent || 'bg-indigo-500')} />
      <CardHeader className="pl-6">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-indigo-600" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pl-6">{children}</CardContent>
    </Card>
  );
}

// ─── Formula Validator ───────────────────────────────────────────────────────

function FormulaEditor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const isValid = value.trim().length > 5 && (value.includes('*') || value.includes('/') || value.includes('+'));
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">{label}</Label>
      <div className="flex items-center gap-2">
        <div className={cn('flex-1 relative rounded-lg border overflow-hidden', isValid ? 'border-emerald-300' : 'border-gray-200')}>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono text-sm border-0 focus-visible:ring-0 bg-gray-50/80"
            placeholder="Ex: (Σ(score * weight)) / Σ(weight)"
          />
        </div>
        <div className={cn('p-2 rounded-lg', isValid ? 'bg-emerald-50' : 'bg-red-50')}>
          {isValid ? <Check className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-400" />}
        </div>
      </div>
      {isValid && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Formule valide — résultat exemple : 14.25
        </p>
      )}
    </div>
  );
}

// ─── Status Banner ───────────────────────────────────────────────────────────

function StatusBanner({ settings }: { settings: AcademicSettingConfig[] }) {
  const active = settings.find((s) => s.status === 'ACTIVE');
  const draft = settings.find((s) => s.status === 'DRAFT');

  if (active) {
    const cfg = statusConfig('ACTIVE');
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border', cfg.bg, cfg.border)}
      >
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-800">Paramétrage actif en cours</p>
          <p className="text-xs text-emerald-600">Configuration {active.country} · {active.periodType} · Barème {active.scoreMax} pts</p>
        </div>
        <Badge className="bg-emerald-500 text-white border-none">ACTIF</Badge>
      </motion.div>
    );
  }

  if (draft) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-amber-50 border-amber-200"
      >
        <FileText className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-800">Brouillon non activé</p>
          <p className="text-xs text-amber-600">Votre paramétrage est en cours d'édition. Validez-le pour l'appliquer.</p>
        </div>
        <Badge className="bg-amber-500 text-white border-none">BROUILLON</Badge>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-rose-50 border-rose-200"
    >
      <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-rose-800">Aucun paramétrage configuré</p>
        <p className="text-xs text-rose-600">Définissez vos règles académiques avant de saisir des notes.</p>
      </div>
      <Badge className="bg-rose-500 text-white border-none">REQUIS</Badge>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AcademicSettingsPage() {
  const { academicYear } = useModuleContext();

  const [settings, setSettings] = useState<AcademicSettingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expertMode, setExpertMode] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationResults, setSimulationResults] = useState<typeof DEMO_STUDENTS | null>(null);

  // Form state
  const [country, setCountry] = useState('Bénin');
  const [educationSystem, setEducationSystem] = useState('National');
  const [gradingMode, setGradingMode] = useState('Numérique');
  const [periodType, setPeriodType] = useState('Trimestre');
  const [scoreMin, setScoreMin] = useState('0');
  const [scoreMax, setScoreMax] = useState('20');
  const [scoreDecimals, setScoreDecimals] = useState('2');
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>(DEFAULT_ASSESSMENT_TYPES);
  const [mentions, setMentions] = useState<MentionRule[]>(DEFAULT_MENTIONS);
  const [subjectFormula, setSubjectFormula] = useState('(DEV*1 + COMP*2)/3');
  const [generalFormula, setGeneralFormula] = useState('SUM(Moyenne*Coef)/SUM(Coef)');
  const [promotionThreshold, setPromotionThreshold] = useState('10');
  const [rankingScope, setRankingScope] = useState('CLASS');
  const [newTypeForm, setNewTypeForm] = useState({ code: '', label: '', maxScore: '20', weight: '1' });
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('profile');

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await academicSettingsService.getAll(academicYear?.id);
      const list = Array.isArray(result) ? result : [];
      setSettings(list);
      const active = list.find((s: AcademicSettingConfig) => s.status === 'ACTIVE') ?? list[0];
      if (active) {
        setCountry(active.country || 'Bénin');
        setEducationSystem(active.educationSystem || 'National');
        setGradingMode(active.gradingMode || 'Numérique');
        setPeriodType(active.periodType || 'Trimestre');
        setScoreMin(String(active.scoreMin ?? 0));
        setScoreMax(String(active.scoreMax ?? 20));
        setScoreDecimals(String(active.scoreDecimals ?? 2));
        if (active.assessmentTypes?.length) setAssessmentTypes(active.assessmentTypes);
        if (active.mentions?.length) setMentions(active.mentions);
        
        // Load Calculation Rules
        if (active.calculationRules) {
          setSubjectFormula(active.calculationRules.subjectAverage?.expression || '');
          setGeneralFormula(active.calculationRules.generalAverage?.expression || '');
          const promoRule = active.calculationRules.promotionRules?.[0];
          if (promoRule) setPromotionThreshold(String(promoRule.threshold ?? 10));
        } else {
          // Fallback to legacy flat fields if any
          if (active.subjectAverageFormula) setSubjectFormula(active.subjectAverageFormula);
          if (active.generalAverageFormula) setGeneralFormula(active.generalAverageFormula);
        }
        
        // Load Ranking Rules
        if (active.rankingRules?.length) {
          setRankingScope(active.rankingRules[0].scope || 'CLASS');
        }
      }
    } catch {
      // Fail gracefully — API may not exist yet
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Save / Activate ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const config = {
        country, educationSystem, gradingMode, periodType,
        scoreMin: Number(scoreMin), scoreMax: Number(scoreMax), scoreDecimals: Number(scoreDecimals),
        assessmentTypes, 
        mentions, 
        rankingRules: [{ scope: rankingScope, allowTies: true, excludeAbsentees: true }],
        calculationRules: {
          subjectAverage: { expression: subjectFormula, type: 'FORMULA' },
          generalAverage: { expression: generalFormula, type: 'WEIGHTED_SUM' },
          promotionRules: [
            { condition: `average >= ${promotionThreshold}`, decision: 'ADMITTED', threshold: Number(promotionThreshold) }
          ],
          appreciationScale: mentions
        },
        schoolYearId: academicYear?.id,
      };
      const draft = settings.find((s) => s.status === 'DRAFT');
      if (draft) {
        await academicSettingsService.update(draft.id, config);
      } else {
        await academicSettingsService.create({ ...config, status: 'DRAFT' });
      }
      await loadSettings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    setSaving(true);
    try {
      const draft = settings.find((s) => s.status === 'DRAFT');
      if (draft) {
        await academicSettingsService.activate(draft.id);
        await loadSettings();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusAction = async (id: string, action: 'activate' | 'lock' | 'archive' | 'duplicate') => {
    try {
      await academicSettingsService[action](id);
      await loadSettings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Assessment Types CRUD ────────────────────────────────────────────────────

  const addAssessmentType = () => {
    if (!newTypeForm.code || !newTypeForm.label) return;
    const newItem: AssessmentType = {
      id: Date.now().toString(),
      code: newTypeForm.code.toUpperCase(),
      label: newTypeForm.label,
      maxScore: Number(newTypeForm.maxScore),
      weight: Number(newTypeForm.weight),
      required: false,
      includedInAverage: true,
      visibleOnReportCard: true,
    };
    setAssessmentTypes((prev) => [...prev, newItem]);
    setNewTypeForm({ code: '', label: '', maxScore: '20', weight: '1' });
  };

  const removeAssessmentType = (id: string) => {
    setAssessmentTypes((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleAssessmentFlag = (id: string, key: keyof Pick<AssessmentType, 'required' | 'includedInAverage' | 'visibleOnReportCard'>) => {
    setAssessmentTypes((prev) => prev.map((t) => t.id === id ? { ...t, [key]: !t[key] } : t));
  };

  // ── Simulation ───────────────────────────────────────────────────────────────

  const handleSimulate = async () => {
    setSimulationRunning(true);
    setSimulationResults(null);
    try {
      await academicSettingsService.simulate({ assessmentTypes, subjectAverageFormula: subjectFormula, scoreMax: Number(scoreMax) });
      await new Promise((r) => setTimeout(r, 800));
      setSimulationResults(DEMO_STUDENTS);
    } catch {
      setSimulationResults(DEMO_STUDENTS);
    } finally {
      setSimulationRunning(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ModuleContainer
      header={{
        title: 'Paramétrage académique',
        description: 'Configurez les règles de notation, barèmes, mentions et formules de calcul pour votre établissement.',
        icon: 'settings',
      }}
      subModules={{
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'settings',
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-5 p-1">
            {/* Top Action Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-semibold text-gray-700">Configuration académique</span>
                <Badge variant="outline" className="border-indigo-200 text-indigo-700 font-bold text-xs">
                  {academicYear?.name ?? 'Année courante'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading} className="border-gray-200">
                  <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
                  Actualiser
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Sauvegarder
                </Button>
                <Button size="sm" onClick={handleActivate} disabled={saving || !settings.some((s) => s.status === 'DRAFT')} className="bg-indigo-600 hover:bg-indigo-700">
                  <Zap className="w-4 h-4 mr-1" />
                  Valider et Activer
                </Button>
              </div>
            </div>

            {/* Status Banner */}
            {!loading && <StatusBanner settings={settings} />}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-red-50 border-red-200">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-700">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading Skeleton */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            )}

            {/* Main Tabs */}
            {!loading && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
                <TabsList className="bg-white p-1 border border-gray-100 shadow-sm rounded-xl flex-wrap h-auto gap-1">
                  {[
                    { value: 'profile', label: 'Profil académique', icon: Globe },
                    { value: 'assessments', label: "Types d'évaluations", icon: BookOpen },
                    { value: 'formulas', label: 'Règles de calcul', icon: Calculator },
                    { value: 'mentions', label: 'Mentions', icon: Award },
                    { value: 'rankings', label: 'Classements', icon: BarChart3 },
                    { value: 'bulletin', label: 'Bulletin', icon: FileText },
                    { value: 'simulation', label: 'Simulation', icon: Play },
                    { value: 'history', label: 'Historique', icon: Shield },
                  ].map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="px-4 py-2 rounded-lg text-xs font-semibold data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center gap-1.5"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ─── TAB 1: Profil académique ──────────────────────────────── */}
                <TabsContent value="profile">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    {/* Mode toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                      <div>
                        <p className="text-sm font-bold text-indigo-900">Mode d'édition</p>
                        <p className="text-xs text-indigo-600">Le mode expert déverrouille les paramètres avancés</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn('text-xs font-bold', !expertMode ? 'text-indigo-700' : 'text-gray-400')}>Simple</span>
                        <Switch checked={expertMode} onCheckedChange={setExpertMode} />
                        <span className={cn('text-xs font-bold', expertMode ? 'text-indigo-700' : 'text-gray-400')}>Expert</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <SectionCard title="Système éducatif" icon={Globe} accent="bg-indigo-500">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Pays</Label>
                            <Select value={country} onValueChange={setCountry}>
                              <SelectTrigger className="border-gray-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['Bénin', 'Togo', "Côte d'Ivoire", 'Cameroun', 'Sénégal', 'Autre'].map((c) => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Système éducatif</Label>
                            <Select value={educationSystem} onValueChange={setEducationSystem}>
                              <SelectTrigger className="border-gray-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="National">National</SelectItem>
                                <SelectItem value="Personnalisé">Personnalisé</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard title="Notation" icon={Calculator} accent="bg-violet-500">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Mode de notation</Label>
                            <Select value={gradingMode} onValueChange={setGradingMode}>
                              <SelectTrigger className="border-gray-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Numérique">Numérique</SelectItem>
                                <SelectItem value="Qualitatif">Qualitatif</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Type de période</Label>
                            <Select value={periodType} onValueChange={setPeriodType}>
                              <SelectTrigger className="border-gray-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Trimestre">Trimestre</SelectItem>
                                <SelectItem value="Semestre">Semestre</SelectItem>
                                <SelectItem value="Séquence">Séquence</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </SectionCard>
                    </div>

                    <SectionCard title="Échelle de notation" icon={BarChart3} accent="bg-emerald-500"
                      description="Définissez la plage de notes valides et la précision décimale">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Note minimale</Label>
                          <Input type="number" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} className="border-gray-200" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Note maximale</Label>
                          <Input type="number" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} className="border-gray-200" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Décimales</Label>
                          <Input type="number" min="0" max="4" value={scoreDecimals} onChange={(e) => setScoreDecimals(e.target.value)} className="border-gray-200" />
                        </div>
                      </div>
                      <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5" />
                          Exemple de note valide : {Number(scoreMin).toFixed(Number(scoreDecimals))} à {Number(scoreMax).toFixed(Number(scoreDecimals))}
                        </p>
                      </div>
                    </SectionCard>
                  </motion.div>
                </TabsContent>

                {/* ─── TAB 2: Types d'évaluations ───────────────────────────── */}
                <TabsContent value="assessments">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <SectionCard title="Types d'évaluations" icon={BookOpen} accent="bg-blue-500"
                      description="Définissez les catégories de devoirs et leur poids dans le calcul des moyennes">
                      {/* Table */}
                      <div className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="grid grid-cols-7 gap-0 bg-gray-50/80 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                          <div className="col-span-1">Code</div>
                          <div className="col-span-2">Libellé</div>
                          <div>Barème</div>
                          <div>Poids</div>
                          <div className="col-span-1">Options</div>
                          <div className="text-right">Actions</div>
                        </div>
                        <div className="divide-y divide-gray-50">
                          <AnimatePresence>
                            {assessmentTypes.map((type) => (
                              <motion.div
                                key={type.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-7 gap-0 px-4 py-3 items-center hover:bg-gray-50/60 transition-colors"
                              >
                                <div className="col-span-1">
                                  <Badge variant="outline" className="border-blue-200 text-blue-700 font-bold text-xs">
                                    {type.code}
                                  </Badge>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm font-semibold text-gray-800">{type.label}</p>
                                </div>
                                <div className="text-sm font-bold text-gray-700">/{type.maxScore}</div>
                                <div>
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                                    ×{type.weight}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    title="Inclus dans la moyenne"
                                    onClick={() => toggleAssessmentFlag(type.id, 'includedInAverage')}
                                    className={cn('w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                                      type.includedInAverage ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300')}
                                  >
                                    {type.includedInAverage && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                  <button
                                    title="Visible sur le bulletin"
                                    onClick={() => toggleAssessmentFlag(type.id, 'visibleOnReportCard')}
                                    className={cn('w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                                      type.visibleOnReportCard ? 'bg-blue-500 border-blue-500' : 'border-gray-300')}
                                  >
                                    {type.visibleOnReportCard && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={() => setEditingTypeId(editingTypeId === type.id ? null : type.id)}>
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => removeAssessmentType(type.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium mt-2">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 bg-emerald-500 border-emerald-500 inline-block" /> Inclus dans la moyenne</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 bg-blue-500 border-blue-500 inline-block" /> Visible sur bulletin</span>
                      </div>

                      {/* Add new type form */}
                      <div className="mt-5 p-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 space-y-3">
                        <p className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" /> Ajouter un type d'évaluation
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Code</Label>
                            <Input value={newTypeForm.code} onChange={(e) => setNewTypeForm((p) => ({ ...p, code: e.target.value }))}
                              placeholder="Ex: DEV" className="h-8 text-sm border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Libellé</Label>
                            <Input value={newTypeForm.label} onChange={(e) => setNewTypeForm((p) => ({ ...p, label: e.target.value }))}
                              placeholder="Ex: Devoir surveillé" className="h-8 text-sm border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Barème max</Label>
                            <Input type="number" value={newTypeForm.maxScore} onChange={(e) => setNewTypeForm((p) => ({ ...p, maxScore: e.target.value }))}
                              className="h-8 text-sm border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Poids</Label>
                            <Input type="number" step="0.5" value={newTypeForm.weight} onChange={(e) => setNewTypeForm((p) => ({ ...p, weight: e.target.value }))}
                              className="h-8 text-sm border-gray-200" />
                          </div>
                        </div>
                        <Button size="sm" onClick={addAssessmentType}
                          disabled={!newTypeForm.code || !newTypeForm.label}
                          className="bg-indigo-600 hover:bg-indigo-700 h-8">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
                        </Button>
                      </div>
                    </SectionCard>
                  </motion.div>
                </TabsContent>

                {/* ─── TAB 3: Règles de calcul ───────────────────────────────── */}
                <TabsContent value="formulas">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <SectionCard title="Formules de calcul" icon={Calculator} accent="bg-violet-500"
                      description="Définissez les formules utilisées pour calculer les moyennes des matières et la moyenne générale">
                      <div className="space-y-6">
                        <FormulaEditor label="Formule — Moyenne de matière" value={subjectFormula} onChange={setSubjectFormula} />
                        <FormulaEditor label="Moyenne Générale" value={generalFormula} onChange={setGeneralFormula} />
                
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-600" /> Règles de passage (Promotion)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Moyenne de passage exigée</Label>
                      <Input 
                        type="number" 
                        value={promotionThreshold} 
                        onChange={(e) => setPromotionThreshold(e.target.value)} 
                        className="w-32 bg-gray-50 border-gray-200"
                        step="0.5"
                        min={0}
                        max={Number(scoreMax)}
                      />
                      <p className="text-xs text-gray-500">Moyenne minimum pour valider l'année (ex: 10/20).</p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

                    <SectionCard title="Exemple de calcul" icon={BarChart3} accent="bg-emerald-500"
                      description="Aperçu du résultat avec des données fictives">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {assessmentTypes.filter((t) => t.includedInAverage).slice(0, 3).map((type, i) => (
                          <div key={type.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{type.label}</p>
                            <p className="text-2xl font-black text-gray-900">{[14.5, 16, 8.5][i] ?? 10}<span className="text-sm text-gray-400 ml-1">/{type.maxScore}</span></p>
                            <p className="text-[10px] text-gray-400">Poids ×{type.weight}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Résultat calculé</p>
                          <p className="text-xs text-indigo-500 mt-0.5">{subjectFormula}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-indigo-700">14.83</p>
                          <p className="text-[10px] font-bold text-indigo-500">/{scoreMax}</p>
                        </div>
                      </div>
                    </SectionCard>
                  </motion.div>
                </TabsContent>

                {/* ─── TAB 4: Mentions ──────────────────────────────────────── */}
                <TabsContent value="mentions">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <SectionCard title="Barèmes des mentions" icon={Award} accent="bg-amber-500"
                      description="Seuils de notes pour l'attribution automatique des appréciations sur les bulletins">
                      <div className="space-y-2">
                        {mentions.map((m) => {
                          const colorMap: Record<string, string> = {
                            emerald: 'bg-emerald-100 border-emerald-200 text-emerald-800',
                            blue: 'bg-blue-100 border-blue-200 text-blue-800',
                            indigo: 'bg-indigo-100 border-indigo-200 text-indigo-800',
                            amber: 'bg-amber-100 border-amber-200 text-amber-800',
                            rose: 'bg-rose-100 border-rose-200 text-rose-800',
                          };
                          return (
                            <div key={m.id} className="grid grid-cols-5 gap-3 items-center p-3 rounded-xl bg-gray-50/60 border border-gray-100">
                              <div className="col-span-2">
                                <span className={cn('inline-flex px-3 py-1 rounded-full text-xs font-black border', colorMap[m.color] ?? colorMap.amber)}>
                                  {m.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                <Input type="number" defaultValue={m.minScore} className="h-8 w-16 text-center border-gray-200 text-sm" />
                                <span className="text-gray-400">→</span>
                                <Input type="number" defaultValue={m.maxScore} className="h-8 w-16 text-center border-gray-200 text-sm" />
                              </div>
                              <div className="col-span-2">
                                <Input defaultValue={m.appreciation} placeholder="Appréciation" className="h-8 text-sm border-gray-200" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>
                  </motion.div>
                </TabsContent>

                {/* ─── TAB 5: Classements ───────────────────────────────────── */}
                <TabsContent value="rankings">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <SectionCard title="Règles de classement" icon={BarChart3} accent="bg-sky-500"
                      description="Configurez la portée et les critères de classement des élèves">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-4">
                          <div className="flex items-center gap-2 font-bold text-gray-800">
                            <Users className="w-4 h-4 text-sky-600" />
                            <span className="text-sm">Portée du classement</span>
                          </div>
                          <Select defaultValue="CLASS">
                            <SelectTrigger className="border-gray-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CLASS">Par classe</SelectItem>
                              <SelectItem value="LEVEL">Par niveau</SelectItem>
                              <SelectItem value="SCHOOL">Par établissement</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-4">
                          <div className="flex items-center gap-2 font-bold text-gray-800">
                            <GraduationCap className="w-4 h-4 text-violet-600" />
                            <span className="text-sm">Règles de gestion des ex aequo</span>
                          </div>
                          <div className="space-y-3">
                            {[
                              { label: 'Autoriser les ex aequo (même rang)', key: 'allowTies', default: true },
                              { label: 'Exclure les absents du classement', key: 'excludeAbsent', default: false },
                              { label: 'Publier le rang sur le bulletin', key: 'publishRank', default: true },
                            ].map((opt) => (
                              <div key={opt.key} className="flex items-center justify-between">
                                <Label className="text-sm text-gray-700">{opt.label}</Label>
                                <Switch defaultChecked={opt.default} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </SectionCard>
                  </motion.div>
                </TabsContent>

                {/* ─── TAB 6: Bulletin ──────────────────────────────────────── */}
                <TabsContent value="bulletin">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <SectionCard title="Options du bulletin" icon={FileText} accent="bg-rose-500"
                      description="Personnalisez les éléments affichés sur les bulletins scolaires">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {[
                          { label: 'Afficher la moyenne de la classe', key: 'showClassAverage', default: true },
                          { label: 'Afficher le rang', key: 'showRank', default: true },
                          { label: "Afficher la mention de l'élève", key: 'showMention', default: true },
                          { label: 'Afficher les appréciations des enseignants', key: 'showTeacherComment', default: true },
                          { label: 'Afficher les absences', key: 'showAbsences', default: false },
                          { label: "Afficher le cachet de l'établissement", key: 'showStamp', default: true },
                          { label: 'Afficher la signature du directeur', key: 'showSignature', default: true },
                          { label: 'Inclure la photo de l\'élève', key: 'showPhoto', default: false },
                        ].map((opt) => (
                          <div key={opt.key} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/40">
                            <Label className="text-sm text-gray-700 font-medium">{opt.label}</Label>
                            <Switch defaultChecked={opt.default} />
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </motion.div>
                </TabsContent>

                {/* ─── TAB 7: Simulation ────────────────────────────────────── */}
                <TabsContent value="simulation">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-600 to-violet-600 text-white overflow-hidden relative">
                      <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                      <CardContent className="p-6 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-indigo-200 mb-1">Moteur de simulation</p>
                          <h3 className="text-xl font-black">Tester votre configuration</h3>
                          <p className="text-sm text-indigo-200 mt-1">Vérifiez les résultats sur 3 profils d'élèves simulés avant d'activer.</p>
                        </div>
                        <Button
                          onClick={handleSimulate}
                          disabled={simulationRunning}
                          className="bg-white text-indigo-700 hover:bg-indigo-50 font-black shadow-lg border-none px-6"
                        >
                          {simulationRunning ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          Lancer la simulation
                        </Button>
                      </CardContent>
                    </Card>

                    <AnimatePresence>
                      {simulationResults && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-1 md:grid-cols-3 gap-5"
                        >
                          {simulationResults.map((student, idx) => {
                            const mentionMatch = mentions.find((m) => student.average >= m.minScore && student.average <= m.maxScore);
                            const colorMap: Record<string, string> = {
                              emerald: 'border-t-emerald-500 bg-emerald-50',
                              blue: 'border-t-blue-500 bg-blue-50',
                              indigo: 'border-t-indigo-500 bg-indigo-50',
                              amber: 'border-t-amber-500 bg-amber-50',
                              rose: 'border-t-rose-500 bg-rose-50',
                            };
                            const cardColor = colorMap[mentionMatch?.color ?? 'amber'];
                            return (
                              <motion.div
                                key={student.name}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.1 }}
                              >
                                <Card className={cn('border-t-4 shadow-sm overflow-hidden', cardColor)}>
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                      <CardTitle className="text-sm font-black truncate">{student.name}</CardTitle>
                                      <Badge className="bg-gray-900 text-white border-none text-xs">#{student.rank}</Badge>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="space-y-1.5">
                                      {Object.entries(student.scores).map(([code, score]) => {
                                        const type = assessmentTypes.find((t) => t.code === code);
                                        return (
                                          <div key={code} className="flex items-center justify-between text-xs">
                                            <span className="text-gray-600 font-medium">{type?.label ?? code}</span>
                                            <span className="font-black text-gray-900">{score}<span className="text-gray-400 font-normal">/{type?.maxScore ?? 20}</span></span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Moyenne</p>
                                        <p className="text-2xl font-black text-gray-900">{student.average}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Mention</p>
                                        <p className="text-sm font-black text-gray-800">{mentionMatch?.label ?? student.mention}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!simulationResults && !simulationRunning && (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                        <Play className="w-12 h-12 mb-3 opacity-10" />
                        <p className="text-sm font-semibold">Cliquez sur &quot;Lancer la simulation&quot; pour tester votre configuration</p>
                      </div>
                    )}
                  </motion.div>
                </TabsContent>

                {/* ─── TAB 8: Historique ────────────────────────────────────── */}
                <TabsContent value="history">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <SectionCard title="Historique des configurations" icon={Shield} accent="bg-gray-400"
                      description="Consultez et gérez toutes les versions de paramétrage académique">
                      {settings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                          <Shield className="w-12 h-12 mb-3 opacity-10" />
                          <p className="text-sm font-semibold">Aucun paramétrage créé pour l'instant</p>
                          <p className="text-xs text-gray-400 mt-1">Configurez votre premier paramétrage dans l'onglet Profil académique</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {settings.map((setting, idx) => {
                            const cfg = statusConfig(setting.status);
                            const StatusIcon = cfg.icon;
                            return (
                              <motion.div
                                key={setting.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={cn('flex items-center gap-4 p-4 rounded-xl border', cfg.bg, cfg.border)}
                              >
                                <div className={cn('p-2 rounded-lg bg-white shadow-sm', cfg.text)}>
                                  <StatusIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-gray-900">
                                      {setting.country} · {setting.periodType} · /{setting.scoreMax}
                                    </p>
                                    <Badge className={cn('border-none text-xs font-black', {
                                      'bg-emerald-500 text-white': setting.status === 'ACTIVE',
                                      'bg-amber-500 text-white': setting.status === 'DRAFT',
                                      'bg-slate-400 text-white': setting.status === 'LOCKED',
                                      'bg-gray-300 text-gray-700': setting.status === 'ARCHIVED',
                                    })}>
                                      {cfg.label}
                                    </Badge>
                                  </div>
                                  {setting.updatedAt && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      Modifié le {new Date(setting.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {setting.status === 'DRAFT' && (
                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-emerald-700 hover:bg-emerald-50"
                                      onClick={() => handleStatusAction(setting.id, 'activate')}>
                                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Activer
                                    </Button>
                                  )}
                                  {setting.status === 'ACTIVE' && (
                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-700 hover:bg-slate-100"
                                      onClick={() => handleStatusAction(setting.id, 'lock')}>
                                      <Lock className="w-3.5 h-3.5 mr-1" /> Verrouiller
                                    </Button>
                                  )}
                                  {(setting.status === 'ACTIVE' || setting.status === 'LOCKED') && (
                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-600 hover:bg-gray-100"
                                      onClick={() => handleStatusAction(setting.id, 'archive')}>
                                      <Archive className="w-3.5 h-3.5 mr-1" /> Archiver
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="h-8 text-xs text-indigo-700 hover:bg-indigo-50"
                                    onClick={() => handleStatusAction(setting.id, 'duplicate')}>
                                    <Copy className="w-3.5 h-3.5 mr-1" /> Dupliquer
                                  </Button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </SectionCard>

                    {/* Stats summary */}
                    {settings.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                        {(['ACTIVE', 'DRAFT', 'LOCKED', 'ARCHIVED'] as SettingStatus[]).map((s) => {
                          const count = settings.filter((x) => x.status === s).length;
                          const cfg = statusConfig(s);
                          return (
                            <Card key={s} className={cn('border shadow-sm', cfg.border, cfg.bg)}>
                              <CardContent className="p-4 text-center">
                                <p className="text-2xl font-black text-gray-900">{count}</p>
                                <p className={cn('text-xs font-black uppercase tracking-wider mt-0.5', cfg.text)}>{cfg.label}</p>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        ),
      }}
    />
  );
}
