/**
 * FederisGradesService — Module « Notes et Moyennes » (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * Reproduit le module Examen d'Academia Helm, adapté aux examens nationaux :
 *
 *   1. MATIÈRES / ÉPREUVES    — NationalExamSubject (code, coefficient,
 *      barème). Jeu officiel par type initialisable en un clic, puis ajustable
 *      librement par le patronat (séries du BAC, filières du CAP…).
 *   2. SAISIE DES NOTES       — grille candidats × matières (pattern
 *      GradingSheet Helm) :
 *        · CEP  → tableau du PRIMAIRE : une note /20 par épreuve, sans
 *          coefficient — total, moyenne simple, rang, seuil 10/20 ;
 *        · BEPC / BAC / CAP → tableau du SECONDAIRE avec coefficients :
 *          note /20 × coefficient, total des coefficients, total des notes
 *          coefficient, moyenne pondérée Σ(note×coef)/Σ(coef), rang.
 *      Saisie par identité OU PAR ANONYMAT (codes du module Candidats —
 *      les noms sont masqués pendant la correction / post-composition).
 *   3. REGISTRE DES NOTES     — lecture seule (pattern RegistreTable Helm) +
 *      récapitulatif : effectif, ayant composé, seuil atteint, taux, par centre.
 *   4. RELEVÉS DE NOTES       — « bulletin » Helm renommé relevé pour Federis :
 *      modèle PRIMAIRE pour le CEP, modèle SECONDAIRE (coefficients) pour le
 *      BEPC / BAC / CAP — rendu PDF 100 % backend (FederisPdfService).
 *
 * Règles transverses :
 *   - Les ABSENTS (isAbsent) sont exclus des totaux, moyennes et classements ;
 *   - Verrous : RESULTS_PUBLISHED → saisie verrouillée ; session soumise
 *     (aucun brouillon) → saisie verrouillée jusqu'à réouverture ;
 *   - Permissions : lecture = membres du patronat ; saisie = WRITE_DELIBERATION
 *     (coordonnateur, secrétaire, organisateur — même chaîne que la délibération) ;
 *   - AuditLog sur chaque mutation (pattern FederisExamsService).
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FederisPatronatService } from './federis-patronat.service';
// ⭐ Module Matières — l'initialisation des matières d'un examen puise
//    D'ABORD dans le catalogue du patronat (module Matières) ; le jeu
//    intégré DEFAULT_SUBJECTS_BY_TYPE n'est qu'un repli (catalogue vide).
import { FederisSubjectsService } from './federis-subjects.service';
import { normalizeSubjectName } from './federis-subjects.service';
import { FederisGradingRulesService } from './federis-grading-rules.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  WRITE_DELIBERATION,
  normalizePatronatFunction,
  patronatFunctionLabel,
  type PatronatFunction,
} from './federis-roles';

// ⭐ FIX 2026-09-29 — décorateurs class-validator OBLIGATOIRES sur TOUS les
//    DTOs : le ValidationPipe global (whitelist + forbidNonWhitelisted) rejette
//    toute propriété sans décorateur (« property X should not exist ») et
//    l'AcademicYearEnforcementInterceptor injecte academicYearId dans le body
//    quand le DTO n'a aucune règle → double rejet 400 (pattern federis-exams).
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ═══════════════════════════════════════════════════════════════════════════
// DTOs (tous décorés — voir note FIX ci-dessus)
// ═══════════════════════════════════════════════════════════════════════════

export class CreateSubjectDto {
  /** Code court de l'épreuve (ex. FR, MATH, RED). */
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /** Poids de l'épreuve (BEPC/BAC/CAP) — 1 pour le CEP (sans coefficient). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  coefficient?: number;

  /** Barème de l'épreuve (défaut 20). */
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  maxScore?: number;

  /** Durée de l'épreuve en minutes. */
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(600)
  duration?: number;

  /** Note minimale de réussite de l'épreuve (défaut 10). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  passingScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  order?: number;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  coefficient?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(600)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  passingScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  order?: number;
}

/** Une cellule de la grille : note /20 (null = effacer) + marquage absent.
 *  ⭐ 2026-10-01 — CEP : détail CM (/18) + CP (/2) ; la note /20 = CM + CP
 *  (si seul `score` est transmis, il est scindé automatiquement). */
export class GradeCellDto {
  @IsString()
  candidateId!: string;

  @IsString()
  subjectId!: string;

