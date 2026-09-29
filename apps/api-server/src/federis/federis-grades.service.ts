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

/** Une cellule de la grille : note /20 (null = effacer) + marquage absent. */
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

export interface GradeSubjectLite {
  id: string;
  code: string;
  name: string;
  coefficient: number;
  maxScore: number;
  order: number;
}

export interface GradeCellLite {
  score: number | null;
  isAbsent: boolean;
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

    const subjects: GradeSubjectLite[] = subjectsRaw.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      coefficient: s.coefficient ?? 1,
      maxScore: s.maxScore ?? 20,
      order: s.order ?? 0,
    }));

    // ⭐ Notes : lecture brute de secours pour isAbsent (colonne récente —
    //    le client Prisma déployé la renvoie, la sandbox locale peut manquer).
    let results: Array<{
      candidateId: string;
      subjectId: string;
      score: number;
      isAbsent: boolean;
      status: string;
    }> = [];
    try {
      results = (await this.prisma.$queryRawUnsafe(
        `SELECT "candidateId", "subjectId", "score", "isAbsent", "status"
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
        select: { candidateId: true, subjectId: true, score: true, status: true },
      });
      results = fallback.map((r) => ({
        candidateId: r.candidateId,
        subjectId: r.subjectId,
        score: r.score,
        isAbsent: false,
        status: r.status,
      }));
    }

    // scores[candidateId][subjectId] = { score, isAbsent }
    const scoreMap = new Map<string, Record<string, GradeCellLite>>();
    for (const r of results) {
      if (!scoreMap.has(r.candidateId)) scoreMap.set(r.candidateId, {});
      scoreMap.get(r.candidateId)![r.subjectId] = {
        score: r.score,
        isAbsent: Boolean((r as any).isAbsent),
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
        select: { id: true, coefficient: true, maxScore: true, code: true },
      }),
    ]);
    const candidateIds = new Set(candidates.map((c) => c.id));
    const subjectById = new Map(subjects.map((s) => [s.id, s]));

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
      const isAbsent = cell.isAbsent === true;
      const scoreEmpty =
        cell.score === null || cell.score === undefined || Number.isNaN(Number(cell.score));

      if (!isAbsent && scoreEmpty) {
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
      const score = isAbsent ? 0 : Math.max(0, Math.min(Number(cell.score), subject.maxScore ?? 20));
      const coefficient = subject.coefficient ?? 1;

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
    return this.buildRelevesPayload(ds, candidateId);
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
    const payload = await this.buildRelevesPayload(ds, candidateId);
    const releve = payload.releves[0] ?? null;
    return {
      releve,
      exam: payload.exam,
      rules: payload.rules,
      dispatchedAt: doc.publishedAt,
      dispatchMetadata: (doc.metadata as any) ?? null,
    };
  }

  /** Construction du payload relevés à partir d'un dataset déjà calculé. */
  private async buildRelevesPayload(
    ds: Awaited<ReturnType<FederisGradesService['buildGradesDataset']>>,
    candidateId?: string,
  ) {
    const passMark = ds.rules?.passMark ?? 10;
    const ordered = [...ds.candidates].sort(
      (a, b) => (ds.ranks.get(a.id) ?? 99999) - (ds.ranks.get(b.id) ?? 99999),
    );

    const releves = ordered
      .filter((c) => !candidateId || c.id === candidateId)
      .map((c) => {
        const comp = ds.computed.get(c.id);
        const lines = ds.subjects.map((subject) => {
          const cell = c.scores[subject.id];
          const isAbsent = cell?.isAbsent === true;
          const score = !isAbsent && cell?.score != null ? cell.score : null;
          return {
            subjectId: subject.id,
            code: subject.code,
            name: subject.name,
            coefficient: subject.coefficient,
            maxScore: subject.maxScore,
            score,
            isAbsent,
            noteCoef: score !== null ? round2(score * subject.coefficient) : null,
            rankInSubject: ds.subjectRanks.get(subject.id)?.get(c.id) ?? null,
            appreciation: score === null ? '—' : appreciationFor(score),
          };
        });
        const finalAverage = comp?.finalAverage ?? null;
        return {
          // Contexte d'examen transporté dans chaque relevé (aperçu + PDF).
          academicYearLabel: ds.academicYearLabel,
          examName: ds.exam.name,
          examCode: ds.exam.code,
          examType: ds.exam.examType,
          level: ds.exam.level,
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
          },
          lines,
          computed: comp ?? null,
          rank: ds.ranks.get(c.id) ?? null,
          totalCandidates: ds.candidates.length,
          mention: nationalMentionFor(finalAverage),
          decision: finalAverage === null ? '—' : finalAverage >= passMark ? 'ADMIS' : 'AJOURNÉ',
          decisionNote: `Décision provisoire au seuil de ${passMark}/20 (règles de calcul du patronat) — la décision officielle relève du jury de délibération.`,
        };
      });

    return {
      exam: ds.exam,
      rules: ds.rules,
      academicYearLabel: ds.academicYearLabel,
      session: ds.session,
      stats: ds.stats,
      perCenter: ds.perCenter,
      releves,
    };
  }
}


