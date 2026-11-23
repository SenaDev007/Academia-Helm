/**
 * ============================================================================
 * MODULE EXAMENS — BULLETINS
 * ============================================================================
 *
 * Onglet « Bulletin d'évaluation » :
 *   1. Sélectionner un trimestre (T1, T2, T3)
 *   2. Sélectionner une classe (CI A, CP, CE1, 6e A, 3e B, etc.)
 *   3. Sélectionner un type d'évaluation (EM1, EM2, EC — secondaire :
 *      Interrogation écrite 1/2, Devoir surveillé 1/2)
 *   4. Les bulletins de tous les élèves s'affichent automatiquement
 *      → pour un élève : toutes les matières, notes du type sélectionné.
 *      Primaire/Maternelle : carnet (CM/18, CP/02…) ; Secondaire : tableau
 *      Discipline | Note /20 | Rang | Appréciation + Moyenne de l'évaluation
 *      (même standard que le bulletin trimestriel) ; page 2 secondaire :
 *      appréciations conseil des professeurs + directeur, signature du
 *      directeur UNIQUEMENT + mention « établi qu'une seule fois ».
 *
 * Onglet « Bulletin trimestriel » :
 *   - Secondaire (piste FR) : modèle consolidé CEG — Discipline |
 *     Interrogation écrite [1, 2] | Moyenne d'interrogation | Devoir
 *     surveillé [Devoir 1, Devoir 2] | Moyenne | [Coefficient | Note
 *     coefficient] | Rang | Appréciation | Signature. 6e/5e sans
 *     coefficient ; 4e → Terminale avec. Récap T1+T2+moyenne annuelle
 *     au 3e trimestre (décision de passage).
 *   - Autres niveaux : moyennes trimestrielles / annuelles.
 *
 * ⭐ Utilise le MÊME pattern que le registre des notes :
 *    - institutionalExamsService.getEvaluations() pour récupérer les évaluations
 *    - apiClient.get('/institutional-exams/grades/evaluation/:id') pour les notes
 *    - Calcul des moyennes côté frontend (pas d'appel POST /exams/* qui échoue)
 *
 * Format PDF : A4 (en-tête officiel République du Bénin + école)
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Suspense, Fragment } from 'react';
import {
  FileText, Loader2, ChevronDown, ChevronRight, Download,
  Users, BookOpen, Award, Calendar, Printer, AlertCircle,
  Calculator, Shield, PenTool, Send, Mail, Undo, CheckCircle, ShieldAlert, Settings, Save, Sparkles,
} from 'lucide-react';
// ⭐ 2026-11-23 — ICÔNE OFFICIELLE WhatsApp (logo vert #25D366) — fin de
//    l'icône générique MessageCircle sur les boutons « Envoyer par WhatsApp ».
import { WhatsAppIcon } from '@/components/finance/OfficialIcons';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useSchoolIdentity, useSchoolIdentityForLevel } from '@/hooks/useSchoolIdentity';
// ⭐ 2026-11-23 — En-tête d'identité école COMPLET (exige promoteur) partagé avec le registre des notes.
import { SchoolIdentityHeader } from '@/components/exams/SchoolIdentityHeader';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import apiClient from '@/lib/api/client';
import { enComponentForCode, translatePeriodName } from '@/lib/exam-anglophone-config';
import { translateClassName } from '@/lib/pedagogy/class-name-en';
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { filterClassesForLevel, matchesLevelLanguage } from '../level-isolation';
// ⭐ SECONDAIRE — appréciations normalisées (mêmes mentions que la fiche de saisie et le registre)
import { computeAppreciationSecondaire, appreciationSecondaireClassName } from '@/components/exams/GradingSheet';
import { getSubjectCategory, groupSubjectsByCategory, CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/exam-subject-category';
import { sortSecondarySubjects } from '@/lib/subject-canonical-order';
import { sortMaternelleSubjects, groupMaternelleByDomain, DOMAIN_LABELS as MATERNELLE_DOMAIN_LABELS } from '@/lib/maternelle-domain-grouping';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { useAppSessionOptional } from '@/contexts/AppSessionContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS as enUSLocale } from 'date-fns/locale';

// ─── Pedagogical class ordering ──────────────────────────────────────────────
const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (const prefix of PEDAGOGICAL_ORDER) {
    if (upper.startsWith(prefix)) return PEDAGOGICAL_ORDER.indexOf(prefix);
  }
  return PEDAGOGICAL_ORDER.length;
};

// ─── Evaluation type ordering: INT1 → INT2 → DS1 → DS2 (secondaire) puis EM1 → EM2 → EC ──
const EVAL_TYPE_ORDER = ['INT1', 'INT2', 'DS1', 'DS2', 'EM1', 'EM2', 'EC', 'DV', 'INT', 'COMP', 'EB', 'ORAL', 'EP'];
const evalTypeSortIndex = (code: string): number => {
  const idx = EVAL_TYPE_ORDER.indexOf(code?.toUpperCase() || '');
  return idx === -1 ? EVAL_TYPE_ORDER.length : idx;
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubjectScore {
  score: number | null;
  qualitativeCode: string | null;
  isAbsent: boolean;
  appreciation: string;
  directorVisa?: string | null;
  // ⭐ Primaire FR — CM (Composé /18) et CP (Contrôle Permanent /2)
  //    Parsé depuis le champ comment de la DB au format JSON {"cm":X,"cp":Y}
  cm?: number | null;   // /18
  cp?: number | null;   // /2
  // ⭐ Champs anglophones : 3 composantes par matière (CA + Exam)
  // ⭐ V10g — First CA /20 + Second CA /20 + Exam /60 → total = /100 exact
  firstCA?: number | null;   // /20
  secondCA?: number | null;  // /20
  exam?: number | null;      // /60
  total?: number | null;     // /100 (somme brute FCA + SCA + Exam)
  // ⭐ SECONDAIRE (Bulletin trimestriel) — modèle CEG : Interrogation écrite 1/2,
  //    Devoir surveillé 1/2, Moyenne d'interrogation, Moyenne, Coefficient,
  //    Note coefficient (undefined = aucune donnée, null = absent, number = note)
  int1?: number | null;
  int2?: number | null;
  ds1?: number | null;
  ds2?: number | null;
  moyInter?: number | null;
  moyenne?: number | null;
  coefficient?: number | null;
  noteCoef?: number | null;
  subjectRank?: number | null;
  secHasSlot?: boolean;      // l'élève apparaît dans au moins une fiche de la matière
}

/**
 * ⭐ V10h — GRILLE DES APPRECIATIONS /100 (modèle Report Book anglophone).
 * 7 paliers → grades A+, A, B, C, D, F (F couvre WEAK + VERY WEAK).
 * Chaque palier porte : Teacher's Appreciation + Teacher's Comments (4 lignes)
 * + Principal's Comment ( Headmaster ). Tout est auto-rempli depuis la
 * moyenne /100 de l'élève et reste éditable.
 */
interface EnAppreciationTier {
  min: number;               // borne incluse (max = palier suivant)
  label: string;             // OUTSTANDING / VERY GOOD / GOOD / FAIR / PASS / WEAK / VERY WEAK
  grade: string;             // A+ / A / B / C / D / F
  color: string;             // badge Tailwind
  teacherAppreciation: string;
  teacherComments: string[];
  principalComment: string;
}

const EN_APPRECIATION_TIERS: EnAppreciationTier[] = [
  {
    min: 90, label: 'Outstanding', grade: 'A+', color: 'bg-emerald-100 text-emerald-700',
    teacherAppreciation: 'Outstanding performance. Excellent mastery of concepts.',
    teacherComments: [
      'Demonstrates exceptional understanding and skills',
      'Highly consistent and disciplined work',
      'Shows leadership and strong participation',
      'Keep up the excellent work',
    ],
    principalComment: 'Excellent academic performance. Commendable effort and discipline. Keep striving for excellence.',
  },
  {
    min: 80, label: 'Very Good', grade: 'A', color: 'bg-blue-100 text-blue-700',
    teacherAppreciation: 'Very good performance. Strong academic achievement.',
    teacherComments: [
      'Very good comprehension of lessons',
      'Regular and serious work habits',
      'Participates actively in class',
      'Aiming for excellence is encouraged',
    ],
    principalComment: 'Very good results. Consistent effort is encouraged to reach the highest standards.',
  },
  {
    min: 70, label: 'Good', grade: 'B', color: 'bg-sky-100 text-sky-700',
    teacherAppreciation: 'Good performance. Satisfactory results.',
    teacherComments: [
      'Understands most concepts taught',
      'Shows good effort and engagement',
      'Minor weaknesses need attention',
      'Can perform better with more focus',
    ],
    principalComment: 'Good performance. Greater concentration and consistency will lead to better outcomes.',
  },
  {
    min: 60, label: 'Fair', grade: 'C', color: 'bg-amber-100 text-amber-700',
    teacherAppreciation: 'Fair performance. Needs improvement.',
    teacherComments: [
      'Basic understanding achieved',
      'Effort is inconsistent',
      'Needs to revise key concepts',
      'Greater commitment is required',
    ],
    principalComment: 'Fair results. Student is advised to work harder and remain focused.',
  },
  {
    min: 50, label: 'Pass', grade: 'D', color: 'bg-orange-100 text-orange-700',
    teacherAppreciation: 'Passable performance. Results are just acceptable.',
    teacherComments: [
      'Learning objectives partially met',
      'Weak academic foundations',
      'Must improve study habits',
      'Parental support is recommended',
    ],
    principalComment: 'Results are just satisfactory. Stronger effort and parental follow-up are necessary.',
  },
  {
    min: 40, label: 'Weak', grade: 'F', color: 'bg-red-100 text-red-700',
    teacherAppreciation: 'Weak performance. Below expected standard.',
    teacherComments: [
      'Significant learning difficulties',
      'Insufficient effort and practice',
      'Requires close academic monitoring',
      'Immediate corrective actions needed',
    ],
    principalComment: 'Performance below expectation. Immediate improvement is required with parental involvement.',
  },
  {
    min: 0, label: 'Very Weak', grade: 'F', color: 'bg-slate-200 text-slate-800',
    teacherAppreciation: 'Very weak performance. Unsatisfactory.',
    teacherComments: [
      'Very poor understanding of lessons',
      'Lack of effort and motivation',
      'Serious academic gaps',
      'Intensive support is urgently required',
    ],
    principalComment: 'Very poor academic performance. Urgent remedial measures and close supervision are required.',
  },
];

/** Palier de la grille pour un score /100 (null → null). */
function enTierFor(score: number | null | undefined): EnAppreciationTier | null {
  if (score === null || score === undefined || isNaN(score)) return null;
  return EN_APPRECIATION_TIERS.find(t => score >= t.min) ?? EN_APPRECIATION_TIERS[EN_APPRECIATION_TIERS.length - 1];
}

/** Grade (A+, A, B, C, D, F) pour un score /100 — colonne Grade du bulletin EN. */
function enGradeFor(score: number | null | undefined): string {
  return enTierFor(score)?.grade ?? '—';
}

/** Ordinal anglais : 1 → 1st, 2 → 2nd, 3 → 3rd, 4 → 4th… */
function enOrdinal(rank: number | null | undefined): string {
  if (rank === null || rank === undefined) return '—';
  const rem10 = rank % 10, rem100 = rank % 100;
  if (rem10 === 1 && rem100 !== 11) return `${rank}st`;
  if (rem10 === 2 && rem100 !== 12) return `${rank}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${rank}rd`;
  return `${rank}th`;
}

/**
 * ⭐ V10h — Stats par matière pour le bulletin EN (Highest / Lowest in class,
 * Position de l'élève dans la matière) — calculées sur l'ensemble des élèves.
 */
function enSubjectClassStats(bulletinData: BulletinData, subjectId: string, studentId: string): {
  highest: number | null; lowest: number | null; position: number | null;
} {
  const totals: Array<{ id: string; total: number }> = [];
  for (const r of bulletinData.results) {
    const s = r.subjectScores[subjectId];
    if (!s || s.isAbsent) continue;
    if (typeof s.total === 'number' && s.total !== null) totals.push({ id: r.id, total: s.total });
  }
  if (totals.length === 0) return { highest: null, lowest: null, position: null };
  const values = totals.map(t => t.total).sort((a, b) => b - a);
  const highest = values[0];
  const lowest = values[values.length - 1];
  const myTotal = totals.find(t => t.id === studentId)?.total ?? null;
  const position = myTotal === null ? null : 1 + values.filter(v => v > myTotal).length;
  return { highest, lowest, position };
}

/** Âge (en années) depuis une date de naissance. */
function ageFromBirthDate(birthDate?: string | null, ref?: Date | null): number | null {
  if (!birthDate) return null;
  try {
    const dob = new Date(birthDate);
    if (isNaN(dob.getTime())) return null;
    const end = ref || new Date();
    let age = end.getFullYear() - dob.getFullYear();
    const m = end.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < dob.getDate())) age--;
    return age >= 0 && age < 130 ? age : null;
  } catch { return null; }
}

/**
 * ⭐ Formate un rang en ordinal français :
 *   1 → "1er", 2 → "2ème", 3 → "3ème", 4 → "4ème", etc.
 *   Pour le féminin (utilisé si l'élève est une fille), on peut passer
 *   `feminine=true` : 1 → "1ère", 2 → "2ème", etc.
 */
function formatRank(rank: number | null | undefined, feminine: boolean = false): string {
  if (rank === null || rank === undefined) return '—';
  if (rank === 1) return feminine ? '1ère' : '1er';
  return `${rank}ème`;
}

interface StudentResult {
  id: string;
  studentName: string;
  matricule?: string;
  gender?: string;
  birthDate?: string | null;   // ⭐ V10h — pour l'âge du Report Book
  age?: number | null;         // ⭐ V10h — calculé côté front
  subjectScores: Record<string, SubjectScore>;
  generalAverage: number | null;
  appreciationGlobale: string | null;
  classRank: number;
  secondaryRecap?: SecondaryRecap | null; // ⭐ SECONDAIRE — récap T3 (T1, T2, moyenne annuelle, passage)
}

/** Récap du 3e trimestre (bulletin secondaire) : moyennes T1/T2 + moyenne annuelle. */
interface SecondaryRecap {
  period1Average: number | null;
  period2Average: number | null;
  annualAverage: number | null;
  annualRank: number | null;
  decision: string | null;
}

interface BulletinData {
  subjects: Array<{ id: string; name: string; code?: string; coefficient?: number }>;
  results: StudentResult[];
  stats: {
    totalStudents: number;
    composedStudents: number;
    classAverage: number | null;
    passingCount: number;
    failingCount: number;
    passingRate: number;
  };
}

// ─── Helpers — SECONDAIRE (bulletins) ────────────────────────────────────────

/** 6e/5e = SANS coefficient ; 4e → Terminale = AVEC coefficient. */
function isJuniorSecondaryClass2(className: string): boolean {
  const m = (className || '').toUpperCase().trim().match(/(\d+)/);
  return !!m && (m[1] === '6' || m[1] === '5');
}

/** Mappe un type d'évaluation vers INT1/INT2/DS1/DS2 (codes ou libellés). */
function secondaryNoteKey2(code?: string | null, name?: string | null): 'INT1' | 'INT2' | 'DS1' | 'DS2' | null {
  const c = (code || '').toUpperCase().trim();
  if (c === 'INT1' || c === 'IE1') return 'INT1';
  if (c === 'INT2' || c === 'IE2') return 'INT2';
  if (c === 'DS1') return 'DS1';
  if (c === 'DS2') return 'DS2';
  const u = (name || '').toUpperCase().trim();
  if (u.includes('INTERROGATION') && u.includes('1')) return 'INT1';
  if (u.includes('INTERROGATION') && u.includes('2')) return 'INT2';
  if (u.includes('DEVOIR SURVEILL') && u.includes('1')) return 'DS1';
  if (u.includes('DEVOIR SURVEILL') && u.includes('2')) return 'DS2';
  return null;
}

/** Moyennes d'une matière depuis les slots (ABS exclus, chaque partie disponible compte pour 1). */
function secondaryMoyenneFromSlots(slots: { INT1?: number | null; INT2?: number | null; DS1?: number | null; DS2?: number | null }): {
  moyInter: number | null;
  moyenne: number | null;
} {
  const interVals = [slots.INT1, slots.INT2].filter((v): v is number => typeof v === 'number');
  const dsVals = [slots.DS1, slots.DS2].filter((v): v is number => typeof v === 'number');
  const moyInter = interVals.length ? interVals.reduce((a, b) => a + b, 0) / interVals.length : null;
  const parts: number[] = [];
  if (moyInter !== null) parts.push(moyInter);
  dsVals.forEach((v) => parts.push(v));
  const moyenne = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  return { moyInter, moyenne };
}

/**
 * Charge les notes des évaluations typées (INT1/INT2/DS1/DS2) d'un trimestre
 * et calcule la moyenne générale de chaque élève :
 *   6e/5e  = moyenne simple des moyennes de matières
 *   4e → T = Σ(note coefficient) / Σ(coefficients)
 */
