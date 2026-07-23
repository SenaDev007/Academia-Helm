'use client';

/**
 * ============================================================================
 * MODULE EXAMEN — ONGLET PARAMÈTRES (Refonte complète)
 * ============================================================================
 *
 * 4 sous-onglets :
 *   1. Règles de calcul — Types d'évaluation + formules + politique d'absence + arrondi
 *   2. Barèmes & Mentions — Barème + mentions configurables + échelle qualitative maternelle
 *   3. Règles de classement — Portée + ex aequo + exclusion absents + visibilité rang
 *   4. Options du Bulletin — Moyenne/classe/mention/rang/absences/signatures/cachet/logo/QR
 *
 * Scope strict : tenant × année × niveau scolaire × piste linguistique
 * Le niveau scolaire et la piste linguistique viennent de l'URL (?level=PRIMAIRE&lang=FR)
 * ============================================================================
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Settings, Save, Loader2, RefreshCw, Zap, Plus, Trash2, Calculator,
  Award, Trophy, FileText, ChevronRight, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useBilingual } from '@/contexts/BilingualContext';
import { academicSettingsService } from '@/services/academic-settings.service';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules } from '../layout';
import { toast } from 'sonner';

// ─── Types d'évaluation par défaut selon le niveau ─────────────────────────

interface AssessmentType {
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

// ⭐ Valeurs par défaut par niveau + piste linguistique (PERSONNALISABLES par l'école)
const DEFAULT_ASSESSMENT_TYPES: Record<string, Record<string, AssessmentType[]>> = {
  MATERNELLE: {
    FR: [
      { code: 'EM1', label: 'Évaluation mensuelle 1', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EM2', label: 'Évaluation mensuelle 2', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EC', label: 'Évaluation certificative', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
    EN: [
      { code: 'FIRST_CA', label: 'First CA', maxScore: 40, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'SECOND_CA', label: 'Second CA', maxScore: 40, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EXAM', label: 'Exam', maxScore: 60, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
  },
  PRIMAIRE: {
    FR: [
      { code: 'EM1', label: 'Évaluation mensuelle 1', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EM2', label: 'Évaluation mensuelle 2', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EC', label: 'Évaluation certificative', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
    EN: [
      { code: 'FIRST_CA', label: 'First CA', maxScore: 40, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'SECOND_CA', label: 'Second CA', maxScore: 40, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EXAM', label: 'Exam', maxScore: 60, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
  },
  SECONDAIRE: {
    FR: [
      { code: 'INT1', label: 'Interrogation 1', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'INT2', label: 'Interrogation 2', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'DS1', label: 'Devoir surveillé 1', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'DS2', label: 'Devoir surveillé 2', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
    EN: [
      { code: 'FIRST_CA', label: 'First CA', maxScore: 40, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'SECOND_CA', label: 'Second CA', maxScore: 40, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EXAM', label: 'Exam', maxScore: 60, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
  },
};

// ⭐ Maternelle EN : système QUANTITATIF (pas qualitatif comme le FR)
// L'anglophone utilise le même système /100 que les autres niveaux EN
const DEFAULT_FORMULAS: Record<string, Record<string, { subject: string; general: string; description: string }>> = {
  MATERNELLE: {
    FR: {
      subject: 'Synthèse qualitative : TS=3, S=2, PS=1 — seuil de réussite (TS+S) ≥ seuil',
      general: 'Somme qualitative par domaine',
      description: 'Maternelle FR : évaluation qualitative TS/S/PS. Pas de moyenne numérique. Réussite si (TS+S) ≥ seuil fixé.',
    },
    EN: {
      subject: 'FIRST_CA + SECOND_CA + EXAM',
      general: 'SUM(total_matière) / (COUNT(matières) × 100)',
      description: 'Kindergarten EN : First CA (/40) + Second CA (/40) + Exam (/60) = Total /100 per subject. Quantitative system (NOT qualitative).',
    },
  },
  PRIMAIRE: {
    FR: {
      subject: '(EM1 + EM2 + EC) / 3',
      general: 'SUM(moyenne_matière) / COUNT(matières)',
      description: 'Primaire FR : 2 évaluations mensuelles + 1 certificative, /20, coefficient 1. Moyenne générale = moyenne arithmétique simple.',
    },
    EN: {
      subject: 'FIRST_CA + SECOND_CA + EXAM',
      general: 'SUM(total_matière) / (COUNT(matières) × 100)',
      description: 'Primary EN : First CA (/40) + Second CA (/40) + Exam (/60) = Total /100 per subject. General average = Sum of totals / (number of subjects × 100).',
    },
  },
  SECONDAIRE: {
    FR: {
      subject: '((INT1 + INT2) / 2 + DS1 + DS2) / 3',
      general: 'SUM(moyenne_matière × coefficient) / SUM(coefficients)',
      description: 'Secondaire FR : Moy. interros = (INT1 + INT2) / 2, note = (Moy_interros + DS1 + DS2) / 3. Avec coef : note × coef. Moy. générale = somme pondérée / somme coef.',
    },
    EN: {
      subject: 'FIRST_CA + SECOND_CA + EXAM',
      general: 'SUM(total_matière) / (COUNT(matières) × 100)',
      description: 'Secondary EN : First CA (/40) + Second CA (/40) + Exam (/60) = Total /100 per subject. General average = Sum of totals / (number of subjects × 100).',
    },
  },
};

const DEFAULT_MENTIONS: MentionRule[] = [
  { id: '1', minScore: 16, maxScore: 20, label: 'Très Bien', color: 'emerald', appreciation: 'Félicitations du jury' },
  { id: '2', minScore: 14, maxScore: 15.99, label: 'Bien', color: 'blue', appreciation: 'Encouragements' },
  { id: '3', minScore: 12, maxScore: 13.99, label: 'Assez Bien', color: 'cyan', appreciation: "Tableau d'honneur" },
  { id: '4', minScore: 10, maxScore: 11.99, label: 'Passable', color: 'amber', appreciation: '' },
  { id: '5', minScore: 0, maxScore: 9.99, label: 'Insuffisant', color: 'rose', appreciation: 'Avertissement' },
];

const QUALITATIVE_SCALE = [
  { code: 'TS', label: 'Très Satisfaisant', value: 3 },
  { code: 'S', label: 'Satisfaisant', value: 2 },
  { code: 'PS', label: 'Peu Satisfaisant', value: 1 },
];

// ⭐ État modifiable pour les annotations qualitatives (l'école peut personnaliser les libellés)
// Les valeurs (3/2/1) sont fixes, seuls les libellés sont modifiables

// ─── Composant principal ─────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams();
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { isEnabled: isBilingual } = useBilingual();

  const levelCode = searchParams.get('level') || '';
  const language = searchParams.get('lang') || (isBilingual ? '' : 'FR');

  const [activeSubTab, setActiveSubTab] = useState<'calculation' | 'mentions' | 'ranking' | 'bulletin'>('calculation');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('DRAFT');

  // Form state — Règles de calcul
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [subjectFormula, setSubjectFormula] = useState('');
  const [generalFormula, setGeneralFormula] = useState('');
  const [formulaDescription, setFormulaDescription] = useState('');
  const [absencePolicy, setAbsencePolicy] = useState<'ZERO' | 'EXCLUDE' | 'NOT_CLASSIFIED'>('EXCLUDE');
  const [roundingDecimals, setRoundingDecimals] = useState(2);
  const [roundingMode, setRoundingMode] = useState<'HALF_UP' | 'FLOOR' | 'CEIL'>('HALF_UP');

  // Form state — Barèmes & Mentions
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(20);
  const [passScore, setPassScore] = useState(10);
  const [qualitativeThreshold, setQualitativeThreshold] = useState(6);
  // ⭐ Annotations qualitatives entièrement modifiables (codes + libellés)
  // L'école peut personnaliser les codes ET les libellés
  // Les valeurs (3/2/1) restent fixes pour le calcul
  const [qualitativeItems, setQualitativeItems] = useState([
    { code: 'TS', label: 'Très Satisfaisant', value: 3 },
    { code: 'S', label: 'Satisfaisant', value: 2 },
    { code: 'PS', label: 'Peu Satisfaisant', value: 1 },
  ]);
  const [mentions, setMentions] = useState<MentionRule[]>(DEFAULT_MENTIONS);

  // Form state — Règles de classement
  const [rankingScope, setRankingScope] = useState<'CLASS' | 'LEVEL' | 'SCHOOL'>('CLASS');
  const [tieMode, setTieMode] = useState<'DENSE_RANK' | 'COMPETITION_RANK' | 'UNIQUE'>('DENSE_RANK');
  const [excludeAbsentees, setExcludeAbsentees] = useState(true);
  const [showRankOnBulletin, setShowRankOnBulletin] = useState(true);
  const [showClassAverage, setShowClassAverage] = useState(true);
  const [showHighestAverage, setShowHighestAverage] = useState(false);
  const [showLowestAverage, setShowLowestAverage] = useState(false);

  // Form state — Options du Bulletin
  const [showStudentAverage, setShowStudentAverage] = useState(true);
  const [showMention, setShowMention] = useState(true);
  const [showAbsences, setShowAbsences] = useState(true);
  const [showTeacherAppreciations, setShowTeacherAppreciations] = useState(true);
  const [showDirectorSignature, setShowDirectorSignature] = useState(true);
  const [showSchoolStamp, setShowSchoolStamp] = useState(true);
  const [showSchoolLogo, setShowSchoolLogo] = useState(true);
  const [showCoefficients, setShowCoefficients] = useState(true);
  const [showQRCode, setShowQRCode] = useState(true);

  const isMaternelle = levelCode === 'MATERNELLE';
  const isMaternelleFR = isMaternelle && (language || 'FR') === 'FR'; // ⭐ TS/S/PS seulement pour Maternelle FR
  const isPrimaire = levelCode === 'PRIMAIRE';
  const isSecondaire = levelCode === 'SECONDAIRE';

  // ── Charger la config existante ──────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    if (!academicYear?.id || !levelCode) return;
    setLoading(true);
    try {
      const all = await academicSettingsService.getAll(academicYear.id);
      const list = Array.isArray(all) ? all : [];
      // Filtrer par scope
      const scoped = list.filter((s: any) =>
        (s.levelCode || null) === levelCode &&
        (s.language || null) === (language || null)
      );
      const active = scoped.find((s: any) => s.status === 'ACTIVE') || scoped[0];

      if (active) {
        setSettingsId(active.id);
        setStatus(active.status || 'DRAFT');
        const cfg = active.config || {};
        if (cfg.assessmentTypes?.length) setAssessmentTypes(cfg.assessmentTypes);
        if (cfg.calculationRules?.subjectAverage?.expression) setSubjectFormula(cfg.calculationRules.subjectAverage.expression);
        if (cfg.calculationRules?.generalAverage?.expression) setGeneralFormula(cfg.calculationRules.generalAverage.expression);
        if (cfg.absencePolicy) setAbsencePolicy(cfg.absencePolicy);
        if (cfg.roundingDecimals != null) setRoundingDecimals(cfg.roundingDecimals);
        if (cfg.roundingMode) setRoundingMode(cfg.roundingMode);
        if (cfg.scoreMax) setScoreMax(cfg.scoreMax);
        if (cfg.passScore) setPassScore(cfg.passScore);
        if (cfg.qualitativeThreshold) setQualitativeThreshold(cfg.qualitativeThreshold);
        if (cfg.qualitativeItems?.length) setQualitativeItems(cfg.qualitativeItems);
        if (cfg.mentions?.length) setMentions(cfg.mentions);
        if (cfg.rankingScope) setRankingScope(cfg.rankingScope);
        if (cfg.tieMode) setTieMode(cfg.tieMode);
        if (cfg.excludeAbsentees != null) setExcludeAbsentees(cfg.excludeAbsentees);
        if (cfg.bulletinOptions) {
          const bo = cfg.bulletinOptions;
          setShowStudentAverage(bo.showStudentAverage !== false);
          setShowClassAverage(bo.showClassAverage !== false);
          setShowMention(bo.showMention !== false);
          setShowRankOnBulletin(bo.showRank !== false);
          setShowAbsences(bo.showAbsences !== false);
          setShowTeacherAppreciations(bo.showTeacherAppreciations !== false);
          setShowDirectorSignature(bo.showDirectorSignature !== false);
          setShowSchoolStamp(bo.showSchoolStamp !== false);
          setShowSchoolLogo(bo.showSchoolLogo !== false);
          setShowCoefficients(bo.showCoefficients !== false);
          setShowQRCode(bo.showQRCode !== false);
          setShowHighestAverage(bo.showHighestAverage || false);
          setShowLowestAverage(bo.showLowestAverage || false);
        }
      } else {
        // Pas de config existante → utiliser les valeurs par défaut selon le niveau
        const defaults = DEFAULT_ASSESSMENT_TYPES[levelCode]?.[language || 'FR'] || DEFAULT_ASSESSMENT_TYPES.PRIMAIRE?.FR;
        const formulas = DEFAULT_FORMULAS[levelCode]?.[language || 'FR'] || DEFAULT_FORMULAS.PRIMAIRE?.FR;
        setAssessmentTypes(defaults);
        setSubjectFormula(formulas.subject);
        setGeneralFormula(formulas.general);
        setFormulaDescription(formulas.description);
      }
    } catch {
      // Config inexistante → valeurs par défaut
      const defaults = DEFAULT_ASSESSMENT_TYPES[levelCode]?.[language || 'FR'] || DEFAULT_ASSESSMENT_TYPES.PRIMAIRE?.FR;
      const formulas = DEFAULT_FORMULAS[levelCode]?.[language || 'FR'] || DEFAULT_FORMULAS.PRIMAIRE?.FR;
      setAssessmentTypes(defaults);
      setSubjectFormula(formulas.subject);
      setGeneralFormula(formulas.general);
      setFormulaDescription(formulas.description);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, levelCode, language]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Sauvegarder ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!academicYear?.id || !levelCode) return;
    setSaving(true);
    try {
      const levelLabel = levelCode === 'MATERNELLE' ? 'Maternelle'
        : levelCode === 'PRIMAIRE' ? 'Primaire' : 'Secondaire';
      const langLabel = language ? ` ${language}` : '';
      const name = `Paramétrage ${levelLabel}${langLabel} — ${academicYear?.label || ''}`;

      const config = {
        assessmentTypes,
        calculationRules: {
          subjectAverage: { expression: subjectFormula, type: 'FORMULA' },
          generalAverage: { expression: generalFormula, type: isSecondaire ? 'WEIGHTED_SUM' : 'SIMPLE_AVERAGE' },
        },
        absencePolicy,
        roundingDecimals,
        roundingMode,
        scoreMin, scoreMax, passScore,
        qualitativeThreshold,
        qualitativeItems,
        mentions,
        rankingScope,
        tieMode,
        excludeAbsentees,
        bulletinOptions: {
          showStudentAverage, showClassAverage, showMention,
          showRank: showRankOnBulletin, showAbsences,
          showTeacherAppreciations, showDirectorSignature,
          showSchoolStamp, showSchoolLogo, showCoefficients,
          showQRCode, showHighestAverage, showLowestAverage,
        },
      };

      const payload = {
        name,
        countryCode: 'BJ',
        levelCode,
        language: language || null,
        schoolYearId: academicYear.id,
        config,
      };

      if (settingsId) {
        await academicSettingsService.update(settingsId, payload);
      } else {
        const result = await academicSettingsService.create({ ...payload, status: 'DRAFT' });
        if (result?.id) setSettingsId(result.id);
      }
      toast.success('✅ Paramètres enregistrés');
      await loadSettings();
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!settingsId) return;
    setSaving(true);
    try {
      await academicSettingsService.activate(settingsId);
      toast.success('✅ Paramètres activés');
      await loadSettings();
    } catch (err: any) {
      toast.error('Erreur activation', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Ajouter/Supprimer un type d'évaluation ────────────────────────────────
  const addAssessmentType = () => {
    setAssessmentTypes([...assessmentTypes, {
      code: '', label: '', maxScore: 20, weight: 1, required: true,
      includedInAverage: true, visibleOnReportCard: true,
    }]);
  };

  const removeAssessmentType = (index: number) => {
    setAssessmentTypes(assessmentTypes.filter((_, i) => i !== index));
  };

  const updateAssessmentType = (index: number, field: keyof AssessmentType, value: any) => {
    setAssessmentTypes(assessmentTypes.map((at, i) =>
      i === index ? { ...at, [field]: value } : at
    ));
  };

  // ── Ajouter/Supprimer une mention ─────────────────────────────────────────
  const addMention = () => {
    setMentions([...mentions, {
      id: crypto.randomUUID(),
      minScore: 0, maxScore: 20, label: 'Nouvelle mention',
      color: 'gray', appreciation: '',
    }]);
  };

  const removeMention = (id: string) => {
    setMentions(mentions.filter(m => m.id !== id));
  };

  const updateMention = (id: string, field: keyof MentionRule, value: any) => {
    setMentions(mentions.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des paramètres...</span>
      </div>
    );
  }

  const levelLabel = (availableLevels || []).find((l: any) =>
    (l.code || '').toUpperCase() === levelCode
  )?.label || levelCode;

  const SUB_TABS = [
    { id: 'calculation' as const, label: 'Règles de calcul', icon: Calculator },
    { id: 'mentions' as const, label: 'Barèmes & Mentions', icon: Award },
    { id: 'ranking' as const, label: 'Règles de classement', icon: Trophy },
    { id: 'bulletin' as const, label: 'Options du Bulletin', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-blue-200 text-blue-700 font-bold text-xs">
            {levelLabel} {language ? `· ${language}` : ''}
          </Badge>
          <Badge className={cn(
            "text-xs",
            status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
            status === 'LOCKED' ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {status === 'ACTIVE' ? '✅ Active' : status === 'LOCKED' ? '🔒 Verrouillée' : '✏️ Brouillon'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} /> Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Sauvegarder
          </Button>
          <Button size="sm" onClick={handleActivate} disabled={saving || !settingsId || status === 'ACTIVE'}>
            <Zap className="w-4 h-4 mr-1" /> Activer
          </Button>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 flex-wrap">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
                activeSubTab === tab.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100")}>
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* === SOUS-ONGLET 1 : RÈGLES DE CALCUL === */}
      {activeSubTab === 'calculation' && (
        <div className="space-y-4">
          {/* Description du système de calcul selon le niveau */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-blue-900">Système de calcul — {levelLabel}</h3>
                  <p className="text-xs text-blue-700 mt-1">
                    {DEFAULT_FORMULAS[levelCode]?.[language || 'FR']?.description || 'Configurez les règles de calcul ci-dessous.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Types d'évaluation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md flex items-center justify-between">
                <span>Types d'évaluation</span>
                <Button size="sm" variant="outline" onClick={addAssessmentType}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {assessmentTypes.map((at, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <Input placeholder="Code" value={at.code} maxLength={10}
                      onChange={e => updateAssessmentType(i, 'code', e.target.value.toUpperCase())}
                      className="w-24 text-xs font-mono flex-shrink-0" />
                    <Input placeholder="Nom de l'évaluation" value={at.label}
                      onChange={e => updateAssessmentType(i, 'label', e.target.value)}
                      className="flex-1 min-w-0 text-sm" />
                    <Input type="number" placeholder="Max" value={at.maxScore}
                      onChange={e => updateAssessmentType(i, 'maxScore', Number(e.target.value))}
                      className="w-20 text-center text-sm flex-shrink-0" />
                    <Input type="number" placeholder="Coef" value={at.weight}
                      onChange={e => updateAssessmentType(i, 'weight', Number(e.target.value))}
                      className="w-20 text-center text-sm flex-shrink-0" disabled={isPrimaire}
                      title={isPrimaire ? 'Primaire : coefficient toujours 1' : ''} />
                    <Button size="sm" variant="ghost" onClick={() => removeAssessmentType(i)} className="flex-shrink-0">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                ))}
                {assessmentTypes.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Aucun type d'évaluation. Cliquez sur "Ajouter".</p>
                )}
              </div>
              {/* Bouton de réinitialisation — SPÉCIFIQUE au niveau + piste sélectionnés */}
              <div className="mt-3">
                <button
                  onClick={() => {
                    const defaults = DEFAULT_ASSESSMENT_TYPES[levelCode]?.[language || 'FR'];
                    if (defaults) setAssessmentTypes([...defaults]);
                  }}
                  className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold border border-blue-200"
                >
                  ↻ Réinitialiser aux valeurs par défaut ({levelCode} · {language || 'FR'})
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Formules de calcul */}
          <Card>
            <CardHeader><CardTitle className="text-md">Formules de calcul</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Formule moyenne par matière</label>
                <Input value={subjectFormula} onChange={e => setSubjectFormula(e.target.value)}
                  placeholder="Ex: (CM + CP) / 2 ou ((INT1 + INT2) / 2 + DS1 + DS2) / 3"
                  className="font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Formule moyenne générale</label>
                <Input value={generalFormula} onChange={e => setGeneralFormula(e.target.value)}
                  placeholder="Ex: SUM(moyenne_matière) / COUNT(matières) ou SUM(moyenne × coef) / SUM(coef)"
                  className="font-mono text-sm" />
              </div>
              {isMaternelleFR && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-xs text-pink-800">
                  <strong>📌 Maternelle :</strong> Système qualitatif TS/S/PS.
                  TS = Très Satisfaisant (valeur 3), S = Satisfaisant (valeur 2), PS = Peu Satisfaisant (valeur 1).
                  Le système calcule en arrière-plan avec ces valeurs mais affiche TS/S/PS côté interface.
                  Seuil de réussite : (TS + S) ≥ seuil fixé dans l'onglet Barèmes & Mentions.
                </div>
              )}
              {isPrimaire && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <strong>📌 Primaire :</strong> CM (Critère Maximal, sur 18) + CP (Critère de Perfectionnement, sur 2) = note /20.
                  L'élève n'obtient le CP que s'il a au moins 10/18 au CM.
                  Le CP peut être 0, 1 ou 2 (jamais plus de 2).
                  Toutes les matières ont le coefficient 1 — la moyenne générale est arithmétique simple.
                </div>
              )}
              {isSecondaire && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-800">
                  <strong>📌 Secondaire :</strong> Moyenne interros = (INT1 + INT2) / 2.
                  Note matière = (Moy_interros + DS1 + DS2) / 3.
                  Avec coefficients : Note × coefficient = Moyenne coefficientée.
                  Moyenne générale = Somme(Moyenne_coef) / Somme(coefficients).
                </div>
              )}
            </CardContent>
          </Card>

          {/* Politique d'absence + Arrondi — PAS pour la maternelle FR (pas de notes numériques) */}
          {!isMaternelleFR && (
          <Card>
            <CardHeader><CardTitle className="text-md">Politique d'absence & Arrondi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Politique d'absence</label>
                  <select value={absencePolicy} onChange={e => setAbsencePolicy(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="EXCLUDE">Exclure de la moyenne</option>
                    <option value="ZERO">Note zéro</option>
                    <option value="NOT_CLASSIFIED">Non classé</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Mode d'arrondi</label>
                  <select value={roundingMode} onChange={e => setRoundingMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="HALF_UP">Demi vers le haut</option>
                    <option value="FLOOR">Toujours vers le bas</option>
                    <option value="CEIL">Toujours vers le haut</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Nombre de décimales</label>
                  <Input type="number" min={0} max={4} value={roundingDecimals}
                    onChange={e => setRoundingDecimals(Number(e.target.value))}
                    className="text-center" />
                </div>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      )}

      {/* === SOUS-ONGLET 2 : BARÈMES & MENTIONS === */}
      {activeSubTab === 'mentions' && (
        <div className="space-y-4">
          {/* Barème de notation */}
          {isMaternelleFR ? (
            // ⭐ Maternelle FR : échelle qualitative avec codes ET libellés modifiables
            <Card className="border-pink-200">
              <CardHeader>
                <CardTitle className="text-md">Échelle qualitative (Maternelle FR)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {qualitativeItems.map((qs, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-pink-50 rounded-lg p-2">
                      <Input
                        value={qs.code}
                        onChange={e => {
                          const updated = [...qualitativeItems];
                          updated[idx] = { ...qs, code: e.target.value.toUpperCase().substring(0, 5) };
                          setQualitativeItems(updated);
                        }}
                        className="w-20 text-center text-sm font-bold flex-shrink-0"
                        placeholder="Code"
                      />
                      <Input
                        value={qs.label}
                        onChange={e => {
                          const updated = [...qualitativeItems];
                          updated[idx] = { ...qs, label: e.target.value };
                          setQualitativeItems(updated);
                        }}
                        className="flex-1 min-w-0 text-sm"
                        placeholder="Libellé"
                      />
                      <span className="text-xs text-gray-500 flex-shrink-0 w-20 text-right">Valeur : {qs.value} (fixe)</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Valeur minimale</label>
                    <Input type="number" value={1} disabled className="text-center bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Valeur maximale</label>
                    <Input type="number" value={3} disabled className="text-center bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Seuil de réussite (moyenne)</label>
                    <Input type="number" value={2} disabled className="text-center bg-gray-50" />
                    <p className="text-[10px] text-gray-400 mt-1">Moyenne = (1+2+3)/3 = 2</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 italic">
                  ℹ️ Les codes et libellés sont personnalisables. Les valeurs (3, 2, 1) sont fixes et utilisées pour le calcul en arrière-plan.
                </p>
              </CardContent>
            </Card>
          ) : (
            // ⭐ Primaire/Secondaire/Maternelle EN : barème quantitatif + mentions
            <>
            <Card>
              <CardHeader><CardTitle className="text-md">Barème de notation</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Note minimale</label>
                    <Input type="number" value={scoreMin} onChange={e => setScoreMin(Number(e.target.value))} className="text-center" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Note maximale</label>
                    <Input type="number" value={scoreMax} onChange={e => setScoreMax(Number(e.target.value))} className="text-center" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Seuil de réussite</label>
                    <Input type="number" value={passScore} onChange={e => setPassScore(Number(e.target.value))} className="text-center" />
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Mentions — PAS pour la maternelle FR */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md flex items-center justify-between">
                <span>Mentions & Appréciations</span>
                <Button size="sm" variant="outline" onClick={addMention}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mentions.map(m => (
                  <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <Input type="number" placeholder="Min" value={m.minScore}
                      onChange={e => updateMention(m.id, 'minScore', Number(e.target.value))}
                      className="w-20 text-center text-sm" />
                    <span className="text-gray-400 flex-shrink-0">→</span>
                    <Input type="number" placeholder="Max" value={m.maxScore}
                      onChange={e => updateMention(m.id, 'maxScore', Number(e.target.value))}
                      className="w-20 text-center text-sm" />
                    <Input placeholder="Mention" value={m.label}
                      onChange={e => updateMention(m.id, 'label', e.target.value)}
                      className="w-36 text-sm font-semibold flex-shrink-0" />
                    <Input placeholder="Appréciation (optionnel)" value={m.appreciation}
                      onChange={e => updateMention(m.id, 'appreciation', e.target.value)}
                      className="flex-1 min-w-0 text-sm" />
                    <Button size="sm" variant="ghost" onClick={() => removeMention(m.id)} className="flex-shrink-0">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
            </>
          )}
        </div>
      )}

      {/* === SOUS-ONGLET 3 : RÈGLES DE CLASSEMENT === */}
      {activeSubTab === 'ranking' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-md">Configuration du classement</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Portée du classement</label>
                <select value={rankingScope} onChange={e => setRankingScope(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="CLASS">Par classe</option>
                  <option value="LEVEL">Par niveau scolaire</option>
                  <option value="SCHOOL">Toute l'école</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Gestion des ex aequo</label>
                <select value={tieMode} onChange={e => setTieMode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="DENSE_RANK">Sans saut — 1er, 2e, 2e, 3e (ex aequo conservés)</option>
                  <option value="COMPETITION_RANK">Avec saut — 1er, 2e, 2e ex, 4e (ex aequo avec saut)</option>
                  <option value="UNIQUE">Départage — pas d'ex aequo (chaque élève a un rang unique)</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <ToggleRow label="Exclure les absents du classement" checked={excludeAbsentees} onChange={setExcludeAbsentees} />
                <ToggleRow label="Afficher le rang sur le bulletin" checked={showRankOnBulletin} onChange={setShowRankOnBulletin} />
                <ToggleRow label="Afficher la moyenne de classe sur le bulletin" checked={showClassAverage} onChange={setShowClassAverage} />
                {!isMaternelleFR && (
                  <ToggleRow label="Afficher la plus forte moyenne" checked={showHighestAverage} onChange={setShowHighestAverage} />
                )}
                {!isMaternelleFR && (
                  <ToggleRow label="Afficher la plus faible moyenne" checked={showLowestAverage} onChange={setShowLowestAverage} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === SOUS-ONGLET 4 : OPTIONS DU BULLETIN === */}
      {activeSubTab === 'bulletin' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-md">Options d'affichage du bulletin</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <ToggleRow label="Afficher la moyenne de l'élève" checked={showStudentAverage} onChange={setShowStudentAverage} />
              <ToggleRow label="Afficher la moyenne de la classe" checked={showClassAverage} onChange={setShowClassAverage} />
              <ToggleRow label="Afficher la mention de l'élève" checked={showMention} onChange={setShowMention} />
              <ToggleRow label="Afficher le rang" checked={showRankOnBulletin} onChange={setShowRankOnBulletin} />
              <ToggleRow label="Afficher les absences" checked={showAbsences} onChange={setShowAbsences} />
              <ToggleRow label="Afficher les appréciations des enseignants" checked={showTeacherAppreciations} onChange={setShowTeacherAppreciations} />
              {!isMaternelleFR && (
                <ToggleRow label="Afficher les coefficients" checked={showCoefficients} onChange={setShowCoefficients} />
              )}
              {!isMaternelleFR && (
                <ToggleRow label="Afficher la plus forte moyenne" checked={showHighestAverage} onChange={setShowHighestAverage} />
              )}
              {!isMaternelleFR && (
                <ToggleRow label="Afficher la plus faible moyenne" checked={showLowestAverage} onChange={setShowLowestAverage} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-md">Signatures & Éléments visuels</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <ToggleRow label="Afficher la signature du directeur" checked={showDirectorSignature} onChange={setShowDirectorSignature} />
              <ToggleRow label="Afficher le cachet de l'établissement" checked={showSchoolStamp} onChange={setShowSchoolStamp} />
              <ToggleRow label="Inclure le logo/photo de l'école" checked={showSchoolLogo} onChange={setShowSchoolLogo} />
              <ToggleRow label="Inclure le QR code de vérification" checked={showQRCode} onChange={setShowQRCode} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Composant ToggleRow ─────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── Page export avec Suspense (useSearchParams nécessite Suspense) ──────────

export default function AcademicSettingsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  return (
    <ModuleContainer
      header={{
        title: 'Paramètres',
        description: 'Configuration du système d\'évaluation par niveau scolaire et piste linguistique.',
        icon: 'slidersHorizontal',
      }}
      subModules={{
        modules: scopedSubModules,
        activeModuleId: 'settings',
      }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
              <SettingsContent />
            </Suspense>
        ),
      }}
    />
  );
}
