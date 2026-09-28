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
 * Scope strict : tenant × année × niveau scolaire (piste linguistique déduite)
 * Le niveau scolaire vient de l'URL (?level=PRIMAIRE&lang=FR) — depuis la V10,
 * la piste linguistique est DÉDUITE du niveau (miroirs EN : Nursery/Primary).
 * ============================================================================
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Settings, Save, Loader2, RefreshCw, Zap, Plus, Trash2, Calculator,
  Award, Trophy, FileText, ChevronRight, AlertCircle, AlertTriangle, CheckCircle2,
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
import { academicSettingsService } from '@/services/academic-settings.service';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope, languageForLevel } from '../layout';
import { toastSuccess, toastError, toastWarning } from '@/lib/toast/toast-helpers';

// ─── Types d'évaluation par défaut selon le niveau ─────────────────────────

interface AssessmentType {
  code: string;
  label: string;
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
      { code: 'EM1', label: 'Évaluation mensuelle 1', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EM2', label: 'Évaluation mensuelle 2', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EC', label: 'Évaluation certificative', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EP', label: 'Évaluation de passage', required: false, includedInAverage: true, visibleOnReportCard: true },
    ],
    EN: [
      { code: 'FIRST_CA', label: 'First CA', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'SECOND_CA', label: 'Second CA', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EXAM', label: 'Exam', required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
  },
  PRIMAIRE: {
    FR: [
      { code: 'EM1', label: 'Évaluation mensuelle 1', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EM2', label: 'Évaluation mensuelle 2', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EC', label: 'Évaluation certificative', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EP', label: 'Évaluation de passage', required: false, includedInAverage: true, visibleOnReportCard: true },
    ],
    EN: [
      { code: 'FIRST_CA', label: 'First CA', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'SECOND_CA', label: 'Second CA', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EXAM', label: 'Exam', required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
  },
  SECONDAIRE: {
    FR: [
      { code: 'INT1', label: 'Interrogation 1', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'INT2', label: 'Interrogation 2', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'DS1', label: 'Devoir surveillé 1', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'DS2', label: 'Devoir surveillé 2', required: true, includedInAverage: true, visibleOnReportCard: true },
    ],
    EN: [
      { code: 'FIRST_CA', label: 'First CA', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'SECOND_CA', label: 'Second CA', required: true, includedInAverage: true, visibleOnReportCard: true },
      { code: 'EXAM', label: 'Exam', required: true, includedInAverage: true, visibleOnReportCard: true },
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

// ⭐ Mentions anglophones par défaut (/100)
const DEFAULT_EN_MENTIONS: MentionRule[] = [
  { id: '1', minScore: 90, maxScore: 100, label: 'Outstanding', color: 'emerald', appreciation: 'Excellent academic performance. Commendable effort and discipline.' },
  { id: '2', minScore: 80, maxScore: 89.99, label: 'Very Good', color: 'blue', appreciation: 'Very good results. Consistent effort is encouraged.' },
  { id: '3', minScore: 70, maxScore: 79.99, label: 'Good', color: 'cyan', appreciation: 'Good performance. Greater concentration will lead to better outcomes.' },
  { id: '4', minScore: 60, maxScore: 69.99, label: 'Fair', color: 'amber', appreciation: 'Fair results. Student is advised to work harder.' },
  { id: '5', minScore: 50, maxScore: 59.99, label: 'Pass', color: 'orange', appreciation: 'Results are just satisfactory. Stronger effort is necessary.' },
  { id: '6', minScore: 40, maxScore: 49.99, label: 'Weak', color: 'rose', appreciation: 'Performance below expectation. Immediate improvement is required.' },
  { id: '7', minScore: 0, maxScore: 39.99, label: 'Very Weak', color: 'red', appreciation: 'Very poor performance. Urgent remedial measures are required.' },
];

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

  const levelCode = searchParams.get('level') || '';
  // ⭐ V10 — la piste linguistique est DÉDUITE du niveau scolaire (miroirs EN) :
  //    NURSERY/PRIMARY → EN, MATERNELLE/PRIMAIRE/SECONDAIRE → FR.
  //    Plus de sélection manuelle de piste dans le module examen.
  const language = searchParams.get('lang') || languageForLevel(levelCode);

  // ⭐ V10 — niveau de BASE pour les valeurs par défaut : les miroirs EN partagent
  //    les défauts de leur niveau FR jumeau (NURSERY→MATERNELLE, PRIMARY→PRIMAIRE).
  const baseLevelCode = levelCode === 'NURSERY' ? 'MATERNELLE'
    : levelCode === 'PRIMARY' ? 'PRIMAIRE' : levelCode;

  const [activeSubTab, setActiveSubTab] = useState<'calculation' | 'mentions' | 'ranking' | 'bulletin' | 'distinctions'>('calculation');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('DRAFT');

  // ⭐ FEATURE — Partage du paramétrage entre Nursery et Primary (EN) :
  // les deux niveaux anglophones sont quantitatifs /100 avec les mêmes types
  // (First CA / Second CA / Examination) → l'école peut vouloir un paramétrage
  // unique. Par défaut : ACTIVÉ (exigence utilisateur). Persisté en localStorage.
  const siblingLevelCode = levelCode === 'NURSERY' ? 'PRIMARY'
    : levelCode === 'PRIMARY' ? 'NURSERY' : null;
  const canShareEnLevels = (language === 'EN') && !!siblingLevelCode;
  const [shareEnLevels, setShareEnLevels] = useState(true);
  const [siblingSettingsId, setSiblingSettingsId] = useState<string | null>(null);

  // Restaurer la préférence de partage depuis localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('exams_settings_share_nursery_primary');
      if (stored !== null) setShareEnLevels(stored === 'true');
    } catch { /* ignore */ }
  }, []);

  const toggleShareEnLevels = (checked: boolean) => {
    setShareEnLevels(checked);
    try {
      localStorage.setItem('exams_settings_share_nursery_primary', String(checked));
    } catch { /* ignore */ }
  };

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

  // ⭐ Form state — Distinctions & Sanctions (Secondaire uniquement)
  // Distinctions : Tableau d'honneur + Félicitations, Tableau d'honneur + Encouragements, Tableau d'honneur
  // Sanctions : Avertissement travail, Blâme travail
  // Chaque entrée : { id, label, minScore, maxScore, type: 'DISTINCTION' | 'SANCTION' }
  const [distinctions, setDistinctions] = useState([
    { id: 'd1', label: 'Tableau d\'honneur + Félicitations', minScore: 16, maxScore: 20, type: 'DISTINCTION' as const },
    { id: 'd2', label: 'Tableau d\'honneur + Encouragements', minScore: 14, maxScore: 15.99, type: 'DISTINCTION' as const },
    { id: 'd3', label: 'Tableau d\'honneur', minScore: 12, maxScore: 13.99, type: 'DISTINCTION' as const },
    { id: 's1', label: 'Avertissement travail', minScore: 8, maxScore: 9.99, type: 'SANCTION' as const },
    { id: 's2', label: 'Blâme travail', minScore: 0, maxScore: 7.99, type: 'SANCTION' as const },
  ]);

  const isMaternelle = levelCode === 'MATERNELLE';
  const isMaternelleFR = isMaternelle && (language || 'FR') === 'FR'; // ⭐ TS/S/PS seulement pour Maternelle FR
  const isPrimaire = levelCode === 'PRIMAIRE';
  const isSecondaire = levelCode === 'SECONDAIRE';

  // ⭐ FEATURE — Interface bilingue : la page Paramètres s'affiche dans la
  //    langue du niveau sélectionné (Nursery/Primary → anglais, sinon français).
  const isENUI = language === 'EN';
  const L = (fr: string, en: string): string => (isENUI ? en : fr);

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

      // ⭐ FEATURE — Mémoriser le paramétrage du niveau jumeau (Nursery↔Primary)
      //    pour pouvoir y refléter la sauvegarde quand le partage est activé.
      if (siblingLevelCode) {
        const siblingScoped = list.filter((s: any) =>
          (s.levelCode || null) === siblingLevelCode &&
          (s.language || null) === (language || null)
        );
        const siblingActive = siblingScoped.find((s: any) => s.status === 'ACTIVE') || siblingScoped[0];
        setSiblingSettingsId(siblingActive?.id || null);
      } else {
        setSiblingSettingsId(null);
      }

      // ⭐ FEATURE — Si aucun paramétrage pour CE niveau mais que le partage
      //    est activé et qu'un paramétrage existe pour le jumeau → le charger
      //    comme point de départ (le paramétrage est alors identique).
      const effectiveActive = active
        || (shareEnLevels && siblingLevelCode
          ? (() => {
              const siblingScoped = list.filter((s: any) =>
                (s.levelCode || null) === siblingLevelCode &&
                (s.language || null) === (language || null)
              );
              return siblingScoped.find((s: any) => s.status === 'ACTIVE') || siblingScoped[0] || null;
            })()
          : null);

      if (effectiveActive) {
        // ⭐ Si on a chargé le paramétrage du jumeau (partage), settingsId reste
        //    null : la sauvegarde créera une fiche propre à CE niveau.
        setSettingsId(active?.id || null);
        setStatus(effectiveActive.status || 'DRAFT');
        const cfg = effectiveActive.config || {};
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
        if (cfg.distinctions?.length) setDistinctions(cfg.distinctions);
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
        // ⭐ V10 — baseLevelCode : les miroirs EN (NURSERY/PRIMARY) héritent des
        //    défauts de leur niveau FR jumeau, avec la piste EN.
        const defaults = DEFAULT_ASSESSMENT_TYPES[baseLevelCode]?.[language || 'FR'] || DEFAULT_ASSESSMENT_TYPES.PRIMAIRE?.FR;
        const formulas = DEFAULT_FORMULAS[baseLevelCode]?.[language || 'FR'] || DEFAULT_FORMULAS.PRIMAIRE?.FR;
        setAssessmentTypes(defaults);
        setSubjectFormula(formulas.subject);
        setGeneralFormula(formulas.general);
        setFormulaDescription(formulas.description);
        // ⭐ Si piste anglophone, utiliser les mentions EN (/100) et le barème /100
        if (language === 'EN') {
          setMentions(DEFAULT_EN_MENTIONS);
          setScoreMax(100);
          setScoreMin(0);
          setPassScore(50);
        }
      }
    } catch {
      // Config inexistante → valeurs par défaut
      // ⭐ V10 — baseLevelCode : les miroirs EN héritent des défauts FR jumeaux.
      const defaults = DEFAULT_ASSESSMENT_TYPES[baseLevelCode]?.[language || 'FR'] || DEFAULT_ASSESSMENT_TYPES.PRIMAIRE?.FR;
      const formulas = DEFAULT_FORMULAS[baseLevelCode]?.[language || 'FR'] || DEFAULT_FORMULAS.PRIMAIRE?.FR;
      setAssessmentTypes(defaults);
      setSubjectFormula(formulas.subject);
      setGeneralFormula(formulas.general);
      setFormulaDescription(formulas.description);
      // ⭐ Si piste anglophone, utiliser les mentions EN (/100) et le barème /100
      if (language === 'EN') {
        setMentions(DEFAULT_EN_MENTIONS);
        setScoreMax(100);
        setScoreMin(0);
        setPassScore(50);
      }
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, levelCode, baseLevelCode, language, siblingLevelCode, shareEnLevels]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Sauvegarder ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!academicYear?.id || !levelCode) return;
    setSaving(true);
    try {
      const levelLabel = levelCode === 'MATERNELLE' ? 'Maternelle'
        : levelCode === 'PRIMAIRE' ? 'Primaire'
        : levelCode === 'NURSERY' ? 'Nursery'
        : levelCode === 'PRIMARY' ? 'Primary'
        : 'Secondaire';
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
        distinctions: isSecondaire ? distinctions : undefined,
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

      let newSettingsId = settingsId;
      if (settingsId) {
        await academicSettingsService.update(settingsId, payload);
      } else {
        const result = await academicSettingsService.create(payload);
        if (result?.id) {
          setSettingsId(result.id);
          newSettingsId = result.id;
        }
      }

      // ⭐ 2026-09-28 — Auto-activation après sauvegarde : les settings
      //    doivent être ACTIVE pour que le bulletin PDF puisse résoudre
      //    les distinctions (la requête filtre sur isActive=true OU
      //    status='ACTIVE'). Sans auto-activation, l'utilisateur devait
      //    cliquer manuellement sur « Activer » après chaque sauvegarde,
      //    ce qui n'était pas intuitif — d'où le bug « distinction non
      //    affichée dans le bloc Conseil de classe du bulletin ».
      if (newSettingsId) {
        try {
          await academicSettingsService.activate(newSettingsId);
        } catch (activateErr: any) {
          console.warn('[Settings] Auto-activation échouée :', activateErr?.message);
        }
      }

      // ⭐ FEATURE — Partage Nursery ↔ Primary : refléter la sauvegarde sur le
      //    niveau jumeau anglophone (même config, même année, même piste EN).
      //    Si une fiche existe déjà pour le jumeau → update ; sinon → create.
      //    Le toggle désactivé → pas de reflet (paramétrages indépendants).
      if (canShareEnLevels && shareEnLevels && siblingLevelCode) {
        try {
          const siblingLabel = siblingLevelCode === 'NURSERY' ? 'Nursery' : 'Primary';
          const siblingPayload = {
            ...payload,
            name: `Paramétrage ${siblingLabel}${langLabel} — ${academicYear?.label || ''}`,
            levelCode: siblingLevelCode,
          };
          if (siblingSettingsId) {
            await academicSettingsService.update(siblingSettingsId, siblingPayload);
          } else {
            const siblingResult = await academicSettingsService.create(siblingPayload);
            if (siblingResult?.id) setSiblingSettingsId(siblingResult.id);
          }
        } catch (mirrorErr: any) {
          // Le reflet ne doit PAS faire échouer la sauvegarde principale
          console.warn('[Settings] Miroir Nursery/Primary échoué :', mirrorErr?.message);
          toastWarning('Paramétrage partagé : le miroir vers le niveau jumeau a échoué', {
            description: mirrorErr?.message,
          });
        }
      }

      toastSuccess(
        canShareEnLevels && shareEnLevels && siblingLevelCode
          ? 'Paramètres enregistrés et appliqués à Nursery et Primary'
          : 'Paramètres enregistrés'
      );
      await loadSettings();
    } catch (err: any) {
      toastError('Erreur lors de la sauvegarde', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!settingsId) return;
    setSaving(true);
    try {
      await academicSettingsService.activate(settingsId);
      // ⭐ FEATURE — Partage Nursery ↔ Primary : activer AUSSI le jumeau
      //    (le statut ACTIVE doit être synchronisé avec la config partagée).
      let mirrored = false;
      if (canShareEnLevels && shareEnLevels && siblingSettingsId) {
        try {
          await academicSettingsService.activate(siblingSettingsId);
          mirrored = true;
        } catch (mirrorErr: any) {
          console.warn('[Settings] Miroir activation Nursery/Primary échoué :', mirrorErr?.message);
        }
      }
      toastSuccess(mirrored ? 'Paramètres activés pour Nursery et Primary' : 'Paramètres activés');
      await loadSettings();
    } catch (err: any) {
      toastError('Erreur activation', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Ajouter/Supprimer un type d'évaluation ────────────────────────────────
  const addAssessmentType = () => {
    setAssessmentTypes([...assessmentTypes, {
      code: '', label: '', required: true,
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
        <span className="ml-2 text-gray-600">{L('Chargement des paramètres...', 'Loading settings...')}</span>
      </div>
    );
  }

  const levelLabel = (availableLevels || []).find((l: any) =>
    (l.code || '').toUpperCase() === levelCode
  )?.label || levelCode;

  const SUB_TABS = [
    { id: 'calculation' as const, label: L('Règles de calcul', 'Calculation Rules'), icon: Calculator },
    { id: 'mentions' as const, label: L('Barèmes & Mentions', 'Grading Scale & Grades'), icon: Award },
    { id: 'ranking' as const, label: L('Règles de classement', 'Ranking Rules'), icon: Trophy },
    { id: 'bulletin' as const, label: L('Options du Bulletin', 'Report Card Options'), icon: FileText },
    ...(isSecondaire ? [{ id: 'distinctions' as const, label: 'Distinctions & Sanctions', icon: Trophy }] : []),
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
            {status === 'ACTIVE' ? L('Active', 'Active') : status === 'LOCKED' ? L('Verrouillée', 'Locked') : L('Brouillon', 'Draft')}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} /> {L('Actualiser', 'Refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {L('Sauvegarder', 'Save')}
          </Button>
          <Button size="sm" onClick={handleActivate} disabled={saving || !settingsId || status === 'ACTIVE'}>
            <Zap className="w-4 h-4 mr-1" /> {L('Activer', 'Activate')}
          </Button>
        </div>
      </div>

      {/* ⭐ FEATURE — Partage du paramétrage Nursery ↔ Primary (uniquement EN) */}
      {canShareEnLevels && (
        <div className="flex items-center justify-between gap-4 bg-indigo-50/70 border border-indigo-200 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-lg bg-indigo-100 text-indigo-600">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                {language === 'EN' ? 'Share settings between Nursery and Primary' : 'Partager le paramétrage entre Nursery et Primary'}
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                {language === 'EN'
                  ? 'When enabled, saving here also applies the same configuration to the other anglophone level.'
                  : 'Activé, la sauvegarde applique automatiquement la même configuration au niveau anglophone jumeau.'}
              </p>
            </div>
          </div>
          <Switch
            checked={shareEnLevels}
            onCheckedChange={toggleShareEnLevels}
            aria-label="Partage Nursery/Primary"
          />
        </div>
      )}

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
                  <h3 className="text-sm font-bold text-blue-900">{L('Système de calcul', 'Calculation System')} — {levelLabel}</h3>
                  <p className="text-xs text-blue-700 mt-1">
                    {DEFAULT_FORMULAS[levelCode]?.[language || 'FR']?.description
                      || DEFAULT_FORMULAS[baseLevelCode]?.[language || 'FR']?.description
                      || L('Configurez les règles de calcul ci-dessous.', 'Configure the calculation rules below.')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Types d'évaluation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md flex items-center justify-between">
                <span>{L("Types d'évaluation", 'Assessment Types')}</span>
                <Button size="sm" variant="outline" onClick={addAssessmentType}>
                  <Plus className="w-4 h-4 mr-1" /> {L('Ajouter', 'Add')}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* En-têtes de colonnes */}
              <div className="flex items-center gap-2 mb-2 px-2 text-xs font-bold text-gray-500 uppercase">
                <span className="w-24 flex-shrink-0">{L('Code', 'Code')}</span>
                <span className="flex-1">{L("Nom de l'évaluation", 'Assessment Name')}</span>
                <span className="w-10"></span>
              </div>
              <div className="space-y-2">
                {assessmentTypes.map((at, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <Input placeholder={L('Code', 'Code')} value={at.code} maxLength={10}
                      onChange={e => updateAssessmentType(i, 'code', e.target.value.toUpperCase())}
                      className="w-24 text-xs font-mono flex-shrink-0" />
                    <Input placeholder={L("Nom de l'évaluation", 'Assessment name')} value={at.label}
                      onChange={e => updateAssessmentType(i, 'label', e.target.value)}
                      className="flex-1 min-w-0 text-sm" />
                    <Button size="sm" variant="ghost" onClick={() => removeAssessmentType(i)} className="flex-shrink-0">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                ))}
                {assessmentTypes.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">{L('Aucun type d\'évaluation. Cliquez sur "Ajouter".', 'No assessment type. Click "Add".')}</p>
                )}
              </div>
              {/* Bouton de réinitialisation — SPÉCIFIQUE au niveau + piste sélectionnés */}
              <div className="mt-3">
                <button
                  onClick={() => {
                    const defaults = DEFAULT_ASSESSMENT_TYPES[baseLevelCode]?.[language || 'FR'];
                    if (defaults) setAssessmentTypes([...defaults]);
                  }}
                  className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold border border-blue-200"
                >
                  ↻ {L('Réinitialiser aux valeurs par défaut', 'Reset to defaults')} ({levelCode} · {language || 'FR'})
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Formules de calcul */}
          <Card>
            <CardHeader><CardTitle className="text-md">{L('Formules de calcul', 'Calculation Formulas')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">{L('Formule moyenne par matière', 'Subject Average Formula')}</label>
                <Input value={subjectFormula} onChange={e => setSubjectFormula(e.target.value)}
                  placeholder="Ex: (CM + CP) / 2 ou ((INT1 + INT2) / 2 + DS1 + DS2) / 3"
                  className="font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">{L('Formule moyenne générale', 'General Average Formula')}</label>
                <Input value={generalFormula} onChange={e => setGeneralFormula(e.target.value)}
                  placeholder="Ex: SUM(moyenne_matière) / COUNT(matières) ou SUM(moyenne × coef) / SUM(coef)"
                  className="font-mono text-sm" />
              </div>
              {isMaternelleFR && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-xs text-pink-800">
                  <strong>Maternelle :</strong> Système qualitatif TS/S/PS.
                  TS = Très Satisfaisant (valeur 3), S = Satisfaisant (valeur 2), PS = Peu Satisfaisant (valeur 1).
                  Le système calcule en arrière-plan avec ces valeurs mais affiche TS/S/PS côté interface.
                  Seuil de réussite : (TS + S) ≥ seuil fixé dans l'onglet Barèmes & Mentions.
                </div>
              )}
              {isPrimaire && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <strong>Primaire :</strong> CM (Critère Maximal, sur 18) + CP (Critère de Perfectionnement, sur 2) = note /20.
                  L'élève n'obtient le CP que s'il a au moins 10/18 au CM.
                  Le CP peut être 0, 1 ou 2 (jamais plus de 2).
                  Toutes les matières ont le coefficient 1 — la moyenne générale est arithmétique simple.
                </div>
              )}
              {isSecondaire && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-800">
                  <strong>Secondaire :</strong> Moyenne interros = (INT1 + INT2) / 2.
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
            <CardHeader><CardTitle className="text-md">{L("Politique d'absence & Arrondi", 'Absence Policy & Rounding')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">{L("Politique d'absence", 'Absence Policy')}</label>
                  <select value={absencePolicy} onChange={e => setAbsencePolicy(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="EXCLUDE">{L('Exclure de la moyenne', 'Exclude from average')}</option>
                    <option value="ZERO">{L('Note zéro', 'Zero mark')}</option>
                    <option value="NOT_CLASSIFIED">{L('Non classé', 'Not classified')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">{L("Mode d'arrondi", 'Rounding Mode')}</label>
                  <select value={roundingMode} onChange={e => setRoundingMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="HALF_UP">{L('Demi vers le haut', 'Half up')}</option>
                    <option value="FLOOR">{L('Toujours vers le bas', 'Always down')}</option>
                    <option value="CEIL">{L('Toujours vers le haut', 'Always up')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">{L('Nombre de décimales', 'Decimal Places')}</label>
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
              <CardHeader><CardTitle className="text-md">{L('Barème de notation', 'Grading Scale')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">{L('Note minimale', 'Minimum Score')}</label>
                    <Input type="number" value={scoreMin} onChange={e => setScoreMin(Number(e.target.value))} className="text-center" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">{L('Note maximale', 'Maximum Score')}</label>
                    <Input type="number" value={scoreMax} onChange={e => setScoreMax(Number(e.target.value))} className="text-center" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">{L('Seuil de réussite', 'Passing Score')}</label>
                    <Input type="number" value={passScore} onChange={e => setPassScore(Number(e.target.value))} className="text-center" />
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Mentions — PAS pour la maternelle FR */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md flex items-center justify-between">
                <span>{L('Mentions & Appréciations', 'Grades & Comments')}</span>
                <Button size="sm" variant="outline" onClick={addMention}>
                  <Plus className="w-4 h-4 mr-1" /> {L('Ajouter', 'Add')}
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
                    <Input placeholder={L('Mention', 'Grade')} value={m.label}
                      onChange={e => updateMention(m.id, 'label', e.target.value)}
                      className="w-36 text-sm font-semibold flex-shrink-0" />
                    <Input placeholder={L('Appréciation (optionnel)', 'Comment (optional)')} value={m.appreciation}
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
            <CardHeader><CardTitle className="text-md">{L('Configuration du classement', 'Ranking Configuration')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">{L('Portée du classement', 'Ranking Scope')}</label>
                <select value={rankingScope} onChange={e => setRankingScope(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="CLASS">{L('Par classe', 'By class')}</option>
                  <option value="LEVEL">{L('Par niveau scolaire', 'By school level')}</option>
                  <option value="SCHOOL">{L("Toute l'école", 'Whole school')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">{L('Gestion des ex aequo', 'Tie Handling')}</label>
                <select value={tieMode} onChange={e => setTieMode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="DENSE_RANK">{L('Sans saut — 1er, 2e, 2e, 3e (ex aequo conservés)', 'No gap — 1st, 2nd, 2nd, 3rd (ties kept)')}</option>
                  <option value="COMPETITION_RANK">{L('Avec saut — 1er, 2e, 2e ex, 4e (ex aequo avec saut)', 'With gap — 1st, 2nd, 2nd, 4th (ties with gap)')}</option>
                  <option value="UNIQUE">{L("Départage — pas d'ex aequo (chaque élève a un rang unique)", 'Tie-break — no ties (each student gets a unique rank)')}</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <ToggleRow label={L("Exclure les absents du classement", 'Exclude absentees from ranking')} checked={excludeAbsentees} onChange={setExcludeAbsentees} />
                <ToggleRow label={L('Afficher le rang sur le bulletin', 'Show rank on report card')} checked={showRankOnBulletin} onChange={setShowRankOnBulletin} />
                <ToggleRow label={L('Afficher la moyenne de classe sur le bulletin', 'Show class average on report card')} checked={showClassAverage} onChange={setShowClassAverage} />
                {!isMaternelleFR && (
                  <ToggleRow label={L('Afficher la plus forte moyenne', 'Show highest average')} checked={showHighestAverage} onChange={setShowHighestAverage} />
                )}
                {!isMaternelleFR && (
                  <ToggleRow label={L('Afficher la plus faible moyenne', 'Show lowest average')} checked={showLowestAverage} onChange={setShowLowestAverage} />
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
            <CardHeader><CardTitle className="text-md">{L("Options d'affichage du bulletin", 'Report Card Display Options')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <ToggleRow label={L("Afficher la moyenne de l'élève", "Show student's average")} checked={showStudentAverage} onChange={setShowStudentAverage} />
              <ToggleRow label={L('Afficher la moyenne de la classe', 'Show class average')} checked={showClassAverage} onChange={setShowClassAverage} />
              <ToggleRow label={L("Afficher la mention de l'élève", "Show student's grade")} checked={showMention} onChange={setShowMention} />
              <ToggleRow label={L('Afficher le rang', 'Show rank')} checked={showRankOnBulletin} onChange={setShowRankOnBulletin} />
              <ToggleRow label={L('Afficher les absences', 'Show absences')} checked={showAbsences} onChange={setShowAbsences} />
              <ToggleRow label={L("Afficher les appréciations des enseignants", 'Show teacher comments')} checked={showTeacherAppreciations} onChange={setShowTeacherAppreciations} />
              {!isMaternelleFR && (
                <ToggleRow label={L('Afficher les coefficients', 'Show coefficients')} checked={showCoefficients} onChange={setShowCoefficients} />
              )}
              {!isMaternelleFR && (
                <ToggleRow label={L('Afficher la plus forte moyenne', 'Show highest average')} checked={showHighestAverage} onChange={setShowHighestAverage} />
              )}
              {!isMaternelleFR && (
                <ToggleRow label={L('Afficher la plus faible moyenne', 'Show lowest average')} checked={showLowestAverage} onChange={setShowLowestAverage} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-md">{L('Signatures & Éléments visuels', 'Signatures & Visual Elements')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <ToggleRow label={L("Afficher la signature du directeur", "Show principal's signature")} checked={showDirectorSignature} onChange={setShowDirectorSignature} />
              <ToggleRow label={L("Afficher le cachet de l'établissement", 'Show school stamp')} checked={showSchoolStamp} onChange={setShowSchoolStamp} />
              <ToggleRow label={L("Inclure le logo/photo de l'école", 'Include school logo/photo')} checked={showSchoolLogo} onChange={setShowSchoolLogo} />
              <ToggleRow label={L('Inclure le QR code de vérification', 'Include verification QR code')} checked={showQRCode} onChange={setShowQRCode} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ Sub-tab: Distinctions & Sanctions (Secondaire uniquement) ═══ */}
      {activeSubTab === 'distinctions' && isSecondaire && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-600" />
                Distinctions
              </CardTitle>
              <p className="text-sm text-gray-500">
                Configurez les seuils de notes pour chaque distinction. Ces distinctions figureront sur le bulletin de l'élève.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {distinctions.filter(d => d.type === 'DISTINCTION').map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-sm font-semibold text-amber-900 flex-1">{d.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Entre</span>
                    <input type="number" min={0} max={20} step={0.01} value={d.minScore}
                      onChange={(e) => setDistinctions(distinctions.map(x => x.id === d.id ? { ...x, minScore: Number(e.target.value) } : x))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center" />
                    <span className="text-xs text-gray-500">et</span>
                    <input type="number" min={0} max={20} step={0.01} value={d.maxScore}
                      onChange={(e) => setDistinctions(distinctions.map(x => x.id === d.id ? { ...x, maxScore: Number(e.target.value) } : x))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center" />
                    <span className="text-xs text-gray-500">/20</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Sanctions
              </CardTitle>
              <p className="text-sm text-gray-500">
                Configurez les seuils de notes pour chaque sanction. Ces sanctions figureront sur le bulletin de l'élève.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {distinctions.filter(d => d.type === 'SANCTION').map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-sm font-semibold text-red-900 flex-1">{d.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Entre</span>
                    <input type="number" min={0} max={20} step={0.01} value={d.minScore}
                      onChange={(e) => setDistinctions(distinctions.map(x => x.id === d.id ? { ...x, minScore: Number(e.target.value) } : x))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center" />
                    <span className="text-xs text-gray-500">et</span>
                    <input type="number" min={0} max={20} step={0.01} value={d.maxScore}
                      onChange={(e) => setDistinctions(distinctions.map(x => x.id === d.id ? { ...x, maxScore: Number(e.target.value) } : x))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center" />
                    <span className="text-xs text-gray-500">/20</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Rappel :</strong> Ces distinctions et sanctions sont basées sur la moyenne générale de l'élève.
              Elles seront automatiquement affichées sur le bulletin trimestriel et annuel.
              La conduite (module Vie Scolaire) est également prise en compte dans le calcul final.
            </p>
          </div>
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
  // ⭐ En-tête dans la langue du niveau (Nursery/Primary → anglais)
  const { language } = useExamScope();
  const isENHeader = language === 'EN';
  return (
    <ModuleContainer
      header={{
        title: isENHeader ? 'Settings' : 'Paramètres',
        description: isENHeader
          ? 'Assessment system configuration per school level and language track.'
          : 'Configuration du système d\'évaluation par niveau scolaire et piste linguistique.',
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