  /** null → efface la note ; nombre → borne [0 ; maxScore de la matière]. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number | null;

  /** CEP — note de base sur 18. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(18)
  cm?: number | null;

  /** CEP — note de perfectionnement sur 2 (0 si CM < note minimale exigée). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  cp?: number | null;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;
}

export class BulkSaveGradesDto {
  /** Cellules modifiées de la grille (max 5000 par lot). */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeCellDto)
  grades!: GradeCellDto[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Matières officielles par type d'examen (point de départ ajustable)
// ═══════════════════════════════════════════════════════════════════════════
//
// Le patronat peut librement modifier coefficients et barèmes (dialogue
// « Matières et coefficients ») — ces jeux officiels ne sont qu'un point de
// départ réaliste par type d'examen.

export const DEFAULT_SUBJECTS_BY_TYPE: Record<
  string,
  Array<{ code: string; name: string; coefficient: number; maxScore?: number; duration?: number; order?: number }>
> = {
  // CEP — modèle PRIMAIRE : une note /20 par épreuve, SANS coefficient.
  CEP: [
    { code: 'RED', name: 'Rédaction', coefficient: 1, duration: 60 },
    { code: 'DIC', name: 'Dictée', coefficient: 1, duration: 20 },
    { code: 'ETX', name: 'Étude de texte', coefficient: 1, duration: 45 },
    { code: 'CAL', name: 'Calcul (Mathématiques)', coefficient: 1, duration: 60 },
    { code: 'SCI', name: 'Leçons de sciences', coefficient: 1, duration: 45 },
    { code: 'HGE', name: 'Histoire-Géographie', coefficient: 1, duration: 45 },
  ],
  // BEPC — modèle SECONDAIRE avec coefficients.
  BEPC: [
    { code: 'FR', name: 'Français', coefficient: 4, duration: 120 },
    { code: 'MATH', name: 'Mathématiques', coefficient: 4, duration: 120 },
    { code: 'ANG', name: 'Anglais', coefficient: 3, duration: 90 },
    { code: 'PCT', name: 'Physique-Chimie-Technologie', coefficient: 2, duration: 90 },
    { code: 'SVT', name: 'Sciences de la Vie et de la Terre', coefficient: 2, duration: 90 },
    { code: 'ESC', name: 'Éducation Sociale et Civique', coefficient: 2, duration: 90 },
  ],
  // BAC — jeu générique (à ajuster selon la série A1/A2/C/D…).
  BAC: [
    { code: 'PHI', name: 'Philosophie', coefficient: 2, duration: 240 },
    { code: 'FR', name: 'Français', coefficient: 3, duration: 240 },
    { code: 'MATH', name: 'Mathématiques', coefficient: 4, duration: 240 },
    { code: 'ANG', name: 'Anglais', coefficient: 2, duration: 180 },
    { code: 'HGE', name: 'Histoire-Géographie', coefficient: 2, duration: 180 },
    { code: 'SVT', name: 'Sciences de la Vie et de la Terre', coefficient: 2, duration: 180 },
    { code: 'PC', name: 'Physique-Chimie', coefficient: 4, duration: 240 },
  ],
  // CAP — filières techniques : théorie + pratique.
  CAP: [
    { code: 'CG', name: 'Culture générale', coefficient: 3, duration: 120 },
    { code: 'MATH', name: 'Mathématiques', coefficient: 2, duration: 90 },
    { code: 'TEC', name: 'Technologie professionnelle', coefficient: 4, duration: 180 },
    { code: 'TP', name: 'Travaux pratiques', coefficient: 5, duration: 240 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers de calcul PURS (exportés — utilisés par le service, le service PDF
// et testés par scripts/test_grades_module_2026-09-29.mjs)
// ═══════════════════════════════════════════════════════════════════════════

/** Le CEP suit le modèle du PRIMAIRE (sans coefficients) ? */
export function isPrimaryExamType(examType: string | null | undefined): boolean {
  return (examType ?? '').toUpperCase() === 'CEP';
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ 2026-10-01 — MODÈLE OFFICIEL DU CEP : CM (/18) + CP (/2) = NOTE (/20)
// Même règle que le module Examen d'Academia Helm (niveau primaire) :
//   - CM (note de base) sur 18 ;
//   - CP (note de perfectionnement) sur 2 — attribuée UNIQUEMENT si le
//     candidat a obtenu la note minimale exigée (défaut 10) ; valeur dans
//     [0 ; 2] (le relevé officiel admet des dixièmes, ex. 1,25) ;
//   - Note /20 = CM + CP (somme — stockée dans ExamResult.score, les
//     totaux/moyennes restent inchangés).
// ═══════════════════════════════════════════════════════════════════════════

export const CEP_CM_MAX = 18;
export const CEP_CP_MAX = 2;

/** Scinde une note /20 héritée en CM (/18) + CP (/2) — reprise des données
 *  existantes : la part au-delà de 18 devient du perfectionnement. */
export function splitCepScore(score: number): { cm: number; cp: number } {
  const cm = Math.min(Math.max(Number(score) || 0, 0), CEP_CM_MAX);
  return { cm: round2(cm), cp: round2(Math.max(0, (Number(score) || 0) - cm)) };
}

/** Règle officielle : la note de perfectionnement (CP) n'est attribuée que
 *  si le candidat a obtenu la note minimale exigée (défaut 10) — pattern
 *  GradingSheet Helm : CP forcé à 0 sous le seuil. */
export function cepCpGate(cm: number | null, minRequise: number): number | null {
  return cm !== null && cm >= minRequise ? null : 0;
}

/** Matières « étoilées » du CEP (astérisque du relevé officiel : Expression
 *  Écrite, Compréhension de l'Écrit / Lecture, Mathématiques) — ⭐ leur
 *  MOYENNE conditionne l'admission en 6ème (règle utilisateur 2026-10-01). */
export function isCepPerfectionnementSubject(code: string, name: string): boolean {
  const n = normalizeSubjectName(`${code} ${name}`);
  return (
    n.includes('expression ecrite') ||
    n.includes('redaction') ||
    n.includes('comprehension') ||
    n.includes('lecture') ||
    n.includes('mathematique') ||
    n.includes('calcul')
  );
}

/** Décision du jury du CEP (règles officielles du relevé) :
 *   - ADMIS AU CEP : note minimale exigée atteinte dans au moins 6 des
 *     9 matières (générique : les 2/3 des matières de l'examen) ;
 *   - ADMIS EN 6ÈME : ⭐ règle utilisateur (2026-10-01) — la MOYENNE des
 *     matières marquées d'un astérisque (*) détermine seule l'admission :
 *     moyenne ≥ 10/20 → admis(e) en 6ème. Repli : si aucune matière
 *     étoilée n'est définie (jeu de matières personnalisé), la moyenne
 *     générale de l'examen est utilisée. */
export const CEP_SIXIEME_THRESHOLD = 10;

export interface CepAdmission {
  matieresNotees: number;
  matieresReussies: number;
  matieresRequises: number;
  admisCep: boolean;
  admisSixieme: boolean;
  /** ⭐ Moyenne des matières étoilées (note /20 = CM + CP) — base de la
   *    décision d'admission en 6ème ; null si aucune note exploitable. */
  moyenneEtoiles: number | null;
  /** Matières étoilées effectivement notées (non absentes). */
  matieresEtoiles: number;
}

export function computeCepAdmission(
  lines: Array<{
    score: number | null;
    isAbsent: boolean;
    passingScore: number | null;
    cp: number | null;
    perfectionnement: boolean;
  }>,
  nbMatieresExamen: number,
): CepAdmission {
  const matieresRequises = Math.max(1, Math.ceil((nbMatieresExamen * 2) / 3));
  let matieresNotees = 0;
  let matieresReussies = 0;
  // ⭐ Admission en 6ème : moyenne des matières étoilées (note /20).
  let sommeEtoiles = 0;
  let matieresEtoiles = 0;
  // Repli : moyenne générale si aucune matière étoilée n'est définie.
  let sommeToutes = 0;
  for (const l of lines) {
    if (l.isAbsent || l.score === null) continue;
    matieresNotees += 1;
    sommeToutes += l.score;
    if (l.score >= (l.passingScore ?? 10)) matieresReussies += 1;
    if (l.perfectionnement) {
      sommeEtoiles += l.score;
      matieresEtoiles += 1;
    }
  }
  const admisCep = matieresReussies >= matieresRequises;
  const moyenneEtoiles =
    matieresEtoiles > 0
      ? round2(sommeEtoiles / matieresEtoiles)
      : matieresNotees > 0
        ? round2(sommeToutes / matieresNotees)
        : null;
  return {
    matieresNotees,
    matieresReussies,
    matieresRequises,
    admisCep,
    // ⭐ Règle : la moyenne des matières étoilées (≥ 10/20) détermine SEULE
    //    l'admission en 6ème — plus de condition de perfectionnement (CP).
    admisSixieme: moyenneEtoiles !== null && moyenneEtoiles >= CEP_SIXIEME_THRESHOLD,
    moyenneEtoiles,
    matieresEtoiles,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ 2026-10-01 — COLONNE BILAN du relevé BEPC / BAC / CAP (modèle officiel) :
// Total Français (groupe français) · Total Écrit (hors oraux et EPS) ·
// Total Final (toutes matières) · Moyenne = Total Final / Σ coefficients.
// ═══════════════════════════════════════════════════════════════════════════

/** Matière du groupe FRANÇAIS (Total Français du bilan). */
export function isFrenchGroupSubject(name: string): boolean {
  const n = normalizeSubjectName(name);
  return (
    n.includes('communication ecrite') ||
    n.includes('lecture') ||
    n.includes('francais') ||
    n.includes('expression ecrite') ||
    n.includes('redaction') ||
    n.includes('dictee') ||
    n.includes('comprehension')
  );
}

/** Épreuve ORALE (exclue du Total Écrit). */
export function isOralSubject(name: string): boolean {
  return normalizeSubjectName(name).includes('oral');
}

/** EPS (exclue du Total Écrit) — « Éducation Physique et Sportive », « E.P.S. ». */
export function isEpsSubject(name: string): boolean {
  const n = normalizeSubjectName(name).replace(/\./g, '');
  return n.includes('education physique') || n.includes('eps') || n.includes('sport');
}

export interface ReleveBilan {
  hasFrancais: boolean;
  totalFrancais: number | null;
  totalEcrit: number | null;
  totalFinal: number | null;
  moyenne: number | null;
}

/** Sous-totaux de la colonne BILAN (relevé officiel BEPC / BAC / CAP). */
export function computeReleveBilan(
  lines: Array<{ name: string; score: number | null; isAbsent: boolean; coefficient: number }>,
): ReleveBilan {
  let sumFrancais = 0;
  let sumEcrit = 0;
  let sumFinal = 0;
  let sumCoef = 0;
  let hasFrancais = false;
  let nbFrancaisNotes = 0;
  for (const l of lines) {
    const coef = l.coefficient ?? 1;
    if (l.isAbsent || l.score === null) continue;
    const noteCoef = l.score * coef;
    sumFinal += noteCoef;
    sumCoef += coef;
    if (isFrenchGroupSubject(l.name)) {
      hasFrancais = true;
      nbFrancaisNotes += 1;
      sumFrancais += noteCoef;
    }
    if (!isOralSubject(l.name) && !isEpsSubject(l.name)) sumEcrit += noteCoef;
  }
  return {
    hasFrancais: hasFrancais && nbFrancaisNotes > 0,
    totalFrancais: hasFrancais && nbFrancaisNotes > 0 ? round2(sumFrancais) : null,
    totalEcrit: round2(sumEcrit),
    totalFinal: round2(sumFinal),
    moyenne: sumCoef > 0 ? round2(sumFinal / sumCoef) : null,
  };
}

/** Libellé de session du relevé officiel : « Session de mai 2027 » depuis la
 *  date de début d'examen, repli sur l'année scolaire. */
export function examSessionLabel(
  exam: { startDate?: Date | null },
  academicYearLabel?: string | null,
): string {
  if (exam?.startDate) {
    const d = new Date(exam.startDate);
    const mois = d.toLocaleDateString('fr-FR', { month: 'long' });
    return `Session de ${mois} ${d.getFullYear()}`;
  }
  return academicYearLabel ? `Session ${academicYearLabel}` : '';
}

/** Intitulé officiel de l'examen pour l'en-tête du relevé. */
export function officialExamTitle(
  examType: string | null | undefined,
  series?: string | null,
): { main: string; sub: string } {
  switch ((examType ?? '').toUpperCase()) {
    case 'CEP':
      return { main: "CERTIFICAT D'ÉTUDES PRIMAIRES", sub: '(C.E.P.)' };
    case 'BEPC':
      return { main: "Brevet d'Études du Premier Cycle", sub: '(B.E.P.C)' };
    case 'BAC':
      return { main: 'Baccalauréat', sub: series ? `Série ${series}` : '' };
    case 'CAP':
      return { main: "Certificat d'Aptitude Professionnelle", sub: '(C.A.P)' };
    default:
      return { main: (examType ?? 'Examen').toUpperCase(), sub: '' };
  }
}

export interface GradeSubjectLite {
  id: string;
  code: string;
  name: string;
  coefficient: number;
  maxScore: number;
  order: number;
  /** ⭐ 2026-10-01 — RÈGLE ÉPREUVE PRÉPARÉE : une matière sans épreuve
   *  préparée (module Épreuves et documents) ne peut PAS recevoir de notes.
   *  La préparation = une épreuve FederisExamPaper correspondante (lien
   *  catalogue ou nom normalisé) OU un marquage manuel « déjà préparée »
   *  (metadata.epreuvePreparedAt — épreuve préparée hors application). */
  epreuvePrepared: boolean;
  /** 'paper' = épreuve dans le module · 'manual' = marquée « déjà préparée » · null. */
  preparedSource: 'paper' | 'manual' | null;
  /** ⭐ 2026-10-01 — Note minimale exigée (relevé officiel CEP : « NOTE
   *  MINIMALE EXIGEE » ; porte du CP — défaut 10). */
  passingScore: number | null;
  /** ⭐ 2026-10-01 — Matière « étoilée » du CEP (perfectionnement → 6ème). */
  perfectionnement: boolean;
}

/** Infos de préparation d'une matière (règle épreuve préparée). */
export interface EpreuvePreparedInfo {
  prepared: boolean;
  source: 'paper' | 'manual' | null;
}

/** ⭐ 2026-10-01 — RÈGLE ÉPREUVE PRÉPARÉE (partagée grille patronat + saisie
 *  secrétariat) : calcule, pour chaque matière d'un examen, si son épreuve
 *  est préparée. Correspondance IDENTIQUE au signal du module Épreuves
 *  (FederisSubjectsService.getReadiness) : lien catalogue
 *  metadata.sourceSubjectId → FederisExamPaper.subjectId, ou nom/code
 *  normalisés. Le marquage manuel (metadata.epreuvePreparedAt) débloque la
 *  saisie pour les épreuves préparées HORS application. */
export async function computeEpreuvePreparedMap(
  prisma: any,
  tenantId: string,
  academicYearId: string,
  examType: string,
  subjects: Array<{ id: string; code: string; name: string; metadata?: unknown }>,
): Promise<Map<string, EpreuvePreparedInfo>> {
  const papers = await prisma.federisExamPaper.findMany({
    where: { tenantId, academicYearId, examCategory: examType },
    select: { subjectId: true, subject: true },
  });
  const papersBySubjectId = new Set<string>();
  const papersByNormName = new Set<string>();
  for (const p of papers) {
    if (p.subjectId) papersBySubjectId.add(p.subjectId);
    if (p.subject) papersByNormName.add(normalizeSubjectName(p.subject));
  }
  const map = new Map<string, EpreuvePreparedInfo>();
  for (const s of subjects) {
    const md = (s.metadata ?? {}) as any;
    const sourceId: string | null = md.sourceSubjectId ?? null;
    const hasPaper =
      Boolean(sourceId && papersBySubjectId.has(sourceId)) ||
      papersByNormName.has(normalizeSubjectName(s.name)) ||
      papersByNormName.has(normalizeSubjectName(s.code));
    const manualAt: string | null = md.epreuvePreparedAt ?? null;
    map.set(s.id, {
      prepared: Boolean(hasPaper) || Boolean(manualAt),
      source: hasPaper ? 'paper' : manualAt ? 'manual' : null,
    });
  }
  return map;
}

export interface GradeCellLite {
  score: number | null;
  isAbsent: boolean;
  /** ⭐ 2026-10-01 — Détail CEP : CM (/18) et CP (/2) — note = CM + CP.
   *  Null pour les examens secondaires (BEPC / BAC / CAP). */
  cm: number | null;
  cp: number | null;
}

export interface GradeCandidateLite {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  anonymatCode: string | null;
  gender: string | null;
  school: string;
  centerId: string | null;
  centerCode: string | null;
  centerName: string | null;
  roomCode: string | null;
  tableNumber: string | null;
  scores: Record<string, GradeCellLite>;
}

/** Statistiques calculées d'un candidat (moyennes Helm primaire / secondaire). */
export interface CandidateComputed {
  total: number;
  nbEval: number;
  /** Moyenne simple = total / nb matières évaluées (modèle primaire — CEP). */
  average: number | null;
  /** Σ coefficients des matières évaluées (modèle secondaire). */
  totalCoef: number;
  /** Σ note × coefficient (modèle secondaire). */
  totalNotesCoef: number;
  /** Moyenne pondérée = Σ(note×coef) / Σ(coef) (modèle secondaire). */
  averagePondernee: number | null;
  /** Moyenne retenue selon le modèle : simple (CEP) ou pondérée (autres). */
  finalAverage: number | null;
}

/**
 * Calcule les statistiques d'un candidat à partir de ses notes.
 *   - useSimpleAverage = true  (modèle SIMPLE) : moyenne = Σ notes / nb ;
 *   - useSimpleAverage = false (modèle PONDÉRÉ) : moyenne = Σ(note×coef)/Σcoef ;
 *   Le modèle EFFECTIF vient des règles de calcul (Paramètres → Règles de
 *   calcul) : défaut backend (CEP simple, BEPC/BAC/CAP pondérée) ou règle
 *   personnalisée du patronat (source de vérité). Les ABSENTS sont exclus.
 */
export function computeCandidateStats(
  scores: Record<string, GradeCellLite>,
  subjects: GradeSubjectLite[],
  useSimpleAverage: boolean,
): CandidateComputed {
  let total = 0;
  let nbEval = 0;
  let totalCoef = 0;
  let totalNotesCoef = 0;
  for (const subject of subjects) {
    const cell = scores[subject.id];
    if (!cell || cell.isAbsent || cell.score === null || cell.score === undefined) continue;
    const score = Math.max(0, Math.min(Number(cell.score), subject.maxScore ?? 20));
    const coef = subject.coefficient ?? 1;
    total += score;
    nbEval += 1;
    totalCoef += coef;
    totalNotesCoef += score * coef;
  }
  const average = nbEval > 0 ? round2(total / nbEval) : null;
  const averagePondernee = totalCoef > 0 ? round2(totalNotesCoef / totalCoef) : null;
  return {
    total: round2(total),
    nbEval,
    average,
    totalCoef: round2(totalCoef),
    totalNotesCoef: round2(totalNotesCoef),
    averagePondernee,
    finalAverage: useSimpleAverage ? average : averagePondernee,
  };
}

/** Rang dense (ex æquo) par moyenne retenue décroissante. */
export function computeDenseRanks(
  values: Array<{ id: string; value: number | null }>,
): Map<string, number> {
  const ranks = new Map<string, number>();
  const sorted = [...values].filter((v) => v.value !== null).sort((a, b) => (b.value as number) - (a.value as number));
  let currentRank = 0;
  let previousValue: number | null = null;
  for (const entry of sorted) {
    if (previousValue === null || entry.value !== previousValue) {
      currentRank += 1;
      previousValue = entry.value;
    }
    ranks.set(entry.id, currentRank);
  }
  return ranks;
}

/** Appréciation par matière / générale (modèle secondaire Helm). */
export function appreciationFor(average: number | null): string {
  if (average === null) return '—';
  if (average >= 16) return 'Très Bien';
  if (average >= 14) return 'Bien';
  if (average >= 12) return 'Assez Bien';
  if (average >= 10) return 'Passable';
  if (average >= 8) return 'Insuffisant';
  return 'Faible';
}

/** Mention nationale (même barème que le palmarès federis-pdf.service). */
export function nationalMentionFor(average: number | null): string {
  if (average === null) return '—';
  if (average >= 16) return 'Excellent';
  if (average >= 14) return 'Très Bien';
  if (average >= 12) return 'Bien';
  if (average >= 10) return 'Assez Bien';
  return 'Passable';
}

/** 1er / 2e / 3e (1re au féminin) — pattern formatRank des bulletins Helm. */
export function formatRankFr(rank: number | null, female?: boolean): string {
  if (rank === null || rank === undefined) return '—';
  if (rank === 1) return female ? '1re' : '1er';
  return `${rank}e`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class FederisGradesService {
  private readonly logger = new Logger(FederisGradesService.name);
  private schemaReady = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FederisPatronatService))
    private readonly patronatService: FederisPatronatService,
    private readonly subjectsService: FederisSubjectsService,
    private readonly gradingRulesService: FederisGradingRulesService,
  ) {}

  // ── Auto-guérison du schéma (pattern FederisExamsService) ────────────────
  //
  // Miroir EXACT de la migration 20260929180000_federis_grades_isabsent :
  // exam_results.isAbsent (+ index). Le déploiement Railway n'exécute pas
  // prisma migrate deploy au démarrage — la colonne est créée idempotemment
  // au premier appel du service.

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      const cols: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='exam_results' AND column_name='isAbsent'`,
      )) as any[];
      if (!cols || cols.length < 1) throw new Error('colonne isAbsent absente');
      this.schemaReady = true;
      return;
    } catch {
      /* colonne absente → création idempotente ci-dessous */
    }
    const statements = [
      `ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "isAbsent" BOOLEAN NOT NULL DEFAULT false`,
      `CREATE INDEX IF NOT EXISTS "exam_results_examId_isAbsent_idx"
          ON "exam_results"("examId", "isAbsent")`,
    ];
    for (const sql of statements) {
      await this.prisma.$executeRawUnsafe(sql);
    }
    this.schemaReady = true;
    this.logger.log('Schéma notes/moyennes assuré (migration 20260929180000)');
  }

  // ── Contexte & permissions (pattern FederisExamsService) ─────────────────

  private async resolveContext(tenantId: string, userId: string) {
    const patronat = await this.patronatService.resolvePatronat(tenantId, userId);
    const link = await this.prisma.patronatUser.findFirst({
      where: { tenantId: patronat.tenantId, userId, isActive: true },
      select: { role: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const fn = normalizePatronatFunction(link?.role ?? user?.role);
    return { patronat, fn, fnLabel: patronatFunctionLabel(fn) };
  }

  private assertRead(fn: PatronatFunction): void {
    if (!ALL_PATRONAT_FUNCTIONS.includes(fn)) {
      throw new ForbiddenException('Accès réservé aux membres du patronat.');
    }
  }

  /** Saisie / matières : même chaîne que la délibération (notes → jury). */
  private assertWriteGrades(fn: PatronatFunction): void {
    if (!WRITE_DELIBERATION.includes(fn)) {
      throw new ForbiddenException(
        "La saisie des notes est réservée au coordonnateur, au secrétaire et à l'organisateur.",
      );
    }
  }

  private async getOwnedExam(patronatTenantId: string, examId: string) {
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronatTenantId },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');
    return exam;
  }

  private async getActiveYear(tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!year) {
      throw new BadRequestException(
        'Aucune année scolaire active — la saisie de données est bloquée (NO ACADEMIC YEAR = NO DATA).',
      );
    }
    return year;
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    examId: string,
    newData: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          tenantId,
          userId,
          action,
          resource: 'NationalExam',
          resourceId: examId,
          tableName: 'exam_results',
          recordId: examId,
          newData,
        },
      })
      .catch(() => undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. MATIÈRES / ÉPREUVES (NationalExamSubject)
  // ═══════════════════════════════════════════════════════════════════════

  /** Matières de l'examen (triées), avec effectif de notes saisies. */
  async listSubjects(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    await this.ensureSchema();

    const subjects = await this.prisma.nationalExamSubject.findMany({
      where: { examId: exam.id },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    const counts = await this.prisma.examResult.groupBy({
      by: ['subjectId'],
      where: { examId: exam.id },
      _count: { _all: true },
    });
    const countBySubject = new Map(counts.map((c) => [c.subjectId, c._count._all]));

    return {
      examType: exam.examType,
      isPrimary: isPrimaryExamType(exam.examType),
      totalCandidates: await this.prisma.examCandidate.count({ where: { examId: exam.id } }),
      subjects: subjects.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        coefficient: s.coefficient,
        maxScore: s.maxScore,
        passingScore: s.passingScore,
        duration: s.duration,
        order: s.order,
        gradedCount: countBySubject.get(s.id) ?? 0,
      })),
      defaults: DEFAULT_SUBJECTS_BY_TYPE[exam.examType] ?? [],
    };
  }

  /** Crée le jeu de matières de l'examen — D'ABORD depuis le CATALOGUE du
   *  patronat (module Matières : matières paramétrées par type/série), avec
   * repli sur le jeu officiel intégré si le catalogue est vide. */
  async initDefaultSubjects(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    const year = await this.getActiveYear(patronat.tenantId);

    // ⭐ 1. Catalogue du patronat (module Matières) — source de vérité
    const catalogCount = await this.prisma.federisSubject
      .count({
        where: {
          tenantId: patronat.tenantId,
          academicYearId: year.id,
          examType: exam.examType,
          isActive: true,
        },
      })
      .catch(() => 0);

    if (catalogCount > 0) {
      const res = await this.subjectsService.syncCatalogToExam(tenantId, userId, examId);
      return {
        ...res,
        fromCatalog: true,
        message: `${res.message} (catalogue du module Matières — ${catalogCount} matière(s) paramétrée(s) pour le type ${exam.examType}).`,
      };
    }

    // ⭐ 2. Repli : jeu officiel intégré (catalogue vide)
    const defaults = DEFAULT_SUBJECTS_BY_TYPE[exam.examType] ?? [];
    if (defaults.length === 0) {
      throw new BadRequestException(`Aucun jeu de matières prédéfini pour le type ${exam.examType}.`);
    }
    const existing = await this.prisma.nationalExamSubject.findMany({
      where: { examId: exam.id },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((s) => s.code.toUpperCase()));
    const toCreate = defaults.filter((d) => !existingCodes.has(d.code.toUpperCase()));

    let created = 0;
    if (toCreate.length > 0) {
      const res = await this.prisma.$transaction(
        toCreate.map((d, idx) =>
          this.prisma.nationalExamSubject.create({
            data: {
              tenantId: patronat.tenantId,
              academicYearId: year.id,
              examId: exam.id,
              code: d.code,
              name: d.name,
              coefficient: d.coefficient,
              maxScore: d.maxScore ?? 20,
              duration: d.duration ?? null,
              order: (d.order ?? 0) + idx,
              status: 'ACTIVE',
              createdBy: userId,
            },
          }),
        ),
      );
      created = res.length;
    }

    await this.audit(patronat.tenantId, userId, 'FEDERIS_SUBJECTS_INIT', exam.id, {
      examCode: exam.code,
      created,
      skipped: defaults.length - created,
    });

    return {
      created,
      skipped: defaults.length - created,
      message:
        created > 0
          ? `${created} matière(s) officielle(s) ajoutée(s)${toCreate.length < defaults.length ? ' — les codes déjà présents ont été ignorés' : ''}.`
          : 'Toutes les matières officielles de ce type existent déjà.',
    };
  }

  async createSubject(tenantId: string, userId: string, examId: string, dto: CreateSubjectDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    const year = await this.getActiveYear(patronat.tenantId);

    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.nationalExamSubject.findFirst({
      where: { examId: exam.id, code },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(`Le code matière « ${code} » existe déjà pour cet examen.`);
    }

    const subject = await this.prisma.nationalExamSubject.create({
      data: {
        tenantId: patronat.tenantId,
        academicYearId: year.id,
        examId: exam.id,
        code,
        name: dto.name.trim(),
        coefficient: dto.coefficient ?? 1,
        maxScore: dto.maxScore ?? 20,
        passingScore: dto.passingScore ?? null,
        duration: dto.duration ?? null,
        order: dto.order ?? 0,
        status: 'ACTIVE',
        createdBy: userId,
      },
    });

    await this.audit(patronat.tenantId, userId, 'FEDERIS_SUBJECT_CREATE', exam.id, {
      examCode: exam.code,
      subjectCode: subject.code,
      subjectName: subject.name,
      coefficient: subject.coefficient,
    });
    return subject;
  }

  async updateSubject(
    tenantId: string,
    userId: string,
    examId: string,
    subjectId: string,
    dto: UpdateSubjectDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const subject = await this.prisma.nationalExamSubject.findFirst({
      where: { id: subjectId, examId: exam.id },
    });
    if (!subject) throw new NotFoundException('Matière introuvable pour cet examen.');

    const updated = await this.prisma.nationalExamSubject.update({
      where: { id: subject.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.coefficient !== undefined ? { coefficient: dto.coefficient } : {}),
        ...(dto.maxScore !== undefined ? { maxScore: dto.maxScore } : {}),
        ...(dto.passingScore !== undefined ? { passingScore: dto.passingScore } : {}),
        ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });

    // ⭐ Coefficient modifié → recalcul des notes coefficient existantes
    //    (weightedScore = score × coefficient, pattern bulkUpsertResults).
    if (dto.coefficient !== undefined && dto.coefficient !== subject.coefficient) {
      await this.prisma.examResult.updateMany({
        where: { examId: exam.id, subjectId: subject.id },
        data: { coefficient: dto.coefficient },
      });
      const results = await this.prisma.examResult.findMany({
        where: { examId: exam.id, subjectId: subject.id },
        select: { id: true, score: true },
      });
      for (const r of results) {
        await this.prisma.examResult.update({
          where: { id: r.id },
          data: { weightedScore: round2(r.score * (dto.coefficient ?? 1)) },
        }).catch(() => undefined);
      }
    }

    await this.audit(patronat.tenantId, userId, 'FEDERIS_SUBJECT_UPDATE', exam.id, {
      examCode: exam.code,
      subjectCode: subject.code,
      changes: dto,
    });
    return updated;
  }

  /** Supprime la matière ET les notes qui y sont rattachées (transaction). */
  async deleteSubject(tenantId: string, userId: string, examId: string, subjectId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const subject = await this.prisma.nationalExamSubject.findFirst({
      where: { id: subjectId, examId: exam.id },
    });
    if (!subject) throw new NotFoundException('Matière introuvable pour cet examen.');

    await this.prisma.$transaction(async (tx) => {
      await tx.examResult.deleteMany({ where: { examId: exam.id, subjectId: subject.id } });
      await tx.nationalExamSubject.delete({ where: { id: subject.id } });
    });

    await this.audit(patronat.tenantId, userId, 'FEDERIS_SUBJECT_DELETE', exam.id, {
      examCode: exam.code,
      subjectCode: subject.code,
      subjectName: subject.name,
    });
    return { deleted: true, subjectCode: subject.code };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. DATASET CENTRAL (public — consommé par la grille, le registre, les
  //    relevés et le service PDF ; les permissions sont vérifiées par les
  //    méthodes appelantes)
  // ═══════════════════════════════════════════════════════════════════════

  // ── ⭐ 2026-10-01 — RÈGLE ÉPREUVE PRÉPARÉE : marquage manuel ─────────────
  // L'épreuve a été préparée HORS application (traitement de texte, ronéo…) :
  // le patronat la marque « déjà préparée » pour débloquer la saisie des
  // notes de cette matière (metadata.epreuvePreparedAt sur NationalExamSubject).

  /** Marque une matière comme « déjà préparée » (épreuve hors application). */
  async markSubjectPrepared(tenantId: string, userId: string, examId: string, subjectId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    const subject = await this.prisma.nationalExamSubject.findFirst({
      where: { id: subjectId, examId: exam.id },
    });
    if (!subject) throw new NotFoundException('Matière introuvable pour cet examen.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const preparedByName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null;
    const preparedAt = new Date();
    const md = ((subject.metadata ?? {}) as Record<string, unknown>) ?? {};
    await this.prisma.nationalExamSubject.update({
      where: { id: subject.id },
      data: {
        metadata: {
          ...md,
          epreuvePreparedAt: preparedAt.toISOString(),
          epreuvePreparedBy: userId,
          epreuvePreparedByName: preparedByName,
        },
      },
    });
    await this.audit(tenantId, userId, 'FEDERIS_SUBJECT_MARK_PREPARED', exam.id, {
      subjectId: subject.id,
      subjectName: subject.name,
    });
    return {
      subjectId: subject.id,
      name: subject.name,
      epreuvePrepared: true,
      preparedSource: 'manual' as const,
      preparedAt: preparedAt.toISOString(),
      preparedByName,
    };
  }

  /** Retire le marquage manuel (l'épreuve redevient « non préparée » sauf si
   *  une épreuve correspondante existe dans le module Épreuves et documents). */
  async unmarkSubjectPrepared(tenantId: string, userId: string, examId: string, subjectId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    const subject = await this.prisma.nationalExamSubject.findFirst({
      where: { id: subjectId, examId: exam.id },
    });
    if (!subject) throw new NotFoundException('Matière introuvable pour cet examen.');

    const md = ((subject.metadata ?? {}) as Record<string, unknown>) ?? {};
    delete md.epreuvePreparedAt;
    delete md.epreuvePreparedBy;
    delete md.epreuvePreparedByName;
    await this.prisma.nationalExamSubject.update({
      where: { id: subject.id },
      data: { metadata: md },
    });

    // État recalculé : le marquage manuel est retiré — la matière reste
    // préparée si une épreuve du module lui correspond.
    const preparedMap = await computeEpreuvePreparedMap(
      this.prisma,
      patronat.tenantId,
      exam.academicYearId,
      exam.examType,
      [subject as any],
    );
    await this.audit(tenantId, userId, 'FEDERIS_SUBJECT_UNMARK_PREPARED', exam.id, {
      subjectId: subject.id,
      subjectName: subject.name,
    });
    return {
      subjectId: subject.id,
      name: subject.name,
      epreuvePrepared: preparedMap.get(subject.id)?.prepared ?? false,
      preparedSource: preparedMap.get(subject.id)?.source ?? null,
    };
  }

  /**
   * Collecte et calcule TOUT l'état « notes et moyennes » d'un examen :
   * matières, candidats, notes (avec isAbsent lu en brut de secours — pattern
   * anonymatCode de listCandidates), statistiques Helm primaire/secondaire,
   * rangs denses (global + par matière), session de saisie et récapitulatifs.
   */
  async buildGradesDataset(patronatTenantId: string, examId: string) {
    await this.ensureSchema();
    const exam = await this.getOwnedExam(patronatTenantId, examId);
    const isPrimary = isPrimaryExamType(exam.examType);

    // ⭐ Règles de calcul effectives (module Paramètres — 2026-09-30) :
    //    surcharge du patronat si définie (source de vérité), sinon défauts
    //    backend (admission 10/20). Les seuils pilotent stats + décisions et
    //    le MODÈLE DE CALCUL (simple / pondérée) pilote la moyenne retenue.
    const rules = await this.gradingRulesService.resolveEffectiveRules(
      patronatTenantId,
      exam.examType,
    );
    // Modèle de calcul effectif — indépendant du template d'affichage
    // (isPrimary : grille primaire CEP / secondaire avec coefficients).
    const useSimpleAverage = rules.averageModel === 'simple';

    const [academicYear, subjectsRaw, candidatesRaw] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: exam.academicYearId } }),
      this.prisma.nationalExamSubject.findMany({
        where: { examId: exam.id },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.examCandidate.findMany({
        where: { examId: exam.id },
        include: {
          center: { select: { id: true, code: true, name: true } },
          room: { select: { id: true, code: true, name: true } },
          schoolTenant: { select: { id: true, name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
    ]);

    // ⭐ 2026-10-01 — RÈGLE ÉPREUVE PRÉPARÉE : chaque matière sait si son
    //    épreuve est préparée (module Épreuves et documents ou marquage
    //    manuel « déjà préparée ») — la grille verrouille la saisie des
    //    matières non préparées.
    const preparedMap = await computeEpreuvePreparedMap(
      this.prisma,
      patronatTenantId,
      exam.academicYearId,
      exam.examType,
      subjectsRaw as any,
    );
    const subjects: GradeSubjectLite[] = subjectsRaw.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      coefficient: s.coefficient ?? 1,
      maxScore: s.maxScore ?? 20,
      order: s.order ?? 0,
      epreuvePrepared: preparedMap.get(s.id)?.prepared ?? false,
      preparedSource: preparedMap.get(s.id)?.source ?? null,
      passingScore: s.passingScore ?? null,
      perfectionnement: isCepPerfectionnementSubject(s.code, s.name),
    }));

    // ⭐ Notes : lecture brute de secours pour isAbsent (colonne récente —
    //    le client Prisma déployé la renvoie, la sandbox locale peut manquer).
    let results: Array<{
      candidateId: string;
      subjectId: string;
      score: number;
      isAbsent: boolean;
      status: string;
      metadata: unknown;
    }> = [];
    try {
      results = (await this.prisma.$queryRawUnsafe(
        `SELECT "candidateId", "subjectId", "score", "isAbsent", "status", "metadata"
         FROM "exam_results" WHERE "examId" = $1`,
        exam.id,
      )) as any[];
      if (!Array.isArray(results)) results = [];
    } catch {
      results = [];
    }
    if (results.length === 0) {
      // Fallback client Prisma (isAbsent inconnu localement → false).
      const fallback = await this.prisma.examResult.findMany({
        where: { examId: exam.id },
        select: { candidateId: true, subjectId: true, score: true, status: true, metadata: true },
      });
      results = fallback.map((r) => ({
        candidateId: r.candidateId,
        subjectId: r.subjectId,
        score: r.score,
        isAbsent: false,
        status: r.status,
        metadata: r.metadata,
      }));
    }

    // scores[candidateId][subjectId] = { score, isAbsent, cm, cp }
    // ⭐ CEP : reprise des notes héritées (sans détail CM/CP en base) par
    //    scission automatique — CM = min(note, 18), CP = le reste.
    const scoreMap = new Map<string, Record<string, GradeCellLite>>();
    for (const r of results) {
      if (!scoreMap.has(r.candidateId)) scoreMap.set(r.candidateId, {});
      const md = (r.metadata ?? {}) as any;
      let cm: number | null =
        md.cm !== undefined && md.cm !== null && Number.isFinite(Number(md.cm))
          ? Number(md.cm)
          : null;
      let cp: number | null =
        md.cp !== undefined && md.cp !== null && Number.isFinite(Number(md.cp))
          ? Number(md.cp)
          : null;
      if (isPrimary && !r.isAbsent && r.score != null && cm === null) {
        const split = splitCepScore(r.score);
        cm = split.cm;
        cp = split.cp;
      }
      if (!isPrimary) {
        cm = null;
        cp = null;
      }
      scoreMap.get(r.candidateId)![r.subjectId] = {
        score: r.score,
        isAbsent: Boolean((r as any).isAbsent),
        cm,
        cp,
      };
    }

    const candidates: GradeCandidateLite[] = candidatesRaw.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      matricule: c.matricule,
      anonymatCode: (c as any).anonymatCode ?? null,
      gender: c.gender,
      school: (c as any).schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
      centerId: c.centerId,
      centerCode: (c as any).center?.code ?? null,
      centerName: (c as any).center?.name ?? null,
      roomCode: (c as any).room?.code ?? null,
      tableNumber: c.tableNumber,
      scores: scoreMap.get(c.id) ?? {},
    }));

    // ── Statistiques par candidat + rangs (pattern Helm) ──
    //    ⭐ Moyenne retenue = MODÈLE DE CALCUL des règles effectives.
    const computed = new Map<string, CandidateComputed>();
    for (const c of candidates) {
      computed.set(c.id, computeCandidateStats(c.scores, subjects, useSimpleAverage));
    }
    const denseRanks = computeDenseRanks(
      candidates.map((c) => ({ id: c.id, value: computed.get(c.id)?.finalAverage ?? null })),
    );

    // Rang par matière (dense, notes non-absentes uniquement).
    const subjectRanks = new Map<string, Map<string, number>>();
    for (const subject of subjects) {
      subjectRanks.set(
        subject.id,
        computeDenseRanks(
          candidates.map((c) => ({
            id: c.id,
            value: c.scores[subject.id]?.isAbsent
              ? null
              : c.scores[subject.id]?.score ?? null,
          })),
        ),
      );
    }

    // ── Session de saisie ──
    const draftCount = results.filter((r) => r.status === 'DRAFT').length;
    const submittedCount = results.filter((r) => r.status === 'SUBMITTED').length;
    const locked = exam.status === 'RESULTS_PUBLISHED';
    const allSubmitted = submittedCount > 0 && draftCount === 0;

    // ── Récapitulatif (pattern « Récapitulatif de l'évaluation » Helm) ──
    //    ⭐ Seuil d'admission = règles de calcul effectives (Paramètres).
    const composed = candidates.filter((c) => (computed.get(c.id)?.nbEval ?? 0) > 0);
    const finalAverages = composed
      .map((c) => computed.get(c.id)?.finalAverage ?? null)
      .filter((v): v is number => v !== null);
    const passed = finalAverages.filter((v) => v >= rules.passMark).length;

    const stats = {
      totalCandidates: candidates.length,
      composed: composed.length,
      passed,
      failed: composed.length - passed,
      successRate: composed.length > 0 ? round2((passed / composed.length) * 100) : null,
      generalAverage:
        finalAverages.length > 0
          ? round2(finalAverages.reduce((a, b) => a + b, 0) / finalAverages.length)
          : null,
      bestAverage: finalAverages.length > 0 ? Math.max(...finalAverages) : null,
      worstAverage: finalAverages.length > 0 ? Math.min(...finalAverages) : null,
    };

    // Par centre d'examen.
    const perCenterMap = new Map<string, { centerCode: string; centerName: string; ids: string[] }>();
    for (const c of candidates) {
      const key = c.centerId ?? '__NONE__';
      if (!perCenterMap.has(key)) {
        perCenterMap.set(key, {
          centerCode: c.centerCode ?? '—',
          centerName: c.centerName ?? 'Non affecté',
          ids: [],
        });
      }
      perCenterMap.get(key)!.ids.push(c.id);
    }
    const perCenter = [...perCenterMap.values()]
      .map((center) => {
        const values = center.ids
          .map((id) => computed.get(id)?.finalAverage ?? null)
          .filter((v): v is number => v !== null);
        const centerComposed = values.length;
        const centerPassed = values.filter((v) => v >= rules.passMark).length;
        return {
          centerCode: center.centerCode,
          centerName: center.centerName,
          candidates: center.ids.length,
          composed: centerComposed,
          passed: centerPassed,
          successRate:
            centerComposed > 0 ? round2((centerPassed / centerComposed) * 100) : null,
          average:
            centerComposed > 0
              ? round2(values.reduce((a, b) => a + b, 0) / centerComposed)
              : null,
        };
      })
      .sort((a, b) => b.candidates - a.candidates);

    // Remplissage de la grille.
    const gradedCells = results.filter((r) => !r.isAbsent).length;
    const totalCells = candidates.length * subjects.length;

    return {
      exam: {
        id: exam.id,
        code: exam.code,
        name: exam.name,
        examType: exam.examType,
        level: exam.level,
        status: exam.status,
        isPrimary,
        startDate: exam.startDate ?? null,
        session: examSessionLabel(exam, academicYear?.label ?? academicYear?.name ?? null),
      },
      rules,
      academicYearLabel: academicYear?.label ?? academicYear?.name ?? null,
      subjects,
      candidates,
      computed,
      ranks: denseRanks,
      subjectRanks,
      session: {
        draftCount,
        submittedCount,
        allSubmitted,
        locked,
        editable: !locked && !allSubmitted,
      },
      filling: {
        gradedCells,
        totalCells,
        absentCells: results.filter((r) => r.isAbsent).length,
        fullyGraded: candidates.filter((c) => {
          const comp = computed.get(c.id);
          return comp !== undefined && comp.nbEval === subjects.length && subjects.length > 0;
        }).length,
      },
      stats,
      perCenter,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. GRILLE DE SAISIE (pattern getGradingSheet Helm)
  // ═══════════════════════════════════════════════════════════════════════

  async getGradingSheet(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const ds = await this.buildGradesDataset(patronat.tenantId, examId);
    return {
      exam: ds.exam,
      academicYearLabel: ds.academicYearLabel,
      // ⭐ Règles effectives (seuils + modèle de calcul) — calculs LIVE du miroir
      rules: ds.rules,
      subjects: ds.subjects,
      session: ds.session,
      filling: ds.filling,
      stats: ds.stats,
      candidates: ds.candidates.map((c) => ({
        ...c,
        computed: ds.computed.get(c.id) ?? null,
        rank: ds.ranks.get(c.id) ?? null,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. SAUVEGARDE / SOUMISSION / RÉOUVERTURE
  // ═══════════════════════════════════════════════════════════════════════

  /** Enregistre les cellules modifiées de la grille (upsert / effacement). */
  async bulkSaveGrades(
    tenantId: string,
    userId: string,
    examId: string,
    dto: BulkSaveGradesDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    const year = await this.getActiveYear(patronat.tenantId);

    if (exam.status === 'RESULTS_PUBLISHED') {
      throw new BadRequestException(
        'Les résultats de cet examen sont publiés — la saisie des notes est verrouillée.',
      );
    }
    if (!dto.grades?.length) {
      throw new BadRequestException('Aucune cellule transmise.');
    }
    if (dto.grades.length > 5000) {
      throw new BadRequestException('Trop de cellules (max 5000 par lot).');
    }

    // Verrou de session : saisie soumise → réouverture préalable obligatoire.
    const statusCounts = await this.prisma.examResult.groupBy({
      by: ['status'],
      where: { examId: exam.id },
      _count: { _all: true },
    });
    const draft = statusCounts.find((s) => s.status === 'DRAFT')?._count._all ?? 0;
    const submitted = statusCounts.find((s) => s.status === 'SUBMITTED')?._count._all ?? 0;
    if (submitted > 0 && draft === 0) {
      throw new BadRequestException(
        'La saisie a été soumise (verrouillée) — rouvrez la session avant toute modification.',
      );
    }

    // Index de validation : candidats et matières de l'examen.
    const [candidates, subjects] = await Promise.all([
      this.prisma.examCandidate.findMany({
        where: { examId: exam.id },
        select: { id: true },
      }),
      this.prisma.nationalExamSubject.findMany({
        where: { examId: exam.id },
        select: { id: true, name: true, code: true, coefficient: true, maxScore: true, passingScore: true, metadata: true },
      }),
    ]);
    const candidateIds = new Set(candidates.map((c) => c.id));
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    // ⭐ Modèle CEP : CM (/18) + CP (/2) = note (/20).
    const isPrimary = isPrimaryExamType(exam.examType);

    // ⭐ Métadonnées existantes (décisions de délibération éventuelles) —
    //    le détail CM/CP est FUSIONNÉ, jamais écrasé.
    let metaByCell = new Map<string, any>();
    if (isPrimary) {
      const existingRows = await this.prisma.examResult.findMany({
        where: { examId: exam.id },
        select: { candidateId: true, subjectId: true, metadata: true },
      });
      metaByCell = new Map(
        existingRows.map((m) => [`${m.candidateId}|${m.subjectId}`, (m.metadata ?? {}) as any]),
      );
    }

    // ⭐ 2026-10-01 — RÈGLE ÉPREUVE PRÉPARÉE : refus de toute cellule d'une
    //    matière dont l'épreuve n'est PAS préparée (ni dans le module
    //    Épreuves et documents, ni marquée manuellement « déjà préparée »).
    //    Le message guide l'utilisateur : préparer l'épreuve OU la marquer.
    const preparedMap = await computeEpreuvePreparedMap(
      this.prisma,
      patronat.tenantId,
      exam.academicYearId,
      exam.examType,
      subjects as any,
    );
    const unprepared = new Set<string>();
    for (const cell of dto.grades) {
      const subj = subjectById.get(cell.subjectId);
      if (subj && !(preparedMap.get(subj.id)?.prepared ?? false)) {
        unprepared.add(subj.name);
      }
    }
    if (unprepared.size > 0) {
      throw new BadRequestException(
        `Saisie refusée — notes bloquées pour ${unprepared.size} matière(s) sans épreuve préparée : ` +
          `${Array.from(unprepared).join(', ')}. Préparez l'épreuve dans le module « Épreuves et documents » ` +
          `ou marquez-la comme « déjà préparée » (épreuve produite hors application) pour débloquer la saisie.`,
      );
    }

    let saved = 0;
    let deleted = 0;
    let absent = 0;
    const errors: string[] = [];

    for (const cell of dto.grades) {
      const subject = subjectById.get(cell.subjectId);
      if (!candidateIds.has(cell.candidateId)) {
        errors.push('Candidat inconnu dans cet examen.');
        continue;
      }
      if (!subject) {
        errors.push(`Matière inconnue : ${cell.subjectId}`);
        continue;
      }

      // Effacement : score null et non absent → suppression de la ligne.
      // (CEP : effacement seulement si CM ET note sont vides.)
      const isAbsent = cell.isAbsent === true;
      const scoreEmpty =
        cell.score === null || cell.score === undefined || Number.isNaN(Number(cell.score));
      const cmEmpty =
        cell.cm === null || cell.cm === undefined || Number.isNaN(Number(cell.cm));

      if (!isAbsent && scoreEmpty && cmEmpty) {
        const res = await this.prisma.examResult
          .deleteMany({
            where: {
              examId: exam.id,
              candidateId: cell.candidateId,
              subjectId: subject.id,
            },
          })
          .catch(() => ({ count: 0 }));
        deleted += res.count ?? 0;
        continue;
      }

      // Absent → score 0 (contrainte NOT NULL) mais EXCLU des calculs ;
      // note → bornée au barème de la matière.
      // ⭐ CEP — détail CM (/18) + CP (/2) :
      //   · cm transmis → borne [0 ; 18] ;
      //   · cp transmis → borne [0 ; 2] ET forcé à 0 si CM < note minimale
      //     exigée (règle officielle du perfectionnement — pattern Helm) ;
      //   · note /20 = CM + CP ;
      //   · si seul `score` est transmis (reprise), il est scindé : CM =
      //     min(note, 18), CP = le reste.
      const coefficient = subject.coefficient ?? 1;
      let score: number;
      let cepDetail: { cm: number; cp: number } | null = null;
      if (isPrimary) {
        const minRequise = subject.passingScore ?? 10;
        let cm: number;
        let cp: number;
        if (cell.cm !== undefined && cell.cm !== null && Number.isFinite(Number(cell.cm))) {
          cm = Math.max(0, Math.min(Number(cell.cm), CEP_CM_MAX));
          cp =
            cell.cp !== undefined && cell.cp !== null && Number.isFinite(Number(cell.cp))
              ? Math.max(0, Math.min(Number(cell.cp), CEP_CP_MAX))
              : 0;
          if (cm < minRequise) cp = 0;
        } else {
          const split = splitCepScore(isAbsent ? 0 : Number(cell.score) || 0);
          cm = split.cm;
          cp = split.cp;
        }
        cepDetail = { cm, cp };
        score = isAbsent ? 0 : Math.max(0, Math.min(round2(cm + cp), subject.maxScore ?? 20));
        // Fusion avec les métadonnées existantes (décisions jury conservées).
        const prevMeta = metaByCell.get(`${cell.candidateId}|${subject.id}`) ?? {};
        cepDetail = { ...prevMeta, cm, cp };
      } else {
        score = isAbsent ? 0 : Math.max(0, Math.min(Number(cell.score), subject.maxScore ?? 20));
      }

      await this.prisma.examResult
        .upsert({
          where: {
            tenantId_academicYearId_examId_candidateId_subjectId: {
              tenantId: patronat.tenantId,
              academicYearId: year.id,
              examId: exam.id,
              candidateId: cell.candidateId,
              subjectId: subject.id,
            },
          },
          create: {
            tenantId: patronat.tenantId,
            academicYearId: year.id,
            examId: exam.id,
            candidateId: cell.candidateId,
            subjectId: subject.id,
            score,
            maxScore: subject.maxScore ?? 20,
            coefficient,
            weightedScore: round2(score * coefficient),
            isAbsent,
            status: 'DRAFT',
            enteredBy: userId,
            ...(cepDetail ? { metadata: { cm: cepDetail.cm, cp: cepDetail.cp } } : {}),
          },
          update: {
            score,
            coefficient,
            weightedScore: round2(score * coefficient),
            isAbsent,
            status: 'DRAFT',
            enteredBy: userId,
            validatedBy: null,
            validatedAt: null,
            ...(cepDetail ? { metadata: { cm: cepDetail.cm, cp: cepDetail.cp } } : {}),
          },
        })
        .catch((err: any) => {
          errors.push(`${subject.code} : ${err?.message ?? 'erreur d\u2019enregistrement'}`);
        });
      if (isAbsent) absent += 1;
      saved += 1;
    }

    await this.audit(patronat.tenantId, userId, 'FEDERIS_GRADES_BULK_SAVE', exam.id, {
      examCode: exam.code,
      received: dto.grades.length,
      saved,
      deleted,
      absent,
      errors: errors.length,
    });

    return { saved, deleted, absent, errors, message: `${saved} note(s) enregistrée(s).` };
  }

  /** Soumet la session de saisie : toutes les notes passent en SUBMITTED (verrou). */
  async submitGrades(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (exam.status === 'RESULTS_PUBLISHED') {
      throw new BadRequestException('Résultats déjà publiés — session définitivement verrouillée.');
    }
    const total = await this.prisma.examResult.count({ where: { examId: exam.id } });
    if (total === 0) {
      throw new BadRequestException('Aucune note saisie — rien à soumettre.');
    }
    const res = await this.prisma.examResult.updateMany({
      where: { examId: exam.id, status: 'DRAFT' },
      data: { status: 'SUBMITTED', validatedBy: userId, validatedAt: new Date() },
    });
    await this.audit(patronat.tenantId, userId, 'FEDERIS_GRADES_SUBMIT', exam.id, {
      examCode: exam.code,
      submitted: res.count,
    });
    return {
      submitted: res.count,
      message: `Saisie soumise — ${res.count} note(s) verrouillée(s) jusqu'à réouverture.`,
    };
  }

  /** Rouvre la session de saisie (interdit après publication des résultats). */
  async reopenGrades(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteGrades(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (exam.status === 'RESULTS_PUBLISHED') {
      throw new BadRequestException(
        'Résultats déjà publiés — la saisie ne peut plus être rouverte.',
      );
    }
    const res = await this.prisma.examResult.updateMany({
      where: { examId: exam.id, status: 'SUBMITTED' },
      data: { status: 'DRAFT', validatedBy: null, validatedAt: null },
    });
    await this.audit(patronat.tenantId, userId, 'FEDERIS_GRADES_REOPEN', exam.id, {
      examCode: exam.code,
      reopened: res.count,
    });
    return { reopened: res.count, message: 'Session de saisie rouverte (brouillon).' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. REGISTRE DES NOTES (lecture seule + récapitulatifs — pattern Helm)
  // ═══════════════════════════════════════════════════════════════════════

  async getRegistry(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const ds = await this.buildGradesDataset(patronat.tenantId, examId);
    return {
      exam: ds.exam,
      academicYearLabel: ds.academicYearLabel,
      subjects: ds.subjects,
      session: ds.session,
      stats: ds.stats,
      perCenter: ds.perCenter,
      candidates: ds.candidates.map((c) => ({
        ...c,
        computed: ds.computed.get(c.id) ?? null,
        rank: ds.ranks.get(c.id) ?? null,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. RELEVÉS DE NOTES (données de l'onglet + PDF — « bulletin » Helm)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Relevés complets, triés par rang : pour chaque candidat, lignes par
   * matière (note, coefficient, note coefficient, rang dans la matière,
   * appréciation), totaux, moyenne retenue, rang, mention et décision
   * provisoire au seuil des RÈGLES DE CALCUL EFFECTIVES (Paramètres — la
   * décision officielle relève du jury de délibération).
   */
  async getReleves(tenantId: string, userId: string, examId: string, candidateId?: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const ds = await this.buildGradesDataset(patronat.tenantId, examId);
    const header = await this.loadPatronatHeaderInfo(patronat.tenantId);
    return this.buildRelevesPayload(ds, header, candidateId);
  }

  /**
   * ⭐ Accès ÉCOLE (2026-09-30) — relevé d'un candidat pour l'établissement
   * Helm qui l'a présenté : vérifie l'appartenance du candidat à l'école ET
   * que le relevé lui a été distribué (ExamDocument PUBLISHED — module
   * Délibération « Envoyer les relevés »), puis reconstruit le relevé sur le
   * dataset du patronat propriétaire (aucune duplication de règle métier).
   */
  async getReleveForSchool(
    schoolTenantId: string,
    userId: string,
    examId: string,
    candidateId: string,
  ) {
    const candidate = await this.prisma.examCandidate.findFirst({
      where: { id: candidateId, examId },
      select: { id: true, schoolTenantId: true },
    });
    if (!candidate) throw new NotFoundException('Candidat introuvable pour cet examen.');
    if (candidate.schoolTenantId !== schoolTenantId) {
      throw new ForbiddenException('Ce candidat n\u2019appartient pas à votre établissement.');
    }

    // Relevé distribué à l'école (ledger ExamDocument du module Délibération)
    const doc = await this.prisma.examDocument.findFirst({
      where: {
        examId,
        candidateId,
        documentType: 'RELEVE_NOTES',
        status: 'PUBLISHED',
      },
      select: { id: true, publishedAt: true, metadata: true },
    });
    if (!doc) {
      throw new ForbiddenException(
        'Le relevé de notes de ce candidat n\u2019a pas encore été distribué à votre établissement par le patronat.',
      );
    }

    const exam = await this.prisma.nationalExam.findUnique({
      where: { id: examId },
      select: { tenantId: true },
    });
    if (!exam) throw new NotFoundException('Examen introuvable.');

    const ds = await this.buildGradesDataset(exam.tenantId, examId);
    const header = await this.loadPatronatHeaderInfo(exam.tenantId);
    const payload = await this.buildRelevesPayload(ds, header, candidateId);
    const releve = payload.releves[0] ?? null;
    return {
      releve,
      exam: payload.exam,
      rules: payload.rules,
      dispatchedAt: doc.publishedAt,
      dispatchMetadata: (doc.metadata as any) ?? null,
    };
  }

  /**
   * ⭐ T26 (2026-10-01) — Portail PUBLIC de consultation des résultats
   * (parents) : payload relevés SANS contexte utilisateur — la validité du
   * LIEN TOKEN fait foi (vérifiée par FederisPublicResultsService AVANT cet
   * appel : examen publié + lien non révoqué + non expiré).
   *
   * Jamais exposé directement : consommé uniquement par le service public
   * qui n'en diffuse que les champs strictement nécessaires (identité de
   * l'élève, notes, moyenne, décision — aucun contact ni PII sensible).
   */
  async getRelevesForPublicExam(tenantId: string, examId: string) {
    const ds = await this.buildGradesDataset(tenantId, examId);
    const header = await this.loadPatronatHeaderInfo(tenantId);
    return this.buildRelevesPayload(ds, header, undefined);
  }

  /** En-tête patronat du relevé officiel : nom, territoire, coordonnateur
   *  (signataire) — remplace le bloc ministériel du modèle officiel. */
  /** (public — réutilisé par FederisPdfService pour l.en-tête du relevé officiel) */
  async loadPatronatHeaderInfo(tenantId: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: {
        name: true,
        abbreviation: true,
        territoryName: true,
        address: true,
        primaryPhone: true,
        primaryEmail: true,
        country: { select: { name: true } },
      },
    });
    let coordinatorName: string | null = null;
    try {
      const link = await this.prisma.patronatUser.findFirst({
        where: { tenantId, isActive: true, role: 'COORDONNATEUR' },
        select: { user: { select: { firstName: true, lastName: true } } },
      });
      if (link?.user) {
        coordinatorName = `${link.user.firstName ?? ''} ${link.user.lastName ?? ''}`.trim() || null;
      }
      if (!coordinatorName) {
        const bureau = await this.prisma.patronatBureauMember.findFirst({
          where: {
            patronat: { tenantId },
            isActive: true,
            role: { contains: 'COORDONNATEUR', mode: 'insensitive' },
          },
          select: { firstName: true, lastName: true },
        });
        if (bureau) coordinatorName = `${bureau.firstName} ${bureau.lastName}`.trim();
      }
    } catch {
      /* bureau optionnel — signature générique si absent */
    }
    const place =
      patronat?.address?.split(/[\n,]/)[0]?.trim() ||
      patronat?.territoryName ||
      patronat?.country?.name ||
      '';
    return {
      name: patronat?.name ?? 'Patronat',
      abbreviation: patronat?.abbreviation ?? null,
      territoryName: patronat?.territoryName ?? null,
      address: patronat?.address ?? null,
      phone: patronat?.primaryPhone ?? null,
      email: patronat?.primaryEmail ?? null,
      country: patronat?.country?.name ?? null,
      coordinatorName,
      place,
    };
  }

  /** Construction du payload relevés à partir d'un dataset déjà calculé.
   *  ⭐ 2026-10-01 — MODÈLES OFFICIELS :
   *     · CEP  → MATIÈRE | CEP {NOTE OBTENUE (= CM /18) | NOTE MINIMALE
   *       EXIGÉE} | NOTE DE PERFECTIONNEMENT OBTENUE (= CP /2) + décision
   *       du jury (Admis CEP / Admis entrée en 6ème) ;
   *     · BEPC / BAC / CAP → MATIÈRES | COEF. | NOTE/20 | NOTE COEF. |
   *       BILAN (Total Français, Total Écrit, Total Final, Moyenne). */
  private async buildRelevesPayload(
    ds: Awaited<ReturnType<FederisGradesService['buildGradesDataset']>>,
    header: Awaited<ReturnType<FederisGradesService['loadPatronatHeaderInfo']>>,
    candidateId?: string,
  ) {
    const passMark = ds.rules?.passMark ?? 10;
    const isPrimary = ds.exam.isPrimary === true;
    const ordered = [...ds.candidates].sort(
      (a, b) => (ds.ranks.get(a.id) ?? 99999) - (ds.ranks.get(b.id) ?? 99999),
    );
    const scoped = ordered.filter((c) => !candidateId || c.id === candidateId);

    // Détails d'état civil des candidats (relevé officiel : date et lieu de
    // naissance, n° d'inscription, nature de la candidature).
    const candIds = scoped.map((c) => c.id);
    const civilRows = candIds.length
      ? await this.prisma.examCandidate.findMany({
          where: { id: { in: candIds } },
          select: { id: true, dateOfBirth: true, placeOfBirth: true, registrationNumber: true, metadata: true },
        })
      : [];
    const civilById = new Map(civilRows.map((r) => [r.id, r]));

    // Série unique (BAC — intitulé officiel « Baccalauréat — Série D »).
    const subjectsMeta = await this.prisma.nationalExamSubject
      .findMany({ where: { examId: ds.exam.id }, select: { code: true, metadata: true } })
      .catch(() => [] as Array<{ code: string; metadata: unknown }>);
    const seriesSet = new Set<string>();
    for (const s of subjectsMeta) {
      const ser = (s.metadata as any)?.series;
      if (ser && typeof ser === 'string' && ser.trim()) seriesSet.add(ser.trim());
    }
    const series = seriesSet.size === 1 ? [...seriesSet][0] : null;

    const releves = scoped
      .map((c) => {
        const comp = ds.computed.get(c.id);
        const civil = civilById.get(c.id);
        const lines = ds.subjects.map((subject) => {
          const cell = c.scores[subject.id];
          const isAbsent = cell?.isAbsent === true;
          const score = !isAbsent && cell?.score != null ? cell.score : null;
          const cm = isPrimary && !isAbsent && cell?.cm != null ? cell.cm : null;
          const cp = isPrimary && !isAbsent && cell?.cp != null ? cell.cp : null;
          return {
            subjectId: subject.id,
            code: subject.code,
            name: subject.name,
            coefficient: subject.coefficient,
            maxScore: subject.maxScore,
            score,
            isAbsent,
            // ⭐ CEP — détail officiel CM / CP + minimale exigée + étoile.
            cm,
            cp,
            passingScore: subject.passingScore ?? 10,
            perfectionnement: subject.perfectionnement,
            // ⭐ BEPC / BAC / CAP — matière du groupe Français (BILAN).
            francais: !isPrimary && isFrenchGroupSubject(subject.name),
            noteCoef: score !== null ? round2(score * subject.coefficient) : null,
            rankInSubject: ds.subjectRanks.get(subject.id)?.get(c.id) ?? null,
            appreciation: score === null ? '—' : appreciationFor(score),
          };
        });
        const finalAverage = comp?.finalAverage ?? null;

        // ⭐ Décision du jury CEP (règles officielles du relevé).
        const cepAdmission = isPrimary
          ? computeCepAdmission(
              lines.map((l) => ({
                score: l.score,
                isAbsent: l.isAbsent,
                passingScore: l.passingScore,
                cp: l.cp,
                perfectionnement: l.perfectionnement,
              })),
              ds.subjects.length,
            )
          : null;

        // ⭐ Colonne BILAN du relevé secondaire (BEPC / BAC / CAP).
        const bilan = !isPrimary
          ? computeReleveBilan(
              lines.map((l) => ({
                name: l.name,
                score: l.score,
                isAbsent: l.isAbsent,
                coefficient: l.coefficient,
              })),
            )
          : null;

        const decision = isPrimary
          ? cepAdmission
            ? cepAdmission.admisCep
              ? 'ADMIS'
              : 'AJOURNÉ'
            : '—'
          : finalAverage === null
            ? '—'
            : finalAverage >= passMark
              ? 'ADMIS'
              : 'AJOURNÉ';

        const civilMeta = (civil?.metadata ?? {}) as any;
        return {
          // Contexte d'examen transporté dans chaque relevé (aperçu + PDF).
          academicYearLabel: ds.academicYearLabel,
          examName: ds.exam.name,
          examCode: ds.exam.code,
          examType: ds.exam.examType,
          level: ds.exam.level,
          session: ds.exam.session,
          officialTitle: officialExamTitle(ds.exam.examType, series),
          bestAverage: ds.stats.bestAverage,
          worstAverage: ds.stats.worstAverage,
          candidate: {
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            matricule: c.matricule,
            anonymatCode: c.anonymatCode,
            gender: c.gender,
            school: c.school,
            centerCode: c.centerCode,
            centerName: c.centerName,
            roomCode: c.roomCode,
            tableNumber: c.tableNumber,
            // État civil du relevé officiel.
            dateOfBirth: civil?.dateOfBirth ?? null,
            placeOfBirth: civil?.placeOfBirth ?? null,
            registrationNumber: civil?.registrationNumber ?? c.matricule,
            candidatureNature: civilMeta.candidatureNature ?? civilMeta.nature ?? 'Officiel',
          },
          lines,
          computed: comp ?? null,
          rank: ds.ranks.get(c.id) ?? null,
          totalCandidates: ds.candidates.length,
          mention: nationalMentionFor(finalAverage),
          decision,
          decisionNote: `Décision provisoire au seuil de ${passMark}/20 (règles de calcul du patronat) — la décision officielle relève du jury de délibération.`,
          // ⭐ CEP — décision du jury officielle.
          cepAdmission,
          // ⭐ BEPC / BAC / CAP — sous-totaux de la colonne BILAN.
          bilan,
        };
      });

    return {
      exam: ds.exam,
      rules: ds.rules,
      academicYearLabel: ds.academicYearLabel,
      session: ds.session,
      stats: ds.stats,
      perCenter: ds.perCenter,
      // ⭐ En-tête patronat (remplace le bloc ministériel du modèle officiel).
      patronat: header,
      releves,
    };
  }
}