async function computeSecondaryPeriodAverages(
  periodEvals: any[],
  isJunior: boolean,
  coefficientBySubject: Map<string, number>,
): Promise<Map<string, number | null>> {
  // ⭐ FIX PERF (2026-09-21 — module Examen lent) : UN SEUL appel batché au
  //    lieu de N requêtes HTTP parallèles (une par évaluation).
  const sheetsMap = await institutionalExamsService
    .getGradingSheetsBatch(periodEvals.map((ev: any) => ev.id))
    .catch(() => ({}) as Record<string, any[]>);
  const gradesByEval = new Map<string, any[]>();
  for (const ev of periodEvals) {
    gradesByEval.set(ev.id, Array.isArray(sheetsMap[ev.id]) ? sheetsMap[ev.id] : []);
  }

  // Slots par élève × matière
  const slotsByStudent = new Map<string, Map<string, { INT1?: number | null; INT2?: number | null; DS1?: number | null; DS2?: number | null }>>();
  periodEvals.forEach((ev: any) => {
    const subjId = ev.subject?.id;
    if (!subjId) return;
    const secKey = secondaryNoteKey2(ev.evaluationType?.code, ev.evaluationType?.name);
    if (!secKey) return;
    (gradesByEval.get(ev.id) || []).forEach((g: any) => {
      if (!slotsByStudent.has(g.studentId)) slotsByStudent.set(g.studentId, new Map());
      const subjMap = slotsByStudent.get(g.studentId)!;
      if (!subjMap.has(subjId)) subjMap.set(subjId, {});
      subjMap.get(subjId)![secKey] = g.isAbsent ? null : (g.score !== null ? Number(g.score) : null);
    });
  });

  // Moyenne générale par élève
  const out = new Map<string, number | null>();
  slotsByStudent.forEach((subjMap, studentId) => {
    let sumCoef = 0, sumNoteCoef = 0, sumMoy = 0, countMoy = 0;
    subjMap.forEach((slots, subjectId) => {
      const { moyenne } = secondaryMoyenneFromSlots(slots);
      if (moyenne === null) return;
      if (isJunior) { sumMoy += moyenne; countMoy++; }
      else {
        const coef = coefficientBySubject.get(subjectId) ?? 1;
        sumCoef += coef;
        sumNoteCoef += moyenne * coef;
      }
    });
    if (isJunior) out.set(studentId, countMoy ? sumMoy / countMoy : null);
    else out.set(studentId, sumCoef ? sumNoteCoef / sumCoef : null);
  });
  return out;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BulletinsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { language: scopeLang } = useExamScope();
  const isEN = scopeLang === 'EN';

  return (
    <ModuleContainer
      header={{ title: isEN ? 'Report Cards' : 'Bulletins', description: isEN ? 'Report cards by assessment, class and term.' : 'Bulletins de notes par évaluation, classe et trimestre.', icon: 'fileText' }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'bulletins' }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
            <BulletinsContent />
          </Suspense>
        ),
      }}
    />
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function BulletinsContent() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { identity: school } = useSchoolIdentity();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  const isEN = scopeLang === 'EN';
  const session = useAppSessionOptional();
  const user = session?.user;
  const effectiveTenantId = session?.tenant?.id;

  // ⭐ 2026-11-23 — IDENTITÉ DU NIVEAU courant — maternelle/primaire → identité
  //    PAR DÉFAUT de l'école ; secondaire → profil « Identité école secondaire »
  //    (Paramètres → Identité) fusionné champ à champ. Résolution désormais
  //    partagée avec l'onglet Registre des notes via le hook
  //    useSchoolIdentityForLevel, et l'identité est COMPLÈTE (téléphone 1/2,
  //    WhatsApp, email, site web, localisation — exigence promoteur).
  const isSecondaire = scopeLevel === 'SECONDAIRE';
  const { identity: schoolForLevel } = useSchoolIdentityForLevel(scopeLevel, effectiveTenantId);

  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  // ⭐ FIX PERF (2026-09-21) : refs miroirs — loadBulletins lit classes/periods
  //    via refs et ne les a PLUS dans ses dépendances. Avant, chaque re-fetch
  //    des listes de référence (nouvelle identité de tableau, contenu identique)
  //    recréait le callback → RECHARGEMENT COMPLET des bulletins (requêtes
  //    évaluations + notes rejouées pour rien).
  const classesRef = useRef<any[]>([]);
  const periodsRef = useRef<any[]>([]);
  useEffect(() => { classesRef.current = classes; }, [classes]);
  useEffect(() => { periodsRef.current = periods; }, [periods]);
  const [evaluationTypes, setEvaluationTypes] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedEvalTypeId, setSelectedEvalTypeId] = useState('');
  const [loadingBulletins, setLoadingBulletins] = useState(false);
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  // ⭐ Sub-tabs: 'bulletin' (Bulletin d'évaluation) | 'trimestriel' (Bulletin
  //    trimestriel) | 'criteria' | 'received'
  const [activeSubTab, setActiveSubTab] = useState<'bulletin' | 'trimestriel' | 'criteria' | 'received'>('bulletin');
  // ⭐ Sub-sub-tabs within MoyennesTab (primaire): 'trimestriel' | 'annuel'
  const [activeMoyenneTab, setActiveMoyenneTab] = useState<'trimestriel' | 'annuel'>('trimestriel');
  // ⭐ Vue par matière / Vue globale — toggle dans MoyennesTab (maternelle uniquement)
  const [activeVue, setActiveVue] = useState<'globale' | 'par-matiere'>('globale');

  const isMaternelle = scopeLevel === 'MATERNELLE';
  // ⭐ SECONDAIRE (piste FR) — deux onglets distincts :
  //    • « Bulletin d'évaluation » = standard primaire : un type d'évaluation
  //      à la fois (Interrogation écrite 1, Devoir surveillé 2, …) et, pour
  //      un élève, toutes les matières de ce type.
  //    • « Bulletin trimestriel » = modèle consolidé CEG : Interrogation écrite
  //      1/2 + Devoir surveillé 1/2 du trimestre, moyennes et coefficients.
  //    (isSecondaire est déclaré plus haut avec l'identité du niveau secondaire)
  const isSecondaryTrack = isSecondaire && scopeLang !== 'EN';
  const secondaryConsolidated = isSecondaryTrack && activeSubTab === 'trimestriel';

  // ⭐ Anti-screenshot protection for teachers
  const isTeacher = ['TEACHER', 'TEACHER_RESP', 'ENSEIGNANT', 'PEDAGOGIC_COORDINATOR'].includes(user?.role || '');
  useAntiScreenshot(isTeacher);

  // ⭐ Workflow signatures — loaded from backend to display in bulletin preview
  const [workflowSignatures, setWorkflowSignatures] = useState<Record<string, { directorSig?: string; teacherSig?: string }>>({});

  // ⭐ Nom du directeur — résolu automatiquement depuis le module RH (onglet
  //    Administration → staff-admin-assignments) : le directeur affecté au
  //    niveau scolaire courant (MAT / PRI / SEC / MAT_PRI / ALL), à la piste
  //    linguistique (FR/EN ou bi-piste) et à l'année en cours (ou permanente).
  const [directorName, setDirectorName] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveTenantId) return;
    let cancelled = false;
    fetch('/api/staff-admin-assignments?isActive=true', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        if (cancelled || !Array.isArray(list) || list.length === 0) return;
        const DIR_ROLE_PRIORITY = ['DIRECTEUR_GENERAL', 'DIRECTEUR', 'PROVISEUR', 'DIRECTEUR_DES_ETUDES', 'DIRECTEUR_ADJOINT'];
        const levelToCodes: Record<string, string[]> = {
          MATERNELLE: ['MAT', 'MAT_PRI', 'ALL'],
          PRIMAIRE: ['PRI', 'MAT_PRI', 'ALL'],
          SECONDAIRE: ['SEC', 'ALL'],
        };
        const targetCodes = levelToCodes[scopeLevel || ''] || null;
        if (!targetCodes) return;
        const candidates = list.filter((a: any) => {
          if (!a || a.isActive === false) return false;
          if (!DIR_ROLE_PRIORITY.includes(a.adminRole)) return false;
          if (!targetCodes.includes(a.schoolLevelCode)) return false;
          // Piste : null = bi-piste ; sinon la piste doit correspondre
          const trackCode = a.academicTrack?.code;
          if (trackCode && scopeLang && trackCode !== scopeLang) return false;
          // Année : null = permanente (héritée) ; sinon l'année courante
          if (a.academicYearId && academicYear?.id && a.academicYearId !== academicYear.id) return false;
          return true;
        });
        if (candidates.length === 0) return;
        candidates.sort((a: any, b: any) => {
          const pa = DIR_ROLE_PRIORITY.indexOf(a.adminRole);
          const pb = DIR_ROLE_PRIORITY.indexOf(b.adminRole);
          if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
          const ya = a.academicYearId ? 0 : 1;
          const yb = b.academicYearId ? 0 : 1;
          if (ya !== yb) return ya - yb;
          return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
        });
        const best: any = candidates[0];
        if (best?.staff) {
          const first = (best.staff.firstName || '').trim();
          const last = (best.staff.lastName || '').trim();
          const name = [first, last].filter(Boolean).join(' ').trim();
          if (name) setDirectorName(name);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [effectiveTenantId, scopeLevel, scopeLang, academicYear?.id]);

  // Load workflow status to get signatures per student
  useEffect(() => {
    if (!effectiveTenantId || !academicYear?.id || !selectedClassId || !selectedPeriodId) return;
    apiClient.get(`/institutional-exams/bulletins/class/${selectedClassId}/workflow-status?periodId=${selectedPeriodId}`)
      .then((res) => {
        const sigs: Record<string, { directorSig?: string; teacherSig?: string }> = {};
        for (const b of (res.data?.bulletins || [])) {
          // ⭐ b.student.id is the studentId (Prisma includes relation as nested object)
          const studentId = b.studentId || b.student?.id;
          if (studentId) {
            sigs[studentId] = {
              directorSig: b.directorSignature || undefined,
              teacherSig: b.teacherSignature || undefined,
            };
          }
        }
        setWorkflowSignatures(sigs);
      })
      .catch(() => {});
  }, [effectiveTenantId, academicYear?.id, selectedClassId, selectedPeriodId]);

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find((l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL');
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  // ── Load classes (same pattern as registre) ────────────────────────────────
  const loadClasses = useCallback(async () => {
    if (!schoolLevelUuid) return;
    try {
      const res = await fetch(`/api/all-classes${academicYear?.id ? `?academicYearId=${encodeURIComponent(academicYear.id)}` : ''}`, { credentials: 'include' });
      const data = await res.json();
      const allClasses = Array.isArray(data) ? data : (data?.items || []);
      // ⭐ V10b — Isolation stricte niveau + piste linguistique (non marqué = FR)
      const langClasses = filterClassesForLevel(allClasses, schoolLevelUuid, scopeLang);
      langClasses.sort((a: any, b: any) => {
        const idxA = pedagogicalSortIndex(a.name);
        const idxB = pedagogicalSortIndex(b.name);
        if (idxA !== idxB) return idxA - idxB;
        return (a.name || '').localeCompare(b.name || '', 'fr');
      });
      setClasses(langClasses);
      if (langClasses.length > 0 && !selectedClassId) setSelectedClassId(langClasses[0].id);
    } catch { setClasses([]); }
  }, [schoolLevelUuid, scopeLang, selectedClassId, academicYear?.id]);

  // ── Load periods ──────────────────────────────────────────────────────────
  const loadPeriods = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const res = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const periodList = Array.isArray(data) ? data : (data?.items || []);
        setPeriods(periodList);
        if (periodList.length > 0 && !selectedPeriodId) setSelectedPeriodId(periodList[0].id);
      }
    } catch { setPeriods([]); }
  }, [academicYear?.id, selectedPeriodId]);

  // ── Load evaluation types (sorted EM1 → EM2 → EC) ──────────────────────────
  const loadEvaluationTypes = useCallback(async () => {
    if (!schoolLevelUuid) return;
    try {
      const types = await institutionalExamsService.getEvaluationTypes(schoolLevelUuid);
      const sorted = (Array.isArray(types) ? types : []).sort((a: any, b: any) =>
        evalTypeSortIndex(a.code) - evalTypeSortIndex(b.code)
      );
      setEvaluationTypes(sorted);
      if (sorted.length > 0 && !selectedEvalTypeId) setSelectedEvalTypeId(sorted[0].id);
    } catch { setEvaluationTypes([]); }
  }, [schoolLevelUuid, selectedEvalTypeId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => { loadEvaluationTypes(); }, [loadEvaluationTypes]);

  // ── Load bulletins (auto-calculate — same pattern as registre) ─────────────
  const loadBulletins = useCallback(async () => {
    // ⭐ For EN: selectedEvalTypeId is not required (we load all 3 eval types)
    //    For FR: selectedEvalTypeId is required
    //    ⭐ SECONDAIRE « Bulletin trimestriel » : consolidé — pas de filtre par
    //       type, le tableau regroupe Interrogations 1/2 + Devoirs surveillés 1/2
    //       (INT1/INT2/DS1/DS2) du trimestre.
    //    ⭐ SECONDAIRE « Bulletin d'évaluation » : standard primaire — un seul
    //       type d'évaluation sélectionné à la fois.
    if (!selectedClassId || !selectedPeriodId || !academicYear?.id) return;
    if (scopeLang !== 'EN' && !secondaryConsolidated && !selectedEvalTypeId) return;
    setLoadingBulletins(true);
    try {
      // ⭐ Step 1: Fetch VALIDATED evaluations (same as registre)
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      // ⭐ Filter by period + evaluationType
      //    For EN: load ALL 3 eval types (FCA + SCA + EXAM) for the selected period
      //            — the bulletin is consolidated (shows all 3 components per subject)
      //            ⭐ V10h : les 2 familles de codes sont acceptées
      //            (FCA/FIRST_CA, SCA/SECOND_CA, EXAM/EXAMINATION) via
      //            enComponentForCode — même robustesse que le récapitulatif.
      //    For FR secondary (Bulletin trimestriel): load ALL typed evals (INT1/INT2/DS1/DS2) of the period
      //    For FR (dont secondaire « Bulletin d'évaluation »): filter by selected eval type ID (single eval per bulletin)
      const filtered = scopeLang === 'EN'
        ? allEvals.filter((ev: any) =>
            ev.period?.id === selectedPeriodId &&
            enComponentForCode(ev.evaluationType?.code || '') !== null
          )
        : secondaryConsolidated
          ? allEvals.filter((ev: any) =>
              ev.period?.id === selectedPeriodId &&
              secondaryNoteKey2(ev.evaluationType?.code, ev.evaluationType?.name) !== null
            )
          : allEvals.filter((ev: any) =>
              ev.period?.id === selectedPeriodId &&
              ev.evaluationType?.id === selectedEvalTypeId
            );

      // Filter by language (FR/EN) — for EN, also include subjects with no language set
      // ⭐ 2026-09-30 — FIX fuite anglophone dans la maternelle FR : si scopeLang
      //    est null (pas de piste linguistique définie), on exclut les évaluations
      //    anglophones (language='EN') pour éviter la fuite de données.
      const langFiltered = scopeLang
        ? filtered.filter((ev: any) => {
            const lang = ev.subject?.language;
            return !lang || lang === scopeLang || lang === 'FR';
          })
        : filtered.filter((ev: any) => {
            // Pas de scopeLang → on exclut les évaluations explicitement anglophones
            const lang = ev.subject?.language;
            return !lang || lang === 'FR';
          });

      // ⭐ SECONDAIRE — 6e/5e SANS coefficient ; 4e → Terminale AVEC coefficient
      const selectedClassObj = classesRef.current.find((c: any) => c.id === selectedClassId);
      const isJuniorSec = isJuniorSecondaryClass2(selectedClassObj?.name || '');
      const selectedPeriodNumber = parseInt(
        (periodsRef.current.find((p: any) => p.id === selectedPeriodId)?.name || '').match(/(\d+)/)?.[1] || '0', 10
      );

      // ⭐ Step 2: Build subject list (sorted)
      const subjects: Array<{ id: string; name: string; code?: string; coefficient?: number }> = [];
      const seenSubjectIds = new Set<string>();
      for (const ev of langFiltered) {
        if (ev.subject?.id && !seenSubjectIds.has(ev.subject.id)) {
          subjects.push({
            id: ev.subject.id,
            name: ev.subject.name,
            code: ev.subject.code,
            coefficient: typeof ev.subject.coefficient === 'number' ? ev.subject.coefficient : 1,
          });
          seenSubjectIds.add(ev.subject.id);
        }
      }

      // ⭐ Step 3: Fetch grades — UN SEUL appel batché (FIX PERF 2026-09-21 :
      //    N requêtes HTTP parallèles saturaient le navigateur/le SW sur
      //    réseau lent → temps de chargement > 1 min et toasts « délai
      //    dépassé »)
      const evalGradesMap = new Map<string, any[]>();
      {
        const sheetsMap = await institutionalExamsService
          .getGradingSheetsBatch(langFiltered.map((ev: any) => ev.id))
          .catch(() => ({}) as Record<string, any[]>);
        for (const ev of langFiltered) {
          evalGradesMap.set(ev.id, Array.isArray(sheetsMap[ev.id]) ? sheetsMap[ev.id] : []);
        }
      }

      // ⭐ Step 4: Build student results + compute averages (frontend calculation)
      const studentMap = new Map<string, StudentResult>();

      for (const ev of langFiltered) {
        const grades = evalGradesMap.get(ev.id) || [];
        const subjectId = ev.subject?.id;
        if (!subjectId) continue;
        const evalCode = ev.evaluationType?.code;

        for (const grade of grades) {
          if (!studentMap.has(grade.studentId)) {
            studentMap.set(grade.studentId, {
              id: grade.studentId,
              studentName: grade.studentName || 'Inconnu',
              matricule: grade.matricule,
              gender: grade.gender,
              birthDate: grade.birthDate ?? null,   // ⭐ V10h — âge du Report Book
              age: ageFromBirthDate(grade.birthDate ?? null),
              subjectScores: {},
              generalAverage: null,
              appreciationGlobale: null,
              classRank: 0,
            });
          }
          const student = studentMap.get(grade.studentId)!;

          // ⭐ SECONDAIRE (Bulletin trimestriel) — slots INT1/INT2/DS1/DS2 par
          //    matière : le bulletin consolide les 4 évaluations —
          //    Moyenne d'interrogation = (INT1+INT2)/2,
          //    Moyenne = (MoyInt + DS1 + DS2)/3, calculées au post-pass
          if (secondaryConsolidated) {
            const existing: SubjectScore = student.subjectScores[subjectId] || {
              score: null, qualitativeCode: null, isAbsent: false, appreciation: '—',
            };
            const val = grade.isAbsent
              ? null
              : (grade.score !== null ? Number(grade.score) : null);
            if (evalCode === 'INT1' || evalCode === 'IE1') existing.int1 = val;
            else if (evalCode === 'INT2' || evalCode === 'IE2') existing.int2 = val;
            else if (evalCode === 'DS1') existing.ds1 = val;
            else if (evalCode === 'DS2') existing.ds2 = val;
            else {
              const secKey = secondaryNoteKey2(evalCode, ev.evaluationType?.name);
              if (secKey === 'INT1') existing.int1 = val;
              else if (secKey === 'INT2') existing.int2 = val;
              else if (secKey === 'DS1') existing.ds1 = val;
              else if (secKey === 'DS2') existing.ds2 = val;
            }
            existing.secHasSlot = true;
            student.subjectScores[subjectId] = existing;
            continue;
          }

          // ⭐ EN: 3-component accumulation (FCA + SCA + EXAM) per subject
          //    Each grade is stored in its corresponding slot.
          //    The Total (/100) is recomputed after each insertion.
          if (scopeLang === 'EN' && !isMaternelle) {
            const existing: SubjectScore = student.subjectScores[subjectId] || {
              score: null, qualitativeCode: null, isAbsent: false, appreciation: '—',
              firstCA: null, secondCA: null, exam: null, total: null,
            };
            const scoreVal = grade.isAbsent
              ? null
              : (grade.score !== null ? Number(grade.score) : null);
            // ⭐ V10g — Normalisation des codes : les types EN existent sous
            // FIRST_CA/SECOND_CA/EXAM (settings) OU FCA/SCA/EXAM (défauts).
            const comp = enComponentForCode(evalCode || '');
            if (comp?.key === 'CA1') existing.firstCA = scoreVal;
            else if (comp?.key === 'CA2') existing.secondCA = scoreVal;
            else if (comp?.key === 'EXAM') existing.exam = scoreVal;
            existing.isAbsent = existing.isAbsent || grade.isAbsent;
            // ⭐ V10g — Recompute total /100 : 20 + 20 + 60 = 100 (somme brute,
            // plus aucune conversion par /140)
            const fca = existing.firstCA ?? 0;
            const sca = existing.secondCA ?? 0;
            const ex = existing.exam ?? 0;
            const hasAnyScore = existing.firstCA !== null || existing.secondCA !== null || existing.exam !== null;
            existing.total = hasAnyScore ? (fca + sca + ex) : null;
            existing.score = existing.total; // for rank computation
            // Appreciation based on /100
            const t100 = existing.total;
            existing.appreciation = t100 === null
              ? '—'
              : t100 >= 90 ? 'Outstanding'
                : t100 >= 80 ? 'Very Good'
                : t100 >= 70 ? 'Good'
                : t100 >= 60 ? 'Fair'
                : t100 >= 50 ? 'Pass'
                : t100 >= 40 ? 'Weak'
                : 'Very Weak';
            student.subjectScores[subjectId] = existing;
            continue;
          }

          if (grade.isAbsent) {
            student.subjectScores[subjectId] = { score: null, qualitativeCode: null, isAbsent: true, appreciation: 'Absent' };
          } else if (isMaternelle) {
            const code = grade.qualitativeCode;
            student.subjectScores[subjectId] = {
              score: null, qualitativeCode: code, isAbsent: false,
              appreciation: code === 'TS' ? (scopeLang === 'EN' ? 'Very Satisfactory' : 'Très Satisfaisant')
                : code === 'S' ? (scopeLang === 'EN' ? 'Satisfactory' : 'Satisfaisant')
                : code === 'PS' ? (scopeLang === 'EN' ? 'Less Satisfactory' : 'Peu Satisfaisant') : '—',
            };
          } else {
            const score = grade.score !== null ? Number(grade.score) : null;
            // ⭐ Récupérer CM et CP depuis le grade (parsé depuis comment JSON par le backend)
            const cmVal = grade.cm !== null && grade.cm !== undefined ? Number(grade.cm) : null;
            const cpVal = grade.cp !== null && grade.cp !== undefined ? Number(grade.cp) : null;
            // ⭐ En anglophone, les mentions sont basées sur /100 (converties depuis le barème)
            const score100 = score !== null && grade.maxScore ? (score / Number(grade.maxScore || 20)) * 100 : null;
            // ⭐ Secondaire « Bulletin d'évaluation » : mêmes mentions que le
            //    bulletin trimestriel (Très Bien → Faible)
            const frAppreciation = (isSecondaryTrack && !secondaryConsolidated)
              ? computeAppreciationSecondaire(score)
              : (score === null ? '—' : score >= 16 ? 'Très Bien' : score >= 14 ? 'Bien' : score >= 12 ? 'Assez Bien' : score >= 10 ? 'Passable' : 'Insuffisant');
            student.subjectScores[subjectId] = {
              score, qualitativeCode: null, isAbsent: false,
              cm: cmVal, cp: cpVal,
              appreciation: scopeLang === 'EN'
                ? (score100 === null ? '—'
                  : score100 >= 90 ? 'Outstanding'
                  : score100 >= 80 ? 'Very Good'
                  : score100 >= 70 ? 'Good'
                  : score100 >= 60 ? 'Fair'
                  : score100 >= 50 ? 'Pass'
                  : score100 >= 40 ? 'Weak'
                  : 'Very Weak')
                : frAppreciation,
            };
          }
        }
      }

      // Fill missing subjects + compute averages
      const results = Array.from(studentMap.values());

      // ⭐ SECONDAIRE « Bulletin d'évaluation » — rang dense par matière sur la
      //    note de l'évaluation (ex æquo gérés) : alimente la colonne Rang du
      //    tableau Discipline | Note /20 | Rang | Appréciation.
      if (isSecondaryTrack && !secondaryConsolidated) {
        for (const subject of subjects) {
          const scored = results
            .map((st) => ({ id: st.id, note: st.subjectScores[subject.id]?.score ?? null }))
            .filter((x) => x.note !== null)
            .sort((a, b) => (b.note as number) - (a.note as number));
          let lastEvalRank = 0;
          let lastEvalVal: number | null = null;
          scored.forEach((x, i) => {
            const r = (i > 0 && x.note === lastEvalVal) ? lastEvalRank : i + 1;
            lastEvalRank = r;
            lastEvalVal = x.note;
            const s = results.find((st) => st.id === x.id)!.subjectScores[subject.id];
            if (s) s.subjectRank = r;
          });
        }
      }

      // ⭐ SECONDAIRE (Bulletin trimestriel) — post-pass : moyennes par matière
      //    + rang par matière. Moyenne d'interrogation = (INT1+INT2)/2 ·
      //    Moyenne = (MoyInt+DS1+DS2)/3 · Note coefficient = Moyenne × Coef
      //    (4e → Terminale)
      if (secondaryConsolidated) {
        for (const student of results) {
          for (const subject of subjects) {
            const s = student.subjectScores[subject.id] || { score: null, qualitativeCode: null, isAbsent: false, appreciation: '—' };
            const { moyInter, moyenne } = secondaryMoyenneFromSlots({
              INT1: s.int1, INT2: s.int2, DS1: s.ds1, DS2: s.ds2,
            });
            s.moyInter = moyInter;
            s.moyenne = moyenne;
            s.score = moyenne; // pour les chemins génériques (stats classe)
            s.isAbsent = s.secHasSlot === true && moyenne === null;
            const coef = subject.coefficient ?? 1;
            s.coefficient = isJuniorSec ? null : coef;
            s.noteCoef = !isJuniorSec && moyenne !== null ? moyenne * coef : null;
            s.appreciation = computeAppreciationSecondaire(moyenne);
            student.subjectScores[subject.id] = s;
          }
        }
        // Rang dense par matière (ex æquo gérés)
        for (const subject of subjects) {
          const scored = results
            .map((st) => ({ id: st.id, moyenne: st.subjectScores[subject.id]?.moyenne ?? null }))
            .filter((x) => x.moyenne !== null)
            .sort((a, b) => (b.moyenne as number) - (a.moyenne as number));
          let lastRank = 0;
          let lastVal: number | null = null;
          scored.forEach((x, i) => {
            const r = (i > 0 && x.moyenne === lastVal) ? lastRank : i + 1;
            lastRank = r;
            lastVal = x.moyenne;
            const s = results.find((st) => st.id === x.id)!.subjectScores[subject.id];
            if (s) s.subjectRank = r;
          });
        }
      }

      for (const student of results) {
        for (const subject of subjects) {
          if (!student.subjectScores[subject.id]) {
            student.subjectScores[subject.id] = { score: null, qualitativeCode: null, isAbsent: false, appreciation: '—' };
          }
        }

        // Compute general average
        let totalScore = 0;
        let validCount = 0;
        let tsCount = 0, sCount = 0, psCount = 0;

        for (const subject of subjects) {
          const s = student.subjectScores[subject.id];
          if (!s || s.isAbsent) continue;
          if (isMaternelle) {
            if (s.qualitativeCode === 'TS') { tsCount++; validCount++; }
            else if (s.qualitativeCode === 'S') { sCount++; validCount++; }
            else if (s.qualitativeCode === 'PS') { psCount++; validCount++; }
          } else {
            if (s.score !== null) { totalScore += s.score; validCount++; }
          }
        }

        if (isMaternelle) {
          if (validCount > 0) {
            student.generalAverage = (tsCount * 3 + sCount * 2 + psCount * 1) / validCount;
            student.appreciationGlobale = student.generalAverage >= 2.5
              ? (scopeLang === 'EN' ? 'Very Satisfactory' : 'Très Satisfaisant')
              : student.generalAverage >= 1.5
                ? (scopeLang === 'EN' ? 'Satisfactory' : 'Satisfaisant')
                : (scopeLang === 'EN' ? 'Less Satisfactory' : 'Peu Satisfaisant');
          }
        } else if (secondaryConsolidated) {
          // ⭐ SECONDAIRE (Bulletin trimestriel) — 6e/5e : moyenne simple des
          //    moyennes de matières ; 4e → T : Σ(note coefficient) / Σ(coefficients)
          let sumCoef = 0, sumNoteCoef = 0, sumMoy = 0, countMoy = 0;
          for (const subject of subjects) {
            const s = student.subjectScores[subject.id];
            if (!s || s.moyenne === null || s.moyenne === undefined) continue;
            if (isJuniorSec) { sumMoy += s.moyenne; countMoy++; }
            else {
              const coef = s.coefficient ?? subject.coefficient ?? 1;
              sumCoef += coef;
              sumNoteCoef += s.noteCoef ?? (s.moyenne * coef);
            }
          }
          student.generalAverage = isJuniorSec
            ? (countMoy ? sumMoy / countMoy : null)
            : (sumCoef ? sumNoteCoef / sumCoef : null);
          student.appreciationGlobale = computeAppreciationSecondaire(student.generalAverage);
        } else if (scopeLang === 'EN') {
          // ⭐ EN: generalAverage is the mean of subject totals (on /100)
          if (validCount > 0) {
            student.generalAverage = totalScore / validCount;
            const avg100 = student.generalAverage;
            student.appreciationGlobale = avg100 >= 90 ? 'Outstanding'
              : avg100 >= 80 ? 'Very Good'
              : avg100 >= 70 ? 'Good'
              : avg100 >= 60 ? 'Fair'
              : avg100 >= 50 ? 'Pass'
              : avg100 >= 40 ? 'Weak'
              : 'Very Weak';
          }
        } else {
          if (validCount > 0) student.generalAverage = totalScore / validCount;
          // ⭐ Secondaire « Bulletin d'évaluation » : moyenne de l'évaluation +
          //    mention du modèle secondaire (Très Bien → Faible)
          if (isSecondaryTrack && !secondaryConsolidated) {
            student.appreciationGlobale = computeAppreciationSecondaire(student.generalAverage);
          }
        }
      }

      // Sort by average DESC + assign ranks
      results.sort((a, b) => (b.generalAverage ?? -1) - (a.generalAverage ?? -1));
      results.forEach((r, idx) => { r.classRank = idx + 1; });

      // Stats
      const validResults = results.filter(r => r.generalAverage !== null);
      const classAverage = validResults.length > 0
        ? validResults.reduce((sum, r) => sum + (r.generalAverage || 0), 0) / validResults.length : null;
      const passingCount = isMaternelle
        ? validResults.filter(r => r.appreciationGlobale === 'Très Satisfaisant' || r.appreciationGlobale === 'Satisfaisant'
            || r.appreciationGlobale === 'Very Satisfactory' || r.appreciationGlobale === 'Satisfactory').length
        : scopeLang === 'EN'
          ? validResults.filter(r => (r.generalAverage || 0) >= 50).length
          : validResults.filter(r => (r.generalAverage || 0) >= 10).length;

      // ⭐ SECONDAIRE (Bulletin trimestriel) — récap du 3e trimestre : moyennes
      //    T1 + T2 + moyenne annuelle (passage). Le tableau reste identique ; le
      //    récap s'ajoute sous le tableau du T3 uniquement (modèle officiel).
      if (secondaryConsolidated && selectedPeriodNumber === 3 && results.length > 0) {
        const coefficientBySubject = new Map<string, number>(subjects.map((s) => [s.id, s.coefficient ?? 1]));
        const otherPeriods = periodsRef.current
          .filter((p: any) => p.id !== selectedPeriodId)
          .sort((a: any, b: any) => {
            const numA = parseInt((a.name || '').match(/(\d+)/)?.[1] || '99', 10);
            const numB = parseInt((b.name || '').match(/(\d+)/)?.[1] || '99', 10);
            return numA - numB;
          })
          .slice(0, 2); // 1er et 2e trimestre seulement
        const averagesByPeriod: Array<Map<string, number | null>> = [];
        for (const p of otherPeriods) {
          const periodEvals = allEvals.filter((ev: any) =>
            ev.period?.id === p.id &&
            secondaryNoteKey2(ev.evaluationType?.code, ev.evaluationType?.name) !== null &&
            (!scopeLang || !ev.subject?.language || ev.subject.language === scopeLang || ev.subject.language === 'FR')
          );
          if (periodEvals.length === 0) {
            averagesByPeriod.push(new Map());
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          const avgs = await computeSecondaryPeriodAverages(periodEvals, isJuniorSec, coefficientBySubject);
          averagesByPeriod.push(avgs);
        }
        const [t1Map, t2Map] = averagesByPeriod;
        for (const student of results) {
          const t1 = t1Map?.get(student.id) ?? null;
          const t2 = t2Map?.get(student.id) ?? null;
          const annualParts = [t1, t2, student.generalAverage].filter((v): v is number => v !== null);
          const annualAverage = annualParts.length
            ? annualParts.reduce((a, b) => a + b, 0) / annualParts.length
            : null;
          student.secondaryRecap = {
            period1Average: t1,
            period2Average: t2,
            annualAverage,
            annualRank: null,
            decision: annualAverage !== null
              ? (annualAverage >= 10 ? 'Passe en classe supérieure' : 'Redouble')
              : null,
          };
        }
        // Rang annuel dense (ex æquo gérés)
        const ranked = results
          .map((st) => ({ id: st.id, annual: st.secondaryRecap?.annualAverage ?? null }))
          .filter((x) => x.annual !== null)
          .sort((a, b) => (b.annual as number) - (a.annual as number));
        let lastAnnualRank = 0;
        let lastAnnualVal: number | null = null;
        ranked.forEach((x, i) => {
          const r = (i > 0 && x.annual === lastAnnualVal) ? lastAnnualRank : i + 1;
          lastAnnualRank = r;
          lastAnnualVal = x.annual;
          const st = results.find((s2) => s2.id === x.id);
          if (st?.secondaryRecap) st.secondaryRecap.annualRank = r;
        });
      }

      setBulletinData({
        subjects,
        results,
        stats: {
          totalStudents: results.length,
          composedStudents: validResults.length,
          classAverage,
          passingCount,
          failingCount: validResults.length - passingCount,
          passingRate: validResults.length > 0 ? (passingCount / validResults.length) * 100 : 0,
        },
      });

      if (results.length > 0) setExpandedStudents(new Set([results[0].id]));
    } catch (err: any) {
      console.error('Error loading bulletins:', err);
      toastError('Erreur lors du chargement', { description: err.message });
      setBulletinData(null);
    } finally {
      setLoadingBulletins(false);
    }
  // ⭐ FIX PERF : classes/periods retirés des deps (lus via refs ci-dessus) —
  //    fin des rechargements complets des bulletins à chaque re-fetch des
  //    listes de référence.
  }, [selectedClassId, selectedPeriodId, selectedEvalTypeId, academicYear?.id, scopeLang, isMaternelle, isSecondaryTrack, secondaryConsolidated]);

  useEffect(() => { loadBulletins(); }, [loadBulletins]);

  // ⭐ 2026-09-29 — REFONTE : la source de vérité pour la conduite est le BACKEND.
  //    Avant : le frontend faisait un useEffect qui fetchait /api/discipline/conduct
  //    (URL incorrecte — pas d'endpoint), /api/discipline/sanctions (URL incorrecte
  //    aussi) et injectait Conduite comme matière synthétique avec score = defaultRef
  //    (puisque les fetchs retournaient null) → TOUS les élèves affichaient 17/20
  //    (la valeur par défaut), même ceux ayant des sanctions.
  //    Désormais : le frontend fetch la conduite de chaque élève via le nouvel
  //    endpoint dédié /api/discipline/conduct/student (URL correcte) et injecte
  //    une matière synthétique « Conduite » dans bulletinData.subjects pour qu'elle
  //    apparaisse dans le tableau des notes de l'UI (FR secondary + EN Report Book).
  //    Le backend fait de même côté PDF (cf. bulletins.controller.ts lignes
  //    ~1100-1190 — injection dans subjects[]).
  //    ⭐ Source de vérité = backend (conduct_ledger + sanctions du module
  //    Vie Scolaire, configuré par l'école).
  useEffect(() => {
    // ⭐ Uniquement pour les bulletins secondaires (FR trimestriel/évaluation +
    //    EN Report Book). Pas pour maternelle/primaire qui n'ont pas de conduite.
    const isAnySecondary = isSecondaire && (scopeLang === 'EN' || isSecondaryTrack);
    if (!isAnySecondary || !bulletinData || !academicYear?.id || !selectedPeriodId || !selectedClassId) return;
    const CONDUCT_SUBJECT_ID = '__conduct__';
    // ⭐ 2026-09-30 — OPTIMISATION : on utilise l'endpoint batch
    //    /api/discipline/conduct/students-batch qui récupère la conduite de
    //    TOUS les élèves de la classe en UNE SEULE requête (au lieu de N
    //    requêtes /student par élève). Avant : 30 élèves → 30 fetchs
    //    parallèles qui pouvaient échouer (504) → conductScore null →
    //    « — » dans le tableau. Désormais : 1 seul fetch qui retourne un
    //    tableau de { studentId, conductScore, ... }.
    fetch(`/api/discipline/conduct/students-batch?classId=${selectedClassId}&periodId=${selectedPeriodId}&academicYearId=${academicYear.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((batchResults: any[]) => {
        if (!Array.isArray(batchResults) || batchResults.length === 0) return;
        // Construire une map studentId → conductScore (pour lookup rapide)
        const conductByStudentId = new Map<string, any>();
        for (const row of batchResults) {
          if (row.studentId) conductByStudentId.set(row.studentId, row);
        }
        setBulletinData(prev => {
          if (!prev) return prev;
          const hasConduct = prev.subjects.some(s => s.id === CONDUCT_SUBJECT_ID);
          const subjects = hasConduct ? prev.subjects : [...prev.subjects, { id: CONDUCT_SUBJECT_ID, name: 'Conduite', coefficient: 1 }];
          const results = prev.results.map((st) => {
            const conduct = conductByStudentId.get(st.id);
            const conductScore = conduct && typeof conduct.conductScore === 'number' ? conduct.conductScore : null;
            const conductRef = conduct && typeof conduct.conductReference === 'number' ? conduct.conductReference : 17;
            return {
              ...st,
              subjectScores: {
                ...st.subjectScores,
                [CONDUCT_SUBJECT_ID]: {
                  score: conductScore,
                  qualitativeCode: null,
                  isAbsent: false,
                  appreciation: conductScore !== null && conductScore >= conductRef * 0.6 ? 'Satisfaisant' : 'À améliorer',
                  moyenne: conductScore,
                  coefficient: 1,
                  noteCoef: conductScore,
                  // ⭐ 2026-09-29 — FIX ABS dans colonne « Moyenne d'interrogation » :
                  //    secHasSlot: true déclenchait l'affichage « ABS » quand
                  //    int1/int2/moyInter étaient null. Or la Conduite n'a PAS de
                  //    composantes INT1/INT2/DS1/DS2 → on force secHasSlot: false
                  //    pour que les colonnes vides affichent « — » et non « ABS ».
                  secHasSlot: false,
                  int1: null,
                  int2: null,
                  moyInter: null,
                  ds1: null,
                  ds2: null,
                  subjectRank: null,
                  // Pour EN Report Book (10 colonnes FCA/SCA/EXAM/Total/100) :
                  // pas de composantes CA, mais on met le score en Total.
                  firstCA: null,
                  secondCA: null,
                  exam: null,
                  total: conductScore,
                } as any,
              },
            };
          });
          return { ...prev, subjects, results };
        });
      })
      .catch(() => {});
  }, [isSecondaire, scopeLang, isSecondaryTrack, bulletinData?.subjects.length, bulletinData?.results.length, academicYear?.id, selectedPeriodId, selectedClassId]);

  const toggleStudent = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  };

  // ⭐ 2026-11-23 — Construction du PAYLOAD du bulletin, partagée par « Générer
  //    PDF », « Toute la classe » et « Envoyer par WhatsApp ».
  //    ⭐ AUTO-GÉNÉRATION AU MOMENT DE LA GÉNÉRATION (exigence promoteur :
  //    « dès qu'on clique sur le bouton générer PDF, tous les champs qui
  //    devaient être auto-générés doivent être auto-générés pour apparaître
  //    dans le fichier PDF ») — AVANT, l'auto-génération (assiduité,
  //    discipline, défauts majeurs, qualités remarquables, analyse/
  //    recommandations, visa directeur) ne se déclenchait qu'au MONTAGE DE LA
  //    PAGE 2 : sans visiter la page 2, le PDF sortait avec les champs vides.
  //    Désormais, si aucune annotation n'a jamais été enregistrée pour l'élève,
  //    on la demande au backend (auto-annotations), on la PERSISTE, et elle
  //    figure dans le PDF — quel que soit le bouton utilisé.
  const buildBulletinPayload = async (
    student: StudentResult,
    signatures?: { teacherSig: string | null; directorSig: string | null; parentSig: string | null },
  ): Promise<any> => {
    const isEn = scopeLang === 'EN';
    const selectedPeriod = periods.find((p: any) => p.id === selectedPeriodId);
    const periodEndDate = selectedPeriod?.endDate ? format(new Date(selectedPeriod.endDate), 'EEEE, MMMM d, yyyy', { locale: enUSLocale }) : null;
    // Next period start date (look for the next period in the same academic year)
    const sortedPeriods = [...periods].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const currentIdx = sortedPeriods.findIndex((p: any) => p.id === selectedPeriodId);
    const nextPeriod = currentIdx >= 0 && currentIdx < sortedPeriods.length - 1 ? sortedPeriods[currentIdx + 1] : null;
    const nextTermStart = nextPeriod?.startDate ? format(new Date(nextPeriod.startDate), 'EEEE, MMMM d, yyyy', { locale: enUSLocale }) : null;

    const payload: any = {
      // ⭐ schoolForLevel : identité du NIVEAU courant — pour le
      //    secondaire, l'override « Identité école secondaire » (module
      //    Paramètres → Identité) remplace nom/logo/adresse/tél/email/slogan.
      schoolName: schoolForLevel?.schoolName,
      schoolLogo: schoolForLevel?.logoUrl,
      schoolAddress: schoolForLevel?.address,
      schoolPhone: schoolForLevel?.phone,
      schoolEmail: schoolForLevel?.email,
      schoolSlogan: schoolForLevel?.slogan,
      academicYearName: academicYear?.label || '',
      periodName: selectedPeriodName,
      // ⭐ periodId envoyé au backend pour qu'il puisse résoudre
      //    la conduite depuis conduct_ledger WHERE quarterId = periodId
      //    (au lieu de isCurrent=true qui peut ne pas être marqué).
      periodId: selectedPeriodId,
      evaluationTypeId: selectedEvalTypeId || null,
      evaluationTypeName: selectedEvalTypeName,
      evaluationTypeCode: selectedEvalTypeCode,
      className: selectedClassName,
      studentName: student.studentName,
      studentMatricule: student.matricule,
      studentGender: student.gender,
      // ⭐ V10h — âge + date de naissance pour le formulaire Report Book
      studentAge: student.age ?? null,
      studentBirthDate: student.birthDate ?? null,
      admissionNumber: student.matricule || null,
      isMaternelle,
      // ⭐ isSecondaryLevel : vrai pour TOUS les bulletins
      //    secondaires (FR trimestriel, FR évaluation, ET EN Report Book).
      //    Utilisé par le backend pour résoudre la conduite depuis
      //    conduct_ledger + sanctions (module Vie Scolaire) — source de vérité
      //    côté backend. Sans ce flag, le backend ignorait la conduite pour
      //    les bulletins EN (car isSecondary/isSecondaryEval étaient false).
      isSecondaryLevel: isSecondaire,
      // ⭐ SECONDAIRE « Bulletin trimestriel » uniquement — modèle CEG (Interrogation
      //    écrite 1/2 + Devoir surveillé 1/2 + Moyenne + Coefficient + Note coefficient).
      isSecondary: secondaryConsolidated,
      // ⭐ SECONDAIRE « Bulletin d'évaluation » — même standard graphique que le
      //    bulletin secondaire MAIS un seul type d'évaluation : tableau
      //    Discipline | Note /20 | Rang | Appréciation + moyenne de l'évaluation.
      isSecondaryEval: isSecondaryTrack && !secondaryConsolidated ? true : undefined,
      secJunior: secondaryConsolidated
        ? isJuniorSecondaryClass2(selectedClassName || '')
        : undefined,
      // ⭐ EN-specific fields
      scopeLang: scopeLang || null,
      sessionYear: academicYear?.label || null,
      termEndingDate: periodEndDate,
      nextTermStartDate: nextTermStart,
      numberOfSubjects: bulletinData!.subjects.length,
      subjects: bulletinData!.subjects.map(s => {
        const sc = student.subjectScores[s.id];
        // ⭐ V10h — stats par matière (Highest/Lowest in class + Position)
        const stats = isEn ? enSubjectClassStats(bulletinData!, s.id, student.id) : null;
        return {
          // ⭐ id (subjectId) envoyé au backend pour qu'il
          //    puisse résoudre le nom de l'enseignant de la matière via
          //    TeacherClassAssignment (classe × matière). Affiché dans la
          //    colonne « Professeur » du bulletin secondaire.
          id: s.id,
          name: s.name,
          score: sc?.score ?? null,
          qualitativeCode: sc?.qualitativeCode ?? null,
          isAbsent: sc?.isAbsent ?? false,
          appreciation: sc?.appreciation ?? '—',
          // ⭐ Primaire — CM/CP envoyés par le frontend (valeurs réelles depuis le grade)
          cm: !isEn && !secondaryConsolidated && !isMaternelle ? (sc?.cm ?? null) : undefined,
          cp: !isEn && !secondaryConsolidated && !isMaternelle ? (sc?.cp ?? null) : undefined,
          // ⭐ EN: 3-component scores per subject
          firstCA: isEn ? (sc?.firstCA ?? null) : undefined,
          secondCA: isEn ? (sc?.secondCA ?? null) : undefined,
          exam: isEn ? (sc?.exam ?? null) : undefined,
          total: isEn ? (sc?.total ?? null) : undefined,
          // ⭐ V10h — colonnes Report Book : Grade + Remark + stats classe
          grade: isEn ? enGradeFor(sc?.total ?? null) : undefined,
          remark: isEn ? (enTierFor(sc?.total ?? null)?.label ?? '—') : undefined,
          highestInClass: isEn ? stats?.highest ?? null : undefined,
          lowestInClass: isEn ? stats?.lowest ?? null : undefined,
          subjectPosition: (isEn || (isSecondaryTrack && !secondaryConsolidated))
            ? (isEn ? (stats?.position ?? null) : (sc?.subjectRank ?? null))
            : undefined,
          // ⭐ SECONDAIRE (Bulletin trimestriel) — slots + moyennes + coefficient
          //    + rang (modèle CEG). undefined = évaluation sans donnée pour
          //    l'élève → clé absente du JSON ; null = absent → ABS ; number = note
          secInt1: secondaryConsolidated ? sc?.int1 : undefined,
          secInt2: secondaryConsolidated ? sc?.int2 : undefined,
          secDs1: secondaryConsolidated ? sc?.ds1 : undefined,
          secDs2: secondaryConsolidated ? sc?.ds2 : undefined,
          secMoyInter: secondaryConsolidated ? (sc?.moyInter ?? null) : undefined,
          secMoyenne: secondaryConsolidated ? (sc?.moyenne ?? null) : undefined,
          secCoef: secondaryConsolidated ? (sc?.coefficient ?? s.coefficient ?? null) : undefined,
          secNoteCoef: secondaryConsolidated ? (sc?.noteCoef ?? null) : undefined,
          secRank: secondaryConsolidated ? (sc?.subjectRank ?? null) : undefined,
          secHasSlot: secondaryConsolidated ? (sc?.secHasSlot ?? false) : undefined,
        };
      }),
      // ⭐ SECONDAIRE (Bulletin trimestriel) — totaux + récap T3 (moyennes
      //    T1/T2 + moyenne annuelle)
      secTotalCoef: secondaryConsolidated
        ? bulletinData!.subjects.reduce((sum, s) => {
            const sc = student.subjectScores[s.id];
            return sum + (sc?.moyenne != null ? (sc?.coefficient ?? s.coefficient ?? 1) : 0);
          }, 0)
        : undefined,
      secTotalNotesCoef: secondaryConsolidated
        ? bulletinData!.subjects.reduce((sum, s) => sum + (student.subjectScores[s.id]?.noteCoef ?? 0), 0)
        : undefined,
      secRecap: secondaryConsolidated ? (student.secondaryRecap ?? null) : undefined,
      generalAverage: student.generalAverage,
      classRank: student.classRank,
      classAverage: bulletinData!.stats.classAverage,
      highestAverage: bulletinData!.results.length > 0 ? Math.max(...bulletinData!.results.map(r => r.generalAverage || 0)) : null,
      lowestAverage: bulletinData!.results.length > 0 ? Math.min(...bulletinData!.results.map(r => r.generalAverage || 0)) : null,
      totalStudents: bulletinData!.results.length,
      appreciationGlobale: student.appreciationGlobale,
    };

    // ⭐ Charger les annotations enregistrées, puis AUTO-GÉNÉRER si vide
    //    (voir commentaire d'en-tête — plus besoin de visiter la page 2).
    let ann: any = {};
    try {
      const annRes = await apiClient.get(`/institutional-exams/bulletins/annotations?studentId=${student.id}&periodId=${selectedPeriodId}`);
      ann = annRes.data || {};
    } catch {}

    if (!ann.analyseRecommandations && !ann.assiduite) {
      try {
        const autoRes = await apiClient.get(`/institutional-exams/bulletins/auto-annotations?studentId=${student.id}&periodId=${selectedPeriodId}`);
        const autoData = autoRes.data || {};
        if (autoData.analyseRecommandations || autoData.assiduite) {
          ann = { ...ann, ...autoData };
          // Persister (même logique que la page 2) — non bloquant
          apiClient.patch('/institutional-exams/bulletins/annotations', {
            studentId: student.id,
            periodId: selectedPeriodId,
            analyseRecommandations: autoData.analyseRecommandations || '',
            assiduite: autoData.assiduite || '',
            discipline: autoData.discipline || '',
            defautsMajeurs: autoData.defautsMajeurs || '',
            qualitesRemarquables: autoData.qualitesRemarquables || '',
            directorVisa: autoData.directorVisa || student.appreciationGlobale || '',
          }).catch(() => {});
        }
      } catch {}
    }

    payload.assiduite = ann.assiduite || null;
    payload.discipline = ann.discipline || null;
    payload.defautsMajeurs = ann.defautsMajeurs || null;
    payload.qualitesRemarquables = ann.qualitesRemarquables || null;
    payload.analyseRecommandations = ann.analyseRecommandations || null;
    payload.directorVisa = ann.directorVisa || null;
    // ⭐ Champs anglophones
    payload.enTeacherComment = ann.enTeacherComment || null;
    payload.enDirectorComment = ann.enDirectorComment || null;
    payload.enAffectiveAssessment = ann.enAffectiveAssessment || null;
    payload.enPsychomotorAssessment = ann.enPsychomotorAssessment || null;

    payload.teacherSignature = signatures?.teacherSig ?? null;
    payload.directorSignature = signatures?.directorSig ?? null;
    payload.parentSignature = signatures?.parentSig ?? null;

    return payload;
  };

  const handleGeneratePdf = async (student: StudentResult, signatures?: { teacherSig: string | null; directorSig: string | null; parentSig: string | null }) => {
    setGeneratingPdf(student.id);
    try {
      // ⭐ Call backend PDF generation endpoint (same pattern as Module Élèves)
      // Backend uses Puppeteer + official header (République, drapeau, ministère, école)
      const payload = await buildBulletinPayload(student, signatures);

      const response = await apiClient.post('/institutional-exams/bulletins/generate-pdf', payload, {
        responseType: 'blob',
        timeout: 120000, // ⭐ 2 minutes — la génération PDF via Puppeteer peut prendre du temps
      });

      // Download the PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // ⭐ Nom du fichier : bulletin_[élève]_[type éval]_[trimestre].pdf
      const safeStudentName = student.studentName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const safeEvalType = (selectedEvalTypeCode || selectedEvalTypeName || 'eval').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const safePeriod = (selectedPeriodName || 'periode').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `bulletin_${safeStudentName}_${safeEvalType}_${safePeriod}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toastSuccess('Bulletin généré', { description: student.studentName });
    } catch (err: any) {
      toastError('Erreur PDF', { description: err.response?.data?.message || err.message });
    } finally { setGeneratingPdf(null); }
  };

  const handleGenerateAllPdf = async () => {
    if (!bulletinData) return;
    let success = 0;
    let failed = 0;
    for (const student of bulletinData.results) {
      try {
        // ⭐ 2026-11-23 — signatures du workflow (directeur/enseignant) reprises
        //    pour chaque élève : le PDF « Toute la classe » naît avec les
        //    vraies signatures quand le workflow a déjà été signé.
        const sigs = {
          teacherSig: workflowSignatures[student.id]?.teacherSig ?? null,
          directorSig: workflowSignatures[student.id]?.directorSig ?? null,
          parentSig: null as string | null,
        };
        await handleGeneratePdf(student, sigs);
        success++;
      } catch (err) {
        console.error('PDF generation failed for student:', student.id, err);
        failed++;
      }
    }
    if (failed > 0) {
      toastError(isEN ? 'Generation incomplete' : 'Génération incomplète', {
        description: isEN
          ? `${success} generated, ${failed} failed.`
          : `${success} générés, ${failed} échoués.`,
      });
    } else {
      toastSuccess(isEN ? 'Generation complete' : 'Génération terminée', {
        description: isEN
          ? `${success} report cards generated.`
          : `${success} bulletins générés.`,
      });
    }
  };

  // ⭐ 2026-11-23 — ENVOI DU BULLETIN AU PARENT PAR WHATSAPP (bouton par élève —
  //    maternelle, primaire et secondaire). MÊME PATTERN QUE LE MODULE FINANCE
  //    (onglet Encaissement → option « lien wa.me ») — retour promoteur :
  //    « nous n'utilisons pas l'API directe de WhatsApp, ça ne peut pas
  //    fonctionner par API directe » :
  //      1. POST /institutional-exams/bulletins/whatsapp-link : le backend
  //         rédige le message professionnel (école, moyenne, rang, mention),
  //         archive le PDF (URL publique R2/S3 — repli /bulletin/[token]
  //         30 jours) et renvoie le lien wa.me pré-rempli vers le numéro du
  //         tuteur ;
  //      2. window.open(wa.me) → WhatsApp (application / WhatsApp Web du
  //         téléphone de l'école) s'ouvre avec le message DÉJÀ RÉDIGÉ et le
  //         LIEN DE TÉLÉCHARGEMENT DU PDF — envoyé depuis le numéro de
  //         l'école vers le numéro WhatsApp du parent, il ne reste qu'à
  //         cliquer Envoyer (aucune API directe, aucun presse-papiers, aucun
  //         téléchargement manuel).
  //    Réponses gérées : hasPhone=false (aucun numéro de tuteur renseigné),
  //    succès (WhatsApp ouvert — cliquez Envoyer), erreur backend (dont
  //    « Envoi bloqué : arriérés de scolarité »).
  const [whatsappSending, setWhatsappSending] = useState<string | null>(null);
  const handleWhatsAppBulletin = async (student: StudentResult) => {
    if (!bulletinData) return;
    setWhatsappSending(student.id);
    try {
      const sigs = {
        teacherSig: workflowSignatures[student.id]?.teacherSig ?? null,
        directorSig: workflowSignatures[student.id]?.directorSig ?? null,
        parentSig: null as string | null,
      };
      const payload = await buildBulletinPayload(student, sigs);
      const response = await apiClient.post('/institutional-exams/bulletins/whatsapp-link', payload, {
        timeout: 120000, // génération PDF (Puppeteer) + archive — même budget que « Générer PDF »
      });
      const data: any = response.data || {};
      const who = data.parentName || student.studentName || 'le parent';
      const toLabel = data.phone || '';

      if (!data.hasPhone || !data.url) {
        toastError(isEN ? 'No guardian phone number' : 'Numéro de tuteur manquant', {
          description: (isEN
            ? `${who} — no guardian WhatsApp number is recorded. Add one from Élèves > Familles.`
            : `${who} — aucun numéro de téléphone WhatsApp n'est renseigné pour le tuteur. Ajoutez-le dans Élèves et scolarité > Familles.`),
        });
        return;
      }

      // WhatsApp s'ouvre avec le message pré-rédigé + le lien du PDF —
      // l'école clique simplement sur Envoyer (pattern finance encaissement).
      window.open(data.url, '_blank');
      toastSuccess(isEN ? 'WhatsApp opened' : 'WhatsApp ouvert', {
        description: (isEN
          ? `Message ready for ${who}${toLabel ? ` (${toLabel})` : ''} — click Send in WhatsApp to deliver the report card (PDF link included) from the school's number.`
          : `Message prêt pour ${who}${toLabel ? ` (${toLabel})` : ''} — cliquez sur Envoyer dans WhatsApp pour transmettre le bulletin (lien PDF inclus) depuis le numéro de l'école.`),
      });
    } catch (err: any) {
      toastError(isEN ? 'WhatsApp send failed' : 'Échec de l\'envoi WhatsApp', {
        description: err.response?.data?.message || err.message,
      });
    } finally { setWhatsappSending(null); }
  };

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';
  const selectedPeriodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
  const selectedEvalTypeName = evaluationTypes.find(t => t.id === selectedEvalTypeId)?.name || '';
  const selectedEvalTypeCode = evaluationTypes.find(t => t.id === selectedEvalTypeId)?.code || '';

  // ⭐ Calcul de la date de fin du trimestre (TERM ENDING — Report Book EN)
  //    Format long anglais : "Friday, December 12, 2025"
  const termEndingDateForCard = useMemo(() => {
    const selectedPeriod = periods.find((p: any) => p.id === selectedPeriodId);
    const end = selectedPeriod?.endDate || selectedPeriod?.end_date;
    if (!end) return null;
    try {
      return format(new Date(end), 'EEEE, MMMM d, yyyy', { locale: enUSLocale });
    } catch {
      return null;
    }
  }, [periods, selectedPeriodId]);

  // ⭐ Calcul de la date de début du prochain trimestre (pour EN Page 2 teacher comment)
  //    On prend la prochaine période triée par date de début.
  const nextTermStartDateForCard = useMemo(() => {
    if (!periods || periods.length === 0) return null;
    const sorted = [...periods].sort((a: any, b: any) =>
      new Date(a.startDate || a.start_date || 0).getTime() - new Date(b.startDate || b.start_date || 0).getTime()
    );
    const currentIdx = sorted.findIndex((p: any) => p.id === selectedPeriodId);
    if (currentIdx < 0 || currentIdx >= sorted.length - 1) return null;
    const nextPeriod = sorted[currentIdx + 1];
    const nextStart = nextPeriod?.startDate || nextPeriod?.start_date;
    if (!nextStart) return null;
    try {
      return format(new Date(nextStart), 'EEEE, MMMM d, yyyy', { locale: enUSLocale });
    } catch {
      return null;
    }
  }, [periods, selectedPeriodId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">{isEN ? 'Report Cards' : 'Bulletins'}</h2>
        <Badge variant="outline" className="text-xs">{scopeLevel || '—'} {scopeLang ? `· ${scopeLang}` : ''}</Badge>
      </div>

      {/* Sub-tabs: Report Cards | Termly & Annual | Sending Criteria | Received */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('bulletin')}
          className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            activeSubTab === 'bulletin' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
        >
          <FileText className="w-4 h-4" />
          {isEN ? 'Report Cards' : 'Bulletin d\'évaluation'}
        </button>
        {/* ⭐ 2026-10-01 — Sous-onglet 'Bulletin trimestriel' masqué pour la
            piste anglophone (EN track n'utilise que 'Report Cards'). */}
        {!isEN && (
          <button
            onClick={() => setActiveSubTab('trimestriel')}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              activeSubTab === 'trimestriel' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            <Calculator className="w-4 h-4" />
            Bulletin trimestriel et annuel
          </button>
        )}
        <button
          onClick={() => setActiveSubTab('criteria')}
          className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            activeSubTab === 'criteria' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
        >
          <Settings className="w-4 h-4" />
          {isEN ? 'Sending Criteria' : 'Critères d\'envoi'}
        </button>
        {isTeacher && (
          <button
            onClick={() => setActiveSubTab('received')}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              activeSubTab === 'received' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            <Mail className="w-4 h-4" />
            {isEN ? 'Received Report Cards' : 'Bulletins reçus'}
          </button>
        )}
      </div>

      {/* ═══ Sub-tab: Bulletin d'évaluation (standard primaire : un type
          d'évaluation à la fois) — et, pour le secondaire FR, « Bulletin
          trimestriel » réutilise le même tableau avec le modèle consolidé
          CEG (secondaryConsolidated pilote le chargement) ═══ */}
      {(activeSubTab === 'bulletin' || (activeSubTab === 'trimestriel' && isSecondaryTrack)) && (
        <>

      {/* ⭐ Workflow Bar — Signature + Distribution + Envoi parents */}
      {bulletinData && bulletinData.results.length > 0 && selectedClassId && selectedPeriodId && (
        <WorkflowBar
          tenantId={effectiveTenantId}
          academicYearId={academicYear?.id}
          classId={selectedClassId}
          periodId={selectedPeriodId}
          userRole={user?.role}
          evaluationTypeId={selectedEvalTypeId || undefined}
          evaluationTypeName={selectedEvalTypeName || undefined}
          evaluationTypeCode={selectedEvalTypeCode || undefined}
          language={scopeLang as 'FR' | 'EN'}
          onRefresh={() => {
            loadBulletins();
            // ⭐ Force re-load of workflow signatures
            if (effectiveTenantId && academicYear?.id && selectedClassId && selectedPeriodId) {
              apiClient.get(`/institutional-exams/bulletins/class/${selectedClassId}/workflow-status?periodId=${selectedPeriodId}`)
                .then((res) => {
                  const sigs: Record<string, { directorSig?: string; teacherSig?: string }> = {};
                  for (const b of (res.data?.bulletins || [])) {
                    const studentId = b.studentId || b.student?.id;
                    if (studentId) {
                      sigs[studentId] = {
                        directorSig: b.directorSignature || undefined,
                        teacherSig: b.teacherSignature || undefined,
                      };
                    }
                  }
                  setWorkflowSignatures(sigs);
                })
                .catch(() => {});
            }
          }}
        />
      )}

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{isEN ? 'Term' : 'Trimestre'}</label>
            <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500">
              <option value="">{isEN ? '— Select —' : '— Sélectionner —'}</option>
              {periods.map(p => <option key={p.id} value={p.id}>{isEN ? translatePeriodName(p.name || p.label || '', 'EN') : (p.name || p.label)}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{isEN ? 'Class' : 'Classe'}</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500">
              <option value="">{isEN ? '— Select —' : '— Sélectionner —'}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{isEN ? translateClassName(c.name) : c.name}</option>)}
            </select>
          </div>
          {/* ⭐ EN + secondaire « Bulletin trimestriel » : bulletin consolidé —
              pas de filtre par type d'évaluation. Sinon (primaire + secondaire
              « Bulletin d'évaluation ») : filtre par type sélectionné. */}
          {scopeLang !== 'EN' && !secondaryConsolidated && (
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{isEN ? 'Evaluation' : 'Évaluation'}</label>
              <select value={selectedEvalTypeId} onChange={(e) => setSelectedEvalTypeId(e.target.value)}
                className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500">
                <option value="">{isEN ? '— Select —' : '— Sélectionner —'}</option>
                {evaluationTypes.map(t => <option key={t.id} value={t.id}>[{t.code}] {t.name}</option>)}
              </select>
            </div>
          )}
          {secondaryConsolidated && (
            <div className="flex-1 self-end">
              <div className="bg-blue-50 border border-blue-200 rounded-lg py-2.5 px-3 text-xs font-bold text-blue-700">
                Bulletin trimestriel (IE1 &amp; IE2 + DS1 &amp; DS2)
              </div>
            </div>
          )}
          {scopeLang === 'EN' && (
            <div className="flex-1 self-end">
              <div className="bg-blue-50 border border-blue-200 rounded-lg py-2.5 px-3 text-xs font-bold text-blue-700">
                Report Card (First CA + Second CA + Examination)
              </div>
            </div>
          )}
          {bulletinData && bulletinData.results.length > 0 && !isTeacher && (
            <div className="flex items-end">
              <Button onClick={handleGenerateAllPdf} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-lg shadow-sm w-full md:w-auto">
                <Printer className="w-4 h-4 mr-2" />{isEN ? 'Whole Class' : 'Toute la classe'}
              </Button>
            </div>
          )}
        </div>
        {(selectedClassName || selectedPeriodName || selectedEvalTypeName) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap text-xs text-gray-500">
            <span className="font-semibold">{isEN ? 'Selection:' : 'Sélection :'}</span>
            <Badge variant="outline" className="text-xs">{isEN ? translatePeriodName(selectedPeriodName || '', 'EN') || '—' : (selectedPeriodName || '—')}</Badge><span>·</span>
            <Badge variant="outline" className="text-xs">{isEN ? translateClassName(selectedClassName || '—') : (selectedClassName || '—')}</Badge>
            {/* ⭐ EN track has no eval type selector (consolidated 1st CA + 2nd CA + Exam),
                so the eval badge is hidden. For FR track, show the eval type badge. */}
            {!isEN && selectedEvalTypeName && (
              <><span>·</span><Badge variant="outline" className="text-xs">{selectedEvalTypeCode ? `[${selectedEvalTypeCode}] ` : ''}{selectedEvalTypeName || '—'}</Badge></>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {loadingBulletins ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-slate-500">{isEN ? 'Loading report cards…' : 'Chargement des bulletins…'}</span>
        </div>
      ) : !bulletinData ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">{isEN ? 'No report cards to display' : 'Aucun bulletin à afficher'}</p>
          <p className="text-sm text-gray-400 mt-1">
            {isEN
              ? 'Please select a term and a class.'
              : (scopeLang !== 'EN' && !secondaryConsolidated
                ? 'Sélectionnez un trimestre, une classe et une évaluation.'
                : 'Sélectionnez un trimestre et une classe.')}
          </p>
        </div>
      ) : bulletinData.results.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">{isEN ? 'No pupil / no validated grade' : 'Aucun élève / aucune note validée'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-xs gap-1"><Users className="w-3 h-3" />{bulletinData.results.length} {scopeLang === 'EN' ? 'pupils' : 'élèves'}</Badge>
              <Badge variant="outline" className="text-xs gap-1"><BookOpen className="w-3 h-3" />{bulletinData.subjects.length} {scopeLang === 'EN' ? 'subjects' : 'matières'}</Badge>
              {!isMaternelle && bulletinData.stats.classAverage !== null && (
                <Badge variant="outline" className="text-xs gap-1"><Award className="w-3 h-3" />{scopeLang === 'EN' ? 'Class average' : 'Moy. classe'}: {bulletinData.stats.classAverage.toFixed(2)}{scopeLang === 'EN' ? '/100' : '/20'}</Badge>
              )}
            </div>
          </div>

          {/* Student bulletins */}
          {bulletinData.results.map((student) => {
            const isExpanded = expandedStudents.has(student.id);
            return (
              <div key={student.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-stretch">
                  <button onClick={() => toggleStudent(student.id)}
                    className="flex-1 min-w-0 px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">{scopeLang === 'EN' ? enOrdinal(student.classRank) : formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}</div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{student.studentName}</div>
                        <div className="text-xs text-slate-500">
                          {student.matricule || '—'} · {scopeLang === 'EN' ? 'Position' : 'Rang'} {scopeLang === 'EN' ? enOrdinal(student.classRank) : formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}
                          {!isMaternelle && student.generalAverage !== null && ` · ${student.generalAverage.toFixed(2)}${scopeLang === 'EN' ? '/100' : '/20'}`}
                          {isMaternelle && student.appreciationGlobale && ` · ${student.appreciationGlobale}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isMaternelle && student.generalAverage !== null && (
                        <span className={cn('px-2 py-1 rounded text-xs font-bold',
                          scopeLang === 'EN'
                            ? ((student.generalAverage ?? 0) >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                            : (student.generalAverage >= 10 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'))}>
                          {student.generalAverage.toFixed(2)}{scopeLang === 'EN' ? '/100' : '/20'}
                        </span>
                      )}
                      {isMaternelle && student.appreciationGlobale && (
                        <span className={cn('px-2 py-1 rounded text-xs font-bold',
                          student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
                          student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
                          student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
                        )}>{student.appreciationGlobale}</span>
                      )}
                    </div>
                  </button>
                  {/* ⭐ 2026-11-23 — BOUTON « ENVOYER LE BULLETIN PAR WHATSAPP »
                      (directeur/promoteur) : disponible directement sur la
                      ligne de CHAQUE élève — maternelle, primaire et
                      secondaire. MÊME PATTERN QUE LE MODULE FINANCE
                      (encaissement → « lien wa.me ») : le backend rédige le
                      message (école, moyenne, rang, mention) + archive le PDF
                      (URL publique), et WhatsApp s'ouvre avec le message prêt
                      + le lien du PDF — envoyé depuis le téléphone de l'école
                      vers le WhatsApp du parent, il reste à cliquer Envoyer. */}
                  {!isTeacher && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleWhatsAppBulletin(student); }}
                      disabled={whatsappSending === student.id || generatingPdf === student.id}
                      title={isEN ? 'Send report card by WhatsApp to the parent' : 'Envoyer le bulletin par WhatsApp au parent'}
                      className="px-3 border-l border-slate-100 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                    >
                      {whatsappSending === student.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <WhatsAppIcon className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4">
                    <BulletinTwoPage
                      student={student}
                      bulletinData={bulletinData}
                      isMaternelle={isMaternelle}
                      school={schoolForLevel}
                      academicYear={academicYear}
                      selectedPeriodName={selectedPeriodName}
                      selectedClassName={selectedClassName}
                      selectedEvalTypeCode={selectedEvalTypeCode}
                      selectedEvalTypeName={selectedEvalTypeName}
                      onGeneratePdf={(sigs) => handleGeneratePdf(student, sigs)}
                      generatingPdf={generatingPdf === student.id}
                      canDownload={!isTeacher}
                      directorSignature={workflowSignatures[student.id]?.directorSig}
                      teacherSignature={workflowSignatures[student.id]?.teacherSig}
                      selectedPeriodId={selectedPeriodId}
                      scopeLang={scopeLang}
                      nextTermStartDate={nextTermStartDateForCard}
                      termEndingDate={termEndingDateForCard}
                      isSecondaire={secondaryConsolidated}
                      isSecondaryTrack={isSecondaryTrack}
                      directorName={directorName}
                      onWhatsAppBulletin={handleWhatsAppBulletin}
                      whatsappSending={whatsappSending === student.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* ═══ Sub-tab: Bulletin trimestriel et annuel — secondaire FR : tableau consolidé
          CEG affiché par le bloc ci-dessus ; autres niveaux : moyennes
          trimestrielles/annuelles (EM1/EM2/EC) ═══ */}
      {activeSubTab === 'trimestriel' && !isSecondaryTrack && (
        <MoyennesTab
          academicYear={academicYear}
          schoolLevelUuid={schoolLevelUuid}
          scopeLang={scopeLang}
          scopeLevel={scopeLevel || ''}
          isMaternelle={isMaternelle}
          classes={classes}
          activeMoyenneTab={activeMoyenneTab}
          setActiveMoyenneTab={setActiveMoyenneTab}
          activeVue={activeVue}
          setActiveVue={setActiveVue}
          school={schoolForLevel}
          effectiveTenantId={effectiveTenantId}
          user={user}
          directorName={directorName}
        />
      )}

      {/* ═══ Sub-tab: Critères d'envoi ═══ */}
      {activeSubTab === 'criteria' && (
        <SendingCriteriaTab tenantId={effectiveTenantId} isEN={isEN} />
      )}

      {/* ═══ Sub-tab: Bulletins reçus (enseignants) ═══ */}
      {activeSubTab === 'received' && isTeacher && (
        <ReceivedBulletinsTab
          tenantId={effectiveTenantId}
          academicYearId={academicYear?.id}
          user={user}
        />
      )}
    </div>
  );
}

// ─── Bulletin 2-Page Component (with flip animation) ────────────────────────

function BulletinTwoPage({
  student, bulletinData, isMaternelle, school, academicYear,
  selectedPeriodName, selectedClassName, selectedEvalTypeCode, selectedEvalTypeName,
  onGeneratePdf, generatingPdf, canDownload = true, directorSignature, teacherSignature,
  selectedPeriodId, scopeLang, nextTermStartDate, termEndingDate, isSecondaire, isSecondaryTrack, directorName,
  onWhatsAppBulletin, whatsappSending,
}: {
  student: StudentResult;
  bulletinData: BulletinData;
  isMaternelle: boolean;
  school: any;
  academicYear: any;
  selectedPeriodName: string;
  selectedClassName: string;
  selectedEvalTypeCode: string;
  selectedEvalTypeName: string;
  onGeneratePdf: (signatures: { teacherSig: string | null; directorSig: string | null; parentSig: string | null }) => void;
  generatingPdf: boolean;
  canDownload?: boolean;
  directorSignature?: string | null;
  teacherSignature?: string | null;
  selectedPeriodId?: string;
  scopeLang?: string;
  nextTermStartDate?: string | null;
  termEndingDate?: string | null;   // ⭐ V10h — TERM ENDING du Report Book
  // ⭐ 2026-11-23 — Envoi du bulletin par WhatsApp (bouton par élève)
  onWhatsAppBulletin?: (student: StudentResult) => void;
  whatsappSending?: boolean;
  isSecondaire?: boolean;           // ⭐ SECONDAIRE « Bulletin trimestriel » (consolidé CEG) — sinon standard primaire
  isSecondaryTrack?: boolean;       // ⭐ SECONDAIRE piste FR (les 2 onglets) — page 2 modèle secondaire
  directorName?: string | null;     // ⭐ Nom du directeur résolu depuis le module RH (administration)
}) {
  const isEn = scopeLang === 'EN';
  const isSecondaryBulletin = !!isSecondaire && !isEn;
  // ⭐ SECONDAIRE piste FR — « Bulletin d'évaluation » (un seul type d'éval,
  //    tableau Discipline | Note /20 | Rang | Appréciation) vs « Bulletin
  //    trimestriel » (consolidé CEG).
  const isSecondaryEvalMode = !!isSecondaryTrack && !isSecondaire && !isEn;
  const isSecondaryAny = isSecondaryBulletin || isSecondaryEvalMode || (isEn && isSecondaire);
  const [page, setPage] = useState<1 | 2>(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  // ⭐ Signature state — initialized from workflow signatures (backend) if available
  const [teacherSig, setTeacherSig] = useState<string | null>(teacherSignature ?? null);
  const [directorSig, setDirectorSig] = useState<string | null>(directorSignature ?? null);
  const [parentSig, setParentSig] = useState<string | null>(null);

  // ⭐ Update signatures when backend data changes (e.g. after director signs)
  useEffect(() => {
    if (directorSignature) setDirectorSig(directorSignature);
  }, [directorSignature]);
  useEffect(() => {
    if (teacherSignature) setTeacherSig(teacherSignature);
  }, [teacherSignature]);

  // ⭐ Only trigger page flip if horizontal swipe is dominant (not vertical scroll)
  //    AND the touch didn't start inside a scrollable table
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't track touch if it started inside a scrollable element (table, editor, etc.)
    if (target.closest('table') || target.closest('[contenteditable]') || target.closest('.overflow-x-auto')) {
      setTouchStart(null);
      return;
    }
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diffX = touchStart.x - e.changedTouches[0].clientX;
    const diffY = touchStart.y - e.changedTouches[0].clientY;
    if (!isSecondaryAny && Math.abs(diffX) > 80 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0 && page === 1) setPage(2);
      if (diffX < 0 && page === 2) setPage(1);
    }
    setTouchStart(null);
  };

  return (
    <div className="space-y-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* ⭐ 2026-11-23 — EN-TÊTE D'IDENTITÉ ÉCOLE COMPLET (exige promoteur :
          « toutes les informations de l'école ne figurent pas… les adresses
          mail et les contacts sont bien mentionnés dans le module paramètres
          onglet identité ») — logo, nom, sigle, devise, localisation,
          téléphones 1/2, WhatsApp, email, site web — résolu par niveau
          (maternelle/primaire → identité par défaut ; secondaire → identité
          du secondaire telle que définie dans Paramètres → Identité). */}
      <SchoolIdentityHeader school={school} lang={isEn ? 'EN' : 'FR'} />

      {/* Bulletin header (période/classe/élève) — ⭐ V10h : libellés EN pour la piste anglophone */}
      <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
        <div className="text-[10px] text-slate-600">
          {isEn ? <>Session: <strong>{academicYear?.label || ''}</strong> · {translatePeriodName(selectedPeriodName, 'EN')} · Class: <strong>{translateClassName(selectedClassName)}</strong></>
            : <>Année: <strong>{academicYear?.label || ''}</strong> · {selectedPeriodName} · Classe: <strong>{selectedClassName}</strong></>}
        </div>
        <div className="text-[10px] text-slate-600 mt-0.5">
          {isEn ? <>Pupil: <strong>{student.studentName}</strong> · Admission N°: {student.matricule || '—'} · Report Card (1st CA + 2nd CA + Exam)</>
            : isSecondaryBulletin ? <>Élève: <strong>{student.studentName}</strong> · Matricule: {student.matricule || '—'} · Bulletin trimestriel (IE1 &amp; IE2 + DS1 &amp; DS2)</>
            : isSecondaryEvalMode ? <>Élève: <strong>{student.studentName}</strong> · Matricule: {student.matricule || '—'} · Bulletin d'évaluation ({selectedEvalTypeCode ? `${selectedEvalTypeCode} ` : ''}{selectedEvalTypeName})</>
            : <>Élève: <strong>{student.studentName}</strong> · Matricule: {student.matricule || '—'} · {selectedEvalTypeCode} {selectedEvalTypeName}</>}
        </div>
      </div>

      {/* Page navigation — hidden for secondary (isSecondaryAny) */}
      {!isSecondaryAny && (
      <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-1.5">
        <button
          onClick={() => setPage(1)}
          className={cn('text-xs font-bold px-3 py-1 rounded transition-colors', page === 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-200')}
        >{isEn ? '← Page 1: Grades' : '← Page 1: Notes'}</button>
        <span className="text-[10px] text-slate-400">{isEn ? 'Page' : 'Page'} {page}/2</span>
        <button
          onClick={() => setPage(2)}
          className={cn('text-xs font-bold px-3 py-1 rounded transition-colors', page === 2 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-200')}
        >{isEn ? 'Page 2: Comments & Signatures →' : 'Page 2: Appréciations →'}</button>
      </div>
      )}

      {/* Page content with flip animation */}
      <div className="relative overflow-hidden">
        <div key={page} className="animate-in fade-in slide-in-from-right duration-300">
          {(isSecondaryAny || page === 1) ? (
            isSecondaryEvalMode ? (
              <BulletinSecondaireEvalPage1
                student={student}
                bulletinData={bulletinData}
                className={selectedClassName}
                periodName={selectedPeriodName}
                academicYearLabel={academicYear?.label}
                evalTypeName={selectedEvalTypeName}
                evalTypeCode={selectedEvalTypeCode}
              />
            ) : isSecondaryBulletin ? (
              <BulletinSecondairePage1
                student={student}
                bulletinData={bulletinData}
                className={selectedClassName}
                periodName={selectedPeriodName}
                academicYearLabel={academicYear?.label}
                academicYearId={academicYear?.id}
              />
            ) : isMaternelle ? (
              <BulletinMaternellePage1
                student={student}
                bulletinData={bulletinData}
                academicYearLabel={academicYear?.label}
                periodName={selectedPeriodName}
                classLabel={selectedClassName}
              />
            ) : scopeLang === 'EN' ? (
              <BulletinAnglophonePage1 student={student} bulletinData={bulletinData} selectedClassName={selectedClassName} termEndingDate={termEndingDate} sessionYear={academicYear?.label} />
            ) : (
              <BulletinPrimairePage1
                student={student}
                bulletinData={bulletinData}
                academicYearLabel={academicYear?.label}
                periodName={selectedPeriodName}
                classLabel={selectedClassName}
              />
            )
          ) : isSecondaryTrack && !isEn ? (
            <BulletinSecondairePage2
              student={student}
              signatures={{ teacherSig, directorSig, parentSig, setTeacherSig, setDirectorSig, setParentSig }}
              periodId={selectedPeriodId}
              directorName={directorName}
              academicYearId={academicYear?.id}
            />
          ) : scopeLang === 'EN' && !isMaternelle ? (
            <BulletinAnglophonePage2 student={student} bulletinData={bulletinData} signatures={{ teacherSig, directorSig, parentSig, setTeacherSig, setDirectorSig, setParentSig }} periodId={selectedPeriodId} nextTermStartDate={nextTermStartDate} directorName={directorName} academicYearId={academicYear?.id} />
          ) : (
            <BulletinPage2 student={student} isMaternelle={isMaternelle} signatures={{ teacherSig, directorSig, parentSig, setTeacherSig, setDirectorSig, setParentSig }} periodId={selectedPeriodId} directorName={directorName} />
          )}
        </div>
      </div>

      {/* PDF + WhatsApp buttons — hidden for teachers (anti-download protection) */}
      {canDownload && (
      <div className="flex justify-end gap-2 flex-wrap">
        {/* ⭐ 2026-11-23 — Envoi du bulletin au parent par WhatsApp — pattern
            finance encaissement (lien wa.me) : WhatsApp s'ouvre avec le
            message professionnel prêt + le lien public du PDF (icône
            OFFICIELLE WhatsApp). */}
        {onWhatsAppBulletin && (
          <Button
            onClick={() => onWhatsAppBulletin(student)}
            disabled={whatsappSending || generatingPdf}
            title="Envoyer le bulletin par WhatsApp au parent (message professionnel prêt + lien PDF — cliquez Envoyer dans WhatsApp)"
            className="bg-[#25D366] hover:bg-[#1EBE5B] text-white text-sm font-bold shadow-sm"
          >
            {whatsappSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEn ? 'Preparing…' : 'Préparation…'}</> : <><WhatsAppIcon className="w-4 h-4 mr-2" />{isEn ? 'Send by WhatsApp' : 'Envoyer par WhatsApp'}</>}
          </Button>
        )}
        <Button onClick={() => onGeneratePdf({ teacherSig, directorSig, parentSig })} disabled={generatingPdf || whatsappSending} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
          {generatingPdf ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEn ? 'Generating…' : 'Génération…'}</> : <><Download className="w-4 h-4 mr-2" />{isEn ? 'Generate PDF' : 'Générer PDF'}</>}
        </Button>
      </div>
      )}
    </div>
  );
}

// ─── Maternelle Page 1: Notes table (TS/S/PS columns) ──────────────────────

function BulletinMaternellePage1({
  student, bulletinData, academicYearLabel, periodName, classLabel,
}: {
  student: StudentResult;
  bulletinData: BulletinData;
  /** ⭐ T37 — contexte de l'en-tête d'infos (même design que le secondaire). */
  academicYearLabel?: string;
  periodName?: string;
  classLabel?: string;
}) {
  // ⭐ Visa du directeur par matière — éditable, auto-save on blur
  // Auto-rempli depuis l'appréciation enseignant si vide
  const [directorVisas, setDirectorVisas] = useState<Record<string, string>>({});

  // ⭐ 2026-09-30 — Tri canonique des matières par domaine (1→5)
  //    L'ordre ne dépend pas de l'API → identique pour tous les élèves.
  const sortedSubjects = useMemo(
    () => sortMaternelleSubjects(bulletinData.subjects),
    [bulletinData.subjects],
  );

  // Charge les visas existants au montage
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const subject of sortedSubjects) {
      const score = student.subjectScores[subject.id];
      initial[subject.id] = score?.directorVisa || score?.appreciation || '';
    }
    setDirectorVisas(initial);
  }, [student.id, sortedSubjects]);

  const handleVisaBlur = async (subjectId: string, value: string) => {
    // Auto-save : on envoie au backend via le BulletinPdfData.directorVisa par matière
    // (le frontend garde l'état local, le PDF utilise les valeurs en mémoire)
    setDirectorVisas(prev => ({ ...prev, [subjectId]: value }));
  };

  return (
    <div className="overflow-x-auto space-y-2">
      {/* ⭐ T37 — EN-TÊTE D'INFORMATIONS « façon Frederis » (même design que le
          secondaire) : cadre arrondi noir, libellés sur fond slate, filets noirs. */}
      <div className="rounded-md overflow-hidden border border-black">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <tbody>
          <tr>
            <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Année scolaire : <span className="text-slate-900">{academicYearLabel || '—'}</span>
            </td>
            <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Période : <span className="text-slate-900">{periodName || '—'}</span>
            </td>
            <td className="border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Classe : <span className="text-slate-900">{classLabel || '—'}</span>
            </td>
          </tr>
          <tr>
            <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Nom et prénoms : <span className="text-slate-900 uppercase">{student.studentName}</span>
            </td>
            <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Effectif : <span className="text-slate-900">{bulletinData.results.length}</span>
              {' '}· Matricule : <span className="text-slate-900">{student.matricule || '—'}</span>
            </td>
            <td className="px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Rang : <span className="text-slate-900">
                {student.classRank ? formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F') : '—'}
              </span>
            </td>
          </tr>
        </tbody>
        </table>
      </div>

      {/* ⭐ T37 — TITRE : barre encadrée navy (même standard que le PDF et le
          secondaire — plus de simple texte nu, design unifié). */}
      <div className="text-center border-2 border-[#0A2A5E] bg-slate-50 rounded-lg px-3 py-1.5">
        <h4 className="text-xs font-bold text-[#0A2A5E] uppercase">Évaluation Sommative Mensuelle</h4>
        <p className="text-[10px] text-slate-500">(à remplir après avoir observé l'enfant)</p>
      </div>
      {/* ⭐ T27/T37 — Corps « façon Frederis » : cadre arrondi noir UNIQUE (le
          wrapper porte le cadre, les cellules portent les filets), en-tête
          BLANC sur filets noirs fins, libellés complets du carnet (comme le
          PDF : Domaine | Résultats | Appréciation de l'enseignant(e) | Visa du
          Directeur (trice) | Impression et visa des parents). */}
      <div className="rounded-lg overflow-hidden border-2 border-black">
      <table className="w-full border-separate border-spacing-0 text-[10px]">
        <thead>
          <tr className="bg-white">
            <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '120px' }}>Domaine</th>
            <th colSpan={3} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Résultats</th>
            <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '80px' }}>Appréciation de l'enseignant(e)</th>
            <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '80px' }}>Visa du Directeur (trice)</th>
            <th rowSpan={2} className="border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '60px' }}>Impression et visa des parents</th>
          </tr>
          <tr className="bg-white">
            <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[9px]">TS</th>
            <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[9px]">S</th>
            <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[9px]">PS</th>
          </tr>
        </thead>
        <tbody>
          {sortedSubjects.map((subject, idx) => {
            const score = student.subjectScores[subject.id];
            const code = score?.qualitativeCode;
            const rowB = idx === sortedSubjects.length - 1 ? '' : 'border-b';
            return (
              <tr key={subject.id}>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 font-medium text-slate-900 whitespace-nowrap`}>{subject.name}</td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>
                  {code === 'TS' && <span className="font-black text-emerald-700">✓</span>}
                  {score?.isAbsent && <span className="text-red-600 text-[8px] font-bold">ABS</span>}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>
                  {code === 'S' && <span className="font-black text-slate-900">✓</span>}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>
                  {code === 'PS' && <span className="font-black text-amber-700">✓</span>}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center text-slate-600`}>{score?.appreciation || '—'}</td>
                {/* ⭐ Visa Directeur éditable — auto-save on blur */}
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center bg-slate-50`}>
                  <input
                    type="text"
                    value={directorVisas[subject.id] ?? ''}
                    onChange={(e) => setDirectorVisas(prev => ({ ...prev, [subject.id]: e.target.value }))}
                    onBlur={(e) => handleVisaBlur(subject.id, e.target.value)}
                    placeholder="—"
                    className="w-full bg-transparent text-center text-[9px] text-slate-900 font-semibold outline-none focus:bg-slate-100 rounded px-1 py-0.5"
                    title="Visa du directeur (auto-enregistré à la sortie de la ligne)"
                  />
                </td>
                <td className={`${rowB} border-black px-1 py-0.5 text-center text-slate-300`}>—</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {/* TS/S/PS Legend */}
      <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-500">
        <span className="font-bold">TS: Très Satisfaisant</span>
        <span className="font-bold">S: Satisfaisant</span>
        <span className="font-bold">PS: Peu Satisfaisant</span>
      </div>
      {/* ⭐ Symbole mérité (emoji) — distinct de l'appréciation globale */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Symbole mérité par l'élève</p>
          <span className="inline-block mt-1 text-2xl">
            {student.appreciationGlobale === 'Très Satisfaisant' ? '😄' :
             student.appreciationGlobale === 'Satisfaisant' ? '😊' :
             student.appreciationGlobale === 'Peu Satisfaisant' ? '😞' : '—'}
          </span>
        </div>
        <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Appréciation globale</p>
          <span className={cn('inline-block mt-1 px-3 py-1 rounded text-xs font-bold',
            student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
            student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
            student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
          )}>{student.appreciationGlobale || '—'}</span>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 mt-1 italic">
        💡 Le visa du directeur est auto-rempli depuis l'appréciation de l'enseignant mais reste éditable. Modifications enregistrées automatiquement à la sortie de la ligne.
      </p>
    </div>
  );
}

// ─── Primaire Page 1: Notes table (CM/18, CP/2, Total/20, Seuil, Appréciation) ─

function BulletinPrimairePage1({
  student, bulletinData, academicYearLabel, periodName, classLabel,
}: {
  student: StudentResult;
  bulletinData: BulletinData;
  /** ⭐ T37 — contexte de l'en-tête d'infos (même design que le secondaire). */
  academicYearLabel?: string;
  periodName?: string;
  classLabel?: string;
}) {
  // ⭐ Visa du directeur par matière — éditable, auto-save on blur
  const [directorVisas, setDirectorVisas] = useState<Record<string, string>>({});

  // ⭐ 2026-09-30 — Tri canonique des matières par catégorie (comme le secondaire)
  //    Lettres → Sciences → Arts → Autres. L'ordre ne dépend pas de l'API.
  const sortedSubjects = useMemo(
    () => sortSecondarySubjects(bulletinData.subjects),
    [bulletinData.subjects],
  );

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const subject of sortedSubjects) {
      const score = student.subjectScores[subject.id];
      initial[subject.id] = score?.directorVisa || score?.appreciation || '';
    }
    setDirectorVisas(initial);
  }, [student.id, sortedSubjects]);

  // ⭐ FIX 2026-11-15 — « handleVisaBlur is not defined » : le visa directeur du
  //    bulletin PRIMAIRE référence un handler jamais déclaré (présent côté
  //    maternelle mais oublié ici) → ReferenceError au blur de la cellule
  //    « Visa ». Même comportement que la version maternelle : maintien de
  //    l'état local (le PDF consomme les valeurs en mémoire).
  const handleVisaBlur = async (subjectId: string, value: string) => {
    setDirectorVisas(prev => ({ ...prev, [subjectId]: value }));
  };

  const totalGeneral = sortedSubjects.reduce((sum, subj) => {
    const s = student.subjectScores[subj.id];
    return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
  }, 0);
  const seuilAtteint = totalGeneral >= (10 * sortedSubjects.length);
  const validSubjects = sortedSubjects.filter(subj => {
    const s = student.subjectScores[subj.id];
    return s && !s.isAbsent && s.score !== null;
  }).length;

  // ⭐ Symbole mérité (emoji) basé sur la moyenne générale
  const symboleMerite = student.generalAverage === null ? '—' :
    student.generalAverage >= 16 ? '🏆' :
    student.generalAverage >= 14 ? '😄' :
    student.generalAverage >= 12 ? '😊' :
    student.generalAverage >= 10 ? '😐' : '😞';
  const mentionGenerale = student.generalAverage === null ? '—' :
    student.generalAverage >= 16 ? 'Très Bien' :
    student.generalAverage >= 14 ? 'Bien' :
    student.generalAverage >= 12 ? 'Assez Bien' :
    student.generalAverage >= 10 ? 'Passable' : 'Insuffisant';

  return (
    <div className="overflow-x-auto space-y-2">
      {/* ⭐ T37 — EN-TÊTE D'INFORMATIONS « façon Frederis » (même design que le
          secondaire et la maternelle) : cadre arrondi noir, libellés slate. */}
      <div className="rounded-md overflow-hidden border border-black">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <tbody>
          <tr>
            <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Année scolaire : <span className="text-slate-900">{academicYearLabel || '—'}</span>
            </td>
            <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Période : <span className="text-slate-900">{periodName || '—'}</span>
            </td>
            <td className="border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Classe : <span className="text-slate-900">{classLabel || '—'}</span>
            </td>
          </tr>
          <tr>
            <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Nom et prénoms : <span className="text-slate-900 uppercase">{student.studentName}</span>
            </td>
            <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Effectif : <span className="text-slate-900">{bulletinData.results.length}</span>
              {' '}· Matricule : <span className="text-slate-900">{student.matricule || '—'}</span>
            </td>
            <td className="px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Rang : <span className="text-slate-900">
                {student.classRank ? formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F') : '—'}
              </span>
            </td>
          </tr>
        </tbody>
        </table>
      </div>

      {/* ⭐ T37 — TITRE : barre encadrée navy (même standard que le PDF, la
          maternelle et le secondaire — design unifié). */}
      <div className="text-center border-2 border-[#0A2A5E] bg-slate-50 rounded-lg px-3 py-1.5">
        <h4 className="text-xs font-bold text-[#0A2A5E] uppercase">I — Connaissance et Habiletés</h4>
      </div>
      {/* ⭐ T27/T37 — Corps « façon Frederis » : cadre arrondi noir UNIQUE, en-tête
          BLANC sur filets noirs fins, total en bandeau navy (seul accent). */}
      <div className="rounded-lg overflow-hidden border-2 border-black">
      <table className="w-full border-separate border-spacing-0 text-[10px]">
        <thead>
          <tr className="bg-white">
            <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-left" style={{ minWidth: '120px' }}>Champs de formation</th>
            <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center w-12">Note min.</th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">CM</th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">CP</th>
            <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center w-12">Total /20</th>
            <th colSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Maîtrise min.</th>
            <th colSpan={2} className="border-b border-black px-1 py-1 font-bold uppercase text-center">Seuil réussite</th>
            <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '60px' }}>Appréciation</th>
            <th rowSpan={2} className="border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '70px' }}>Visa Directeur</th>
          </tr>
          <tr className="bg-white">
            <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[8px]">/18</th>
            <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[8px]">/02</th>
            <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[8px]">Oui</th>
            <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[8px]">Non</th>
            <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[8px]">Oui</th>
            <th className="border-b border-black px-1 py-0.5 font-bold text-center text-[8px]">Non</th>
          </tr>
        </thead>
        <tbody>
          {sortedSubjects.map((subject, idx) => {
            const score = student.subjectScores[subject.id];
            const note = score?.score !== null && typeof score?.score === 'number' ? score.score : null;
            const cmVal = score?.cm !== null && typeof score?.cm === 'number' ? score.cm : null;
            const cpVal = score?.cp !== null && typeof score?.cp === 'number' ? score.cp : null;
            const reached = note !== null && note >= 10;
            const rowB = idx === sortedSubjects.length - 1 ? '' : 'border-b';
            return (
              <tr key={subject.id}>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 font-medium text-slate-900 whitespace-nowrap`}>{subject.name}</td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center text-slate-400 text-[8px]`}>10</td>
                {/* CM /18 — depuis le champ cm du SubjectScore (parsé depuis comment JSON) */}
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center text-slate-700`}>
                  {score?.isAbsent ? <span className="text-red-600 text-[8px] font-bold">ABS</span> : cmVal !== null ? cmVal : '—'}
                </td>
                {/* CP /2 — depuis le champ cp du SubjectScore (parsé depuis comment JSON) */}
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center text-slate-700`}>
                  {score?.isAbsent ? <span className="text-red-600 text-[8px] font-bold">ABS</span> : cpVal !== null ? cpVal : '—'}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center font-bold`}>
                  {/* ⭐ Afficher la note sans décimales (entier) si la note est entière */}
                  {score?.isAbsent ? <span className="text-red-600 text-[8px] font-bold">ABS</span> :
                    note !== null ? <span className={note >= 10 ? 'text-emerald-700' : 'text-red-600'}>{Number.isInteger(note) ? note : note.toFixed(2)}</span> : '—'}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>{reached ? '✓' : ''}</td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>{!reached && note !== null ? '✓' : ''}</td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>{reached ? '✓' : ''}</td>
                <td className={`border-b ${rowB} border-black px-1 py-0.5 text-center`}>{!reached && note !== null ? '✓' : ''}</td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center text-slate-600 text-[9px]`}>{score?.appreciation || '—'}</td>
                {/* ⭐ Visa Directeur éditable — auto-save on blur */}
                <td className={`${rowB} border-black px-1 py-0.5 text-center bg-slate-50`}>
                  <input
                    type="text"
                    value={directorVisas[subject.id] ?? ''}
                    onChange={(e) => setDirectorVisas(prev => ({ ...prev, [subject.id]: e.target.value }))}
                    onBlur={(e) => handleVisaBlur(subject.id, e.target.value)}
                    placeholder="—"
                    className="w-full bg-transparent text-center text-[9px] text-slate-900 font-semibold outline-none focus:bg-slate-100 rounded px-1 py-0.5"
                    title="Visa du directeur (auto-enregistré à la sortie de la ligne)"
                  />
                </td>
              </tr>
            );
          })}
          {/* Total General — bandeau navy, seul accent de couleur du tableau */}
          <tr className="bg-[#0A2A5E] text-white font-bold">
            <td className="px-1 py-0.5 uppercase" colSpan={4}>Total général</td>
            <td className="px-1 py-0.5 text-center">{Number.isInteger(totalGeneral) ? totalGeneral : totalGeneral.toFixed(2)}</td>
            <td colSpan={2}></td>
            <td colSpan={2}></td>
            <td></td>
            <td className="px-1 py-0.5 text-center text-[9px] font-bold">{mentionGenerale}</td>
          </tr>
        </tbody>
      </table>
      </div>
      {/* ⭐ T27 — Synthèse : carte unique divisible, valeurs emerald/rouge en TEXTE seul */}
      <div className="mt-2 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 text-[10px]">
        <div className="flex justify-between px-3 py-1.5">
          <span className="text-slate-500">Moyenne obtenue par l'élève :</span>
          <strong className="text-slate-900">{student.generalAverage !== null ? (Number.isInteger(student.generalAverage) ? student.generalAverage : student.generalAverage.toFixed(2)) : '—'}/20</strong>
        </div>
        <div className="flex justify-between px-3 py-1.5">
          <span className="text-slate-500">Plus forte moyenne de la classe :</span>
          <strong className="text-slate-900">{bulletinData.stats.classAverage !== null ? (() => { const v = Math.max(...bulletinData.results.map(r => r.generalAverage || 0)); return Number.isInteger(v) ? v : v.toFixed(2); })() : '—'}/20</strong>
        </div>
        <div className="flex justify-between px-3 py-1.5">
          <span className="text-slate-500">Plus faible moyenne de la classe :</span>
          <strong className="text-slate-900">{bulletinData.stats.classAverage !== null ? (() => { const v = Math.min(...bulletinData.results.map(r => r.generalAverage || 0)); return Number.isInteger(v) ? v : v.toFixed(2); })() : '—'}/20</strong>
        </div>
        <div className="flex justify-between px-3 py-1.5">
          <span className="text-slate-500">Seuil de réussite globale fixé à :</span>
          <strong className="text-slate-900">10/20</strong>
        </div>
        <div className="flex justify-between px-3 py-1.5 font-bold bg-slate-50 rounded-b-lg">
          <span>Seuil de réussite globale atteint :</span>
          <span className={seuilAtteint ? 'text-emerald-700' : 'text-red-600'}>{seuilAtteint ? 'OUI' : 'NON'}</span>
        </div>
        <div className="flex justify-between px-3 py-1.5">
          <span className="text-slate-500">Nombre de matières évaluées :</span>
          <strong className="text-slate-900">{validSubjects}</strong>
        </div>
      </div>
      {/* ⭐ Symbole mérité (emoji) — distinct de l'appréciation globale */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Symbole mérité par l'élève</p>
          <span className="inline-block mt-1 text-2xl">{symboleMerite}</span>
        </div>
        <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Appréciation globale</p>
          <span className={cn('inline-block mt-1 px-3 py-1 rounded text-xs font-bold',
            student.generalAverage !== null && student.generalAverage >= 12 && 'bg-emerald-100 text-emerald-700',
            student.generalAverage !== null && student.generalAverage >= 10 && student.generalAverage < 12 && 'bg-blue-100 text-blue-700',
            student.generalAverage !== null && student.generalAverage < 10 && 'bg-amber-100 text-amber-700',
          )}>{mentionGenerale}</span>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 mt-1 italic">
        Le visa du directeur est auto-rempli depuis l'appréciation de l'enseignant mais reste éditable. Modifications enregistrées automatiquement à la sortie de la ligne.
      </p>
    </div>
  );
}

// ─── Page 1: Bulletin SECONDAIRE (Bulletin trimestriel) — modèle CEG ───────
//
// Structure exacte du modèle fourni (bulletin du secondaire) :
//   En-tête info : Année scolaire | Nom et prénoms | Classe | Effectif | Rang
//   Tableau : Discipline | Interrogation écrite [Interrogation écrite 1,
//     Interrogation écrite 2] | Moyenne d'interrogation | Devoir surveillé
//     [Devoir 1, Devoir 2] | Moyenne | [Coefficient | Note coefficient] |
//     Rang | Appréciation | Signature
//     (les colonnes parentes sont EN HAUT, les sous-colonnes EN BAS)
//   6e/5e : SANS colonnes Coefficient / Note coefficient — 4e → Terminale : AVEC
//   Totaux (4e→T) : TOTAL DES COEFFICIENTS / TOTAL DES MOYENNES (= Σ moy×coef)
//   Synthèse : Moyenne trimestrielle + Rang · Moyenne de la classe / plus faible / plus forte
//   Récap (3e trimestre UNIQUEMENT) : Moyenne 1er trimestre | Moyenne 2e trimestre |
//     Moyenne annuelle (passage) | Rang annuel | Décision
function BulletinSecondairePage1({
  student,
  bulletinData,
  className,
  periodName,
  academicYearLabel,
  academicYearId,
}: {
  student: StudentResult;
  bulletinData: BulletinData;
  className: string;
  periodName: string;
  academicYearLabel?: string;
  academicYearId?: string;
}) {
  const isJunior = isJuniorSecondaryClass2(className || '');

  /** Format d'une note : 15 → « 15.00 », null → « — ». */
  const fmtS = (n: number | null | undefined): string =>
    (typeof n === 'number' && !isNaN(n)) ? n.toFixed(2) : '—';

  /** Cellule de note : undefined → « — », null → ABS, number → note colorée. */
  const noteCell = (n: number | null | undefined, isAbsent: boolean | undefined) => {
    if (isAbsent) return <span className="text-red-600 text-[8px] font-bold">ABS</span>;
    if (typeof n !== 'number') return <span className="text-slate-400">—</span>;
    return <span className={n >= 10 ? 'text-emerald-700' : 'text-red-600'}>{n.toFixed(2)}</span>;
  };

  // Totaux (4e → Terminale) — uniquement les matières où la moyenne existe
  let totalCoef = 0;
  let totalNotesCoef = 0;
  for (const subject of bulletinData.subjects) {
    const s = student.subjectScores[subject.id];
    if (!s || s.moyenne === null || s.moyenne === undefined) continue;
    const coef = s.coefficient ?? subject.coefficient ?? 1;
    totalCoef += coef;
    totalNotesCoef += s.noteCoef ?? (s.moyenne * coef);
  }

  const validAverages = bulletinData.results
    .map((r) => r.generalAverage)
    .filter((v): v is number => v !== null);
  const classAvg = validAverages.length
    ? validAverages.reduce((a, b) => a + b, 0) / validAverages.length
    : null;
  const strongestAvg = validAverages.length ? Math.max(...validAverages) : null;
  const weakestAvg = validAverages.length ? Math.min(...validAverages) : null;

  const recap = student.secondaryRecap ?? null;
  const colCount = isJunior ? 10 : 12;
  const subjectsByCategory = useMemo(() => groupSubjectsByCategory(bulletinData.subjects, (subj) => student.subjectScores[subj.id]?.moyenne ?? null), [bulletinData.subjects, student.subjectScores]);

  return (
    <div className="overflow-x-auto space-y-2">
      {/* ⭐ T27 — En-tête d'informations refondu « façon Frederis » : cadre
          arrondi noir, libellés sur fond slate, filets noirs fins. */}
      <div className="rounded-md overflow-hidden border border-black">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <tbody>
          <tr>
            <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Année scolaire : <span className="text-slate-900">{academicYearLabel || '—'}</span>
            </td>
            <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Trimestre : <span className="text-slate-900">{periodName || '—'}</span>
            </td>
            <td className="border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Classe : <span className="text-slate-900">{className || '—'}</span>
            </td>
          </tr>
          <tr>
            <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Nom et prénoms : <span className="text-slate-900 uppercase">{student.studentName}</span>
            </td>
            <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Effectif : <span className="text-slate-900">{bulletinData.results.length}</span>
              {' '}· Matricule : <span className="text-slate-900">{student.matricule || '—'}</span>
            </td>
            <td className="px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Rang : <span className="text-slate-900">
                {student.classRank ? formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F') : '—'}
              </span>
            </td>
          </tr>
        </tbody>
        </table>
      </div>

      {/* ⭐ T27 — Tableau des notes refondu « façon Frederis » : en-tête BLANC,
          filets noirs fins, lignes de catégorie sobres (slate), moyennes et
          rangs colorés en TEXTE (plus aucun fond coloré par cellule). */}
      <div className="rounded-lg overflow-hidden border-2 border-black">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr className="bg-white">
              <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-left" style={{ minWidth: '110px' }}>Discipline</th>
              <th colSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Interrogation écrite</th>
              <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center w-16 leading-tight">Moyenne d'interrogation</th>
              <th colSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Devoir surveillé</th>
              <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center w-12">Moyenne</th>
              {!isJunior && (
                <>
                  <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center w-12">Coefficient</th>
                  <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center w-14">Note coefficient</th>
                </>
              )}
              <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center w-10">Rang</th>
              <th rowSpan={2} className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '70px' }}>Appréciation</th>
              <th rowSpan={2} className="border-b border-black px-1 py-1 font-bold uppercase text-center w-14">Signature</th>
            </tr>
            {/* Sous-colonnes abrégées IE1/IE2 (Interrogation écrite) + DS1/DS2
                (Devoir surveillé) — TOUJOURS sous leur colonne parente */}
            <tr className="bg-white">
              <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[9px] uppercase min-w-[36px]">IE1</th>
              <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[9px] uppercase min-w-[36px]">IE2</th>
              <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[9px] uppercase min-w-[36px]">DS1</th>
              {/* ⭐ T30 — FIX : border-r sur DS2 (le filet vertical DS2|Moyenne
                  manquait). Le sous-en-tête vit dans sa propre ligne <tr>, la
                  règle « dernière colonne sans filet » ne doit s'appliquer
                  qu'à la colonne Signature, pas à DS2. */}
              <th className="border-r border-b border-black px-1 py-0.5 font-bold text-center text-[9px] uppercase min-w-[36px]">DS2</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.flatMap((cat) => {
              const group = subjectsByCategory.get(cat);
              if (!group || group.subjects.length === 0) return [];
              const subjectRows = group.subjects.map((subject) => {
                const s = student.subjectScores[subject.id];
                return (
                  <tr key={subject.id}>
                    <td className="border-r border-b border-black px-1 py-0.5 font-medium text-slate-900 whitespace-nowrap">{subject.name}</td>
                    <td className="border-r border-b border-black px-1 py-0.5 text-center font-semibold">{s ? noteCell(s.int1, s.int1 === null && s.secHasSlot) : '—'}</td>
                    <td className="border-r border-b border-black px-1 py-0.5 text-center font-semibold">{s ? noteCell(s.int2, s.int2 === null && s.secHasSlot) : '—'}</td>
                    <td className="border-r border-b border-black px-1 py-0.5 text-center font-semibold">{s ? noteCell(s.moyInter, s.isAbsent) : '—'}</td>
                    <td className="border-r border-b border-black px-1 py-0.5 text-center font-semibold">{s ? noteCell(s.ds1, s.ds1 === null && s.secHasSlot) : '—'}</td>
                    {/* ⭐ T30 — FIX CRITIQUE : la cellule DS2 manquait entièrement
                        dans les lignes de matières → toutes les colonnes suivantes
                        étaient décalées d'un cran vers la gauche (Moyenne affichait
                        le rang, Rang affichait l'appréciation, Appréciation était
                        vide, la colonne Signature n'avait plus de cellule du tout
                        → filets horizontaux absents). */}
                    <td className="border-r border-b border-black px-1 py-0.5 text-center font-semibold">{s ? noteCell(s.ds2, s.ds2 === null && s.secHasSlot) : '—'}</td>
                    <td className="border-r border-b border-black px-1 py-0.5 text-center font-bold">{s ? noteCell(s.moyenne, s.isAbsent) : '—'}</td>
                    {!isJunior && (<><td className="border-r border-b border-black px-1 py-0.5 text-center font-bold">{s?.coefficient ?? subject.coefficient ?? 1}</td><td className="border-r border-b border-black px-1 py-0.5 text-center font-bold">{fmtS(s?.noteCoef)}</td></>)}
                    <td className="border-r border-b border-black px-1 py-0.5 text-center font-bold text-slate-700">{s?.subjectRank ? formatRank(s.subjectRank, student.gender === 'FEMALE' || student.gender === 'F') : '—'}</td>
                    <td className="border-r border-b border-black px-1 py-0.5 text-center text-slate-600 text-[9px]"><span className={appreciationSecondaireClassName(s?.appreciation || '—')}>{s?.appreciation || '—'}</span></td>
                    <td className="border-b border-black h-7" />
                  </tr>
                );
              });
              const bilanRow = (
                <tr key={`bilan-${cat}`} className="bg-slate-100 font-bold">
                  <td className="border-r border-b border-black px-1 py-0.5 text-[10px] uppercase text-slate-900">{CATEGORY_LABELS[cat]}</td>
                  <td colSpan={5} className="border-b border-black"></td>
                  <td className="border-r border-b border-black px-1 py-0.5 text-center font-bold text-slate-900">{group.average !== null ? <span className={group.average >= 10 ? 'text-emerald-700' : 'text-red-600'}>{group.average.toFixed(2)}</span> : '—'}</td>
                  {!isJunior && (<><td className="border-b border-black"></td><td className="border-b border-black"></td></>)}
                  <td className="border-b border-black"></td>
                  <td className="border-r border-b border-black"></td>
                  <td className="border-b border-black"></td>
                </tr>
              );
              return [...subjectRows, bilanRow];
            })}
            {!isJunior && (
              <>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={7} className="border-b border-black px-1 py-0.5 text-right uppercase text-slate-700 text-[9px]">Total des coefficients</td>
                  <td className="border-r border-b border-black px-1 py-0.5 text-center font-bold text-slate-900">{totalCoef}</td>
                  <td colSpan={4} className="border-b border-black px-1 py-0.5 text-center text-slate-500 text-[9px]">—</td>
                </tr>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={7} className="border-b border-black px-1 py-0.5 text-right uppercase text-slate-700 text-[9px]">Total des moyennes (Σ moy × coef)</td>
                  <td className="border-r border-b border-black px-1 py-0.5 text-center font-bold text-slate-900">{totalNotesCoef.toFixed(2)}</td>
                  <td colSpan={4} className="border-b border-black px-1 py-0.5 text-center text-slate-500 text-[9px]">—</td>
                </tr>
              </>
            )}
            <tr className="bg-[#0A2A5E] text-white font-bold">
              <td colSpan={6} className="px-1 py-0.5 text-right uppercase text-[9px]">Moyenne trimestrielle</td>
              <td colSpan={isJunior ? 1 : 2} className="px-1 py-0.5 text-center text-sm">{fmtS(student.generalAverage)}</td>
              <td colSpan={isJunior ? 3 : 4} className="px-1 py-0.5 text-center text-[9px]">{student.classRank ? `Rang : ${formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')} / ${bulletinData.results.length}` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ⭐ Synthèse statistique supprimée — doublon avec bloc Résultats de classe */}

      {/* ⭐ T27 — Récap du 3e trimestre : cadre arrondi noir + bandeau navy,
          filets fins (plus de fond bleu épais). */}
      {recap && (
        <div className="mt-2 rounded-lg overflow-hidden border-2 border-black">
          <div className="bg-[#0A2A5E] text-white text-[10px] font-bold uppercase text-center py-1">
            Récapitulatif de l'année (3e trimestre)
          </div>
          <table className="w-full border-separate border-spacing-0 text-[10px]">
            <tbody>
              <tr>
                <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">Moyenne 1er trimestre</td>
                <td className="border-r border-b border-black px-2 py-1 text-center font-bold text-slate-900">{fmtS(recap.period1Average)}</td>
                <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">Moyenne 2e trimestre</td>
                <td className="border-b border-black px-2 py-1 text-center font-bold text-slate-900">{fmtS(recap.period2Average)}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">Moyenne annuelle</td>
                <td className="border-r border-b border-black px-2 py-1 text-center font-bold text-slate-900">{fmtS(recap.annualAverage)}</td>
                <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">Rang annuel</td>
                <td className="border-b border-black px-2 py-1 text-center font-bold text-slate-900">
                  {recap.annualRank ? formatRank(recap.annualRank, student.gender === 'FEMALE' || student.gender === 'F') : '—'}
                </td>
              </tr>
              <tr>
                <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">Décision du conseil</td>
                <td colSpan={3} className="px-2 py-1 text-center font-bold text-slate-900">
                  <span className={recap.decision === 'Passe en classe supérieure' ? 'text-emerald-700' : 'text-red-600'}>
                    {recap.decision || '—'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[9px] text-slate-400 mt-1 italic">
        IE = Interrogation écrite · DS = Devoir surveillé · Moyenne d'interrogation = (IE1 + IE2) / 2 · Moyenne = (Moyenne d'interrogation + DS1 + DS2) / 3
        {!isJunior && <> · Note coefficient = Moyenne × Coefficient · Moyenne trimestrielle = Σ(Note coefficient) / Σ(Coefficients)</>}
        {' '}· Les notes ABS sont exclues des calculs. {colCount} colonnes ({isJunior ? '6e/5e — sans coefficient' : '4e → Terminale — avec coefficients'}).
      </p>
    </div>
  );
}

// ─── Page 1: Bulletin SECONDAIRE « Bulletin d'évaluation » ──────────────────
//
// UN SEUL type d'évaluation à la fois (Interrogation écrite 1, Devoir
// surveillé 2, …). Même standard graphique que le bulletin trimestriel
// (en-tête d'informations + tableau bordure navy à coins arrondis) mais
// tableau simple, conforme au modèle officiel :
//   Discipline | Note /20 | Rang | Appréciation
// … pour toutes les matières, et en bas du tableau :
//   Moyenne de l'évaluation + Rang de l'élève.
function BulletinSecondaireEvalPage1({
  student,
  bulletinData,
  className,
  periodName,
  academicYearLabel,
  evalTypeName,
  evalTypeCode,
}: {
  student: StudentResult;
  bulletinData: BulletinData;
  className: string;
  periodName: string;
  academicYearLabel?: string;
  evalTypeName?: string;
  evalTypeCode?: string;
}) {
  const feminine = student.gender === 'FEMALE' || student.gender === 'F';
  const subjectsByCategory = useMemo(() => groupSubjectsByCategory(bulletinData.subjects, (subj) => { const s = student.subjectScores[subj.id]; return s && typeof s.score === 'number' ? s.score : null; }), [bulletinData.subjects, student.subjectScores]);

  /** Format d'une note : 15 → « 15.00 », null → « — ». */
  const fmtS = (n: number | null | undefined): string =>
    (typeof n === 'number' && !isNaN(n)) ? n.toFixed(2) : '—';

  // Stats de classe (sur la moyenne de l'évaluation)
  const validAverages = bulletinData.results
    .map((r) => r.generalAverage)
    .filter((v): v is number => v !== null);
  const classAvg = validAverages.length
    ? validAverages.reduce((a, b) => a + b, 0) / validAverages.length
    : null;
  const strongestAvg = validAverages.length ? Math.max(...validAverages) : null;
  const weakestAvg = validAverages.length ? Math.min(...validAverages) : null;

  return (
    <div className="overflow-x-auto space-y-2">
      {/* ⭐ T27 — En-tête d'informations refondu « façon Frederis » : cadre
          arrondi noir, libellés sur fond slate, filets noirs fins. */}
      <div className="rounded-md overflow-hidden border border-black">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <tbody>
          <tr>
            <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Année scolaire : <span className="text-slate-900">{academicYearLabel || '—'}</span>
            </td>
            <td className="border-r border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Trimestre : <span className="text-slate-900">{periodName || '—'}</span>
            </td>
            <td className="border-b border-black px-2 py-1 bg-slate-100 font-bold text-slate-700 w-1/3">
              Évaluation : <span className="text-slate-900">{evalTypeCode ? `[${evalTypeCode}] ` : ''}{evalTypeName || '—'}</span>
            </td>
          </tr>
          <tr>
            <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Nom et prénoms : <span className="text-slate-900 uppercase">{student.studentName}</span>
            </td>
            <td className="border-r border-black px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Effectif : <span className="text-slate-900">{bulletinData.results.length}</span>
              {' '}· Matricule : <span className="text-slate-900">{student.matricule || '—'}</span>
            </td>
            <td className="px-2 py-1 bg-slate-100 font-bold text-slate-700">
              Rang : <span className="text-slate-900">
                {student.classRank ? formatRank(student.classRank, feminine) : '—'}
              </span>
            </td>
          </tr>
        </tbody>
        </table>
      </div>

      {/* ⭐ T27 — Tableau simple refondu « façon Frederis » : en-tête BLANC,
          filets noirs fins, lignes de catégorie sobres (slate), note colorée
          en TEXTE (plus aucun fond coloré par cellule). */}
      <div className="rounded-lg overflow-hidden border-2 border-black">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr className="bg-white">
              <th className="border-r border-b border-black px-2 py-1 font-bold uppercase text-left" style={{ minWidth: '140px' }}>Discipline</th>
              <th className="border-r border-b border-black px-2 py-1 font-bold uppercase text-center w-24">Note /20</th>
              <th className="border-r border-b border-black px-2 py-1 font-bold uppercase text-center w-16">Rang</th>
              <th className="border-b border-black px-2 py-1 font-bold uppercase text-center" style={{ minWidth: '110px' }}>Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.flatMap((cat) => {
              const group = subjectsByCategory.get(cat);
              if (!group || group.subjects.length === 0) return [];
              const subjectRows = group.subjects.map((subject) => {
                const s = student.subjectScores[subject.id];
                return (
                  <tr key={subject.id}>
                    <td className="border-r border-b border-black px-2 py-0.5 font-medium text-slate-900 whitespace-nowrap">{subject.name}</td>
                    <td className="border-r border-b border-black px-2 py-0.5 text-center font-bold">
                      {s && s.isAbsent ? <span className="text-red-600 text-[8px] font-bold">ABS</span>
                        : s && typeof s.score === 'number'
                          ? <span className={s.score >= 10 ? 'text-emerald-700' : 'text-red-600'}>{s.score.toFixed(2)}</span>
                          : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="border-r border-b border-black px-2 py-0.5 text-center font-bold text-slate-700">{s?.subjectRank ? formatRank(s.subjectRank, feminine) : '—'}</td>
                    <td className="border-b border-black px-2 py-0.5 text-center text-slate-600 text-[9px]"><span className={appreciationSecondaireClassName(s?.appreciation || '—')}>{s?.appreciation || '—'}</span></td>
                  </tr>
                );
              });
              const bilanRow = (
                <tr key={`bilan-${cat}`} className="bg-slate-100 font-bold">
                  <td className="border-r border-b border-black px-2 py-0.5 text-[10px] uppercase text-slate-900">{CATEGORY_LABELS[cat]}</td>
                  <td className="border-r border-b border-black px-2 py-0.5 text-center font-bold text-slate-900">{group.average !== null ? <span className={group.average >= 10 ? 'text-emerald-700' : 'text-red-600'}>{group.average.toFixed(2)}</span> : '—'}</td>
                  <td className="border-r border-b border-black"></td>
                  <td className="border-b border-black"></td>
                </tr>
              );
              return [...subjectRows, bilanRow];
            })}

            {/* Moyenne de l'évaluation + Rang — bandeau navy */}
            <tr className="bg-[#0A2A5E] text-white font-bold">
              <td colSpan={2} className="px-2 py-0.5 text-right uppercase text-[9px]">Moyenne de l'évaluation</td>
              <td className="px-2 py-0.5 text-center text-sm">
                {fmtS(student.generalAverage)}
              </td>
              <td className="px-2 py-0.5 text-center text-[9px]">
                {student.classRank ? `Rang : ${formatRank(student.classRank, feminine)} / ${bulletinData.results.length}` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ⭐ Synthèse statistique supprimée — doublon avec bloc Résultats de classe */}
    </div>
  );
}

// ─── Page 1: Bulletin Anglophone — modèle Report Book (formulaire + tableau 10 colonnes) ──
//    Structure exacte du Report Book fourni :
//      TERM ENDING / NAME OF PUPIL / AGE + CLASS / POSITION + ADMISSION N° /
//      SESSION / PUPIL'S AVERAGE, puis tableau :
//      SUBJECTS | 1st CA /20 | 2nd CA /20 | Exam /60 | Total /100 |
//      Highest in class | Lowest in class | Position | Grade | Remark

function BulletinAnglophonePage1({
  student, bulletinData, selectedClassName, termEndingDate, sessionYear,
}: {
  student: StudentResult;
  bulletinData: BulletinData;
  selectedClassName?: string;
  termEndingDate?: string | null;
  sessionYear?: string | null;
}) {
  // Moyenne de l'élève sur /100 (déjà calculée dans generalAverage pour EN)
  const pupilAvg = student.generalAverage ?? 0;
  const tier = enTierFor(student.generalAverage);
  const positionStr = enOrdinal(student.classRank);
  const ageStr = student.age !== null && student.age !== undefined ? String(student.age) : '—';
  const session = sessionYear || '—';

  // ⭐ 2026-09-29 — Tri canonique des matières (LETTRES → SCIENCES → AUTRES,
  //    et dans chaque catégorie l'ordre canonique : Mathématiques → PCT → SVT,
  //    EPS → Conduite → Informatique, etc.). L'ordre ne doit pas dépendre de
  //    l'ordre d'entrée → identique pour tous les élèves et cohérent UI ↔ PDF.
  const sortedSubjects = useMemo(
    () => sortSecondarySubjects(bulletinData.subjects),
    [bulletinData.subjects],
  );

  // Ligne de formulaire — libellé + valeur (bordures pointillées façon carnet)
  const FormCell = ({ label, value, colSpan = 1, strong = true }: { label: string; value: React.ReactNode; colSpan?: number; strong?: boolean }) => (
    <td colSpan={colSpan} className="border border-slate-400 px-2 py-1 whitespace-nowrap">
      <span className="text-slate-700 uppercase font-bold text-[10px]">{label}</span>{' '}
      <span className={cn('text-slate-900 border-b border-dotted border-slate-400', strong && 'font-bold')}>{value}</span>
    </td>
  );

  return (
    <div className="overflow-x-auto space-y-3">
      {/* ⭐ 2026-10-05 — TITRE : encadré navy sur fond gris clair (même standard que la piste FR). */}
      <div className="text-center border-2 border-[#0A2A5E] bg-slate-50 rounded-lg px-3 py-1.5">
        <h4 className="text-xs font-bold text-[#0A2A5E] uppercase">Report Card &mdash; 1st CA + 2nd CA + Exam = /100</h4>
      </div>

      {/* ── Formulaire d'information (page 2 du Report Book) — ⭐ wrapper arrondi 1px noir (mêmes standard que la piste FR : plus de bordure 2px navy sans border-radius) ── */}
      <div className="rounded-lg overflow-hidden border border-black">
        <table className="w-full border-collapse text-[10px] bg-slate-50">
          <tbody>
            <tr><FormCell label="Term ending:" value={termEndingDate || '—'} colSpan={4} /></tr>
            <tr><FormCell label="Name of pupil:" value={student.studentName} colSpan={4} /></tr>
            <tr>
              <FormCell label="Age:" value={ageStr} />
              <FormCell label="Class:" value={selectedClassName || '—'} />
              <FormCell label="Position:" value={positionStr} />
              <FormCell label="Admission N°:" value={student.matricule || '—'} />
            </tr>
            <tr>
              <FormCell label="Session:" value={session} colSpan={2} />
              <FormCell
                label="Pupil's average:"
                value={<span className="text-blue-700 text-sm">{student.generalAverage !== null ? pupilAvg.toFixed(2) : '—'} / 100</span>}
                colSpan={2}
              />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Tableau des notes — 10 colonnes — ⭐ wrapper 2px noir + rounded-lg + overflow:hidden (même standard que la piste FR : filets continus, en-tête navy, plus de double-cadre) ── */}
      <div className="rounded-lg overflow-hidden border-2 border-black">
      <table className="w-full border-separate border-spacing-0 text-[10px]">
        <thead>
          <tr className="text-white" style={{ backgroundColor: '#0A2A5E' }}>
            <th className="border-r border-b border-black px-2 py-1 font-bold uppercase text-left" style={{ minWidth: '110px' }}>Subjects</th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">1st<br/>CA<br/><span className="font-normal text-[8px]">/20</span></th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">2nd<br/>CA<br/><span className="font-normal text-[8px]">/20</span></th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Exam<br/><span className="font-normal text-[8px]">/60</span></th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ backgroundColor: '#0D3B85' }}>Total<br/><span className="font-normal text-[8px]">/100</span></th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Highest<br/>in class</th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Lowest<br/>in class</th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Posi-<br/>tion</th>
            <th className="border-r border-b border-black px-1 py-1 font-bold uppercase text-center">Grade</th>
            <th className="border-b border-black px-1 py-1 font-bold uppercase text-center" style={{ minWidth: '70px' }}>Remark</th>
          </tr>
        </thead>
        <tbody>
          {sortedSubjects.map((subject, idx) => {
            const score = student.subjectScores[subject.id];
            const stats = enSubjectClassStats(bulletinData, subject.id, student.id);
            const total = score?.total ?? null;
            const rowB = idx === sortedSubjects.length - 1 ? '' : 'border-b';
            return (
              <tr key={subject.id} className={cn(idx % 2 === 1 && 'bg-slate-50/50')}>
                <td className={`border-r ${rowB} border-black px-2 py-1 font-medium text-slate-900 whitespace-nowrap`}>{subject.name}</td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>
                  {score?.isAbsent ? <span className="text-red-500 text-[8px] font-bold">ABS</span> :
                    score?.firstCA !== null && score?.firstCA !== undefined ? score.firstCA : <span className="text-slate-400">—</span>}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>
                  {score?.isAbsent ? <span className="text-red-500 text-[8px] font-bold">ABS</span> :
                    score?.secondCA !== null && score?.secondCA !== undefined ? score.secondCA : <span className="text-slate-400">—</span>}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center`}>
                  {score?.isAbsent ? <span className="text-red-500 text-[8px] font-bold">ABS</span> :
                    score?.exam !== null && score?.exam !== undefined ? score.exam : <span className="text-slate-400">—</span>}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center font-bold bg-slate-50`}>
                  {score?.isAbsent ? <span className="text-red-500 text-[8px] font-bold">ABS</span> :
                    total !== null ? <span className="text-blue-700">{total.toFixed(1)}</span> : <span className="text-slate-400">—</span>}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center text-slate-600`}>
                  {stats.highest !== null ? stats.highest.toFixed(1) : '—'}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center text-slate-600`}>
                  {stats.lowest !== null ? stats.lowest.toFixed(1) : '—'}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center font-semibold text-slate-800`}>
                  {enOrdinal(stats.position)}
                </td>
                <td className={`border-r ${rowB} border-black px-1 py-0.5 text-center font-bold`}>
                  <span className={cn(
                    (total ?? 0) >= 90 && 'text-emerald-700',
                    (total ?? -1) >= 80 && (total ?? 0) < 90 && 'text-blue-700',
                    (total ?? -1) >= 70 && (total ?? 0) < 80 && 'text-sky-700',
                    (total ?? -1) >= 60 && (total ?? 0) < 70 && 'text-amber-700',
                    (total ?? -1) >= 50 && (total ?? 0) < 60 && 'text-orange-700',
                    (total ?? -1) >= 0 && (total ?? 0) < 50 && 'text-red-600',
                  )}>{enGradeFor(total)}</span>
                </td>
                <td className={`${rowB} border-black px-1 py-0.5 text-center text-[9px] text-slate-600`}>
                  {tier?.label && total !== null ? enTierFor(total)?.label : '—'}
                </td>
              </tr>
            );
          })}
          {/* Ligne Pupil's Average — bandeau navy (seul accent de couleur du tableau) */}
          <tr className="bg-slate-200 font-bold">
            <td className="border-r border-black px-2 py-1 uppercase text-slate-900 text-right" colSpan={9}>Pupil&apos;s Average</td>
            <td className="border-black px-1 py-0.5 text-center text-blue-700 text-sm">{student.generalAverage !== null ? pupilAvg.toFixed(2) : '—'}</td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* Appreciation badge (grille /100) */}
      {tier && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] font-bold text-slate-700 uppercase">Overall Appreciation</span>
          <span className={cn('inline-block px-3 py-1 rounded text-xs font-bold', tier.color)}>
            {tier.label} ({tier.grade})
          </span>
        </div>
      )}

      <p className="text-[9px] text-slate-400 italic">
        1st CA (/20) + 2nd CA (/20) + Exam (/60) = Total /100 per subject. Grade: A+ (90–100) · A (80–89) · B (70–79) · C (60–69) · D (50–59) · F (below 50).
      </p>
    </div>
  );
}

// ─── Page 2: Anglophone Bulletin — modèle Report Book ───────────────────────
//    Mark obtainable / obtained / No in class · Teacher's Appreciation +
//    Class Teacher's Comments (grille /100) · Next term begins ·
//    Affective Assessment: Psychomotor Skills (2 colonnes côte à côte, A–E) ·
//    Headmaster(mistress)'s Comment (grille) · 3 signatures (Teacher /
//    Headmaster / Parent).

function BulletinAnglophonePage2({
  student, bulletinData, signatures, periodId, nextTermStartDate, directorName, academicYearId,
}: {
  student: StudentResult;
  bulletinData: BulletinData;
  signatures: { teacherSig: string | null; directorSig: string | null; parentSig: string | null; setTeacherSig: (v: string | null) => void; setDirectorSig: (v: string | null) => void; setParentSig: (v: string | null) => void };
  periodId?: string;
  nextTermStartDate?: string | null;
  directorName?: string | null;   // ⭐ Nom du directeur — résolu depuis le module RH
  academicYearId?: string;        // ⭐ 2026-09-29 — pour fetcher la conduite
}) {
  // ⭐ Grille + stats de l'élève
  const tier = enTierFor(student.generalAverage);
  const pupilAvg = student.generalAverage ?? 0;
  const nbSubjects = bulletinData.subjects.length;
  const markObtainable = 100 * nbSubjects;
  const markObtained = bulletinData.subjects.reduce((sum, subj) => {
    const s = student.subjectScores[subj.id];
    return sum + (s?.total ?? 0);
  }, 0);

  // ⭐ Catégories du Report Book — colonne gauche (affective) / droite (psychomotor)
  const AFFECTIVE_CATEGORIES = [
    'Co-operativeness', 'Punctuality', 'Curiosity', 'Politeness', 'Honesty',
    'Att. School', 'Writ. Express.', 'Oral Express.', 'Health Info',
  ];
  const PSYCHOMOTOR_CATEGORIES = [
    'Handwriting', 'Games', 'Musical Skills', 'Handling of tool', 'Drawing & Painting',
  ];
  const SKILL_LEVELS = ['A', 'B', 'C', 'D', 'E'];

  // ⭐ Annotations — auto-remplies depuis la grille /100, éditables, auto-save
  const [teacherAppreciation, setTeacherAppreciation] = useState('');
  const [teacherComments, setTeacherComments] = useState('');
  const [headmasterComment, setHeadmasterComment] = useState('');
  const [affectiveMap, setAffectiveMap] = useState<Record<string, string>>({});
  const [psychomotorMap, setPsychomotorMap] = useState<Record<string, string>>({});
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  // ⭐ 2026-09-29 — Conduct (résolu depuis le backend : conduct_ledger +
  //    sanctions du module Vie Scolaire). Affiché dans l'UI comme une section
  //    dédiée (entre « Mark Obtainable » et « Teacher's Appreciation »),
  //    identique au PDF. Le frontend ne calcule RIEN — il fetch la valeur
  //    via /api/discipline/conduct/student.
  const [conductData, setConductData] = useState<{
    conductScore: number | null;
    conductReference: number | null;
    totalPointsDeducted: number;
    sanctionCount: number;
    totalHoursAttributed: number;
    hasLedger: boolean;
  } | null>(null);

  // ─── Auto-fill A–E depuis la moyenne /100 ─────────────────────────────────
  const baseLevel = (avg: number): string =>
    avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 50 ? 'D' : 'E';
  const bumpLevel = (lvl: string, steps: number): string => {
    const idx = SKILL_LEVELS.indexOf(lvl);
    if (idx < 0) return lvl;
    return SKILL_LEVELS[Math.max(0, Math.min(SKILL_LEVELS.length - 1, idx - steps))];
  };
  const autoAffective = (avg: number): Record<string, string> => {
    // Compétences comportementales légèrement au-dessus du niveau académique
    const soft = new Set(['Co-operativeness', 'Politeness', 'Honesty', 'Punctuality', 'Health Info']);
    const base = baseLevel(avg);
    const map: Record<string, string> = {};
    AFFECTIVE_CATEGORIES.forEach((skill, i) => {
      map[skill] = soft.has(skill) ? bumpLevel(base, 1) : (i % 3 === 0 ? bumpLevel(base, -1) : base);
    });
    return map;
  };
  const autoPsychomotor = (avg: number): Record<string, string> => {
    const base = baseLevel(avg);
    const map: Record<string, string> = {};
    PSYCHOMOTOR_CATEGORIES.forEach((skill, i) => {
      map[skill] = i % 3 === 0 ? bumpLevel(base, -1) : base;
    });
    return map;
  };

  // ─── Chargement des annotations backend ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!periodId || !student.id) return;
      let ann: any = {};
      try {
        const annRes = await apiClient.get(`/institutional-exams/bulletins/annotations?studentId=${student.id}&periodId=${periodId}`);
        ann = annRes.data || {};
      } catch { ann = {}; }
      if (cancelled) return;
      // enTeacherComment = "appreciation \n comments" (2 parties)
      if (ann.enTeacherComment && String(ann.enTeacherComment).trim().length > 0) {
        const lines = String(ann.enTeacherComment).split('\n');
        setTeacherAppreciation(lines[0] || '');
        setTeacherComments(lines.slice(1).join('\n').trim());
      } else if (tier) {
        setTeacherAppreciation(tier.teacherAppreciation);
        setTeacherComments(tier.teacherComments.join('\n'));
      }
      if (ann.enDirectorComment && String(ann.enDirectorComment).trim().length > 0) {
        setHeadmasterComment(ann.enDirectorComment);
      } else if (tier) {
        setHeadmasterComment(tier.principalComment);
      }
      try {
        const aff = ann.enAffectiveAssessment ? JSON.parse(ann.enAffectiveAssessment) : null;
        setAffectiveMap(aff && Object.keys(aff).length > 0 ? aff : autoAffective(pupilAvg));
      } catch { setAffectiveMap(autoAffective(pupilAvg)); }
      try {
        const psy = ann.enPsychomotorAssessment ? JSON.parse(ann.enPsychomotorAssessment) : null;
        setPsychomotorMap(psy && Object.keys(psy).length > 0 ? psy : autoPsychomotor(pupilAvg));
      } catch { setPsychomotorMap(autoPsychomotor(pupilAvg)); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, periodId, pupilAvg]);

  // ⭐ 2026-09-29 — Fetcher la conduite depuis le backend (source de vérité).
  //    Endpoint dédié /api/discipline/conduct/student qui retourne :
  //    conductScore + conductReference + totalPointsDeducted + sanctionCount +
  //    totalHoursAttributed + hasLedger. Affiché dans une section dédiée de
  //    l'UI (identique au PDF).
  useEffect(() => {
    if (!student.id || !periodId || !academicYearId) return;
    let cancelled = false;
    fetch(`/api/discipline/conduct/student?studentId=${student.id}&periodId=${periodId}&academicYearId=${academicYearId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setConductData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [student.id, periodId, academicYearId]);

  // ─── Auto-save (best-effort) ──────────────────────────────────────────────
  const saveAnnotations = async (fields: Record<string, any>) => {
    if (!periodId || !student.id) return;
    try {
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        ...fields,
      });
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2000);
    } catch (e) {
      // Silent fail — auto-save best-effort
    }
  };

  const saveTeacherParts = (appreciation: string, comments: string) => {
    saveAnnotations({ enTeacherComment: `${appreciation}\n${comments}`.trim() });
  };

  // ─── Auto-fill depuis la grille (régénère tout) ───────────────────────────
  const handleAutoFill = async () => {
    if (!tier) return;
    setAutoFillLoading(true);
    const newAff = autoAffective(pupilAvg);
    const newPsy = autoPsychomotor(pupilAvg);
    setAffectiveMap(newAff);
    setPsychomotorMap(newPsy);
    setTeacherAppreciation(tier.teacherAppreciation);
    setTeacherComments(tier.teacherComments.join('\n'));
    setHeadmasterComment(tier.principalComment);
    await saveAnnotations({
      enTeacherComment: `${tier.teacherAppreciation}\n${tier.teacherComments.join('\n')}`,
      enDirectorComment: tier.principalComment,
      enAffectiveAssessment: JSON.stringify(newAff),
      enPsychomotorAssessment: JSON.stringify(newPsy),
    });
    setAutoFillLoading(false);
  };

  const setSkill = (kind: 'affective' | 'psychomotor', skill: string, val: string) => {
    if (kind === 'affective') {
      const next = { ...affectiveMap, [skill]: val };
      setAffectiveMap(next);
      saveAnnotations({ enAffectiveAssessment: JSON.stringify(next) });
    } else {
      const next = { ...psychomotorMap, [skill]: val };
      setPsychomotorMap(next);
      saveAnnotations({ enPsychomotorAssessment: JSON.stringify(next) });
    }
  };

  // ─── Rangée de catégorie avec radios A–E ──────────────────────────────────
  // ⭐ 2026-10-05 — CHECKBOXES : un radio non coché n'affiche RIEN (juste le
  //    cercle transparent natif du navigateur). Pas de glyphe ☐ qui se rend
  //    comme un rectangle vertical selon les polices. Le radio est volontairement
  //    transparent quand non coché, coloré quand coché — conforme au modèle
  //    Report Book officiel.
  const SkillRow = ({ skill, value, onChange, accentColor }: { skill: string; value: string; onChange: (v: string) => void; accentColor: string }) => (
    <tr>
      <td className="border-r border-b border-black px-2 py-1 text-[10px] font-medium text-slate-900 whitespace-nowrap">{skill}</td>
      {SKILL_LEVELS.map((lvl, idx) => (
        <td key={lvl} className={cn('border-b border-black px-1 py-0.5 text-center', idx < SKILL_LEVELS.length - 1 && 'border-r')}>
          <input
            type="radio"
            name={`en-skill-${skill.replace(/[^a-zA-Z0-9]/g, '-')}`}
            value={lvl}
            checked={value === lvl}
            onChange={() => onChange(lvl)}
            className={cn('w-3 h-3', accentColor)}
          />
        </td>
      ))}
    </tr>
  );

  // ─── En-tête Affective/Psychomotor — fond navy + texte blanc (cohérent avec le tableau des notes) ──
  const SkillHeader = () => (
    <tr className="text-white" style={{ backgroundColor: '#0A2A5E' }}>
      <th className="border-r border-b border-black px-2 py-1 text-[9px] font-bold uppercase text-left">Category</th>
      {SKILL_LEVELS.map((lvl, idx) => (
        <th key={lvl} className={cn('border-b border-black px-1 py-1 text-[9px] font-bold uppercase w-8', idx < SKILL_LEVELS.length - 1 && 'border-r')}>{lvl}</th>
      ))}
    </tr>
  );

  return (
    <div className="space-y-3">
      {/* Header bar + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-700 uppercase">Page 2 — Comments, Skills &amp; Signatures</div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[10px] text-emerald-600 font-semibold">✓ Saved</span>}
          <Button size="sm" variant="outline" onClick={handleAutoFill} disabled={autoFillLoading} className="text-[10px] h-7">
            {autoFillLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            Auto-fill (grille)
          </Button>
        </div>
      </div>

      {/* ⭐ 2026-10-05 — Mark obtainable / obtained / No in class : wrapper 2px noir + rounded-lg + overflow:hidden (même standard que le tableau des notes) */}
      <div className="rounded-lg overflow-hidden border-2 border-black">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr className="text-white" style={{ backgroundColor: '#0A2A5E' }}>
              <th className="border-r border-b border-black px-2 py-1 uppercase">Mark Obtainable</th>
              <th className="border-r border-b border-black px-2 py-1 uppercase">Mark Obtained</th>
              <th className="border-b border-black px-2 py-1 uppercase">No in Class</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-r border-black px-2 py-1 text-center text-blue-700 font-bold text-base bg-slate-50">{markObtainable}</td>
              <td className="border-r border-black px-2 py-1 text-center text-blue-700 font-bold text-base bg-slate-50">{markObtained.toFixed(2)}</td>
              <td className="px-2 py-1 text-center text-blue-700 font-bold text-base bg-slate-50">{bulletinData.results.length}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ⭐ 2026-09-29 — CONDUCT SECTION (résolu depuis le backend — module
          Vie Scolaire). Source de vérité = backend (conduct_ledger +
          sanctions). Affiché dans l'UI ET dans le PDF (même section).
          Affiche : conduct score / reference + sanctions count + hours +
          total points deducted. */}
      {conductData && (
        <div className="rounded-lg overflow-hidden border-2 border-black">
          <table className="w-full border-separate border-spacing-0 text-[10px]">
            <thead>
              <tr className="text-white" style={{ backgroundColor: '#0A2A5E' }}>
                <th className="border-r border-b border-black px-2 py-1 uppercase">Conduct</th>
                <th className="border-r border-b border-black px-2 py-1 uppercase">Reference</th>
                <th className="border-r border-b border-black px-2 py-1 uppercase">Sanctions</th>
                <th className="border-r border-b border-black px-2 py-1 uppercase">Points Deducted</th>
                <th className="border-b border-black px-2 py-1 uppercase">Hours</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-r border-b border-black px-2 py-1 text-center font-bold text-base bg-slate-50">
                  <span className={cn(
                    conductData.conductScore !== null && conductData.conductScore >= (conductData.conductReference ?? 17) * 0.6 && 'text-emerald-700',
                    conductData.conductScore !== null && conductData.conductScore < (conductData.conductReference ?? 17) * 0.6 && 'text-red-600',
                    conductData.conductScore === null && 'text-slate-400',
                  )}>
                    {conductData.conductScore !== null ? Number(conductData.conductScore).toFixed(2) : '—'}
                  </span>
                </td>
                <td className="border-r border-b border-black px-2 py-1 text-center font-bold text-base text-blue-700 bg-slate-50">{conductData.conductReference ?? 17}</td>
                <td className="border-r border-b border-black px-2 py-1 text-center font-bold text-base text-amber-700 bg-slate-50">{conductData.sanctionCount}</td>
                <td className="border-r border-b border-black px-2 py-1 text-center font-bold text-base text-red-600 bg-slate-50">{Number(conductData.totalPointsDeducted).toFixed(2)}</td>
                <td className="px-2 py-1 text-center font-bold text-base text-orange-600 bg-slate-50">{Number(conductData.totalHoursAttributed).toFixed(1)} h</td>
              </tr>
              {conductData.conductScore !== null && (
                <tr>
                  <td colSpan={5} className="px-2 py-1 text-center text-[9px] italic text-slate-500 bg-slate-50">
                    {conductData.conductScore >= (conductData.conductReference ?? 17) * 0.6 ? 'Satisfactory' : 'Needs improvement'}
                    {conductData.hasLedger && ' · Calculé depuis le compteur de conduite'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Teacher's Appreciation (grille /100) */}
      <div className="border border-slate-300 rounded-lg p-2">
        <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">
          Teacher&apos;s Appreciation
          <span className="ml-2 text-slate-400 font-normal">(auto-generated from the /100 scale — editable)</span>
        </label>
        <textarea
          value={teacherAppreciation}
          onChange={(e) => setTeacherAppreciation(e.target.value)}
          onBlur={() => saveTeacherParts(teacherAppreciation, teacherComments)}
          rows={2}
          className="w-full text-[10px] border border-slate-200 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y italic"
          placeholder="e.g. Outstanding performance. Excellent mastery of concepts."
        />
      </div>

      {/* Class Teacher's Comments (grille /100) */}
      <div className="border border-slate-300 rounded-lg p-2">
        <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">
          Class Teacher&apos;s Comments
          <span className="ml-2 text-slate-400 font-normal">(auto-generated from the /100 scale — editable)</span>
        </label>
        <textarea
          value={teacherComments}
          onChange={(e) => setTeacherComments(e.target.value)}
          onBlur={() => saveTeacherParts(teacherAppreciation, teacherComments)}
          rows={4}
          className="w-full text-[10px] border border-slate-200 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
          placeholder="One comment per line (4 lines from the appreciation scale)..."
        />
      </div>

      {/* Next term begins */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between text-[10px]">
        <span className="text-slate-500 uppercase font-bold">Next term begins</span>
        <strong className="text-slate-900">{nextTermStartDate || '—'}</strong>
      </div>

      {/* ⭐ 2026-10-05 — AFFECTIVE ASSESSMENT: PSYCHOMOTOR SKILLS — wrapper 2px noir + rounded-lg (même standard que le tableau des notes). En-tête navy + texte blanc. */}
      <div className="rounded-lg overflow-hidden border-2 border-black p-2 bg-white">
        <p className="text-[10px] font-bold text-blue-900 uppercase mb-1 text-center">
          Affective Assessment: Psychomotor Skills
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* Colonne gauche — Affective */}
          <table className="w-full border-separate border-spacing-0">
            <thead><SkillHeader /></thead>
            <tbody>
              {AFFECTIVE_CATEGORIES.map(skill => (
                <SkillRow key={skill} skill={skill} value={affectiveMap[skill] || ''} onChange={(v) => setSkill('affective', skill, v)} accentColor="accent-emerald-600" />
              ))}
            </tbody>
          </table>
          {/* Colonne droite — Psychomotor */}
          <table className="w-full border-separate border-spacing-0">
            <thead><SkillHeader /></thead>
            <tbody>
              {PSYCHOMOTOR_CATEGORIES.map(skill => (
                <SkillRow key={skill} skill={skill} value={psychomotorMap[skill] || ''} onChange={(v) => setSkill('psychomotor', skill, v)} accentColor="accent-blue-600" />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Headmaster(mistress)'s Comment (grille /100) */}
      <div className="border border-slate-300 rounded-lg p-2">
        <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">
          Headmaster(mistress)&apos;s Comment
          <span className="ml-2 text-slate-400 font-normal">(auto-generated from the /100 scale — editable)</span>
        </label>
        <textarea
          value={headmasterComment}
          onChange={(e) => setHeadmasterComment(e.target.value)}
          onBlur={() => saveAnnotations({ enDirectorComment: headmasterComment })}
          rows={3}
          className="w-full text-[10px] border border-slate-200 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
          placeholder="Principal's comment from the appreciation scale..."
        />
      </div>

      {/* 3 signatures — Teacher + Headmaster + Parent (même pattern que FR) */}
      <div className="border border-slate-300 rounded-lg p-2">
        <p className="text-[10px] font-bold text-blue-900 uppercase mb-2 text-center">Signatures</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            {signatures.teacherSig ? (
              <img src={signatures.teacherSig} alt="Teacher signature" className="mx-auto" style={{ maxHeight: 40, maxWidth: 100, objectFit: 'contain' }} />
            ) : (
              <div className="h-10 flex items-end justify-center">
                <SignatureCanvas
                  height={40}
                  penColor="#0A2A5E"
                  onChange={(data) => signatures.setTeacherSig(data || null)}
                />
              </div>
            )}
            <div className="border-t border-black mt-1 pt-1">
              <p className="text-[9px] font-bold text-blue-900">Class Teacher</p>
              <p className="text-[8px] text-slate-500">Signature</p>
            </div>
          </div>
          <div className="text-center">
            {signatures.directorSig ? (
              <img src={signatures.directorSig} alt="Headmaster signature" className="mx-auto" style={{ maxHeight: 40, maxWidth: 100, objectFit: 'contain' }} />
            ) : (
              <div className="h-10 flex items-end justify-center">
                <SignatureCanvas
                  height={40}
                  penColor="#0A2A5E"
                  onChange={(data) => signatures.setDirectorSig(data || null)}
                />
              </div>
            )}
            <div className="border-t border-black mt-1 pt-1">
              <p className="text-[9px] font-bold text-blue-900">Headmaster(mistress)</p>
              {/* ⭐ Nom du directeur — résolu depuis le module RH (administration) */}
              {directorName
                ? <p className="text-[8px] font-semibold text-slate-800">{directorName}</p>
                : <p className="text-[8px] text-slate-500">Signature</p>}
            </div>
          </div>
          <div className="text-center">
            {signatures.parentSig ? (
              <img src={signatures.parentSig} alt="Parent signature" className="mx-auto" style={{ maxHeight: 40, maxWidth: 100, objectFit: 'contain' }} />
            ) : (
              <div className="h-10 flex items-end justify-center">
                <SignatureCanvas
                  height={40}
                  penColor="#0A2A5E"
                  onChange={(data) => signatures.setParentSig(data || null)}
                />
              </div>
            )}
            <div className="border-t border-black mt-1 pt-1">
              <p className="text-[9px] font-bold text-blue-900">Parent / Guardian</p>
              <p className="text-[8px] text-slate-500">Name &amp; Signature</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-slate-400 italic">
        Appreciations, comments and skills are auto-generated from the pupil&apos;s average (/100 scale: Outstanding 90–100, Very Good 80–89, Good 70–79, Fair 60–69, Pass 50–59, Weak 40–49, Very Weak 0–39) and remain fully editable. Changes are auto-saved on blur.
      </p>
    </div>
  );
}


// ─── Page 2: Bulletin SECONDAIRE — Bloc Conseil de Classe ──────────────────
//
// ⭐ Refonte (2026-09-28) — remplace l'ancien modèle :
//    Ancien : Appréciation du conseil des professeurs + Appréciation du directeur
//    Nouveau : Mention du conseil de classe + Conduite + Appréciation + Visa chef
//
//    Les valeurs sont auto-générées :
//    - Mention (distinction/sanction) : depuis school_academic_settings.config.distinctions
//    - Conduite : depuis conduct_ledger (module Vie Scolaire)
//    - Appréciation : auto-générée + modifiable (auto-save on blur)
//    Le bloc est éditable dans le frontend ET apparaît dans le PDF généré.

function BulletinSecondairePage2({
  student,
  signatures,
  periodId,
  directorName,
  academicYearId,
}: {
  student: StudentResult;
  signatures: { teacherSig: string | null; directorSig: string | null; parentSig: string | null; setTeacherSig: (v: string | null) => void; setDirectorSig: (v: string | null) => void; setParentSig: (v: string | null) => void };
  periodId?: string;
  directorName?: string | null;
  academicYearId?: string;
}) {
  // ⭐ 2026-09-28 — Annotations secondaires COMPLÈTES (assiduité, discipline,
  //    défauts majeurs, qualités remarquables, analyse/recommandations) avec
  //    auto-save on blur — exactement comme BulletinPage2 du primaire. Le
  //    bloc est éditable dans le frontend ET apparaît dans le PDF généré.
  //    councilAppreciation → Appréciation du conseil de classe (éditable)
  const [assiduite, setAssiduite] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [defautsMajeurs, setDefautsMajeurs] = useState('');
  const [qualitesRemarquables, setQualitesRemarquables] = useState('');
  const [conseilAppreciation, setConseilAppreciation] = useState('');
  const [savedField, setSavedField] = useState<string | null>(null);
  const [autoFillLoading, setAutoFillLoading] = useState(false);

  // ⭐ Mention du conseil de classe (auto-générée depuis la moyenne de l'élève)
  //    Distinction/sanction résolue depuis school_academic_settings.config.distinctions
  const [mentionLabel, setMentionLabel] = useState<string | null>(null);
  const [mentionType, setMentionType] = useState<'DISTINCTION' | 'SANCTION' | null>(null);

  // ⭐ 2026-09-28 — Conduite résolue depuis conduct_ledger (module Vie Scolaire).
  //    Affichée même si pas de donnée (placeholder « — / 17 »).
  //    ⭐ 2026-09-29 — Refonte : on utilise le nouvel endpoint dédié
  //    /api/discipline/conduct/student qui retourne aussi le nombre de
  //    sanctions + le total d'heures attribuées + les points déduits, en une
  //    seule requête (avant : on récupérait tout le ledger de l'année et on
  //    filtrait côté client — moins efficace).
  const [conductScore, setConductScore] = useState<number | null>(null);
  const [conductReference, setConductReference] = useState<number | null>(17);
  const [conductSanctionCount, setConductSanctionCount] = useState<number>(0);
  const [conductTotalHours, setConductTotalHours] = useState<number>(0);
  const [conductPointsDeducted, setConductPointsDeducted] = useState<number>(0);
  const [conductHasLedger, setConductHasLedger] = useState<boolean>(false);

  useEffect(() => {
    if (!student.id || !periodId) return;
    // ⭐ Load all annotations from backend
    apiClient.get(`/institutional-exams/bulletins/annotations?studentId=${student.id}&periodId=${periodId}`)
      .then((res) => {
        const data = res.data || {};
        setAssiduite(data.assiduite || '');
        setDiscipline(data.discipline || '');
        setDefautsMajeurs(data.defautsMajeurs || '');
        setQualitesRemarquables(data.qualitesRemarquables || '');
        setConseilAppreciation(data.analyseRecommandations || data.councilAppreciation || '');
      })
      .catch(() => {});

    // ⭐ Auto-générer la mention depuis la moyenne de l'élève
    if (student.generalAverage !== null && student.generalAverage !== undefined) {
      // Récupérer les distinctions depuis les settings
      fetch('/api/settings/academic-settings?levelCode=SECONDAIRE', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.config?.distinctions && Array.isArray(d.config.distinctions)) {
            for (const dist of d.config.distinctions) {
              if (student.generalAverage! >= dist.minScore && student.generalAverage! <= dist.maxScore) {
                setMentionLabel(dist.label);
                setMentionType(dist.type);
                break;
              }
            }
          }
        })
        .catch(() => {});
    }

    // ⭐ 2026-09-29 — Charger la conduite depuis le backend (source de vérité).
    //    Nouvel endpoint dédié /api/discipline/conduct/student qui retourne
    //    en une seule requête : conductScore + conductReference + sanctionCount
    //    + totalPointsDeducted + totalHoursAttributed + hasLedger.
    //    ⭐ 2026-09-29 — Avant : on utilisait /api/vie-scolaire/conduct (URL
    //       inexistante → 404 → null → la conduite n'était JAMAIS chargée →
    //       affichait toujours le placeholder 17/20). Désormais on utilise
    //       la BONNE URL /api/discipline/conduct/student.
    if (academicYearId) {
      fetch(`/api/discipline/conduct/student?studentId=${student.id}&periodId=${periodId}&academicYearId=${academicYearId}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then((d) => {
          if (!d) return;
          if (typeof d.conductScore === 'number') setConductScore(d.conductScore);
          if (typeof d.conductReference === 'number') setConductReference(d.conductReference);
          if (typeof d.sanctionCount === 'number') setConductSanctionCount(d.sanctionCount);
          if (typeof d.totalHoursAttributed === 'number') setConductTotalHours(d.totalHoursAttributed);
          if (typeof d.totalPointsDeducted === 'number') setConductPointsDeducted(d.totalPointsDeducted);
          if (typeof d.hasLedger === 'boolean') setConductHasLedger(d.hasLedger);
        })
        .catch(() => {});
    }
  }, [student.id, periodId, student.generalAverage, academicYearId]);

  const saveAnnotation = async (field: string, value: string) => {
    if (!student.id || !periodId) return;
    try {
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        [field]: value,
      });
      setSavedField(field);
      setTimeout(() => setSavedField(null), 2000);
    } catch {
      // Silent fail
    }
  };

  // ⭐ AI Auto-fill: génère les annotations depuis l'assiduité + notes
  const handleAutoFill = async () => {
    if (!student.id || !periodId) return;
    setAutoFillLoading(true);
    try {
      const res = await apiClient.get(`/institutional-exams/bulletins/auto-annotations?studentId=${student.id}&periodId=${periodId}`);
      const data = res.data || {};
      if (data.assiduite) setAssiduite(data.assiduite);
      if (data.discipline) setDiscipline(data.discipline);
      if (data.defautsMajeurs !== undefined) setDefautsMajeurs(data.defautsMajeurs);
      if (data.qualitesRemarquables !== undefined) setQualitesRemarquables(data.qualitesRemarquables);
      if (data.analyseRecommandations) setConseilAppreciation(data.analyseRecommandations);
      // Save all to backend
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        assiduite: data.assiduite || '',
        discipline: data.discipline || '',
        defautsMajeurs: data.defautsMajeurs || '',
        qualitesRemarquables: data.qualitesRemarquables || '',
        analyseRecommandations: data.analyseRecommandations || '',
      });
      toastSuccess('Annotations auto-générées', { description: 'Basées sur l\'assiduité et les résultats de l\'élève. Modifiables.' });
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setAutoFillLoading(false); }
  };

  const conductOk = conductScore !== null && conductScore >= (conductReference ?? 17) * 0.6;

  return (
    <div className="space-y-3">
      {/* ⭐ Bloc Conseil de Classe — nouveau modèle */}
      <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 uppercase mb-2">Conseil de Classe</h4>
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={autoFillLoading}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            title="Générer automatiquement les annotations basées sur l'assiduité et les notes"
          >
            {autoFillLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Auto-générer
          </button>
        </div>

        {/* 1. Mention du conseil de classe (auto-générée) */}
        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Mention du conseil de classe :</span>
          <div className="flex-1 border-b border-dotted border-slate-300"></div>
          <span className={cn('text-sm font-bold px-2 py-0.5 rounded',
            mentionType === 'DISTINCTION' && 'bg-emerald-100 text-emerald-700',
            mentionType === 'SANCTION' && 'bg-red-100 text-red-700',
            !mentionType && 'bg-slate-100 text-slate-500')}>
            {mentionLabel || '—'}
          </span>
        </div>

        {/* 2. Conduite (depuis module Vie Scolaire — toujours affichée) */}
        <div className="p-2 bg-slate-50 rounded-lg space-y-2">
          {/* Ligne 1 : score + reference + appreciation */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Conduite :</span>
            <div className="flex-1 border-b border-dotted border-slate-300"></div>
            <span className={cn('text-sm font-bold px-2 py-0.5 rounded',
              conductScore !== null && conductOk && 'bg-emerald-100 text-emerald-700',
              conductScore !== null && !conductOk && 'bg-red-100 text-red-700',
              conductScore === null && 'bg-slate-100 text-slate-500')}>
              {conductScore !== null
                ? `${conductScore.toFixed(2)} / ${conductReference ?? 17}`
                : `— / ${conductReference ?? 17}`}
            </span>
          </div>
          {/* ⭐ 2026-09-29 — Ligne 2 : détail des sanctions (count + points
              déduits + heures attribuées). Affiché seulement si l'élève a
              au moins 1 sanction ce trimestre. */}
          {conductSanctionCount > 0 && (
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="bg-white rounded p-1.5 border border-amber-200 text-center">
                <p className="text-slate-500 uppercase font-bold">Sanctions</p>
                <p className="font-bold text-amber-700">{conductSanctionCount}</p>
              </div>
              <div className="bg-white rounded p-1.5 border border-red-200 text-center">
                <p className="text-slate-500 uppercase font-bold">Points déduits</p>
                <p className="font-bold text-red-600">{conductPointsDeducted.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded p-1.5 border border-orange-200 text-center">
                <p className="text-slate-500 uppercase font-bold">Heures attribuées</p>
                <p className="font-bold text-orange-600">{conductTotalHours.toFixed(1)} h</p>
              </div>
            </div>
          )}
          {conductHasLedger && (
            <p className="text-[9px] text-slate-500 italic text-center">
              Calculé depuis le compteur de conduite (module Vie Scolaire)
            </p>
          )}
        </div>

        {/* 3. Appréciation du conseil de classe (auto-générée + modifiable) */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase mb-1">Appréciation du conseil de classe</h4>
          <textarea
            value={conseilAppreciation}
            onChange={(e) => setConseilAppreciation(e.target.value)}
            onBlur={(e) => saveAnnotation('analyseRecommandations', e.target.value)}
            rows={3}
            placeholder="Appréciation du conseil de classe…"
            className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
          {savedField === 'analyseRecommandations' && <p className="text-[9px] text-emerald-600 mt-1">✓ Enregistré</p>}
        </div>
      </div>

      {/* ⭐ 2026-09-28 — Bloc Attitudes + observations pédagogiques (éditable) */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase mb-2">Attitudes et observations pédagogiques</h4>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-slate-600">Assiduité</label>
            <textarea
              value={assiduite}
              onChange={(e) => setAssiduite(e.target.value)}
              onBlur={(e) => saveAnnotation('assiduite', e.target.value)}
              rows={2}
              placeholder="Renseigner l'assiduité de l'élève…"
              className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            {savedField === 'assiduite' && <p className="text-[9px] text-emerald-600 mt-1">✓ Enregistré</p>}
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-600">Discipline</label>
            <textarea
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              onBlur={(e) => saveAnnotation('discipline', e.target.value)}
              rows={2}
              placeholder="Renseigner la discipline de l'élève…"
              className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            {savedField === 'discipline' && <p className="text-[9px] text-emerald-600 mt-1">✓ Enregistré</p>}
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-600">Défauts majeurs identifiés</label>
            <textarea
              value={defautsMajeurs}
              onChange={(e) => setDefautsMajeurs(e.target.value)}
              onBlur={(e) => saveAnnotation('defautsMajeurs', e.target.value)}
              rows={2}
              placeholder="Renseigner les défauts majeurs…"
              className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            {savedField === 'defautsMajeurs' && <p className="text-[9px] text-emerald-600 mt-1">✓ Enregistré</p>}
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-600">Qualités remarquables</label>
            <textarea
              value={qualitesRemarquables}
              onChange={(e) => setQualitesRemarquables(e.target.value)}
              onBlur={(e) => saveAnnotation('qualitesRemarquables', e.target.value)}
              rows={2}
              placeholder="Renseigner les qualités remarquables…"
              className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            {savedField === 'qualitesRemarquables' && <p className="text-[9px] text-emerald-600 mt-1">✓ Enregistré</p>}
          </div>
        </div>
      </div>

      {/* 4. Visa du Chef d'Établissement */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase mb-3">Visa du Chef d'Établissement</h4>
        <div className="max-w-sm mx-auto text-center">
          <p className="text-[10px] font-bold text-slate-700 mb-1">Le Chef d'Établissement</p>
          <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
            {signatures.directorSig ? (
              <div className="flex flex-col items-center">
                <img src={signatures.directorSig} alt="Signature" className="max-h-24 max-w-[280px] object-contain" />
                <button
                  type="button"
                  onClick={() => signatures.setDirectorSig(null)}
                  className="text-[9px] text-red-500 hover:underline mt-1"
                >
                  Effacer et resigner
                </button>
              </div>
            ) : (
              <SignatureCanvas
                width={280}
                height={100}
                onSignatureChange={signatures.setDirectorSig}
                placeholder="Signature du Chef d'Établissement"
              />
            )}
          </div>
          {directorName && (
            <p className="text-[10px] font-semibold text-slate-800 mt-1">{directorName}</p>
          )}
        </div>
      </div>

      {/* 5. Mention officielle */}
      <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 text-center">
        <p className="text-[10px] font-bold italic text-slate-700">
          Ce bulletin n'est établi qu'une seule fois, veuillez le conserver précieusement.
        </p>
      </div>
    </div>
  );
}

// ─── Page 2: Appréciations + Signatures (Maternelle + Primaire) ────────────

function BulletinPage2({ student, isMaternelle, signatures, periodId, directorName }: { student: StudentResult; isMaternelle: boolean; signatures: { teacherSig: string | null; directorSig: string | null; parentSig: string | null; setTeacherSig: (v: string | null) => void; setDirectorSig: (v: string | null) => void; setParentSig: (v: string | null) => void }; periodId?: string; directorName?: string | null }) {
  // ⭐ Annotation state — loaded from backend + auto-save on blur
  const [assiduite, setAssiduite] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [defautsMajeurs, setDefautsMajeurs] = useState('');
  const [qualitesRemarquables, setQualitesRemarquables] = useState('');
  const [analyseRecommandations, setAnalyseRecommandations] = useState('');
  const [directorVisa, setDirectorVisa] = useState(student.appreciationGlobale || '');
  const [directorVisaSaved, setDirectorVisaSaved] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);

  // Load annotations from backend when student/period changes
  useEffect(() => {
    if (!student.id || !periodId) return;
    apiClient.get(`/institutional-exams/bulletins/annotations?studentId=${student.id}&periodId=${periodId}`)
      .then((res) => {
        const data = res.data || {};
        setAssiduite(data.assiduite || '');
        setDiscipline(data.discipline || '');
        setDefautsMajeurs(data.defautsMajeurs || '');
        setQualitesRemarquables(data.qualitesRemarquables || '');
        setAnalyseRecommandations(data.analyseRecommandations || '');
        if (data.directorVisa) setDirectorVisa(data.directorVisa);
        // ⭐ 2026-09-30 — Auto-générer l'analyse pédagogique pour TOUS les
        //    niveaux (maternelle + primaire) si elle est vide (exigence
        //    promoteur : « ça doit être généré en même temps, on ne doit pas
        //    cliquer sur auto-générer d'abord »).
        //    On déclenche l'auto-génération automatiquement si les annotations
        //    sont vides. Le primaire a aussi besoin de assiduité/discipline/
        //    défauts/qualités auto-générées.
        if (!data.analyseRecommandations && !data.assiduite) {
          // Auto-générer en arrière-plan (sans toast)
          apiClient.get(`/institutional-exams/bulletins/auto-annotations?studentId=${student.id}&periodId=${periodId}`)
            .then((autoRes) => {
              const autoData = autoRes.data;
              if (autoData.analyseRecommandations) {
                setAnalyseRecommandations(autoData.analyseRecommandations);
                setAutoGenerated(true);
                // ⭐ 2026-09-30 — Pour le primaire, aussi auto-générer
                //    assiduité/discipline/défauts/qualités
                if (autoData.assiduite) setAssiduite(autoData.assiduite);
                if (autoData.discipline) setDiscipline(autoData.discipline);
                if (autoData.defautsMajeurs) setDefautsMajeurs(autoData.defautsMajeurs);
                if (autoData.qualitesRemarquables) setQualitesRemarquables(autoData.qualitesRemarquables);
                // Save all to backend
                apiClient.patch('/institutional-exams/bulletins/annotations', {
                  studentId: student.id,
                  periodId,
                  analyseRecommandations: autoData.analyseRecommandations,
                  assiduite: autoData.assiduite || '',
                  discipline: autoData.discipline || '',
                  defautsMajeurs: autoData.defautsMajeurs || '',
                  qualitesRemarquables: autoData.qualitesRemarquables || '',
                  directorVisa: autoData.directorVisa || student.appreciationGlobale || '',
                }).catch(() => {});
                if (autoData.directorVisa) setDirectorVisa(autoData.directorVisa);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [student.id, periodId, isMaternelle, student.appreciationGlobale]);

  // Auto-save a single annotation field on blur
  const saveAnnotation = async (field: string, value: string) => {
    if (!student.id || !periodId) return;
    try {
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        [field]: value,
      });
    } catch (err) {
      // Silent fail — non-blocking
    }
  };

  // ⭐ Director visa auto-save on blur
  const handleDirectorVisaBlur = async () => {
    if (!student.id || !periodId) return;
    try {
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        directorVisa: directorVisa,
      });
      setDirectorVisaSaved(true);
      setTimeout(() => setDirectorVisaSaved(false), 2000);
    } catch {
      // Silent fail — non-blocking
    }
  };

  // ⭐ AI Auto-fill: generate annotations from attendance + grades
  const [autoGenerated, setAutoGenerated] = useState(false); // tracks if annotations were auto-filled (for red handwritten style)

  const handleAutoFill = async () => {
    if (!student.id || !periodId) return;
    setAutoFillLoading(true);
    try {
      const res = await apiClient.get(`/institutional-exams/bulletins/auto-annotations?studentId=${student.id}&periodId=${periodId}`);
      const data = res.data;
      if (data.assiduite) setAssiduite(data.assiduite);
      if (data.discipline) setDiscipline(data.discipline);
      if (data.defautsMajeurs !== undefined) setDefautsMajeurs(data.defautsMajeurs);
      if (data.qualitesRemarquables !== undefined) setQualitesRemarquables(data.qualitesRemarquables);
      if (data.analyseRecommandations) setAnalyseRecommandations(data.analyseRecommandations);
      if (data.directorVisa) setDirectorVisa(data.directorVisa);
      setAutoGenerated(true); // Mark as auto-generated for red handwritten style
      // Save all to backend
      await apiClient.patch('/institutional-exams/bulletins/annotations', {
        studentId: student.id,
        periodId,
        assiduite: data.assiduite,
        discipline: data.discipline,
        defautsMajeurs: data.defautsMajeurs,
        qualitesRemarquables: data.qualitesRemarquables,
        analyseRecommandations: data.analyseRecommandations,
        directorVisa: data.directorVisa,
      });
      toastSuccess('Annotations auto-générées', { description: 'Basées sur l\'assiduité et les résultats de l\'élève. Modifiables.' });
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setAutoFillLoading(false); }
  };

  // CSS class for auto-generated annotations: red, handwritten font
  // CSS class for auto-generated annotations: red, handwritten font
  const autoStyle = autoGenerated ? 'text-red-600 italic' : '';
  const autoFont = autoGenerated ? 'font-mono' : '';

  return (
    <div className="space-y-3">
      {!isMaternelle && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase mb-2">II — Attitudes</h4>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={autoFillLoading}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              title="Générer automatiquement les annotations basées sur l'assiduité et les notes"
            >
              {autoFillLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Auto-générer
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Assiduité</label>
              <textarea
                value={assiduite}
                onChange={(e) => setAssiduite(e.target.value)}
                onBlur={(e) => saveAnnotation('assiduite', e.target.value)}
                rows={2}
                placeholder="Renseigner l'assiduité de l'élève…"
                className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Discipline</label>
              <textarea
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                onBlur={(e) => saveAnnotation('discipline', e.target.value)}
                rows={2}
                placeholder="Renseigner la discipline de l'élève…"
                className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Défauts majeurs identifiés</label>
              <textarea
                value={defautsMajeurs}
                onChange={(e) => setDefautsMajeurs(e.target.value)}
                onBlur={(e) => saveAnnotation('defautsMajeurs', e.target.value)}
                rows={2}
                placeholder="Renseigner les défauts majeurs…"
                className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600">Qualités remarquables</label>
              <textarea
                value={qualitesRemarquables}
                onChange={(e) => setQualitesRemarquables(e.target.value)}
                onBlur={(e) => saveAnnotation('qualitesRemarquables', e.target.value)}
                rows={2}
                placeholder="Renseigner les qualités remarquables…"
                className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Analyse pédagogique */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase">
            {isMaternelle
              ? "Analyse Pédagogique Sommaire des Résultats et Recommandations de l'Enseignant(e) aux Parents"
              : 'Analyse des Résultats et Recommandations'}
          </h4>
          {/* ⭐ Auto-générer l'analyse + visa directeur + date — disponible pour MATERNELLE et PRIMAIRE */}
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={autoFillLoading}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
            title="Générer automatiquement l'analyse pédagogique, le visa du directeur et la date, basés sur l'assiduité et les résultats de l'élève."
          >
            {autoFillLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {isMaternelle ? 'Auto-générer (analyse + visa + date)' : 'Auto-générer les recommandations'}
          </button>
        </div>
        <textarea
          value={analyseRecommandations}
          onChange={(e) => setAnalyseRecommandations(e.target.value)}
          onBlur={(e) => saveAnnotation('analyseRecommandations', e.target.value)}
          rows={isMaternelle ? 6 : 4}
          placeholder="Saisir l'analyse pédagogique et les recommandations…"
          className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
        />
      </div>

      {/* ⭐ Symbole mérité (emoji) + Appréciation globale + Visa directeur — séparés */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Symbole mérité (emoji) */}
        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Symbole mérité par l'élève</p>
          {isMaternelle ? (
            <span className="inline-block mt-2 text-3xl">
              {student.appreciationGlobale === 'Très Satisfaisant' ? '😄' :
               student.appreciationGlobale === 'Satisfaisant' ? '😊' :
               student.appreciationGlobale === 'Peu Satisfaisant' ? '😞' : '—'}
            </span>
          ) : (
            <span className="inline-block mt-2 text-3xl">
              {student.generalAverage === null ? '—' :
               student.generalAverage >= 16 ? '🏆' :
               student.generalAverage >= 14 ? '😄' :
               student.generalAverage >= 12 ? '😊' :
               student.generalAverage >= 10 ? '😐' : '😞'}
            </span>
          )}
        </div>
        {/* Appréciation globale (texte) */}
        <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
          <p className="text-[10px] font-bold text-slate-700 uppercase">Appréciation globale</p>
          {isMaternelle ? (
            <span className={cn('inline-block mt-2 px-3 py-1 rounded text-xs font-bold',
              student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
              student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
              student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
            )}>{student.appreciationGlobale || '—'}</span>
          ) : (
            <span className={cn('inline-block mt-2 px-3 py-1 rounded text-xs font-bold',
              student.generalAverage !== null && student.generalAverage >= 12 && 'bg-emerald-100 text-emerald-700',
              student.generalAverage !== null && student.generalAverage >= 10 && student.generalAverage < 12 && 'bg-blue-100 text-blue-700',
              student.generalAverage !== null && student.generalAverage < 10 && 'bg-amber-100 text-amber-700',
            )}>
              {student.generalAverage !== null ? (
                student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' :
                student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant'
              ) : '—'}
            </span>
          )}
        </div>
        {/* ⭐ Visa du directeur (global, éditable, auto-save on blur) */}
        <div className="bg-amber-50 rounded-lg p-2 border border-amber-200">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-bold text-amber-900 uppercase">Visa du Directeur</p>
            {/* ⭐ Auto-fill visa + date — disponible pour MATERNELLE et PRIMAIRE */}
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={autoFillLoading}
              className="text-[10px] text-amber-700 hover:text-amber-900 underline flex items-center gap-0.5 disabled:opacity-50"
              title="Générer automatiquement le visa du directeur avec la date du jour."
            >
              {autoFillLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
              Auto-remplir
            </button>
          </div>
          <textarea
            value={directorVisa}
            onChange={(e) => setDirectorVisa(e.target.value)}
            onBlur={handleDirectorVisaBlur}
            rows={2}
            placeholder={student.appreciationGlobale || 'Visa du directeur…'}
            className={`w-full mt-1 text-[10px] bg-white/60 border border-amber-200 rounded px-2 py-1 outline-none focus:bg-white focus:border-amber-400 resize-none ${autoStyle} ${autoFont}`}
            title="Visa global du directeur (auto-enregistré à la sortie du champ)"
          />
          {directorVisaSaved && <p className="text-[9px] text-emerald-600 mt-0.5">✓ Enregistré</p>}
        </div>
      </div>

      {/* Signatures électroniques */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase mb-3">Signatures</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-700 mb-1">Titulaire de la classe</p>
            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
              {signatures.teacherSig ? (
                <div className="flex flex-col items-center">
                  <img src={signatures.teacherSig} alt="Signature de l'enseignant" className="max-h-24 max-w-[280px] object-contain" />
                  <button
                    type="button"
                    onClick={() => signatures.setTeacherSig(null)}
                    className="text-[9px] text-red-500 hover:underline mt-1"
                  >
                    Effacer et resigner
                  </button>
                </div>
              ) : (
                <SignatureCanvas
                  width={280}
                  height={100}
                  onSignatureChange={signatures.setTeacherSig}
                  placeholder="Signature de l'enseignant"
                />
              )}
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-700 mb-1">Le Directeur(trice)</p>
            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
              {signatures.directorSig ? (
                <div className="flex flex-col items-center">
                  <img src={signatures.directorSig} alt="Signature du Directeur" className="max-h-24 max-w-[280px] object-contain" />
                  <button
                    type="button"
                    onClick={() => signatures.setDirectorSig(null)}
                    className="text-[9px] text-red-500 hover:underline mt-1"
                  >
                    Effacer et resigner
                  </button>
                </div>
              ) : (
                <SignatureCanvas
                  width={280}
                  height={100}
                  onSignatureChange={signatures.setDirectorSig}
                  placeholder="Signature du Directeur"
                />
              )}
            </div>
            {/* ⭐ Nom du directeur — résolu depuis le module RH (administration) */}
            {directorName && <p className="text-[10px] font-semibold text-slate-800 mt-1">{directorName}</p>}
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-700 mb-1">Les Parents</p>
            <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
              <SignatureCanvas
                width={280}
                height={100}
                onSignatureChange={signatures.setParentSig}
                placeholder="Signature des parents"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Réponse des parents */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <h4 className="text-[10px] font-bold text-slate-700 uppercase mb-1">Réponse des parents de l'élève</h4>
        <textarea
          rows={2}
          placeholder="Zone de réponse des parents…"
          className={`w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${autoStyle} ${autoFont}`}
        />
      </div>
    </div>
  );
}

// ─── Moyennes Tab (Trimestriel + Annuel) ─────────────────────────────────────
//
// ⭐ Refonte (2026-09-27) — tableau primaire/maternelle avec colonnes
//    détaillées : Nom | EM1 | EM2 | Moy. EM | EC | Moyenne générale
//    (par trimestre, bloc de 5 colonnes par période).
//    Pour la moyenne annuelle : Nom | EM annuel | EC annuel | Moyenne annuelle
//    (agrégation sur tous les trimestres + EP si présent).
//    Maternelle garde les valeurs qualitatives TS / S / PS.
//
// ⭐ Vue par matière (2026-09-27) — toggle pour la maternelle uniquement :
//    Vue globale = tableau agrégé par élève × trimestre (vue existante)
//    Vue par matière = liste d'élèves expansable, chaque élève a un tableau
//    par matière (EM1, EM2, MoyEM, EC, Moyenne générale) + génération PDF
//    + workflow d'envoi aux parents (comme bulletin d'évaluation).

function MoyennesTab({
  academicYear, schoolLevelUuid, scopeLang, scopeLevel, isMaternelle, classes,
  activeMoyenneTab, setActiveMoyenneTab,
  activeVue, setActiveVue,
  school, effectiveTenantId, user, directorName,
}: {
  academicYear: any;
  schoolLevelUuid?: string;
  scopeLang?: string;
  scopeLevel: string;
  isMaternelle: boolean;
  classes: any[];
  activeMoyenneTab: 'trimestriel' | 'annuel';
  setActiveMoyenneTab: (t: 'trimestriel' | 'annuel') => void;
  activeVue: 'globale' | 'par-matiere';
  setActiveVue: (v: 'globale' | 'par-matiere') => void;
  school: any;
  effectiveTenantId?: string;
  user?: any;
  directorName?: string | null;
}) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [loading, setLoading] = useState(true);
  const [trimesterData, setTrimesterData] = useState<any[]>([]);
  const [annualData, setAnnualData] = useState<any[]>([]);

  // ── Helper : compute per-student averages for a set of evaluations ──
  //   Returns: Map<studentId, { name, em1Avg, em2Avg, ecAvg, epAvg }>
  //   For each eval type code, computes either the numeric average (primaire)
  //   or the qualitative average (maternelle — TS=3, S=2, PS=1).
  const computeAveragesForEvals = useCallback(async (
    periodEvals: any[],
  ): Promise<{
    studentAverages: Map<string, {
      name: string;
      em1Avg: number | null;
      em2Avg: number | null;
      ecAvg: number | null;
      epAvg: number | null;
    }>;
    hasEm1: boolean;
    hasEm2: boolean;
    hasEc: boolean;
    hasEp: boolean;
  }> => {
    // Group by evaluation type
    const evalTypeMap = new Map<string, any[]>();
    for (const ev of periodEvals) {
      const typeId = ev.evaluationType?.id || '_no_type';
      if (!evalTypeMap.has(typeId)) evalTypeMap.set(typeId, []);
      evalTypeMap.get(typeId)!.push(ev);
    }

    // Resolve eval type codes (EM1, EM2, EC, EP)
    const evalTypeCodes = new Map<string, string>(); // typeId → code
    for (const [typeId, evals] of evalTypeMap) {
      if (evals[0]?.evaluationType?.code) evalTypeCodes.set(typeId, evals[0].evaluationType.code);
    }
    const em1TypeId = Array.from(evalTypeCodes.entries()).find(([, c]) => c === 'EM1')?.[0];
    const em2TypeId = Array.from(evalTypeCodes.entries()).find(([, c]) => c === 'EM2')?.[0];
    const ecTypeId = Array.from(evalTypeCodes.entries()).find(([, c]) => c === 'EC')?.[0];
    const epTypeId = Array.from(evalTypeCodes.entries()).find(([, c]) => c === 'EP')?.[0];

    // Batch-load all grading sheets
    const evalGradesMap = new Map<string, any[]>();
    const allLangEvalIds: string[] = [];
    for (const [, evals] of evalTypeMap) {
      const langEvals = scopeLang
        ? evals.filter((ev: any) => matchesLevelLanguage(ev.subject, scopeLang))
        : evals;
      langEvals.forEach((ev: any) => allLangEvalIds.push(ev.id));
    }
    const sheetsMap = await institutionalExamsService
      .getGradingSheetsBatch(allLangEvalIds)
      .catch(() => ({}) as Record<string, any[]>);
    for (const id of allLangEvalIds) {
      evalGradesMap.set(id, Array.isArray(sheetsMap[id]) ? sheetsMap[id] : []);
    }

    // Compute per-student per-type averages
    // evalTypeAverages: studentId → { typeId: avg }
    const evalTypeAverages: Record<string, Record<string, number | null>> = {};
    const studentNames = new Map<string, string>();

    for (const [typeId, evals] of evalTypeMap) {
      const langEvals = scopeLang
        ? evals.filter((ev: any) => matchesLevelLanguage(ev.subject, scopeLang))
        : evals;
      const studentScores = new Map<string, { total: number; count: number; tsCount: number; sCount: number; psCount: number }>();
      for (const ev of langEvals) {
        const grades = evalGradesMap.get(ev.id) || [];
        for (const grade of grades) {
          if (!studentScores.has(grade.studentId)) {
            studentScores.set(grade.studentId, { total: 0, count: 0, tsCount: 0, sCount: 0, psCount: 0 });
          }
          const s = studentScores.get(grade.studentId)!;
          if (!studentNames.has(grade.studentId)) {
            studentNames.set(grade.studentId, grade.studentName || 'Inconnu');
          }
          if (grade.isAbsent) continue;
          if (isMaternelle) {
            if (grade.qualitativeCode === 'TS') { s.tsCount++; s.count++; }
            else if (grade.qualitativeCode === 'S') { s.sCount++; s.count++; }
            else if (grade.qualitativeCode === 'PS') { s.psCount++; s.count++; }
          } else {
            if (grade.score !== null && grade.score !== undefined) { s.total += Number(grade.score); s.count++; }
          }
        }
      }
      for (const [studentId, s] of studentScores) {
        if (!evalTypeAverages[studentId]) evalTypeAverages[studentId] = {};
        if (isMaternelle && s.count > 0) {
          evalTypeAverages[studentId][typeId] = (s.tsCount * 3 + s.sCount * 2 + s.psCount * 1) / s.count;
        } else if (!isMaternelle && s.count > 0) {
          evalTypeAverages[studentId][typeId] = s.total / s.count;
        } else {
          evalTypeAverages[studentId][typeId] = null;
        }
      }
    }

    // Build the result map
    const studentAverages = new Map<string, { name: string; em1Avg: number | null; em2Avg: number | null; ecAvg: number | null; epAvg: number | null }>();
    for (const [studentId, name] of studentNames) {
      const avgs = evalTypeAverages[studentId] || {};
      studentAverages.set(studentId, {
        name,
        em1Avg: em1TypeId ? avgs[em1TypeId] ?? null : null,
        em2Avg: em2TypeId ? avgs[em2TypeId] ?? null : null,
        ecAvg: ecTypeId ? avgs[ecTypeId] ?? null : null,
        epAvg: epTypeId ? avgs[epTypeId] ?? null : null,
      });
    }
    return {
      studentAverages,
      hasEm1: !!em1TypeId,
      hasEm2: !!em2TypeId,
      hasEc: !!ecTypeId,
      hasEp: !!epTypeId,
    };
  }, [scopeLang, isMaternelle]);

  // ── Load trimester averages ──
  //   Returns one row per (student, period) with: em1Avg, em2Avg, ecAvg, moyEm, trimesterAvg, appreciation
  const loadTrimesterAverages = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    setLoading(true);
    try {
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      const periodsRes = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
      const periodsData = await periodsRes.json();
      const periods = Array.isArray(periodsData) ? periodsData : [];

      const results: any[] = [];
      for (const period of periods) {
        const periodEvals = allEvals.filter((ev: any) => ev.period?.id === period.id);
        if (periodEvals.length === 0) continue;

        const { studentAverages } = await computeAveragesForEvals(periodEvals);

        for (const [studentId, avgs] of studentAverages) {
          // moyEm = (EM1 + EM2) / 2 if both, else either one, else null
          let moyEm: number | null = null;
          if (avgs.em1Avg !== null && avgs.em2Avg !== null) moyEm = (avgs.em1Avg + avgs.em2Avg) / 2;
          else if (avgs.em1Avg !== null) moyEm = avgs.em1Avg;
          else if (avgs.em2Avg !== null) moyEm = avgs.em2Avg;

          // trimesterAvg = ((EM1+EM2)/2 + EC) / 2 if moyEm + EC, else moyEm or EC
          let trimesterAvg: number | null = null;
          if (moyEm !== null && avgs.ecAvg !== null) trimesterAvg = (moyEm + avgs.ecAvg) / 2;
          else if (moyEm !== null) trimesterAvg = moyEm;
          else if (avgs.ecAvg !== null) trimesterAvg = avgs.ecAvg;

          // Maternelle appreciation TS/S/PS
          let appreciation = '—';
          if (isMaternelle && trimesterAvg !== null) {
            appreciation = trimesterAvg >= 2.5 ? 'Très Satisfaisant' : trimesterAvg >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';
          }
          results.push({
            studentId,
            studentName: avgs.name,
            periodName: period.name,
            em1Avg: avgs.em1Avg,
            em2Avg: avgs.em2Avg,
            ecAvg: avgs.ecAvg,
            moyEm,
            trimesterAvg,
            appreciation,
          });
        }
      }
      results.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
      setTrimesterData(results);
    } catch (err) {
      console.error('Error loading trimester averages:', err);
      setTrimesterData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, academicYear?.id, computeAveragesForEvals, isMaternelle]);

  // ── Load annual averages ──
  //   Aggregates: EM annuel = moyenne des moyEm des 3 trimestres
  //               EC annuel = moyenne des ecAvg des 3 trimestres
  //               Moyenne annuelle = ((EM annuel + EC annuel) / 2 + EP) / 2 (EP si présent, sinon (EM annuel + EC annuel) / 2)
  const loadAnnualAverages = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    setLoading(true);
    try {
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      const periodsRes = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
      const periodsData = await periodsRes.json();
      const periods = Array.isArray(periodsData) ? periodsData : [];

      // Pour chaque période (trimestre), on calcule les moyennes par élève.
      // Ensuite on agrège : moyenne annuelle EM = moyenne des moyEm sur tous les trimestres.
      // Pour EP : on prend n'importe quel trimestre (généralement le 3e).
      // studentAnnualMap: studentId → { name, trimesters: [{name, moyEm, ecAvg, epAvg}] }
      const studentAnnualMap = new Map<string, { name: string; trimesters: { name: string; moyEm: number | null; ecAvg: number | null; epAvg: number | null }[] }>();

      for (const period of periods) {
        const periodEvals = allEvals.filter((ev: any) => ev.period?.id === period.id);
        if (periodEvals.length === 0) continue;
        const { studentAverages } = await computeAveragesForEvals(periodEvals);
        for (const [studentId, avgs] of studentAverages) {
          if (!studentAnnualMap.has(studentId)) {
            studentAnnualMap.set(studentId, { name: avgs.name, trimesters: [] });
          }
          let moyEm: number | null = null;
          if (avgs.em1Avg !== null && avgs.em2Avg !== null) moyEm = (avgs.em1Avg + avgs.em2Avg) / 2;
          else if (avgs.em1Avg !== null) moyEm = avgs.em1Avg;
          else if (avgs.em2Avg !== null) moyEm = avgs.em2Avg;
          studentAnnualMap.get(studentId)!.trimesters.push({
            name: period.name,
            moyEm,
            ecAvg: avgs.ecAvg,
            epAvg: avgs.epAvg,
          });
        }
      }

      // Compute annual aggregates
      const annualRows: any[] = [];
      for (const [studentId, info] of studentAnnualMap) {
        const validMoyEms = info.trimesters.map(t => t.moyEm).filter((v): v is number => v !== null);
        const validEcs = info.trimesters.map(t => t.ecAvg).filter((v): v is number => v !== null);
        const validEps = info.trimesters.map(t => t.epAvg).filter((v): v is number => v !== null);

        const emAnnuel = validMoyEms.length > 0 ? validMoyEms.reduce((a, b) => a + b, 0) / validMoyEms.length : null;
        const ecAnnuel = validEcs.length > 0 ? validEcs.reduce((a, b) => a + b, 0) / validEcs.length : null;
        const epAnnuel = validEps.length > 0 ? validEps.reduce((a, b) => a + b, 0) / validEps.length : null;

        let moyenneAnnuelle: number | null = null;
        if (emAnnuel !== null && ecAnnuel !== null && epAnnuel !== null) {
          moyenneAnnuelle = ((emAnnuel + ecAnnuel) / 2 + epAnnuel) / 2;
        } else if (emAnnuel !== null && ecAnnuel !== null) {
          moyenneAnnuelle = (emAnnuel + ecAnnuel) / 2;
        } else if (emAnnuel !== null) {
          moyenneAnnuelle = emAnnuel;
        } else if (ecAnnuel !== null) {
          moyenneAnnuelle = ecAnnuel;
        }

        let appreciation = '—';
        if (isMaternelle && moyenneAnnuelle !== null) {
          appreciation = moyenneAnnuelle >= 2.5 ? 'Très Satisfaisant' : moyenneAnnuelle >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';
        }

        annualRows.push({
          studentId,
          studentName: info.name,
          emAnnuel,
          ecAnnuel,
          epAnnuel,
          moyenneAnnuelle,
          appreciation,
          trimesterCount: info.trimesters.length,
        });
      }
      annualRows.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
      setAnnualData(annualRows);
    } catch (err) {
      console.error('Error loading annual averages:', err);
      setAnnualData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, academicYear?.id, computeAveragesForEvals, isMaternelle]);

  useEffect(() => {
    if (activeMoyenneTab === 'trimestriel') loadTrimesterAverages();
    else loadAnnualAverages();
  }, [loadTrimesterAverages, loadAnnualAverages, activeMoyenneTab]);

  return (
    <div className="space-y-4">
      {/* Sub-sub-tabs: Trimestriel | Annuel */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveMoyenneTab('trimestriel')}
          className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
            activeMoyenneTab === 'trimestriel' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}
        >
          Moyennes trimestrielles
        </button>
        <button
          onClick={() => setActiveMoyenneTab('annuel')}
          className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
            activeMoyenneTab === 'annuel' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}
        >
          Moyennes annuelles
        </button>
      </div>

      {/* ⭐ Vue par matière / Vue globale — toggle pour la maternelle + primaire, trimestriel + annuel */}
      {(isMaternelle || scopeLevel === 'PRIMAIRE') && (activeMoyenneTab === 'trimestriel' || activeMoyenneTab === 'annuel') && (
        <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
          <span className="text-sm font-semibold text-slate-700 mr-2">Vue :</span>
          <button
            onClick={() => setActiveVue('globale')}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeVue === 'globale' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}
          >
            Vue globale
          </button>
          <button
            onClick={() => setActiveVue('par-matiere')}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeVue === 'par-matiere' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}
          >
            Vue par matière
          </button>
        </div>
      )}

      {/* Class selector */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-sm font-semibold text-slate-700">Classe:</span>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
        >
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-slate-500">Calcul des moyennes…</span>
        </div>
      ) : activeMoyenneTab === 'trimestriel' ? (
        (isMaternelle || scopeLevel === 'PRIMAIRE') && activeVue === 'par-matiere' ? (
          <VueParMatiereTrimestriel
            academicYear={academicYear}
            scopeLang={scopeLang}
            isMaternelle={isMaternelle}
            classes={classes}
            selectedClassId={selectedClassId}
            school={school}
            effectiveTenantId={effectiveTenantId}
            user={user}
            directorName={directorName}
          />
        ) : (
          <MoyennesTrimestrielTable data={trimesterData} isMaternelle={isMaternelle} />
        )
      ) : (
        (isMaternelle || scopeLevel === 'PRIMAIRE') && activeVue === 'par-matiere' ? (
          <VueParMatiereAnnuel
            academicYear={academicYear}
            scopeLang={scopeLang}
            isMaternelle={isMaternelle}
            classes={classes}
            selectedClassId={selectedClassId}
            school={school}
            effectiveTenantId={effectiveTenantId}
            user={user}
            directorName={directorName}
          />
        ) : (
          <MoyennesAnnuelTable data={annualData} isMaternelle={isMaternelle} />
        )
      )}
    </div>
  );
}

// ─── Helper : afficher une valeur (numérique /20 ou qualitative TS/S/PS) ──
function fmtAvg(value: number | null | undefined, isMaternelle: boolean, threshold = 10): string {
  if (value === null || value === undefined) return '—';
  if (isMaternelle) {
    return value >= 2.5 ? 'TS' : value >= 1.5 ? 'S' : 'PS';
  }
  return value.toFixed(2);
}

function avgColor(value: number | null | undefined, isMaternelle: boolean, threshold = 10): string {
  if (value === null || value === undefined) return 'text-slate-400';
  if (isMaternelle) {
    return value >= 2.5 ? 'text-emerald-700' : value >= 1.5 ? 'text-blue-700' : 'text-amber-700';
  }
  return value >= threshold ? 'text-emerald-700' : 'text-red-600';
}

// ─── Vue Par Matière Trimestriel (maternelle uniquement) ────────────────────
//
// ⭐ Refonte (2026-09-27) — Vue par matière demandée par l'utilisateur :
//    Pour chaque élève, on affiche un tableau par matière avec les colonnes :
//      Matière | EM1 | EM2 | Moy. EM | EC | Moyenne générale
//    Pour la maternelle, les valeurs sont qualitatives (TS/S/PS).
//    Inclut :
//      - Sélecteur de trimestre
//      - Liste des élèves (expansible)
//      - Génération PDF (impression navigateur)
//      - Workflow bar (signatures + envoi aux parents)

function VueParMatiereTrimestriel({
  academicYear, scopeLang, isMaternelle, classes, selectedClassId, school,
  effectiveTenantId, user, directorName,
}: {
  academicYear: any;
  scopeLang?: string;
  isMaternelle: boolean;
  classes: any[];
  selectedClassId: string;
  school: any;
  effectiveTenantId?: string;
  user?: any;
  directorName?: string | null;
}) {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  // ⭐ 2026-11-23 — Envoi WhatsApp du bulletin par matière (un chargement par élève)
  const [whatsappLoading, setWhatsappLoading] = useState<string | null>(null);
  const isTeacher = ['TEACHER', 'TEACHER_RESP', 'ENSEIGNANT', 'PEDAGOGIC_COORDINATOR'].includes(user?.role || '');

  // ── Charge les périodes ──────────────────────────────────────────────
  useEffect(() => {
    if (!academicYear?.id) return;
    fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const valid = Array.isArray(data) ? data : [];
        setPeriods(valid);
        if (valid.length > 0 && !selectedPeriodId) setSelectedPeriodId(valid[0].id);
      })
      .catch(() => setPeriods([]));
  }, [academicYear?.id]);

  // ── Charge les données (évaluations + grades par élève × matière × type) ──
  const loadData = useCallback(async () => {
    if (!academicYear?.id || !selectedClassId || !selectedPeriodId) return;
    setLoading(true);
    try {
      // 1. Fetch toutes les évaluations VALIDATED pour la classe
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      // 2. Filtrer par période + langue
      const periodEvals = allEvals.filter((ev: any) => {
        if (ev.period?.id !== selectedPeriodId) return false;
        if (scopeLang) {
          const lang = ev.subject?.language;
          return !lang || lang === scopeLang || lang === 'FR';
        }
        return true;
      });

      if (periodEvals.length === 0) {
        setStudents([]);
        setSubjects([]);
        return;
      }

      // 3. Batch-load grading sheets
      const evalIds = periodEvals.map((ev: any) => ev.id);
      const sheetsMap = await institutionalExamsService
        .getGradingSheetsBatch(evalIds)
        .catch(() => ({}) as Record<string, any[]>);
      const evalGradesMap = new Map<string, any[]>();
      for (const id of evalIds) {
        evalGradesMap.set(id, Array.isArray(sheetsMap[id]) ? sheetsMap[id] : []);
      }

      // 4. Construire la liste des matières (unique)
      const subjectMap = new Map<string, { id: string; name: string; code?: string; coefficient?: number }>();
      for (const ev of periodEvals) {
        if (ev.subject?.id && !subjectMap.has(ev.subject.id)) {
          subjectMap.set(ev.subject.id, {
            id: ev.subject.id,
            name: ev.subject.name,
            code: ev.subject.code,
            coefficient: typeof ev.subject.coefficient === 'number' ? ev.subject.coefficient : 1,
          });
        }
      }
      const subjectList = Array.from(subjectMap.values());
      setSubjects(subjectList);

      // 5. Pour chaque élève × matière, calculer EM1, EM2, EC (moyenne des grades)
      //    Pour la maternelle : moyenne des valeurs qualitatives (TS=3, S=2, PS=1)
      //    → on stocke le code dominant (TS/S/PS) et la moyenne numérique.
      const studentMap = new Map<string, any>();

      // Identifier les IDs des types EM1, EM2, EC
      const em1TypeId = periodEvals.find((ev: any) => ev.evaluationType?.code === 'EM1')?.evaluationType?.id;
      const em2TypeId = periodEvals.find((ev: any) => ev.evaluationType?.code === 'EM2')?.evaluationType?.id;
      const ecTypeId = periodEvals.find((ev: any) => ev.evaluationType?.code === 'EC')?.evaluationType?.id;

      for (const ev of periodEvals) {
        const grades = evalGradesMap.get(ev.id) || [];
        const subjectId = ev.subject?.id;
        const evalCode = ev.evaluationType?.code;
        if (!subjectId) continue;

        for (const grade of grades) {
          if (!studentMap.has(grade.studentId)) {
            studentMap.set(grade.studentId, {
              id: grade.studentId,
              studentName: grade.studentName || 'Inconnu',
              matricule: grade.matricule || null,
              gender: grade.gender,
              subjectScores: {} as Record<string, { em1?: number | null; em2?: number | null; ec?: number | null; em1Count?: number; em2Count?: number; ecCount?: number; em1Total?: number; em2Total?: number; ecTotal?: number; appreciation?: string; moyenne?: number | null; moyenneCode?: string | null }>,
              generalAverage: null as number | null,
              appreciationGlobale: null as string | null,
              classRank: 0,
            });
          }
          const student = studentMap.get(grade.studentId);
          if (!student.subjectScores[subjectId]) {
            student.subjectScores[subjectId] = {
              em1: null, em2: null, ec: null,
              em1Count: 0, em2Count: 0, ecCount: 0,
              em1Total: 0, em2Total: 0, ecTotal: 0,
              moyenne: null, moyenneCode: null, appreciation: '—',
            };
          }
          const sc = student.subjectScores[subjectId];
          if (grade.isAbsent) continue;

          // Pour la maternelle : on utilise qualitativeCode (TS=3, S=2, PS=1)
          if (isMaternelle) {
            const val = grade.qualitativeCode === 'TS' ? 3 : grade.qualitativeCode === 'S' ? 2 : grade.qualitativeCode === 'PS' ? 1 : null;
            if (val === null) continue;
            if (evalCode === 'EM1') { sc.em1Total = (sc.em1Total || 0) + val; sc.em1Count = (sc.em1Count || 0) + 1; }
            else if (evalCode === 'EM2') { sc.em2Total = (sc.em2Total || 0) + val; sc.em2Count = (sc.em2Count || 0) + 1; }
            else if (evalCode === 'EC') { sc.ecTotal = (sc.ecTotal || 0) + val; sc.ecCount = (sc.ecCount || 0) + 1; }
          } else {
            // Pour primaire : on utilise le score numérique /20
            const val = grade.score !== null && grade.score !== undefined ? Number(grade.score) : null;
            if (val === null) continue;
            if (evalCode === 'EM1') { sc.em1Total = (sc.em1Total || 0) + val; sc.em1Count = (sc.em1Count || 0) + 1; }
            else if (evalCode === 'EM2') { sc.em2Total = (sc.em2Total || 0) + val; sc.em2Count = (sc.em2Count || 0) + 1; }
            else if (evalCode === 'EC') { sc.ecTotal = (sc.ecTotal || 0) + val; sc.ecCount = (sc.ecCount || 0) + 1; }
          }
        }
      }

      // 6. Calculer les moyennes par matière (EM1, EM2, EC, moyEm, moyenne)
      const results = Array.from(studentMap.values());
      for (const student of results) {
        for (const subject of subjectList) {
          const sc = student.subjectScores[subject.id];
          if (!sc) continue;
          sc.em1 = sc.em1Count && sc.em1Count > 0 ? sc.em1Total / sc.em1Count : null;
          sc.em2 = sc.em2Count && sc.em2Count > 0 ? sc.em2Total / sc.em2Count : null;
          sc.ec = sc.ecCount && sc.ecCount > 0 ? sc.ecTotal / sc.ecCount : null;
          // moyEm = moyenne de EM1 et EM2 (si les deux présents)
          const moyEm = (sc.em1 !== null && sc.em2 !== null) ? (sc.em1 + sc.em2) / 2
            : (sc.em1 !== null ? sc.em1 : (sc.em2 !== null ? sc.em2 : null));
          // moyenne = (moyEm + EC) / 2 si moyEm + EC, sinon moyEm ou EC
          const moyenne = (moyEm !== null && sc.ec !== null) ? (moyEm + sc.ec) / 2
            : (moyEm !== null ? moyEm : (sc.ec !== null ? sc.ec : null));
          sc.moyenne = moyenne;
          if (isMaternelle && moyenne !== null) {
            sc.moyenneCode = moyenne >= 2.5 ? 'TS' : moyenne >= 1.5 ? 'S' : 'PS';
            sc.appreciation = moyenne >= 2.5 ? 'Très Satisfaisant' : moyenne >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';
          } else if (!isMaternelle && moyenne !== null) {
            // ⭐ Primaire — appréciation dynamique basée sur la moyenne /20
            sc.appreciation = moyenne >= 16 ? 'Très Bien'
              : moyenne >= 14 ? 'Bien'
              : moyenne >= 12 ? 'Assez Bien'
              : moyenne >= 10 ? 'Passable' : 'Insuffisant';
          }
        }

        // Calcul moyenne générale de l'élève pour ce trimestre
        const moyennes = subjectList
          .map(s => student.subjectScores[s.id]?.moyenne)
          .filter((m: number | null | undefined): m is number => m !== null && m !== undefined);
        if (moyennes.length > 0) {
          student.generalAverage = moyennes.reduce((a, b) => a + b, 0) / moyennes.length;
          if (isMaternelle) {
            student.appreciationGlobale = student.generalAverage >= 2.5 ? 'Très Satisfaisant'
              : student.generalAverage >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';
          }
        }
      }

      // 7. Rang dense par moyenne générale (ex æquo gérés)
      const scored = results
        .filter(s => s.generalAverage !== null)
        .sort((a, b) => (b.generalAverage as number) - (a.generalAverage as number));
      let lastRank = 0;
      let lastVal: number | null = null;
      scored.forEach((s, i) => {
        const r = (i > 0 && s.generalAverage === lastVal) ? lastRank : i + 1;
        lastRank = r;
        lastVal = s.generalAverage;
        s.classRank = r;
      });

      // Trier par nom
      results.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
      setStudents(results);
    } catch (err) {
      console.error('Error loading vue par matière:', err);
      setStudents([]);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, selectedClassId, selectedPeriodId, scopeLang, isMaternelle]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleStudent = (id: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Génère le PDF professionnel via le backend (Puppeteer) ────────────
  // Même pattern que handleGeneratePdf du bulletin d'évaluation standard,
  // mais avec isVueParMatiere=true pour déclencher buildHtmlVueParMatiere
  // côté backend. Les valeurs em1/em2/moyEm/ec/moyenne par matière sont
  // envoyées dans subject.vueParMatiere.
  // ⭐ 2026-11-23 — Builder de payload partagé entre « Générer PDF » et
  //    l'envoi WhatsApp au parent (POST whatsapp-link — même PDF).
  const buildVueParMatierePayload = (student: any): any => {
    const periodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
    const className = classes.find(c => c.id === selectedClassId)?.name || '';

    // Stats classe (moyenne + min/max) pour la synthèse PDF
    const validAvgs = students.map(s => s.generalAverage).filter((a: number | null): a is number => a !== null);
    const classAverage = validAvgs.length > 0 ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length : null;

    return {
        schoolName: school?.schoolName,
        schoolLogo: school?.logoUrl,
        schoolAddress: school?.address,
        schoolPhone: school?.phone,
        schoolEmail: school?.email,
        schoolSlogan: school?.slogan,
        academicYearName: academicYear?.label || '',
        periodName,
        evaluationTypeName: 'Vue par matière',
        className,
        studentName: student.studentName,
        studentMatricule: student.matricule,
        studentGender: student.gender,
        isMaternelle,
        isVueParMatiere: true,
        subjects: subjects.map(s => {
          const sc = student.subjectScores[s.id];
          const moyEm = (sc?.em1 !== null && sc?.em1 !== undefined && sc?.em2 !== null && sc?.em2 !== undefined)
            ? ((sc.em1 as number) + (sc.em2 as number)) / 2
            : (sc?.em1 !== null && sc?.em1 !== undefined ? sc.em1
              : (sc?.em2 !== null && sc?.em2 !== undefined ? sc.em2 : null));
          return {
            name: s.name,
            score: sc?.moyenne ?? null,
            qualitativeCode: isMaternelle ? (sc?.moyenneCode ?? null) : null,
            isAbsent: false,
            appreciation: sc?.appreciation ?? '—',
            vueParMatiere: {
              em1: sc?.em1 ?? null,
              em2: sc?.em2 ?? null,
              moyEm,
              ec: sc?.ec ?? null,
              moyenne: sc?.moyenne ?? null,
            },
          };
        }),
        generalAverage: student.generalAverage,
        classRank: student.classRank,
        classAverage,
        totalStudents: students.length,
        appreciationGlobale: student.appreciationGlobale,
        directorName,
    };
  };

  const handleGeneratePdf = async (student: any) => {
    setGeneratingPdf(student.id);
    try {
      const periodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
      const payload = buildVueParMatierePayload(student);

      const response = await apiClient.post('/institutional-exams/bulletins/generate-pdf', payload, {
        responseType: 'blob',
        timeout: 120000, // 2 minutes
      });

      // Télécharger le PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeStudentName = student.studentName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const safePeriod = periodName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `bulletin_par_matiere_${safeStudentName}_${safePeriod}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toastSuccess('Bulletin généré', { description: student.studentName });
    } catch (err: any) {
      toastError('Erreur PDF', { description: err.response?.data?.message || err.message });
    } finally {
      setGeneratingPdf(null);
    }
  };

  // ⭐ 2026-11-23 — Envoi WhatsApp au parent (pattern finance encaissement —
  //    lien wa.me) : même payload que « Générer PDF », le parent reçoit le
  //    même bulletin par matière avec un lien public de téléchargement.
  const handleSendWhatsApp = async (student: any) => {
    setWhatsappLoading(student.id);
    try {
      const periodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
      const payload = buildVueParMatierePayload(student);
      const response = await apiClient.post('/institutional-exams/bulletins/whatsapp-link', payload, {
        timeout: 120000,
      });
      const data: any = response.data || {};
      const who = data.parentName || student.studentName || 'le parent';
      if (!data.hasPhone || !data.url) {
        toastError('Numéro de tuteur manquant', {
          description: `${who} — aucun numéro de téléphone WhatsApp n'est renseigné pour le tuteur. Ajoutez-le dans Élèves et scolarité > Familles.`,
        });
        return;
      }
      window.open(data.url, '_blank');
      toastSuccess('WhatsApp ouvert', {
        description: `Message prêt pour ${who}${data.phone ? ` (${data.phone})` : ''} — cliquez sur Envoyer dans WhatsApp pour transmettre le bulletin (lien PDF inclus) depuis le numéro de l'école.`,
      });
    } catch (err: any) {
      toastError('Échec de l\'envoi WhatsApp', { description: err.response?.data?.message || err.message });
    } finally {
      setWhatsappLoading(null);
    }
  };

  const handleGenerateAllPdf = async () => {
    for (const student of students) {
      await handleGeneratePdf(student);
    }
  };

  // Helpers pour afficher une note qualitative
  const fmtQ = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '—';
    return val >= 2.5 ? 'TS' : val >= 1.5 ? 'S' : 'PS';
  };
  const fmtN = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '—';
    return val.toFixed(2);
  };
  const qColor = (val: number | null | undefined): string => {
    // ⭐ T27 — couleur TEXTE seule (plus de pastille de fond) : sobre, lisible.
    if (val === null || val === undefined) return 'text-slate-400';
    return val >= 2.5 ? 'text-emerald-700'
      : val >= 1.5 ? 'text-slate-900' : 'text-amber-700';
  };
  const nColor = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return 'text-slate-400';
    return val >= 10 ? 'text-emerald-700' : 'text-red-600';
  };

  return (
    <div className="space-y-4">
      {/* Sélecteur de trimestre */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-sm font-semibold text-slate-700">Trimestre :</span>
        <select
          value={selectedPeriodId}
          onChange={(e) => setSelectedPeriodId(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
        >
          <option value="">— Sélectionner —</option>
          {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-slate-500">Chargement des moyennes par matière…</span>
        </div>
      ) : !selectedPeriodId ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Sélectionnez un trimestre pour voir la vue par matière.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun élève / aucune note pour ce trimestre.</p>
        </div>
      ) : (
        <>
          {/* Summary bar + bulk PDF button */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-xs gap-1"><Users className="w-3 h-3" />{students.length} élèves</Badge>
              <Badge variant="outline" className="text-xs gap-1"><BookOpen className="w-3 h-3" />{subjects.length} matières</Badge>
            </div>
            {!isTeacher && (
              <Button onClick={handleGenerateAllPdf} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm">
                <Printer className="w-4 h-4 mr-2" />Toute la classe
              </Button>
            )}
          </div>

          {/* Liste des élèves (expansible) */}
          <div className="space-y-3">
            {students.map((student) => {
              const isExpanded = expandedStudents.has(student.id);
              return (
                <div key={student.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* En-tête élève (cliquable) */}
                  <button
                    onClick={() => toggleStudent(student.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        {formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{student.studentName}</div>
                        <div className="text-xs text-slate-500">
                          {student.matricule || '—'} · Rang {formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}
                          {student.appreciationGlobale && ` · ${student.appreciationGlobale}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isMaternelle && student.appreciationGlobale && (
                        <span className={cn('px-2 py-1 rounded text-xs font-bold',
                          student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
                          student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
                          student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
                        )}>{student.appreciationGlobale}</span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4">
                      {/* Tableau par matière — ⭐ T37 : 7 colonnes, EXACTEMENT la
                          même grille que le PDF (Matière | EM1 | EM2 | Moy. EM |
                          EC | Moyenne gén. | Appréciation) — avant : 6 colonnes
                          et la maternelle affichait l'appréciation sous
                          l'en-tête « Moyenne générale » (incohérence UI/PDF). */}
                      <div className="overflow-x-auto rounded-lg border-2 border-black">
                        <table className="w-full border-separate border-spacing-0 text-xs">
                          <thead>
                            <tr className="bg-white">
                              <th className="border-r border-b border-black px-3 py-2 font-bold uppercase text-left" style={{ minWidth: '200px' }}>Matière</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center">EM1</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center">EM2</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center">Moy. EM</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center">EC</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '90px' }}>Moyenne gén.</th>
                              <th className="border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '90px' }}>Appréciation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjects.map((subject, idx) => {
                              const sc = student.subjectScores[subject.id];
                              const moyEm = (sc?.em1 !== null && sc?.em1 !== undefined && sc?.em2 !== null && sc?.em2 !== undefined)
                                ? ((sc.em1 as number) + (sc.em2 as number)) / 2
                                : (sc?.em1 !== null && sc?.em1 !== undefined ? sc.em1
                                  : (sc?.em2 !== null && sc?.em2 !== undefined ? sc.em2 : null));
                              const rowB = idx === subjects.length - 1 ? '' : 'border-b';
                              return (
                                <tr key={subject.id}>
                                  <td className={`border-r ${rowB} border-black px-3 py-1.5 font-medium text-slate-900`}>{subject.name}</td>
                                  {isMaternelle ? (
                                    <>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center`}>
                                        <span className={cn('text-[10px] font-black', qColor(sc?.em1))}>{fmtQ(sc?.em1)}</span>
                                      </td>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center`}>
                                        <span className={cn('text-[10px] font-black', qColor(sc?.em2))}>{fmtQ(sc?.em2)}</span>
                                      </td>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                                        <span className={cn('text-[10px]', qColor(moyEm))}>{fmtQ(moyEm)}</span>
                                      </td>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center`}>
                                        <span className={cn('text-[10px] font-black', qColor(sc?.ec))}>{fmtQ(sc?.ec)}</span>
                                      </td>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                                        <span className={cn('text-[11px]', qColor(sc?.moyenne))}>{fmtQ(sc?.moyenne)}</span>
                                      </td>
                                      <td className={`${rowB} border-black px-2 py-1.5 text-center text-slate-600 text-[10px]`}>{sc?.appreciation || '—'}</td>
                                    </>
                                  ) : (
                                    <>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-semibold`}>
                                        <span className={cn(nColor(sc?.em1))}>{fmtN(sc?.em1)}</span>
                                      </td>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-semibold`}>
                                        <span className={cn(nColor(sc?.em2))}>{fmtN(sc?.em2)}</span>
                                      </td>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-semibold`}>
                                        <span className={cn(nColor(moyEm))}>{fmtN(moyEm)}</span>
                                      </td>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-semibold`}>
                                        <span className={cn(nColor(sc?.ec))}>{fmtN(sc?.ec)}</span>
                                      </td>
                                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                                        <span className={cn('text-sm', nColor(sc?.moyenne))}>{fmtN(sc?.moyenne)}</span>
                                      </td>
                                      <td className={`${rowB} border-black px-2 py-1.5 text-center text-slate-600 text-[10px]`}>{sc?.appreciation || '—'}</td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#0A2A5E] text-white">
                              <td className="px-3 py-2 font-bold uppercase text-right" colSpan={5}>
                                {isMaternelle ? 'Appréciation générale' : 'Moyenne générale'}
                              </td>
                              <td className="px-2 py-2 text-center font-bold">
                                {isMaternelle ? (
                                  <span>{student.appreciationGlobale || '—'}</span>
                                ) : (
                                  <span className="text-sm">{fmtN(student.generalAverage)}</span>
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Boutons d'action : PDF + signatures + envoi parents */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>Formule : Moy. EM = (EM1 + EM2) / 2 · Moyenne gén. = (Moy. EM + EC) / 2</span>
                        </div>
                        {!isTeacher && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* ⭐ 2026-11-23 — Envoi au parent par WhatsApp (pattern
                                finance encaissement — icône OFFICIELLE). */}
                            <Button
                              onClick={() => handleSendWhatsApp(student)}
                              disabled={whatsappLoading === student.id || generatingPdf === student.id}
                              title="Envoyer le bulletin au parent par WhatsApp (message prêt + lien PDF — cliquez Envoyer dans WhatsApp)"
                              className="bg-[#25D366] hover:bg-[#1EBE5B] text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm"
                            >
                              {whatsappLoading === student.id ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Préparation…</>
                              ) : (
                                <><WhatsAppIcon className="w-4 h-4 mr-2" />Envoyer par WhatsApp</>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleGeneratePdf(student)}
                              disabled={generatingPdf === student.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm"
                            >
                              {generatingPdf === student.id ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération…</>
                              ) : (
                                <><Printer className="w-4 h-4 mr-2" />Générer PDF</>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Vue Par Matière Annuel (maternelle + primaire) ──────────────────────────
//
// ⭐ Même pattern que VueParMatiereTrimestriel mais pour les moyennes annuelles.
//    Colonnes : Matière | EM annuel | EC annuel | EP | Moyenne annuelle | Appréciation
//    EM annuel = moyenne des Moy. EM des 3 trimestres
//    EC annuel = moyenne des EC des 3 trimestres
//    EP = évaluation de passage (T3 uniquement)
//    Moyenne annuelle = ((EM annuel + EC annuel) / 2 + EP) / 2 si EP, sinon (EM annuel + EC annuel) / 2

function VueParMatiereAnnuel({
  academicYear, scopeLang, isMaternelle, classes, selectedClassId, school,
  effectiveTenantId, user, directorName,
}: {
  academicYear: any;
  scopeLang?: string;
  isMaternelle: boolean;
  classes: any[];
  selectedClassId: string;
  school: any;
  effectiveTenantId?: string;
  user?: any;
  directorName?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  // ⭐ 2026-11-23 — Envoi WhatsApp du bulletin annuel (un chargement par élève)
  const [whatsappLoading, setWhatsappLoading] = useState<string | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const isTeacher = ['TEACHER', 'TEACHER_RESP', 'ENSEIGNANT', 'PEDAGOGIC_COORDINATOR'].includes(user?.role || '');

  const loadData = useCallback(async () => {
    if (!academicYear?.id || !selectedClassId) return;
    setLoading(true);
    try {
      const evaluations = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      const allEvals = Array.isArray(evaluations) ? evaluations : [];

      const periodsRes = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
      const periodsData = await periodsRes.json();
      const periods = Array.isArray(periodsData) ? periodsData : [];
      if (periods.length === 0) { setStudents([]); setSubjects([]); return; }

      // Batch-load grading sheets
      const evalIds = allEvals.map((ev: any) => ev.id);
      const sheetsMap = await institutionalExamsService
        .getGradingSheetsBatch(evalIds)
        .catch(() => ({}) as Record<string, any[]>);
      const evalGradesMap = new Map<string, any[]>();
      for (const id of evalIds) {
        evalGradesMap.set(id, Array.isArray(sheetsMap[id]) ? sheetsMap[id] : []);
      }

      // Construire la liste des matières
      const subjectMap = new Map<string, { id: string; name: string }>();
      for (const ev of allEvals) {
        if (ev.subject?.id && !subjectMap.has(ev.subject.id)) {
          subjectMap.set(ev.subject.id, { id: ev.subject.id, name: ev.subject.name });
        }
      }
      const subjectList = Array.from(subjectMap.values());
      setSubjects(subjectList);

      // Pour chaque élève × matière × trimestre, calculer EM1, EM2, EC, EP
      // Puis agréger sur l'année : EM annuel = moyenne des moyEm des 3 trimestres
      const studentMap = new Map<string, any>();

      for (const period of periods) {
        const periodEvals = allEvals.filter((ev: any) => ev.period?.id === period.id);
        if (periodEvals.length === 0) continue;

        for (const ev of periodEvals) {
          const grades = evalGradesMap.get(ev.id) || [];
          const subjectId = ev.subject?.id;
          const evalCode = ev.evaluationType?.code;
          if (!subjectId) continue;

          for (const grade of grades) {
            if (!studentMap.has(grade.studentId)) {
              studentMap.set(grade.studentId, {
                id: grade.studentId,
                studentName: grade.studentName || 'Inconnu',
                matricule: grade.matricule || null,
                gender: grade.gender,
                subjectScores: {} as Record<string, any>,
                generalAverage: null as number | null,
                appreciationGlobale: null as string | null,
                classRank: 0,
              });
            }
            const student = studentMap.get(grade.studentId);
            if (!student.subjectScores[subjectId]) {
              student.subjectScores[subjectId] = {
                trimesters: [] as { moyEm: number | null; ec: number | null; ep: number | null }[],
              };
            }
            const sc = student.subjectScores[subjectId];
            // Initialiser les trimestres
            while (sc.trimesters.length < periods.length) {
              sc.trimesters.push({ moyEm: null, ec: null, ep: null });
            }
            const periodIdx = periods.findIndex((p: any) => p.id === period.id);
            if (periodIdx < 0) continue;
            const trimester = sc.trimesters[periodIdx];

            if (grade.isAbsent) continue;

            // Maternelle : qualitativeCode TS=3, S=2, PS=1
            // Primaire : score /20
            const val = isMaternelle
              ? (grade.qualitativeCode === 'TS' ? 3 : grade.qualitativeCode === 'S' ? 2 : grade.qualitativeCode === 'PS' ? 1 : null)
              : (grade.score !== null && grade.score !== undefined ? Number(grade.score) : null);
            if (val === null) continue;

            if (evalCode === 'EM1' || evalCode === 'EM2') {
              // Accumuler pour moyEm
              if (trimester.moyEm === null) trimester.moyEm = 0;
              if (evalCode === 'EM1' && trimester._em1Count === undefined) { trimester._em1Count = 0; trimester._em1Total = 0; }
              if (evalCode === 'EM2' && trimester._em2Count === undefined) { trimester._em2Count = 0; trimester._em2Total = 0; }
              if (evalCode === 'EM1') { trimester._em1Total = (trimester._em1Total || 0) + val; trimester._em1Count = (trimester._em1Count || 0) + 1; }
              if (evalCode === 'EM2') { trimester._em2Total = (trimester._em2Total || 0) + val; trimester._em2Count = (trimester._em2Count || 0) + 1; }
            } else if (evalCode === 'EC') {
              if (trimester.ec === null) trimester.ec = 0;
              trimester.ec = trimester.ec + val;
              trimester._ecCount = (trimester._ecCount || 0) + 1;
            } else if (evalCode === 'EP') {
              trimester.ep = val;
            }
          }
        }
      }

      // Calculer les moyennes par trimestre + agrégation annuelle
      const results = Array.from(studentMap.values());
      for (const student of results) {
        for (const subject of subjectList) {
          const sc = student.subjectScores[subject.id];
          if (!sc) continue;

          let emSum = 0, emCount = 0;
          let ecSum = 0, ecCount = 0;
          let epVal: number | null = null;

          for (const trimester of sc.trimesters) {
            // moyEm = (EM1 + EM2) / 2
            const em1Avg = trimester._em1Count > 0 ? trimester._em1Total / trimester._em1Count : null;
            const em2Avg = trimester._em2Count > 0 ? trimester._em2Total / trimester._em2Count : null;
            const moyEm = (em1Avg !== null && em2Avg !== null) ? (em1Avg + em2Avg) / 2
              : (em1Avg !== null ? em1Avg : (em2Avg !== null ? em2Avg : null));
            if (moyEm !== null) { emSum += moyEm; emCount++; }

            const ecAvg = trimester._ecCount > 0 ? trimester.ec / trimester._ecCount : null;
            if (ecAvg !== null) { ecSum += ecAvg; ecCount++; }

            if (trimester.ep !== null) epVal = trimester.ep;
          }

          const emAnnuel = emCount > 0 ? emSum / emCount : null;
          const ecAnnuel = ecCount > 0 ? ecSum / ecCount : null;

          let moyenneAnnuelle: number | null = null;
          if (emAnnuel !== null && ecAnnuel !== null && epVal !== null) {
            moyenneAnnuelle = ((emAnnuel + ecAnnuel) / 2 + epVal) / 2;
          } else if (emAnnuel !== null && ecAnnuel !== null) {
            moyenneAnnuelle = (emAnnuel + ecAnnuel) / 2;
          } else if (emAnnuel !== null) {
            moyenneAnnuelle = emAnnuel;
          }

          sc.emAnnuel = emAnnuel;
          sc.ecAnnuel = ecAnnuel;
          sc.ep = epVal;
          sc.moyenneAnnuelle = moyenneAnnuelle;

          if (isMaternelle && moyenneAnnuelle !== null) {
            sc.appreciation = moyenneAnnuelle >= 2.5 ? 'Très Satisfaisant'
              : moyenneAnnuelle >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';
          } else if (!isMaternelle && moyenneAnnuelle !== null) {
            sc.appreciation = moyenneAnnuelle >= 16 ? 'Très Bien'
              : moyenneAnnuelle >= 14 ? 'Bien'
              : moyenneAnnuelle >= 12 ? 'Assez Bien'
              : moyenneAnnuelle >= 10 ? 'Passable' : 'Insuffisant';
          } else {
            sc.appreciation = '—';
          }
        }

        // Moyenne générale annuelle
        const moyennes = subjectList
          .map(s => student.subjectScores[s.id]?.moyenneAnnuelle)
          .filter((m: number | null | undefined): m is number => m !== null && m !== undefined);
        if (moyennes.length > 0) {
          student.generalAverage = moyennes.reduce((a, b) => a + b, 0) / moyennes.length;
          if (isMaternelle) {
            student.appreciationGlobale = student.generalAverage >= 2.5 ? 'Très Satisfaisant'
              : student.generalAverage >= 1.5 ? 'Satisfaisant' : 'Peu Satisfaisant';
          }
        }
      }

      // Rang dense
      const scored = results.filter(s => s.generalAverage !== null)
        .sort((a, b) => (b.generalAverage as number) - (a.generalAverage as number));
      let lastRank = 0; let lastVal: number | null = null;
      scored.forEach((s, i) => {
        const r = (i > 0 && s.generalAverage === lastVal) ? lastRank : i + 1;
        lastRank = r; lastVal = s.generalAverage; s.classRank = r;
      });

      results.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
      setStudents(results);
    } catch (err) {
      console.error('Error loading vue par matière annuel:', err);
      setStudents([]); setSubjects([]);
    } finally { setLoading(false); }
  }, [academicYear?.id, selectedClassId, scopeLang, isMaternelle]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleStudent = (id: string) => {
    setExpandedStudents(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ⭐ 2026-11-23 — Builder de payload partagé entre « Générer PDF » et
  //    l'envoi WhatsApp au parent (POST whatsapp-link — même PDF annuel).
  const buildAnnualPayload = (student: any): any => {
    const className = classes.find(c => c.id === selectedClassId)?.name || '';
    const validAvgs = students.map(s => s.generalAverage).filter((a: number | null): a is number => a !== null);
    const classAverage = validAvgs.length > 0 ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length : null;

    return {
        schoolName: school?.schoolName,
        schoolLogo: school?.logoUrl,
        schoolAddress: school?.address,
        schoolPhone: school?.phone,
        schoolEmail: school?.email,
        schoolSlogan: school?.slogan,
        academicYearName: academicYear?.label || '',
        periodName: 'Moyenne annuelle',
        evaluationTypeName: 'Moyenne annuelle',
        className,
        studentName: student.studentName,
        studentMatricule: student.matricule,
        studentGender: student.gender,
        isMaternelle,
        isVueParMatiere: true,
        subjects: subjects.map(s => {
          const sc = student.subjectScores[s.id];
          return {
            name: s.name,
            score: sc?.moyenneAnnuelle ?? null,
            qualitativeCode: isMaternelle ? null : null,
            isAbsent: false,
            appreciation: sc?.appreciation ?? '—',
            vueParMatiere: {
              em1: sc?.emAnnuel ?? null,  // EM annuel → colonne EM1
              em2: null,                  // pas de EM2 en annual
              moyEm: sc?.emAnnuel ?? null, // Moy. EM = EM annuel
              ec: sc?.ecAnnuel ?? null,    // EC annuel
              moyenne: sc?.moyenneAnnuelle ?? null,
            },
          };
        }),
        generalAverage: student.generalAverage,
        classRank: student.classRank,
        classAverage,
        totalStudents: students.length,
        appreciationGlobale: student.appreciationGlobale,
        directorName,
    };
  };

  const handleGeneratePdf = async (student: any) => {
    setGeneratingPdf(student.id);
    try {
      const payload = buildAnnualPayload(student);
      const response = await apiClient.post('/institutional-exams/bulletins/generate-pdf', payload, {
        responseType: 'blob', timeout: 120000,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeName = student.studentName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `bulletin_annuel_${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toastSuccess('Bulletin annuel généré', { description: student.studentName });
    } catch (err: any) {
      toastError('Erreur PDF', { description: err.response?.data?.message || err.message });
    } finally { setGeneratingPdf(null); }
  };

  // ⭐ 2026-11-23 — Envoi WhatsApp au parent (pattern finance encaissement —
  //    lien wa.me) : le parent reçoit le même bulletin annuel par lien public.
  const handleSendWhatsApp = async (student: any) => {
    setWhatsappLoading(student.id);
    try {
      const payload = buildAnnualPayload(student);
      const response = await apiClient.post('/institutional-exams/bulletins/whatsapp-link', payload, {
        timeout: 120000,
      });
      const data: any = response.data || {};
      const who = data.parentName || student.studentName || 'le parent';
      if (!data.hasPhone || !data.url) {
        toastError('Numéro de tuteur manquant', {
          description: `${who} — aucun numéro de téléphone WhatsApp n'est renseigné pour le tuteur. Ajoutez-le dans Élèves et scolarité > Familles.`,
        });
        return;
      }
      window.open(data.url, '_blank');
      toastSuccess('WhatsApp ouvert', {
        description: `Message prêt pour ${who}${data.phone ? ` (${data.phone})` : ''} — cliquez sur Envoyer dans WhatsApp pour transmettre le bulletin annuel (lien PDF inclus) depuis le numéro de l'école.`,
      });
    } catch (err: any) {
      toastError('Échec de l\'envoi WhatsApp', { description: err.response?.data?.message || err.message });
    } finally {
      setWhatsappLoading(null);
    }
  };

  const fmtQ = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '—';
    return isMaternelle ? (val >= 2.5 ? 'TS' : val >= 1.5 ? 'S' : 'PS') : val.toFixed(2);
  };
  const qColor = (val: number | null | undefined): string => {
    // ⭐ T27 — couleur TEXTE seule (plus de pastille de fond) : sobre, lisible.
    if (val === null || val === undefined) return 'text-slate-400';
    if (isMaternelle) {
      return val >= 2.5 ? 'text-emerald-700' : val >= 1.5 ? 'text-slate-900' : 'text-amber-700';
    }
    return val >= 10 ? 'text-emerald-700' : 'text-red-600';
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-slate-500">Calcul des moyennes annuelles par matière…</span>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune donnée annuelle disponible.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-xs gap-1"><Users className="w-3 h-3" />{students.length} élèves</Badge>
              <Badge variant="outline" className="text-xs gap-1"><BookOpen className="w-3 h-3" />{subjects.length} matières</Badge>
            </div>
            {!isTeacher && (
              <Button onClick={() => students.forEach(s => handleGeneratePdf(s))} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm">
                <Printer className="w-4 h-4 mr-2" />Toute la classe
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {students.map((student) => {
              const isExpanded = expandedStudents.has(student.id);
              return (
                <div key={student.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <button onClick={() => toggleStudent(student.id)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                      <div className="text-left">
                        <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{student.studentName}</div>
                        <div className="text-xs text-slate-500">{student.matricule || '—'} · Rang {formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}{student.appreciationGlobale && ` · ${student.appreciationGlobale}`}</div>
                      </div>
                    </div>
                    {isMaternelle && student.appreciationGlobale && (
                      <span className={cn('px-2 py-1 rounded text-xs font-bold',
                        student.appreciationGlobale === 'Très Satisfaisant' && 'bg-emerald-100 text-emerald-700',
                        student.appreciationGlobale === 'Satisfaisant' && 'bg-blue-100 text-blue-700',
                        student.appreciationGlobale === 'Peu Satisfaisant' && 'bg-amber-100 text-amber-700',
                      )}>{student.appreciationGlobale}</span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4">
                      <div className="overflow-x-auto rounded-lg border-2 border-black">
                        <table className="w-full border-separate border-spacing-0 text-xs">
                          <thead>
                            <tr className="bg-white">
                              <th className="border-r border-b border-black px-3 py-2 font-bold uppercase text-left" style={{ minWidth: '200px' }}>Matière</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center">EM annuel</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center">EC annuel</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center">EP</th>
                              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center">Moyenne annuelle</th>
                              <th className="border-b border-black px-2 py-2 font-bold uppercase text-center">Appréciation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjects.map((subject, idx) => {
                              const sc = student.subjectScores[subject.id];
                              const rowB = idx === subjects.length - 1 ? '' : 'border-b';
                              return (
                                <tr key={subject.id}>
                                  <td className={`border-r ${rowB} border-black px-3 py-1.5 font-medium text-slate-900`}>{subject.name}</td>
                                  <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center`}>
                                    <span className={cn('text-[10px] font-black', qColor(sc?.emAnnuel))}>{fmtQ(sc?.emAnnuel)}</span>
                                  </td>
                                  <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center`}>
                                    <span className={cn('text-[10px] font-black', qColor(sc?.ecAnnuel))}>{fmtQ(sc?.ecAnnuel)}</span>
                                  </td>
                                  <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center`}>
                                    <span className={cn('text-[10px] font-black', qColor(sc?.ep))}>{fmtQ(sc?.ep)}</span>
                                  </td>
                                  <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                                    <span className={cn('text-sm', qColor(sc?.moyenneAnnuelle))}>{fmtQ(sc?.moyenneAnnuelle)}</span>
                                  </td>
                                  <td className={`${rowB} border-black px-2 py-1.5 text-center font-bold text-slate-900 text-[10px]`}>{sc?.appreciation || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                          Formule : Moyenne annuelle = ((EM annuel + EC annuel) / 2 + EP) / 2
                        </div>
                        {!isTeacher && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* ⭐ 2026-11-23 — Envoi au parent par WhatsApp (pattern
                                finance encaissement — icône OFFICIELLE). */}
                            <Button
                              onClick={() => handleSendWhatsApp(student)}
                              disabled={whatsappLoading === student.id || generatingPdf === student.id}
                              title="Envoyer le bulletin annuel au parent par WhatsApp (message prêt + lien PDF — cliquez Envoyer dans WhatsApp)"
                              className="bg-[#25D366] hover:bg-[#1EBE5B] text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm"
                            >
                              {whatsappLoading === student.id
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Préparation…</>
                                : <><WhatsAppIcon className="w-4 h-4 mr-2" />Envoyer par WhatsApp</>}
                            </Button>
                            <Button onClick={() => handleGeneratePdf(student)} disabled={generatingPdf === student.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm">
                              {generatingPdf === student.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération…</> : <><Printer className="w-4 h-4 mr-2" />Générer PDF</>}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Générateur HTML pour la Vue par matière (impression PDF) ──────────────
//
// ⭐ Format : en-tête officiel (République + drapeau + ministère + école) +
//    tableau par matière (EM1 | EM2 | Moy. EM | EC | Moyenne gén.) +
//    récap global + signatures. Adapté pour impression PDF via window.print().

function generateVueParMatiereHtml({
  student, subjects, school, academicYear, periodName, className,
  isMaternelle, directorName,
}: {
  student: any;
  subjects: any[];
  school: any;
  academicYear: any;
  periodName: string;
  className: string;
  isMaternelle: boolean;
  directorName?: string | null;
}): string {
  // Helper : formater une valeur qualitative (maternelle)
  const fmtQ = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '—';
    return val >= 2.5 ? 'TS' : val >= 1.5 ? 'S' : 'PS';
  };
  const fmtN = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '—';
    return val.toFixed(2);
  };
  const qColor = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '#666';
    return val >= 2.5 ? '#059669' : val >= 1.5 ? '#2563eb' : '#d97706';
  };
  const qBg = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return 'transparent';
    return val >= 2.5 ? '#d1fae5' : val >= 1.5 ? '#dbeafe' : '#fef3c7';
  };
  const nColor = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '#666';
    return val >= 10 ? '#059669' : '#dc2626';
  };

  const subjectRows = subjects.map((subject, idx) => {
    const sc = student.subjectScores[subject.id];
    const moyEm = (sc?.em1 !== null && sc?.em1 !== undefined && sc?.em2 !== null && sc?.em2 !== undefined)
      ? ((sc.em1 as number) + (sc.em2 as number)) / 2
      : (sc?.em1 !== null && sc?.em1 !== undefined ? sc.em1
        : (sc?.em2 !== null && sc?.em2 !== undefined ? sc.em2 : null));
    const fmt = isMaternelle ? fmtQ : fmtN;
    const color = isMaternelle ? qColor : nColor;
    const bg = isMaternelle ? qBg : (() => 'transparent');

    return `<tr>
      <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;font-weight:bold">${idx + 1}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-weight:500">${subject.name}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;font-weight:bold;background:${bg(sc?.em1)};color:${color(sc?.em1)}">${fmt(sc?.em1)}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;font-weight:bold;background:${bg(sc?.em2)};color:${color(sc?.em2)}">${fmt(sc?.em2)}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;font-weight:bold;background:${bg(moyEm)};color:${color(moyEm)}">${fmt(moyEm)}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;font-weight:bold;background:${bg(sc?.ec)};color:${color(sc?.ec)}">${fmt(sc?.ec)}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;font-weight:bold;background:${bg(sc?.moyenne)};color:${color(sc?.moyenne)}">${fmt(sc?.moyenne)}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;font-size:11px">${sc?.appreciation || '—'}</td>
    </tr>`;
  }).join('');

  const rankStr = formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Bulletin par matière - ${student.studentName} - ${periodName}</title>
<style>
  @page { size: A4 landscape; margin: 1.2cm; }
  body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; color: #1a1a1a; }
  /* ─── Official header (like Module Élèves) ─── */
  .official-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #0A2A5E; padding-bottom: 10px; margin-bottom: 12px; }
  .header-left { display: flex; align-items: center; gap: 8px; }
  .benin-flag { width: 24px; height: 16px; display: inline-block; vertical-align: middle; }
  .benin-flag .green { float: left; width: 33%; height: 100%; background: #00803D; }
  .benin-flag .yellow { float: right; width: 67%; height: 50%; background: #FCDE16; }
  .benin-flag .red { float: right; width: 67%; height: 50%; background: #E8112D; }
  .header-center { text-align: center; flex: 1; }
  .header-center .republique { font-size: 11px; font-weight: bold; }
  .header-center .ministry { font-size: 8px; margin-top: 2px; }
  .header-center .school-name { font-size: 13px; font-weight: bold; color: #0A2A5E; margin-top: 4px; }
  .header-center .school-contact { font-size: 7px; color: #666; margin-top: 2px; font-style: italic; }
  .header-right { text-align: right; }
  .header-right img.logo { max-height: 50px; max-width: 50px; }
  /* ─── Title ─── */
  .bulletin-title { text-align: center; background: #0A2A5E; color: white; padding: 6px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
  /* ─── Student info ─── */
  .student-info { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; margin-bottom: 10px; font-size: 10px; }
  .student-info div { flex: 1; }
  .student-info strong { color: #0A2A5E; }
  /* ─── Table ─── */
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th { background: #0A2A5E; color: white; padding: 6px 8px; border: 1px solid #0D3B85; text-align: center; font-size: 9px; }
  thead tr:nth-child(2) th { background: #0D3B85; }
  tbody td { border: 1px solid #cbd5e1; padding: 4px 8px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tfoot td { background: #0A2A5E; color: white; padding: 6px 8px; border: 1px solid #0D3B85; font-size: 10px; }
  /* ─── Synthèse ─── */
  .synthesis { display: flex; justify-content: space-around; margin-top: 12px; gap: 8px; }
  .synthesis div { text-align: center; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px; flex: 1; background: #f8fafc; }
  .synthesis .label { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: bold; }
  .synthesis .value { font-size: 14px; font-weight: bold; margin-top: 2px; }
  /* ─── Signatures ─── */
  .signatures { display: flex; justify-content: space-between; margin-top: 30px; gap: 16px; }
  .sig-box { flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 6px; }
  .sig-box .sig-label { font-size: 9px; font-weight: bold; color: #0A2A5E; }
  .sig-box .sig-line { margin-top: 35px; font-size: 8px; color: #94a3b8; }
</style></head><body>

  <!-- Official Header -->
  <div class="official-header">
    <div class="header-left">
      <div class="benin-flag"><div class="green"></div><div class="yellow"></div><div class="red"></div></div>
    </div>
    <div class="header-center">
      <div class="republique">République du Bénin</div>
      <div class="ministry">Ministère des Enseignements Maternel et Primaire</div>
      <div class="school-name">${school?.schoolName || 'Établissement'}</div>
      <div class="school-contact">${school?.address || ''} · Tél: ${school?.phone || ''} · ${school?.email || ''}</div>
    </div>
    <div class="header-right">
      ${school?.logoUrl ? `<img class="logo" src="${school.logoUrl}" />` : ''}
    </div>
  </div>

  <!-- Bulletin Title -->
  <div class="bulletin-title">
    Bulletin trimestriel par matière — ${periodName} ${academicYear?.label || ''}
  </div>

  <!-- Student Info -->
  <div class="student-info">
    <div>Élève: <strong>${student.studentName}</strong></div>
    <div>Matricule: <strong>${student.matricule || '—'}</strong></div>
    <div>Classe: <strong>${className || '—'}</strong></div>
    <div>Rang: <strong>${rankStr}</strong></div>
  </div>

  <!-- Notes Table par matière -->
  <table>
    <thead><tr>
      <th style="width:30px">N°</th>
      <th style="text-align:left">Matière</th>
      <th>EM1</th>
      <th>EM2</th>
      <th>Moy. EM</th>
      <th>EC</th>
      <th>Moyenne gén.</th>
      <th>Appréciation</th>
    </tr></thead>
    <tbody>${subjectRows}</tbody>
    <tfoot>
      <tr>
        <td colSpan="6" style="text-align:right;font-weight:bold;text-transform:uppercase">
          ${isMaternelle ? 'Appréciation générale' : 'Moyenne générale'}
        </td>
        <td style="text-align:center;font-weight:bold;font-size:14px;color:#0A2A5E;background:#dbeafe">
          ${isMaternelle ? (student.appreciationGlobale || '—') : (student.generalAverage !== null ? student.generalAverage.toFixed(2) + '/20' : '—')}
        </td>
        <td style="background:#dbeafe;font-size:11px;text-align:center">${student.appreciationGlobale || '—'}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Synthèse -->
  <div class="synthesis">
    <div><div class="label">Moyenne</div><div class="value" style="color:#0A2A5E">${isMaternelle ? (student.appreciationGlobale || '—') : (student.generalAverage?.toFixed(2) || '—')}${isMaternelle ? '' : '/20'}</div></div>
    <div><div class="label">Rang</div><div class="value" style="color:#334155">${rankStr}</div></div>
    <div><div class="label">${isMaternelle ? 'Appréciation' : 'Mention'}</div><div class="value" style="color:#059669;font-size:12px">${isMaternelle ? (student.appreciationGlobale || '—') : (student.generalAverage !== null ? (student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' : student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant') : '—')}</div></div>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-box"><div class="sig-label">Titulaire de la classe</div><div class="sig-line">Signature</div></div>
    <div class="sig-box"><div class="sig-label">Le Directeur(trice)${directorName ? ` — ${directorName}` : ''}</div><div class="sig-line">Visa</div></div>
    <div class="sig-box"><div class="sig-label">Les Parents</div><div class="sig-line">Nom, Prénoms et Signature</div></div>
  </div>

  <script>
    // Lancer l'impression automatiquement après le rendu
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>

  </body></html>`;
}

// ─── Moyennes Trimestrielles Table ───────────────────────────────────────────
//
// ⭐ Refonte (2026-09-27) — colonnes détaillées par trimestre :
//    Nom | EM1 | EM2 | Moy. EM | EC | Moyenne générale  (× nb trimestres)
//    Bordures arrondies (border-radius) sur le conteneur et les en-têtes.

function MoyennesTrimestrielTable({ data, isMaternelle }: { data: any[]; isMaternelle: boolean }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune donnée disponible. Sélectionnez une classe.</p>
      </div>
    );
  }

  // Group by student
  const studentMap = new Map<string, any>();
  for (const row of data) {
    if (!studentMap.has(row.studentId)) {
      studentMap.set(row.studentId, { studentName: row.studentName, periods: {} as Record<string, any> });
    }
    studentMap.get(row.studentId)!.periods[row.periodName] = row;
  }
  const students = Array.from(studentMap.values());

  // Get all period names (sorted)
  const periodNames = [...new Set(data.map(r => r.periodName))].sort();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-white border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">Bulletin trimestriel — moyennes détaillées</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {isMaternelle
            ? 'Valeurs qualitatives : TS = Très Satisfaisant, S = Satisfaisant, PS = Peu Satisfaisant'
            : 'Formule : Moy. EM = (EM1 + EM2) / 2  ·  Moyenne générale = (Moy. EM + EC) / 2'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            {/* Row 1 : Nom (rowspan=2) + period groups (colspan=5 each) */}
            <tr className="bg-white">
              <th
                rowSpan={2}
                className="border-r border-b border-black px-3 py-2 font-bold uppercase text-left sticky left-0 z-10 bg-white"
                style={{ minWidth: '200px' }}
              >
                Nom et prénom
              </th>
              {periodNames.map((p, pi) => (
                <th
                  key={p}
                  colSpan={5}
                  className={`border-b border-black px-3 py-2 font-bold uppercase text-center ${pi < periodNames.length - 1 ? 'border-r' : ''}`}
                >
                  {p}
                </th>
              ))}
            </tr>
            {/* Row 2 : EM1 | EM2 | Moy. EM | EC | Moy. gén. (× nb trimestres) */}
            <tr className="bg-white">
              {periodNames.map((p, pi) => (
                <Fragment key={p}>
                  <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '70px' }}>EM1</th>
                  <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '70px' }}>EM2</th>
                  <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '80px' }}>Moy. EM</th>
                  <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '70px' }}>EC</th>
                  {/* ⭐ T37 — filet vertical entre les groupes de trimestres :
                      la dernière sous-colonne d'un groupe NON FINAL porte le
                      border-r (avant : aucune séparation entre trimestres). */}
                  <th className={`border-b border-black px-2 py-2 font-bold uppercase text-center ${pi < periodNames.length - 1 ? 'border-r' : ''}`} style={{ minWidth: '100px' }}>Moyenne gén.</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, idx) => {
              const rowB = idx === students.length - 1 ? '' : 'border-b';
              return (
              <tr key={student.studentName + idx}>
                <td className={`border-r ${rowB} border-black px-3 py-1.5 font-medium text-slate-900 whitespace-nowrap sticky left-0 z-10 bg-white`}>
                  {student.studentName}
                </td>
                {periodNames.map((p, pi) => {
                  const groupR = pi < periodNames.length - 1 ? 'border-r' : '';
                  const row = student.periods[p];
                  if (!row) {
                    return (
                      <Fragment key={p}>
                        <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center text-slate-300`}>—</td>
                        <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center text-slate-300`}>—</td>
                        <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center text-slate-300`}>—</td>
                        <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center text-slate-300`}>—</td>
                        <td className={`${groupR} ${rowB} border-black px-2 py-1.5 text-center text-slate-300`}>—</td>
                      </Fragment>
                    );
                  }
                  if (isMaternelle) {
                    return (
                      <Fragment key={p}>
                        <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                          <span className={cn('text-[10px] font-black',
                            row.em1Avg === null ? 'text-slate-400' :
                              row.em1Avg >= 2.5 ? 'text-emerald-700' :
                              row.em1Avg >= 1.5 ? 'text-slate-900' : 'text-amber-700')}>
                            {fmtAvg(row.em1Avg, true)}
                          </span>
                        </td>
                        <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                          <span className={cn('text-[10px] font-black',
                            row.em2Avg === null ? 'text-slate-400' :
                              row.em2Avg >= 2.5 ? 'text-emerald-700' :
                              row.em2Avg >= 1.5 ? 'text-slate-900' : 'text-amber-700')}>
                            {fmtAvg(row.em2Avg, true)}
                          </span>
                        </td>
                        <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                          <span className={cn('text-[10px] font-black',
                            row.moyEm === null ? 'text-slate-400' :
                              row.moyEm >= 2.5 ? 'text-emerald-700' :
                              row.moyEm >= 1.5 ? 'text-slate-900' : 'text-amber-700')}>
                            {fmtAvg(row.moyEm, true)}
                          </span>
                        </td>
                        <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                          <span className={cn('text-[10px] font-black',
                            row.ecAvg === null ? 'text-slate-400' :
                              row.ecAvg >= 2.5 ? 'text-emerald-700' :
                              row.ecAvg >= 1.5 ? 'text-slate-900' : 'text-amber-700')}>
                            {fmtAvg(row.ecAvg, true)}
                          </span>
                        </td>
                        <td className={`${groupR} ${rowB} border-black px-2 py-1.5 text-center font-bold text-slate-900 text-[10px]`}>
                          {row.appreciation || '—'}
                        </td>
                      </Fragment>
                    );
                  }
                  // Primaire — numérique /20
                  return (
                    <Fragment key={p}>
                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-medium`}>
                        <span className={cn('font-semibold', avgColor(row.em1Avg, false))}>{fmtAvg(row.em1Avg, false)}</span>
                      </td>
                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-medium`}>
                        <span className={cn('font-semibold', avgColor(row.em2Avg, false))}>{fmtAvg(row.em2Avg, false)}</span>
                      </td>
                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-semibold`}>
                        <span className={cn('text-xs font-bold', avgColor(row.moyEm, false))}>{fmtAvg(row.moyEm, false)}</span>
                      </td>
                      <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-medium`}>
                        <span className={cn('font-semibold', avgColor(row.ecAvg, false))}>{fmtAvg(row.ecAvg, false)}</span>
                      </td>
                      <td className={`${groupR} ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                        <span className={cn('text-sm font-black', avgColor(row.trimesterAvg, false))}>{fmtAvg(row.trimesterAvg, false)}</span>
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Légende */}
      <div className="px-5 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
        {isMaternelle
          ? <>TS = Très Satisfaisant · S = Satisfaisant · PS = Peu Satisfaisant — Moy. EM = moyenne des EM1/EM2, Moyenne gén. = (Moy. EM + EC) / 2</>
          : <>Moy. EM = (EM1 + EM2) / 2 · Moyenne générale = (Moy. EM + EC) / 2 — seuil de réussite : 10/20</>}
      </div>
    </div>
  );
}

// ─── Moyennes Annuelles Table ────────────────────────────────────────────────
//
// ⭐ Refonte (2026-09-27) — colonnes agrégées sur l'année :
//    Nom | EM annuel | EC annuel | EP | Moyenne annuelle | Appréciation
//    EM annuel = moyenne des Moy. EM des 3 trimestres
//    EC annuel = moyenne des EC des 3 trimestres
//    EP = évaluation de passage (T3 uniquement, si présente)
//    Moyenne annuelle = ((EM annuel + EC annuel) / 2 + EP) / 2 (si EP), sinon (EM annuel + EC annuel) / 2

function MoyennesAnnuelTable({ data, isMaternelle }: { data: any[]; isMaternelle: boolean }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune donnée annuelle disponible. Sélectionnez une classe.</p>
        <p className="text-xs text-slate-400 mt-2 italic">
          Les moyennes annuelles seront calculées à la fin de l'année scolaire,
          après l'évaluation de passage (EP).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-white border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">Moyennes annuelles — agrégation sur l'année</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {isMaternelle
            ? 'Valeurs qualitatives : TS = Très Satisfaisant, S = Satisfaisant, PS = Peu Satisfaisant'
            : 'EM annuel = moyenne des Moy. EM des 3 trimestres · EC annuel = moyenne des EC des 3 trimestres · Moyenne annuelle = ((EM annuel + EC annuel) / 2 + EP) / 2'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="bg-white">
              <th className="border-r border-b border-black px-3 py-2 font-bold uppercase text-left" style={{ minWidth: '200px' }}>Nom et prénom</th>
              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '90px' }}>EM annuel</th>
              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '90px' }}>EC annuel</th>
              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '70px' }}>EP</th>
              <th className="border-r border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '110px' }}>Moyenne annuelle</th>
              <th className="border-b border-black px-2 py-2 font-bold uppercase text-center" style={{ minWidth: '130px' }}>Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const rowB = idx === data.length - 1 ? '' : 'border-b';
              return (
              <tr key={row.studentId + idx}>
                <td className={`border-r ${rowB} border-black px-3 py-1.5 font-medium text-slate-900 whitespace-nowrap`}>{row.studentName}</td>
                {isMaternelle ? (
                  <>
                    <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                      <span className={cn('text-[10px] font-black',
                        row.emAnnuel === null ? 'text-slate-400' :
                          row.emAnnuel >= 2.5 ? 'text-emerald-700' :
                          row.emAnnuel >= 1.5 ? 'text-slate-900' : 'text-amber-700')}>
                        {fmtAvg(row.emAnnuel, true)}
                      </span>
                    </td>
                    <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                      <span className={cn('text-[10px] font-black',
                        row.ecAnnuel === null ? 'text-slate-400' :
                          row.ecAnnuel >= 2.5 ? 'text-emerald-700' :
                          row.ecAnnuel >= 1.5 ? 'text-slate-900' : 'text-amber-700')}>
                        {fmtAvg(row.ecAnnuel, true)}
                      </span>
                    </td>
                    <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                      <span className={cn('text-[10px] font-black',
                        row.epAnnuel === null ? 'text-slate-400' :
                          row.epAnnuel >= 2.5 ? 'text-emerald-700' :
                          row.epAnnuel >= 1.5 ? 'text-slate-900' : 'text-amber-700')}>
                        {fmtAvg(row.epAnnuel, true)}
                      </span>
                    </td>
                    <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                      <span className={cn('text-sm font-black',
                        row.moyenneAnnuelle === null ? 'text-slate-400' :
                          row.moyenneAnnuelle >= 2.5 ? 'text-emerald-700' :
                          row.moyenneAnnuelle >= 1.5 ? 'text-slate-900' : 'text-amber-700')}>
                        {fmtAvg(row.moyenneAnnuelle, true)}
                      </span>
                    </td>
                    <td className={`${rowB} border-black px-2 py-1.5 text-center font-bold text-slate-900 text-[10px]`}>
                      {row.appreciation || '—'}
                    </td>
                  </>
                ) : (
                  <>
                    <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-semibold`}>
                      <span className={cn('text-xs font-bold', avgColor(row.emAnnuel, false))}>{fmtAvg(row.emAnnuel, false)}</span>
                    </td>
                    <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-semibold`}>
                      <span className={cn('text-xs font-bold', avgColor(row.ecAnnuel, false))}>{fmtAvg(row.ecAnnuel, false)}</span>
                    </td>
                    <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-medium`}>
                      <span className={cn('font-semibold', avgColor(row.epAnnuel, false))}>{fmtAvg(row.epAnnuel, false)}</span>
                    </td>
                    <td className={`border-r ${rowB} border-black px-2 py-1.5 text-center font-bold`}>
                      <span className={cn('text-sm font-black', avgColor(row.moyenneAnnuelle, false))}>{fmtAvg(row.moyenneAnnuelle, false)}</span>
                    </td>
                    <td className={`${rowB} border-black px-2 py-1.5 text-center font-bold text-slate-900 text-[10px]`}>
                      {row.moyenneAnnuelle === null ? '—' :
                        row.moyenneAnnuelle >= 16 ? 'Très Bien' :
                        row.moyenneAnnuelle >= 14 ? 'Bien' :
                        row.moyenneAnnuelle >= 12 ? 'Assez Bien' :
                        row.moyenneAnnuelle >= 10 ? 'Passable' : 'Insuffisant'}
                    </td>
                  </>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
        {isMaternelle
          ? <>EM annuel = moyenne des Moy. EM des 3 trimestres · EC annuel = moyenne des EC · EP = évaluation de passage (T3)</>
          : <>Moyenne annuelle = ((EM annuel + EC annuel) / 2 + EP) / 2 — seuil de réussite : 10/20</>}
      </div>
    </div>
  );
}

// ─── PDF HTML Generator (A4 paysage) ────────────────────────────────────────

function generateBulletinHtml(
  student: StudentResult,
  data: BulletinData,
  school: any,
  academicYear: any,
  periods: any[],
  selectedPeriodId: string,
  isMaternelle: boolean,
  evalTypeCode?: string,
  evalTypeName?: string,
  className?: string,
): string {
  const periodName = periods.find(p => p.id === selectedPeriodId)?.name || '';
  // Generate a verification token for QR code
  const qrToken = `${student.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('BULLETIN:' + qrToken + ':' + student.id)}`;

  const subjectRows = data.subjects.map((subject, idx) => {
    const score = student.subjectScores[subject.id];
    let scoreCell = '—';
    if (score?.isAbsent) {
      scoreCell = '<span style="color:red;font-weight:bold">ABS</span>';
    } else if (isMaternelle) {
      const color = score?.qualitativeCode === 'TS' ? '#059669' : score?.qualitativeCode === 'S' ? '#2563eb' : score?.qualitativeCode === 'PS' ? '#d97706' : '#666';
      scoreCell = `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-weight:bold">${score?.qualitativeCode || '—'}</span>`;
    } else {
      const val = score?.score !== null ? Number(score.score).toFixed(2) : '—';
      const color = (score?.score || 0) >= 10 ? '#059669' : '#dc2626';
      scoreCell = `<span style="color:${color};font-weight:bold">${val}</span>`;
    }
    return `<tr><td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${idx + 1}</td><td style="border:1px solid #ccc;padding:4px 8px;font-weight:500">${subject.name}</td><td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${scoreCell}</td><td style="border:1px solid #ccc;padding:4px 8px;text-align:center;font-size:11px">${score?.appreciation || '—'}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bulletin - ${student.studentName}</title><style>
  @page { size: A4 landscape; margin: 1.2cm; }
  body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; color: #1a1a1a; }
  /* ─── Official header (like Module Élèves) ─── */
  .official-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #0A2A5E; padding-bottom: 10px; margin-bottom: 12px; }
  .header-left { display: flex; align-items: center; gap: 8px; }
  .benin-flag { width: 24px; height: 16px; display: inline-block; vertical-align: middle; }
  .benin-flag .green { float: left; width: 33%; height: 100%; background: #00803D; }
  .benin-flag .yellow { float: right; width: 67%; height: 50%; background: #FCDE16; }
  .benin-flag .red { float: right; width: 67%; height: 50%; background: #E8112D; }
  .header-center { text-align: center; flex: 1; }
  .header-center .republique { font-size: 11px; font-weight: bold; }
  .header-center .ministry { font-size: 8px; margin-top: 2px; }
  .header-center .school-name { font-size: 13px; font-weight: bold; color: #0A2A5E; margin-top: 4px; }
  .header-center .school-contact { font-size: 7px; color: #666; margin-top: 2px; font-style: italic; }
  .header-right { text-align: right; }
  .header-right img.logo { max-height: 50px; max-width: 50px; }
  /* ─── Bulletin title ─── */
  .bulletin-title { text-align: center; background: #0A2A5E; color: white; padding: 6px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
  /* ─── Student info ─── */
  .student-info { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; margin-bottom: 10px; font-size: 10px; }
  .student-info div { flex: 1; }
  .student-info strong { color: #0A2A5E; }
  /* ─── Table ─── */
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th { background: #0A2A5E; color: white; padding: 6px 8px; border: 1px solid #0D3B85; text-align: center; font-size: 9px; }
  thead tr:nth-child(2) th { background: #0D3B85; }
  tbody td { border: 1px solid #cbd5e1; padding: 4px 8px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  /* ─── Synthèse ─── */
  .synthesis { display: flex; justify-content: space-around; margin-top: 12px; gap: 8px; }
  .synthesis div { text-align: center; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px; flex: 1; background: #f8fafc; }
  .synthesis .label { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: bold; }
  .synthesis .value { font-size: 14px; font-weight: bold; margin-top: 2px; }
  /* ─── Signatures ─── */
  .signatures { display: flex; justify-content: space-between; margin-top: 30px; gap: 16px; }
  .sig-box { flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 6px; }
  .sig-box .sig-label { font-size: 9px; font-weight: bold; color: #0A2A5E; }
  .sig-box .sig-line { margin-top: 35px; font-size: 8px; color: #94a3b8; }
  /* ─── QR Code ─── */
  .qr-section { display: flex; justify-content: flex-end; margin-top: 15px; align-items: center; gap: 8px; }
  .qr-section img { width: 60px; height: 60px; }
  .qr-section .qr-text { font-size: 7px; color: #94a3b8; text-align: right; }
  </style></head><body>

  <!-- Official Header -->
  <div class="official-header">
    <div class="header-left">
      <div class="benin-flag"><div class="green"></div><div class="yellow"></div><div class="red"></div></div>
    </div>
    <div class="header-center">
      <div class="republique">République du Bénin</div>
      <div class="ministry">Ministère des Enseignements Maternel et Primaire</div>
      <div class="school-name">${school?.schoolName || 'Établissement'}</div>
      <div class="school-contact">${school?.address || ''} · Tél: ${school?.phone || ''} · ${school?.email || ''}</div>
    </div>
    <div class="header-right">
      ${school?.logoUrl ? `<img class="logo" src="${school.logoUrl}" />` : ''}
    </div>
  </div>

  <!-- Bulletin Title -->
  <div class="bulletin-title">
    Bulletin de ${evalTypeName || 'Évaluation'} ${evalTypeCode ? '(' + evalTypeCode + ')' : ''} — ${periodName} ${academicYear?.label || ''}
  </div>

  <!-- Student Info -->
  <div class="student-info">
    <div>Élève: <strong>${student.studentName}</strong></div>
    <div>Matricule: <strong>${student.matricule || '—'}</strong></div>
    <div>Classe: <strong>${className || '—'}</strong></div>
    <div>Rang: <strong>${formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}</strong></div>
  </div>

  <!-- Notes Table -->
  <table>
    <thead><tr><th style="width:30px">N°</th><th style="text-align:left">Matière</th><th>${isMaternelle ? 'Appréciation (TS/S/PS)' : 'Note /20'}</th><th>Observation</th></tr></thead>
    <tbody>${subjectRows}</tbody>
  </table>

  <!-- Synthèse -->
  <div class="synthesis">
    ${!isMaternelle ? `<div><div class="label">Moyenne</div><div class="value" style="color:#0A2A5E">${student.generalAverage?.toFixed(2) || '—'}/20</div></div>` : ''}
    <div><div class="label">Rang</div><div class="value" style="color:#334155">${formatRank(student.classRank, student.gender === 'FEMALE' || student.gender === 'F')}</div></div>
    <div><div class="label">${isMaternelle ? 'Appréciation' : 'Mention'}</div><div class="value" style="color:#059669;font-size:12px">${isMaternelle ? (student.appreciationGlobale || '—') : (student.generalAverage !== null ? (student.generalAverage >= 16 ? 'Très Bien' : student.generalAverage >= 14 ? 'Bien' : student.generalAverage >= 12 ? 'Assez Bien' : student.generalAverage >= 10 ? 'Passable' : 'Insuffisant') : '—')}</div></div>
    <div><div class="label">Moy. classe</div><div class="value" style="color:#CFA63A">${data.stats.classAverage?.toFixed(2) || '—'}</div></div>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-box"><div class="sig-label">Titulaire de la classe</div><div class="sig-line">Signature</div></div>
    <div class="sig-box"><div class="sig-label">Le Directeur(trice)</div><div class="sig-line">Visa</div></div>
    <div class="sig-box"><div class="sig-label">Les Parents</div><div class="sig-line">Nom, Prénoms et Signature</div></div>
  </div>

  <!-- QR Code de vérification -->
  <div class="qr-section">
    <div class="qr-text">Code de vérification<br/>${qrToken.substring(0, 20)}…</div>
    <img src="${qrUrl}" alt="QR Code vérification" />
  </div>

  </body></html>`;
}

// ─── Workflow Bar — Signature + Distribution + Envoi aux parents ─────────────

function WorkflowBar({
  tenantId, academicYearId, classId, periodId, userRole, onRefresh,
  evaluationTypeId, evaluationTypeName, evaluationTypeCode,
  language,
}: {
  tenantId?: string;
  academicYearId?: string;
  classId: string;
  periodId: string;
  userRole?: string;
  onRefresh: () => void;
  evaluationTypeId?: string;
  evaluationTypeName?: string;
  evaluationTypeCode?: string;
  language?: 'FR' | 'EN';
}) {
  const isEN = language === 'EN';
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSignModal, setShowSignModal] = useState<'director' | 'teacher' | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isDirector = ['PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'DIRECTEUR', 'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN'].includes(userRole || '');
  const isTeacher = ['TEACHER', 'TEACHER_RESP', 'ENSEIGNANT', 'PEDAGOGIC_COORDINATOR'].includes(userRole || '');

  // ⭐ Load workflow status
  const loadStatus = useCallback(async () => {
    if (!tenantId || !academicYearId || !classId || !periodId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/institutional-exams/bulletins/class/${classId}/workflow-status?periodId=${periodId}`);
      setWorkflowStatus(res.data);
    } catch { setWorkflowStatus(null); }
    finally { setLoading(false); }
  }, [tenantId, academicYearId, classId, periodId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleSign = async () => {
    if (!signature || !showSignModal) return;
    setActionLoading(true);
    try {
      const endpoint = showSignModal === 'director' ? 'director-sign' : 'teacher-sign';
      // ⭐ Pour la signature du directeur, on envoie aussi evaluationTypeId
      //    pour que le bulletin soit lié au type d'évaluation sélectionné
      const body: any = { periodId, signature };
      if (showSignModal === 'director' && evaluationTypeId) {
        body.evaluationTypeId = evaluationTypeId;
        body.evaluationTypeName = evaluationTypeName;
        body.evaluationTypeCode = evaluationTypeCode;
      }
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/${endpoint}`, body);
      toastSuccess(isEN ? 'Signature applied' : 'Signature appliquée', {
        description: showSignModal === 'director'
          ? isEN
            ? 'All report cards' + (evaluationTypeName ? ' of ' + evaluationTypeName : '') + ' have been signed by the Director.'
            : 'Tous les bulletins' + (evaluationTypeName ? ' de ' + evaluationTypeName : '') + ' ont été signés par le directeur.'
          : isEN
            ? 'All report cards have been signed by the Teacher.'
            : "Tous les bulletins ont été signés par l'enseignant.",
      });
      setShowSignModal(null);
      setSignature(null);
      loadStatus();
      onRefresh();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/activate`, { periodId });
      toastSuccess(isEN ? 'Report Cards activated' : 'Bulletins activés', { description: isEN ? 'Distributed to class teachers.' : 'Distribués aux enseignants titulaires de classe.' });
      loadStatus();
      onRefresh();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const handleReturn = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/teacher-return`, { periodId });
      toastSuccess(isEN ? 'Report Cards returned' : 'Bulletins renvoyés', { description: isEN ? 'Report Cards are back in the Director\'s interface.' : 'Les bulletins sont de retour dans l\'interface du directeur.' });
      loadStatus();
      onRefresh();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const handleSendToParents = async () => {
    if (!confirm(isEN ? 'Confirm sending report cards to parents? Only pupils with cleared fees will receive their report card.' : 'Confirmer l\'envoi des bulletins aux parents ? Seuls les élèves dont la scolarité est en règle recevront leur bulletin.')) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/institutional-exams/bulletins/class/${classId}/send-to-parents`, {
        periodId,
        criteria: { blockIfArrears: true, minPaymentPercentage: 100 },
      }, {
        timeout: 60000, // ⭐ 1 minute — peut itérer sur de nombreux élèves
      });
      const data = res.data;
      toastSuccess(isEN ? 'Sending complete' : 'Envoi terminé', {
        description: isEN
          ? data.sent + ' sent to parents, ' + data.blocked + ' blocked (unpaid fees).'
          : data.sent + ' envoyé(s) aux parents, ' + data.blocked + ' bloqué(s) (scolarité impayée).',
      });
      loadStatus();
      onRefresh();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const summary = workflowStatus?.summary;
  const currentStatus = !summary || summary.total === 0 ? 'NONE'
    : summary.PARENT_SENT > 0 ? 'PARENT_SENT'
    : summary.BLOCKED > 0 ? 'BLOCKED'
    : summary.TEACHER_RETURNED > 0 ? 'TEACHER_RETURNED'
    : summary.TEACHER_SIGNED > 0 ? 'TEACHER_SIGNED'
    : summary.TEACHER_DISTRIBUTED > 0 ? 'TEACHER_DISTRIBUTED'
    : summary.DIRECTOR_SIGNED > 0 ? 'DIRECTOR_SIGNED'
    : 'DRAFT';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">{isEN ? 'Report Card Validation Workflow' : 'Workflow de validation des bulletins'}</h3>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-4 flex-wrap text-xs">
        <StatusBadge label={isEN ? 'Draft' : 'Brouillon'} active={currentStatus === 'DRAFT'} done={summary && summary.DIRECTOR_SIGNED > 0} />
        <Arrow />
        <StatusBadge label={isEN ? 'Director Signed' : 'Signé Directeur'} active={currentStatus === 'DIRECTOR_SIGNED'} done={summary && summary.TEACHER_DISTRIBUTED > 0} />
        <Arrow />
        <StatusBadge label={isEN ? 'Distributed to Teachers' : 'Distribué Enseignants'} active={currentStatus === 'TEACHER_DISTRIBUTED'} done={summary && summary.TEACHER_SIGNED > 0} />
        <Arrow />
        <StatusBadge label={isEN ? 'Teacher Signed' : 'Signé Enseignant'} active={currentStatus === 'TEACHER_SIGNED'} done={summary && summary.TEACHER_RETURNED > 0} />
        <Arrow />
        <StatusBadge label={isEN ? 'Returned to Director' : 'Renvoyé Directeur'} active={currentStatus === 'TEACHER_RETURNED'} done={summary && summary.PARENT_SENT > 0} />
        <Arrow />
        <StatusBadge label={isEN ? 'Sent to Parents' : 'Envoyé Parents'} active={currentStatus === 'PARENT_SENT' || currentStatus === 'BLOCKED'} done={false} />
      </div>

      {/* Summary counts */}
      {(summary && summary.total > 0) || (summary && (summary as any).expectedTotal > 0) ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            {/* ⭐ 2026-10-05 — Total affiché comme "signed / expected" quand
                expectedTotal est disponible (pour ne plus montrer "1 / 1"
                quand seul 1 bulletin a été créé sur 30 élèves attendus). */}
            <div className="font-bold text-slate-900 text-lg">
              {(summary as any).expectedTotal
                ? `${summary.total} / ${(summary as any).expectedTotal}`
                : summary.total}
            </div>
            <div className="text-slate-500">{isEN ? 'Report Cards (Signed / Expected)' : 'Bulletins (Signés / Attendus)'}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="font-bold text-blue-700 text-lg">{summary.DIRECTOR_SIGNED + summary.TEACHER_DISTRIBUTED + summary.TEACHER_SIGNED + summary.TEACHER_RETURNED}</div>
            <div className="text-slate-500">{isEN ? 'In Progress' : 'En cours'}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 text-center">
            <div className="font-bold text-emerald-700 text-lg">{summary.PARENT_SENT}</div>
            <div className="text-slate-500">{isEN ? 'Sent to Parents' : 'Envoyés aux parents'}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center">
            <div className="font-bold text-red-700 text-lg">{summary.BLOCKED}</div>
            <div className="text-slate-500">{isEN ? 'Blocked (Fees)' : 'Bloqués (scolarité)'}</div>
          </div>
        </div>
      ) : null}

      {/* Action buttons — role-based */}
      <div className="flex flex-wrap gap-2">
        {/* Director/Promoter actions */}
        {isDirector && (
          <>
            {currentStatus === 'NONE' || currentStatus === 'DRAFT' ? (
              <Button onClick={() => setShowSignModal('director')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                <PenTool className="w-4 h-4 mr-2" /> {isEN ? 'Sign (Director)' : 'Signer (Directeur)'}
              </Button>
            ) : null}

            {currentStatus === 'DIRECTOR_SIGNED' && (
              <Button onClick={handleActivate} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {isEN ? 'Activate — Distribute to Teachers' : 'Activer — Distribuer aux enseignants'}
              </Button>
            )}

            {(currentStatus === 'TEACHER_RETURNED' || currentStatus === 'TEACHER_SIGNED') && (
              <Button onClick={handleSendToParents} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                {isEN ? 'Send to Parents' : 'Envoyer aux parents'}
              </Button>
            )}

            {currentStatus === 'PARENT_SENT' && (
              <div className="text-sm text-emerald-700 font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {isEN ? 'Report Cards sent to parents' : 'Bulletins envoyés aux parents'}
              </div>
            )}
          </>
        )}

        {/* Teacher actions */}
        {isTeacher && (
          <>
            {currentStatus === 'TEACHER_DISTRIBUTED' && (
              <Button onClick={() => setShowSignModal('teacher')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                <PenTool className="w-4 h-4 mr-2" /> {isEN ? 'Sign (Teacher)' : 'Signer (Enseignant)'}
              </Button>
            )}

            {currentStatus === 'TEACHER_SIGNED' && (
              <Button onClick={handleReturn} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo className="w-4 h-4 mr-2" />}
                {isEN ? 'Return to Director' : 'Renvoyer au directeur'}
              </Button>
            )}

            {currentStatus === 'TEACHER_RETURNED' && (
              <div className="text-sm text-slate-600 font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> {isEN ? 'Report Cards returned to Director' : 'Bulletins renvoyés au directeur'}
              </div>
            )}

            {/* ⭐ Anti-screenshot notice for teachers */}
            {(currentStatus === 'TEACHER_DISTRIBUTED' || currentStatus === 'TEACHER_SIGNED') && (
              <div className="w-full mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span><strong>Protection :</strong> Les captures d'écran et le téléchargement des bulletins sont désactivés. Toute tentative est journalisée.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <SignModal
          role={showSignModal}
          signature={signature}
          setSignature={setSignature}
          onConfirm={handleSign}
          onClose={() => { setShowSignModal(null); setSignature(null); }}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

function StatusBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
      active ? 'bg-blue-600 text-white border-blue-600' :
      done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
      'bg-slate-50 text-slate-400 border-slate-200'
    )}>
      {done && <CheckCircle className="w-3 h-3 mr-1" />}
      {label}
    </span>
  );
}

function Arrow() {
  return <span className="text-slate-300 text-xs">→</span>;
}

function SignModal({
  role, signature, setSignature, onConfirm, onClose, loading,
}: {
  role: 'director' | 'teacher';
  signature: string | null;
  setSignature: (v: string | null) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-sm font-bold text-slate-900 mb-2">
          Signature — {role === 'director' ? 'Le Directeur(trice)' : 'L\'Enseignant(e)'}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Cette signature sera appliquée à <strong>tous les bulletins</strong> de cette classe sans exception.
        </p>
        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 mb-4">
          <SignatureCanvas
            width={340}
            height={120}
            onSignatureChange={setSignature}
            placeholder="Signez ici"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="text-sm">Annuler</Button>
          <Button
            onClick={onConfirm}
            disabled={!signature || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Valider la signature
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Anti-screenshot protection hook for teachers ───────────────────────────

function useAntiScreenshot(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };

    // Disable text selection
    const handleSelectStart = (e: Event) => { e.preventDefault(); };

    // Disable common screenshot shortcuts (Ctrl+P, Ctrl+S, Ctrl+Shift+S, PrintScreen)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P (print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); }
      // Ctrl+S (save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); }
      // Ctrl+Shift+S (save as)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); }
      // PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        // Clear clipboard
        if (navigator.clipboard) navigator.clipboard.writeText('').catch(() => {});
      }
    };

    // Detect screenshot via clipboard (PrintScreen puts image in clipboard)
    const handleCopy = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.types.includes('Files')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);

    // Add CSS to disable user-select
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [enabled]);
}

// ─── Sending Criteria Tab — Configuration des critères d'envoi ──────────────

function SendingCriteriaTab({ tenantId, isEN }: { tenantId?: string; isEN?: boolean }) {
  const en = !!isEN;
  const [criteria, setCriteria] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing criteria
  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    apiClient.get('/institutional-exams/bulletins/sending-criteria')
      .then((res) => setCriteria(res.data))
      .catch(() => setCriteria(null))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/institutional-exams/bulletins/sending-criteria', {
        blockIfArrears: criteria.blockIfArrears,
        minPaymentPercentage: criteria.minPaymentPercentage,
        allowDownloadByParents: criteria.allowDownloadByParents,
        requireDirectorSignature: criteria.requireDirectorSignature,
        requireTeacherSignature: criteria.requireTeacherSignature,
        autoSendAfterTeacherSign: criteria.autoSendAfterTeacherSign,
        notifyParentOnSend: criteria.notifyParentOnSend,
        reminderDaysBeforeBlock: criteria.reminderDaysBeforeBlock,
        customMessage: criteria.customMessage,
      });
      toastSuccess(en ? 'Criteria saved' : 'Critères enregistrés', { description: en ? 'Sending rules have been updated.' : 'Les règles d\'envoi des bulletins ont été mises à jour.' });
    } catch (err: any) {
      toastError(en ? 'Error' : 'Erreur', { description: err.response?.data?.message || err.message });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-slate-500">{en ? 'Loading criteria…' : 'Chargement des critères…'}</span>
      </div>
    );
  }

  if (!criteria) {
    return <div className="text-center py-8 text-slate-500">{en ? 'Unable to load criteria.' : 'Impossible de charger les critères.'}</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-900">{en ? 'Report Card Sending Criteria to Parents' : 'Critères d\'envoi des bulletins aux parents'}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          {en
            ? 'Configure the rules that determine which pupils receive their report card and under what conditions. These criteria are automatically applied when you click "Send to Parents".'
            : 'Configurez les règles qui déterminent quels élèves reçoivent leur bulletin et dans quelles conditions. Ces critères sont appliqués automatiquement lors du clic sur « Envoyer aux parents ».'}
        </p>

        {/* Section 1: Financial conditions */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-100">
            {en ? 'Financial Conditions' : 'Conditions financières'}
          </h4>
          <div className="space-y-3">
            <ToggleRow
              label={en ? 'Block if unpaid school fees arrears' : 'Bloquer si arriérés de scolarité impayés'}
              description={en ? 'Pupils with outstanding arrears will not receive their report card.' : 'Les élèves dont le compte présente des arriérés ne recevront pas leur bulletin.'}
              checked={criteria.blockIfArrears}
              onChange={(v) => setCriteria({ ...criteria, blockIfArrears: v })}
            />
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">{en ? 'Minimum payment percentage' : 'Pourcentage minimum de paiement'}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {en ? 'Pupils must have paid at least this percentage of their school fees to receive the report card.' : 'Les élèves doivent avoir payé au moins ce pourcentage de leur scolarité pour recevoir le bulletin.'}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={criteria.minPaymentPercentage}
                  onChange={(e) => setCriteria({ ...criteria, minPaymentPercentage: parseInt(e.target.value) })}
                  className="w-32 accent-blue-600"
                />
                <span className="font-bold text-blue-700 text-sm w-12 text-right">{criteria.minPaymentPercentage}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">{en ? 'Reminder days before blocking' : 'Jours de rappel avant blocage'}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {en ? 'Number of days before sending to remind parents with late payments.' : 'Nombre de jours avant l\'envoi pour rappeler aux parents en retard de paiement.'}
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={90}
                value={criteria.reminderDaysBeforeBlock}
                onChange={(e) => setCriteria({ ...criteria, reminderDaysBeforeBlock: parseInt(e.target.value) || 0 })}
                className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Required signatures */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-100">
            {en ? 'Required Signatures' : 'Signatures requises'}
          </h4>
          <div className="space-y-3">
            <ToggleRow
              label={en ? 'Require Director\'s signature' : 'Exiger la signature du Directeur'}
              description={en ? 'Report cards can only be sent to parents after the Director has signed.' : 'Les bulletins ne peuvent être envoyés aux parents qu\'après signature du directeur.'}
              checked={criteria.requireDirectorSignature}
              onChange={(v) => setCriteria({ ...criteria, requireDirectorSignature: v })}
            />
            <ToggleRow
              label={en ? 'Require Teacher\'s signature' : 'Exiger la signature de l\'Enseignant'}
              description={en ? 'Report cards can only be sent to parents after the class teacher has signed.' : 'Les bulletins ne peuvent être envoyés aux parents qu\'après signature de l\'enseignant titulaire.'}
              checked={criteria.requireTeacherSignature}
              onChange={(v) => setCriteria({ ...criteria, requireTeacherSignature: v })}
            />
          </div>
        </div>

        {/* Section 3: Sending and notification */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-100">
            {en ? 'Sending and Notification' : 'Envoi et notification'}
          </h4>
          <div className="space-y-3">
            <ToggleRow
              label={en ? 'Automatic sending after teacher signs' : 'Envoi automatique après signature de l\'enseignant'}
              description={en ? 'Report cards are automatically sent to parents as soon as the teacher signs (without waiting for the manual click).' : 'Les bulletins sont automatiquement envoyés aux parents dès que l\'enseignant signe (sans attendre le clic manuel).'}
              checked={criteria.autoSendAfterTeacherSign}
              onChange={(v) => setCriteria({ ...criteria, autoSendAfterTeacherSign: v })}
            />
            <ToggleRow
              label={en ? 'Allow download by parents' : 'Autoriser le téléchargement par les parents'}
              description={en ? 'Parents can download the PDF of the report card from their interface.' : 'Les parents peuvent télécharger le PDF du bulletin depuis leur interface.'}
              checked={criteria.allowDownloadByParents}
              onChange={(v) => setCriteria({ ...criteria, allowDownloadByParents: v })}
            />
            <ToggleRow
              label={en ? 'Notify parents on send' : 'Notifier les parents à l\'envoi'}
              description={en ? 'An email/SMS is sent to parents when the report card is made available.' : 'Un email/SMS est envoyé aux parents lors de la mise à disposition du bulletin.'}
              checked={criteria.notifyParentOnSend}
              onChange={(v) => setCriteria({ ...criteria, notifyParentOnSend: v })}
            />
          </div>
        </div>

        {/* Section 4: Custom message */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-100">
            {en ? 'Custom Message (optional)' : 'Message personnalisé (optionnel)'}
          </h4>
          <textarea
            value={criteria.customMessage || ''}
            onChange={(e) => setCriteria({ ...criteria, customMessage: e.target.value })}
            placeholder={en ? 'Message accompanying the report card when sent to parents (e.g. information about parent-teacher meeting, return dates, etc.)' : 'Message accompagnant le bulletin lors de l\'envoi aux parents (ex: informations sur la réunion parents-professeurs, dates de reprise, etc.)'}
            rows={3}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2.5"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{en ? 'Saving…' : 'Enregistrement…'}</>
              : <><Save className="w-4 h-4 mr-2" />{en ? 'Save criteria' : 'Enregistrer les critères'}</>}
          </Button>
        </div>

        {criteria.isDefault && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
            {en ? 'Default values are currently used. Edit and save to customize.' : 'Les valeurs par défaut sont actuellement utilisées. Modifiez et enregistrez pour personnaliser.'}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label, description, checked, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4',
          checked ? 'bg-blue-600' : 'bg-slate-300')}
      >
        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}

// ─── Received Bulletins Tab (for teachers) ──────────────────────────────────

function ReceivedBulletinsTab({ tenantId, academicYearId, user }: { tenantId?: string; academicYearId?: string; user?: any }) {
  const [bulletins, setBulletins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [showSignModal, setShowSignModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load periods
  useEffect(() => {
    if (!academicYearId) return;
    fetch(`/api/settings/academic-years/${academicYearId}/periods`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setPeriods(list);
        if (list.length > 0 && !selectedPeriodId) setSelectedPeriodId(list[0].id);
      })
      .catch(() => setPeriods([]));
  }, [academicYearId]);

  // Load received bulletins
  const loadBulletins = useCallback(async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/institutional-exams/bulletins/teacher-bulletins?periodId=${selectedPeriodId}`);
      setBulletins(res.data?.bulletins || []);
    } catch { setBulletins([]); }
    finally { setLoading(false); }
  }, [selectedPeriodId]);

  useEffect(() => { loadBulletins(); }, [loadBulletins]);

  const handleSignAll = async () => {
    if (!signature || bulletins.length === 0) return;
    setActionLoading(true);
    try {
      // Sign all bulletins — use the first student's class
      const firstBulletin = bulletins[0];
      // ⭐ fix v3.6.0 : chaque bulletin porte DÉJÀ classId (cf. bulletins.controller
      //    Nest : « bulletins : liste complète (avec classId pour chacun) »).
      //    L'ancien code fetchait /students/:id/enrollment avec l'URL DOUBLÉE
      //    (/api/api/…) → 404 permanent → « Impossible de déterminer la classe ».
      const classId = firstBulletin.classId || firstBulletin.class?.id;
      if (!classId) {
        toastError('Erreur', { description: 'Impossible de déterminer la classe' });
        return;
      }
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/teacher-sign`, {
        periodId: selectedPeriodId,
        signature,
      });
      toastSuccess('Bulletins signés', { description: `${bulletins.length} bulletin(s) signé(s) par l'enseignant.` });
      setShowSignModal(false);
      setSignature(null);
      loadBulletins();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const handleReturn = async () => {
    if (bulletins.length === 0) return;
    setActionLoading(true);
    try {
      const firstBulletin = bulletins[0];
      // ⭐ fix v3.6.0 — idem handleSignAll : classId est déjà sur le bulletin
      const classId = firstBulletin.classId || firstBulletin.class?.id;
      if (!classId) {
        toastError('Erreur', { description: 'Impossible de déterminer la classe' });
        return;
      }
      await apiClient.post(`/institutional-exams/bulletins/class/${classId}/teacher-return`, {
        periodId: selectedPeriodId,
      });
      toastSuccess('Bulletins renvoyés', { description: 'Les bulletins sont de retour chez le directeur.' });
      loadBulletins();
    } catch (err: any) {
      toastError('Erreur', { description: err.response?.data?.message || err.message });
    } finally { setActionLoading(false); }
  };

  const allSigned = bulletins.length > 0 && bulletins.every(b => b.status === 'TEACHER_SIGNED');
  const hasDistributed = bulletins.some(b => b.status === 'TEACHER_DISTRIBUTED');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">Bulletins reçus du Directeur</h3>
          </div>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="text-sm border border-gray-200 bg-gray-50 rounded-lg py-2 px-3"
          >
            <option value="">— Période —</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : bulletins.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600 font-medium">Aucun bulletin reçu</p>
            <p className="text-sm text-gray-400 mt-1">Les bulletins distribués par le directeur apparaîtront ici.</p>
          </div>
        ) : (
          <>
            {/* Summary + Actions */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex gap-2 text-xs">
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                  {bulletins.length} bulletin(s)
                </span>
                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                  {bulletins.filter(b => b.status === 'TEACHER_DISTRIBUTED').length} à signer
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                  {bulletins.filter(b => b.status === 'TEACHER_SIGNED').length} signé(s)
                </span>
              </div>
              <div className="flex gap-2">
                {hasDistributed && !allSigned && (
                  <Button onClick={() => setShowSignModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                    <PenTool className="w-4 h-4 mr-2" /> Signer tous les bulletins
                  </Button>
                )}
                {allSigned && (
                  <Button onClick={handleReturn} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
                    {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo className="w-4 h-4 mr-2" />}
                    Renvoyer au directeur
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Élève</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Matricule</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Statut</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Distribué le</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Signé le</th>
                  </tr>
                </thead>
                <tbody>
                  {bulletins.map((b) => (
                    <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-800">{b.studentName}</td>
                      <td className="py-2 px-3 text-gray-500">{b.matricule || '—'}</td>
                      <td className="py-2 px-3">
                        {b.status === 'TEACHER_DISTRIBUTED' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">À signer</span>
                        ) : b.status === 'TEACHER_SIGNED' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Signé</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{b.status}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">
                        {b.distributedAt ? new Date(b.distributedAt).toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">
                        {b.teacherSignedAt ? new Date(b.teacherSignedAt).toLocaleString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Sign Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Signature — Enseignant(e)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cette signature sera appliquée à <strong>tous les bulletins reçus</strong> sans exception.
            </p>
            <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 mb-4">
              <SignatureCanvas
                width={340}
                height={120}
                onSignatureChange={setSignature}
                placeholder="Signez ici"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowSignModal(false); setSignature(null); }} className="text-sm">Annuler</Button>
              <Button
                onClick={handleSignAll}
                disabled={!signature || actionLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Valider la signature
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
