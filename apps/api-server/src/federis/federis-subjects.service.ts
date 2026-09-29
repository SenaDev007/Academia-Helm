/**
 * FederisSubjectsService — Module « Matières » (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * Catalogue des matières D'EXAMEN du patronat, par type (CEP | BEPC | BAC |
 * CAP) et par série (BAC : A1, A2, C, D… / CAP : filières) — reproduction du
 * système de création de matières du module Pédagogie Helm (Matières et
 * programmes : SubjectsPrismaService — CRUD + déduplication intelligente par
 * nom normalisé + upsert par code), adapté au contexte des examens nationaux.
 *
 * CE CATALOGUE ALIMENTE TOUT LE WORKFLOW (tout doit communiquer) :
 *   1. LANCEMENT D'EXAMEN — dès qu'une campagne passe à REGISTRATION_OPEN ou
 *      IN_PROGRESS, les matières du catalogue du type sont ATTACHÉES à
 *      l'examen (NationalExamSubject — copie avec sourceSubjectId en
 *      metadata). Les matières ajoutées au catalogue ensuite se synchronisent
 *      via POST /federis/exams/:examId/subjects/sync (ou le bouton de la
 *      page Matières).
 *   2. MODULE ÉPREUVES — les épreuves se lient à une matière du catalogue
 *      (federis_exam_papers.subjectId) et le SIGNAL « épreuves à préparer »
 *      (getReadiness) passe à l'orange tant qu'une matière d'un examen lancé
 *      n'a pas son épreuve — vert dès que tout est préparé.
 *   3. MODULE NOTES ET MOYENNES — l'initialisation des matières d'un examen
 *      (FederisGradesService.initDefaultSubjects) puise D'ABORD dans ce
 *      catalogue (repli sur le jeu officiel intégré si catalogue vide).
 *
 * Endpoints (FederisSubjectsController) :
 *   GET    /federis/subjects                 — catalogue (année active)
 *   POST   /federis/subjects                 — créer (upsert par code)
 *   POST   /federis/subjects/bulk            — création en lot (suggestions)
 *   POST   /federis/subjects/init            — jeu officiel du type/série
 *   PATCH  /federis/subjects/:id             — modifier (coeff, barème…)
 *   DELETE /federis/subjects/:id             — supprimer (épreuves détachées)
 *   GET    /federis/subjects/readiness       — signal épreuves (orange/vert)
 *   POST   /federis/exams/:examId/subjects/sync — catalogue → examen lancé
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FederisPatronatService } from './federis-patronat.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  WRITE_EXAM_ORG,
  normalizePatronatFunction,
  patronatFunctionLabel,
  type PatronatFunction,
} from './federis-roles';

// ⭐ FIX 2026-09-29 — décorateurs class-validator OBLIGATOIRES sur TOUS les
//    DTOs : le ValidationPipe global (whitelist + forbidNonWhitelisted)
//    rejette toute propriété sans décorateur (« property X should not exist »)
//    et l'AcademicYearEnforcementInterceptor injecte academicYearId dans le
//    body quand le DTO n'a aucune règle → double rejet 400 (pattern federis).
import {
  IsArray,
  IsIn,
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
  @IsIn(['CEP', 'BEPC', 'BAC', 'CAP'])
  examType!: string;

  /** Série (BAC : A1, A2, C, D… / CAP : filière) — vide = tronc commun. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  series?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

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

  /** Durée de l'épreuve en minutes. */
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(600)
  duration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  series?: string;

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
  @IsInt()
  @Min(0)
  @Max(99)
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  isActive?: boolean;
}

/** Ligne du lot (suggestions du jeu officiel — pattern panneau Helm). */
export class SubjectRowDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  series?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

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
}

export class BulkCreateSubjectsDto {
  @IsIn(['CEP', 'BEPC', 'BAC', 'CAP'])
  examType!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectRowDto)
  rows!: SubjectRowDto[];
}

export class InitSubjectsDto {
  @IsIn(['CEP', 'BEPC', 'BAC', 'CAP'])
  examType!: string;

  /** Série ciblée (BAC) — absent = tout le type. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  series?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Catalogue officiel par type et par série (point de départ ajustable)
// ═══════════════════════════════════════════════════════════════════════════

export interface OfficialSubject {
  code: string;
  name: string;
  coefficient: number;
  maxScore?: number;
  duration?: number;
}

/** Séries suggérées pour le Baccalauréat (mêmes familles que le rapprochement Helm). */
export const BAC_SERIES: string[] = ['A1', 'A2', 'C', 'D'];

/**
 * Jeu officiel par type (et par série pour le BAC) — le patronat ajuste
 * librement coefficients et barèmes dans le module ; ce catalogue n'est
 * qu'un point de départ réaliste (pattern seedDefaultSubjects Helm).
 */
export const OFFICIAL_SUBJECTS: Record<string, Record<string, OfficialSubject[]>> = {
  // CEP — modèle du PRIMAIRE : une note /20 par épreuve, SANS coefficient.
  CEP: {
    '': [
      { code: 'RED', name: 'Rédaction', coefficient: 1, duration: 60 },
      { code: 'DIC', name: 'Dictée', coefficient: 1, duration: 20 },
      { code: 'ETX', name: 'Étude de texte', coefficient: 1, duration: 45 },
      { code: 'CAL', name: 'Calcul (Mathématiques)', coefficient: 1, duration: 60 },
      { code: 'SCI', name: 'Leçons de sciences', coefficient: 1, duration: 45 },
      { code: 'HGE', name: 'Histoire-Géographie', coefficient: 1, duration: 45 },
    ],
  },
  // BEPC — modèle du SECONDAIRE avec coefficients.
  BEPC: {
    '': [
      { code: 'FR', name: 'Français', coefficient: 4, duration: 120 },
      { code: 'MATH', name: 'Mathématiques', coefficient: 4, duration: 120 },
      { code: 'ANG', name: 'Anglais', coefficient: 3, duration: 90 },
      { code: 'PCT', name: 'Physique-Chimie-Technologie', coefficient: 2, duration: 90 },
      { code: 'SVT', name: 'Sciences de la Vie et de la Terre', coefficient: 2, duration: 90 },
      { code: 'ESC', name: 'Éducation Sociale et Civique', coefficient: 2, duration: 90 },
    ],
  },
  // BAC — PAR SÉRIE (A1 / A2 / C / D) : les matières varient fortement.
  BAC: {
    A1: [
      { code: 'PHI', name: 'Philosophie', coefficient: 2, duration: 240 },
      { code: 'FR', name: 'Français', coefficient: 4, duration: 240 },
      { code: 'ANG', name: 'Anglais', coefficient: 3, duration: 180 },
      { code: 'HGE', name: 'Histoire-Géographie', coefficient: 3, duration: 180 },
      { code: 'MATH', name: 'Mathématiques', coefficient: 2, duration: 180 },
      { code: 'ESC', name: 'Éducation Sociale et Civique', coefficient: 1, duration: 90 },
    ],
    A2: [
      { code: 'PHI', name: 'Philosophie', coefficient: 2, duration: 240 },
      { code: 'FR', name: 'Français', coefficient: 4, duration: 240 },
      { code: 'ANG', name: 'Anglais', coefficient: 3, duration: 180 },
      { code: 'HGE', name: 'Histoire-Géographie', coefficient: 3, duration: 180 },
      { code: 'LV2', name: 'Langue vivante II', coefficient: 3, duration: 180 },
      { code: 'MATH', name: 'Mathématiques', coefficient: 1, duration: 180 },
    ],
    C: [
      { code: 'PHI', name: 'Philosophie', coefficient: 2, duration: 240 },
      { code: 'FR', name: 'Français', coefficient: 2, duration: 240 },
      { code: 'MATH', name: 'Mathématiques', coefficient: 6, duration: 240 },
      { code: 'PC', name: 'Physique-Chimie', coefficient: 6, duration: 240 },
      { code: 'SN', name: 'Sciences Naturelles', coefficient: 2, duration: 180 },
      { code: 'ANG', name: 'Anglais', coefficient: 2, duration: 180 },
    ],
    D: [
      { code: 'PHI', name: 'Philosophie', coefficient: 2, duration: 240 },
      { code: 'FR', name: 'Français', coefficient: 3, duration: 240 },
      { code: 'MATH', name: 'Mathématiques', coefficient: 4, duration: 240 },
      { code: 'PC', name: 'Physique-Chimie', coefficient: 2, duration: 240 },
      { code: 'SN', name: 'Sciences Naturelles', coefficient: 4, duration: 240 },
      { code: 'ANG', name: 'Anglais', coefficient: 2, duration: 180 },
    ],
  },
  // CAP — théorie + pratique (filières techniques).
  CAP: {
    '': [
      { code: 'CG', name: 'Culture générale', coefficient: 3, duration: 120 },
      { code: 'MATH', name: 'Mathématiques', coefficient: 2, duration: 90 },
      { code: 'TEC', name: 'Technologie professionnelle', coefficient: 4, duration: 180 },
      { code: 'TP', name: 'Travaux pratiques', coefficient: 5, duration: 240 },
    ],
  },
};

/** Statuts considérés comme « officiellement lancés » (signal épreuves actif). */
export const LAUNCHED_EXAM_STATUSES = ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers purs (exportés — testés par scripts/test_subjects_module_2026-09-29.mjs)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalisation d'un nom de matière (copie du pattern SubjectsPrismaService
 * Helm) : trim, minuscules, sans accents, séparateurs - / \ + & et « et »
 * remplacés par un espace, espaces compressés — pour la déduplication et le
 * rapprochement épreuve ↔ matière par nom.
 */
export function normalizeSubjectName(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-/\\+&]| et /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise une série (trim, majuscules, sans accents) — « a1 » → « A1 ». */
export function normalizeSeries(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 20);
}

/** Libellé lisible d'un type d'examen. */
export function examTypeLabel(type: string): string {
  switch (type) {
    case 'CEP':
      return 'CEP';
    case 'BEPC':
      return 'BEPC';
    case 'BAC':
      return 'Baccalauréat';
    case 'CAP':
      return 'CAP';
    default:
      return type;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class FederisSubjectsService {
  private readonly logger = new Logger(FederisSubjectsService.name);
  private schemaReady = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
  ) {}

  // ── Auto-guérison du schéma (pattern FederisEpreuveService) ──────────────
  //
  // Miroir EXACT de la migration 20260929190000_federis_subjects :
  //   - table federis_subjects (+ unique tenant/année/type/série/code) ;
  //   - colonne federis_exam_papers.subjectId (+ index + FK douce SetNull).
  // Le déploiement n'exécute pas prisma migrate deploy au démarrage — les
  // objets sont créés idempotemment au premier appel du service.

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      await this.prisma.$queryRawUnsafe(`SELECT 1 FROM "federis_subjects" LIMIT 1`);
      const col: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name='federis_exam_papers' AND column_name='subjectId' LIMIT 1`,
      )) as any[];
      if (!col || col.length < 1) throw new Error('colonne subjectId absente');
      this.schemaReady = true;
      return;
    } catch {
      /* objet absent → création idempotente ci-dessous */
    }

    const statements = [
      `CREATE TABLE IF NOT EXISTS "federis_subjects" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "academicYearId" TEXT NOT NULL,
          "examType" TEXT NOT NULL,
          "series" TEXT NOT NULL DEFAULT '',
          "code" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
          "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
          "duration" INTEGER,
          "order" INTEGER NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "createdBy" TEXT,
          CONSTRAINT "federis_subjects_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE INDEX IF NOT EXISTS "federis_subjects_tenantId_academicYearId_examType_idx"
          ON "federis_subjects"("tenantId", "academicYearId", "examType")`,
      `CREATE INDEX IF NOT EXISTS "federis_subjects_tenantId_examType_series_idx"
          ON "federis_subjects"("tenantId", "examType", "series")`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_subjects_tenantId_academicYearId_examType_series_code_key') THEN
              ALTER TABLE "federis_subjects"
                  ADD CONSTRAINT "federis_subjects_tenantId_academicYearId_examType_series_code_key"
                  UNIQUE ("tenantId", "academicYearId", "examType", "series", "code");
          END IF;
      END $$`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_subjects_tenantId_fkey') THEN
              ALTER TABLE "federis_subjects"
                  ADD CONSTRAINT "federis_subjects_tenantId_fkey"
                  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
          END IF;
      END $$`,
      `ALTER TABLE "federis_exam_papers" ADD COLUMN IF NOT EXISTS "subjectId" TEXT`,
      `CREATE INDEX IF NOT EXISTS "federis_exam_papers_subjectId_idx"
          ON "federis_exam_papers"("subjectId")`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_exam_papers_subjectId_fkey')
             AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'federis_subjects') THEN
              ALTER TABLE "federis_exam_papers"
                  ADD CONSTRAINT "federis_exam_papers_subjectId_fkey"
                  FOREIGN KEY ("subjectId") REFERENCES "federis_subjects"("id") ON DELETE SET NULL;
          END IF;
      END $$`,
    ];
    for (const stmt of statements) {
      try {
        await this.prisma.$executeRawUnsafe(stmt);
      } catch (e: any) {
        if (!String(e?.message ?? '').includes('already exists')) {
          this.logger.warn(`FederisSubjects ensure-schema : ${String(e?.message ?? e)}`);
        }
      }
    }
    this.schemaReady = true;
    this.logger.log('Schéma matières assuré (migration 20260929190000)');
  }

  // ── Contexte & permissions (pattern FederisEpreuveService) ───────────────

  private async resolveContext(tenantId: string, userId?: string) {
    const patronat = await this.patronatService.resolvePatronat(tenantId, userId);
    const link = userId
      ? await this.prisma.patronatUser.findFirst({
          where: { tenantId: patronat.tenantId, userId, isActive: true },
          select: { role: true },
        })
      : null;
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
      : null;
    const fn = normalizePatronatFunction(link?.role ?? user?.role);
    return { patronat, fn, fnLabel: patronatFunctionLabel(fn) };
  }

  private assertRead(fn: PatronatFunction): void {
    if (!ALL_PATRONAT_FUNCTIONS.includes(fn)) {
      throw new ForbiddenException('Accès réservé aux membres du patronat.');
    }
  }

  /** Écriture : mêmes droits que les épreuves (coordonnateur + organisateur). */
  private assertCanWrite(fn: PatronatFunction): void {
    if (!WRITE_EXAM_ORG.includes(fn)) {
      throw new ForbiddenException(
        "La gestion des matières est réservée au coordonnateur et à l'organisateur.",
      );
    }
  }

  private async getActiveYear(tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!year) {
      throw new BadRequestException(
        'Aucune année scolaire active — la gestion des matières est bloquée (NO ACADEMIC YEAR = NO DATA).',
      );
    }
    return year;
  }

  private async writeAudit(
    tenantId: string,
    userId: string,
    action: string,
    recordId: string,
    newData: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          tenantId,
          userId,
          action,
          resource: 'FederisSubject',
          resourceId: recordId,
          tableName: 'federis_subjects',
          recordId,
          newData,
        },
      })
      .catch(() => undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. LISTE DU CATALOGUE (année active, groupée par type et série)
  // ═══════════════════════════════════════════════════════════════════════

  async listSubjects(
    tenantId: string,
    userId: string,
    filters: { examType?: string; search?: string } = {},
  ) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const year = await this.getActiveYear(patronat.tenantId);

    if (filters.examType && !['CEP', 'BEPC', 'BAC', 'CAP'].includes(filters.examType)) {
      throw new BadRequestException('Type d\u2019examen invalide (CEP, BEPC, BAC ou CAP).');
    }

    const where: any = { tenantId: patronat.tenantId, academicYearId: year.id };
    if (filters.examType) where.examType = filters.examType;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [subjects, papersBySubject] = await Promise.all([
      this.prisma.federisSubject.findMany({
        where,
        orderBy: [{ examType: 'asc' }, { series: 'asc' }, { order: 'asc' }, { name: 'asc' }],
      }),
      // Épreuves liées du patronat (année active) — comptage par matière.
      this.prisma.federisExamPaper.findMany({
        where: { tenantId: patronat.tenantId, academicYearId: year.id, subjectId: { not: null } },
        select: { subjectId: true, title: true, status: true },
      }),
    ]);

    const papersCount = new Map<string, number>();
    for (const p of papersBySubject) {
      if (p.subjectId) papersCount.set(p.subjectId, (papersCount.get(p.subjectId) ?? 0) + 1);
    }

    // Vue par type (onglets) + par série (chips BAC/CAP).
    const byType = new Map<string, { count: number; series: Map<string, number> }>();
    for (const s of subjects) {
      if (!byType.has(s.examType)) byType.set(s.examType, { count: 0, series: new Map() });
      const t = byType.get(s.examType)!;
      t.count += 1;
      const series = s.series || '';
      t.series.set(series, (t.series.get(series) ?? 0) + 1);
    }

    return {
      academicYearId: year.id,
      academicYearLabel: year.label ?? year.name ?? null,
      canManage: WRITE_EXAM_ORG.includes(fn),
      types: ['CEP', 'BEPC', 'BAC', 'CAP'].map((type) => ({
        examType: type,
        label: examTypeLabel(type),
        count: byType.get(type)?.count ?? 0,
        series: [...(byType.get(type)?.series ?? new Map()).entries()]
          .map(([series, count]) => ({ series: series || '', count }))
          .sort((a, b) => a.series.localeCompare(b.series)),
      })),
      subjects: subjects.map((s) => ({
        id: s.id,
        examType: s.examType,
        examTypeLabel: examTypeLabel(s.examType),
        series: s.series || '',
        code: s.code,
        name: s.name,
        description: s.description,
        coefficient: s.coefficient,
        maxScore: s.maxScore,
        duration: s.duration,
        order: s.order,
        isActive: s.isActive,
        papersCount: papersCount.get(s.id) ?? 0,
      })),
      official: OFFICIAL_SUBJECTS,
      bacSeries: BAC_SERIES,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. CRÉATION (dédup intelligente — pattern SubjectsPrismaService Helm)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Crée une matière du catalogue :
   *   - unicité par (type, série, code) → UPSERT (mise à jour au lieu d'un
   *     crash, pattern Helm) ;
   *   - déduplication par nom normalisé : si une matière du même nom existe
   *     déjà dans le type/série, elle est retournée telle quelle.
   */
  async createSubject(tenantId: string, userId: string, dto: CreateSubjectDto) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);
    const year = await this.getActiveYear(patronat.tenantId);

    const series = normalizeSeries(dto.series);
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();

    // Dédup par nom normalisé (pattern Helm — jamais deux « Mathématiques »)
    const existing = await this.prisma.federisSubject.findMany({
      where: { tenantId: patronat.tenantId, academicYearId: year.id, examType: dto.examType, series },
      select: { id: true, code: true, name: true },
    });
    const normName = normalizeSubjectName(name);
    const byName = existing.find((s) => normalizeSubjectName(s.name) === normName);
    if (byName) {
      return { ...byName, duplicated: true, message: `La matière « ${name} » existe déjà (code ${byName.code}).` };
    }

    const subject = await this.prisma.federisSubject.upsert({
      where: {
        tenantId_academicYearId_examType_series_code: {
          tenantId: patronat.tenantId,
          academicYearId: year.id,
          examType: dto.examType,
          series,
          code,
        },
      },
      create: {
        tenantId: patronat.tenantId,
        academicYearId: year.id,
        examType: dto.examType,
        series,
        code,
        name,
        description: dto.description?.trim() || null,
        coefficient: dto.coefficient ?? 1,
        maxScore: dto.maxScore ?? 20,
        duration: dto.duration ?? null,
        order: dto.order ?? 0,
        isActive: true,
        createdBy: userId,
      },
      update: {
        name,
        description: dto.description?.trim() || null,
        coefficient: dto.coefficient ?? 1,
        maxScore: dto.maxScore ?? 20,
        duration: dto.duration ?? null,
        order: dto.order ?? 0,
        isActive: true,
      },
    });

    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_SUBJECT_CREATE', subject.id, {
      examType: subject.examType,
      series: subject.series,
      code: subject.code,
      name: subject.name,
      coefficient: subject.coefficient,
    });
    return subject;
  }

  /** Création en lot (panneau de suggestions — pattern Helm). */
  async bulkCreate(tenantId: string, userId: string, dto: BulkCreateSubjectsDto) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);
    const year = await this.getActiveYear(patronat.tenantId);

    if (!dto.rows?.length) throw new BadRequestException('Aucune matière transmise.');
    if (dto.rows.length > 200) throw new BadRequestException('Trop de matières (max 200 par lot).');

    let created = 0;
    let updated = 0;
    let duplicated = 0;
    const errors: string[] = [];

    for (const [idx, row] of dto.rows.entries()) {
      try {
        const res: any = await this.createSubject(tenantId, userId, {
          examType: dto.examType,
          series: row.series,
          code: row.code,
          name: row.name,
          coefficient: row.coefficient,
          maxScore: row.maxScore,
          duration: row.duration,
        });
        if (res?.duplicated) duplicated += 1;
        else if (res?.updatedAt && res?.createdAt && res.updatedAt > res.createdAt) updated += 1;
        else created += 1;
      } catch (e: any) {
        errors.push(`Ligne ${idx + 1} (${row.code ?? '??'}) : ${e?.message ?? 'erreur'}`);
      }
    }

    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_SUBJECTS_BULK', dto.examType, {
      examType: dto.examType,
      received: dto.rows.length,
      created,
      updated,
      duplicated,
      errors: errors.length,
    });

    return {
      created,
      updated,
      duplicated,
      errors,
      message: `${created} matière(s) créée(s)${updated ? `, ${updated} mise(s) à jour` : ''}${duplicated ? `, ${duplicated} doublon(s) ignoré(s)` : ''}.`,
    };
  }

  /** Initialise le jeu officiel du type (et de la série pour le BAC). */
  async initOfficialSubjects(tenantId: string, userId: string, dto: InitSubjectsDto) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);
    const year = await this.getActiveYear(patronat.tenantId);

    const bySeries = OFFICIAL_SUBJECTS[dto.examType] ?? {};
    const targets = dto.series
      ? { [normalizeSeries(dto.series)]: bySeries[normalizeSeries(dto.series)] ?? [] }
      : bySeries;
    const rows = Object.entries(targets).flatMap(([series, list]) =>
      (list ?? []).map((s) => ({ ...s, series })),
    );
    if (rows.length === 0) {
      throw new BadRequestException(
        dto.series
          ? `Aucun jeu officiel pour la série ${normalizeSeries(dto.series)} — ajoutez vos matières manuellement.`
          : `Aucun jeu officiel pour le type ${dto.examType}.`,
      );
    }

    const res = await this.bulkCreate(tenantId, userId, { examType: dto.examType, rows });
    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_SUBJECTS_INIT', dto.examType, {
      examType: dto.examType,
      series: dto.series ?? null,
      ...res,
    });
    return res;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. MODIFICATION / SUPPRESSION
  // ═══════════════════════════════════════════════════════════════════════

  async updateSubject(tenantId: string, userId: string, id: string, dto: UpdateSubjectDto) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);

    const subject = await this.prisma.federisSubject.findFirst({
      where: { id, tenantId: patronat.tenantId },
    });
    if (!subject) throw new NotFoundException('Matière introuvable dans votre périmètre.');

    const series = dto.series !== undefined ? normalizeSeries(dto.series) : subject.series;
    // Changement de série : garde l'unicité (type, série, code)
    if (series !== subject.series) {
      const clash = await this.prisma.federisSubject.findFirst({
        where: {
          tenantId: patronat.tenantId,
          academicYearId: subject.academicYearId,
          examType: subject.examType,
          series,
          code: subject.code,
          NOT: { id: subject.id },
        },
        select: { id: true },
      });
      if (clash) {
        throw new BadRequestException(
          `Une matière « ${subject.code} » existe déjà dans la série ${series || 'commune'}.`,
        );
      }
    }

    const updated = await this.prisma.federisSubject.update({
      where: { id: subject.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.series !== undefined ? { series } : {}),
        ...(dto.coefficient !== undefined ? { coefficient: dto.coefficient } : {}),
        ...(dto.maxScore !== undefined ? { maxScore: dto.maxScore } : {}),
        ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_SUBJECT_UPDATE', subject.id, {
      code: subject.code,
      changes: dto,
    });
    return updated;
  }

  /**
   * Supprime une matière du catalogue. Les épreuves liées conservent leur
   * intitulé texte (FK SetNull) et les matières déjà attachées à un examen
   * lancé (NationalExamSubject = copies) ne sont PAS touchées.
   */
  async deleteSubject(tenantId: string, userId: string, id: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);

    const subject = await this.prisma.federisSubject.findFirst({
      where: { id, tenantId: patronat.tenantId },
    });
    if (!subject) throw new NotFoundException('Matière introuvable dans votre périmètre.');

    const linkedPapers = await this.prisma.federisExamPaper.count({
      where: { subjectId: subject.id },
    });

    await this.prisma.federisSubject.delete({ where: { id: subject.id } }).catch(async (e: any) => {
      // FK absente en base locale (sandbox) → détachement manuel puis retry
      if (String(e?.message ?? '').includes('Foreign key')) {
        await this.prisma.federisExamPaper.updateMany({
          where: { subjectId: subject.id },
          data: { subjectId: null },
        });
        await this.prisma.federisSubject.delete({ where: { id: subject.id } });
      } else {
        throw e;
      }
    });

    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_SUBJECT_DELETE', subject.id, {
      examType: subject.examType,
      series: subject.series,
      code: subject.code,
      name: subject.name,
      linkedPapersDetached: linkedPapers,
    });
    return {
      deleted: true,
      code: subject.code,
      papersDetached: linkedPapers,
      message:
        linkedPapers > 0
          ? `Matière « ${subject.name} » supprimée — ${linkedPapers} épreuve(s) détachée(s) (elles conservent leur intitulé).`
          : `Matière « ${subject.name} » supprimée.`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. SYNCHRONISATION CATALOGUE → EXAMEN (au lancement de la campagne)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Attache les matières du catalogue du type de l'examen aux matières de la
   * campagne (NationalExamSubject) — uniquement les codes MANQUANTS, jamais
   * d'écrasement des matières déjà saisies ou ajustées. Pour le BAC, toutes
   * les séries sont attachées (chaque candidat compose dans les matières de
   * SA série — la moyenne pondérée ne compte que les matières notées).
   * La matière d'origine est tracée en metadata.sourceSubjectId (signal
   * épreuves + lien dynamique).
   */
  async syncCatalogToExam(tenantId: string, userId: string, examId: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn); // appelable aussi automatiquement au lancement

    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronat.tenantId },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');

    const [catalog, existing] = await Promise.all([
      this.prisma.federisSubject.findMany({
        where: {
          tenantId: patronat.tenantId,
          academicYearId: exam.academicYearId,
          examType: exam.examType,
          isActive: true,
        },
        orderBy: [{ series: 'asc' }, { order: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.nationalExamSubject.findMany({
        where: { examId: exam.id },
        select: { code: true },
      }),
    ]);

    if (catalog.length === 0) {
      return {
        examId: exam.id,
        created: 0,
        skipped: 0,
        emptyCatalog: true,
        message:
          'Le catalogue de matières est vide pour ce type — créez vos matières dans le module Matières (ou initialisez le jeu officiel).',
      };
    }

    const existingCodes = new Set(existing.map((s) => s.code.toUpperCase()));
    const toCreate = catalog.filter((c) => !existingCodes.has(c.code.toUpperCase()));

    if (toCreate.length > 0) {
      await this.prisma.$transaction(
        toCreate.map((c) =>
          this.prisma.nationalExamSubject.create({
            data: {
              tenantId: patronat.tenantId,
              academicYearId: exam.academicYearId,
              examId: exam.id,
              code: c.code,
              name: c.name,
              coefficient: c.coefficient ?? 1,
              maxScore: c.maxScore ?? 20,
              duration: c.duration ?? null,
              order: c.order ?? 0,
              status: 'ACTIVE',
              metadata: { series: c.series || '', sourceSubjectId: c.id } as any,
              createdBy: userId,
            },
          }),
        ),
      );
    }

    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_SUBJECTS_SYNC', exam.id, {
      examCode: exam.code,
      examType: exam.examType,
      catalogSize: catalog.length,
      created: toCreate.length,
    });

    return {
      examId: exam.id,
      created: toCreate.length,
      skipped: catalog.length - toCreate.length,
      emptyCatalog: false,
      message:
        toCreate.length > 0
          ? `${toCreate.length} matière(s) du catalogue attachée(s) à l'examen ${exam.code}.`
          : `Les matières de l'examen ${exam.code} sont déjà à jour avec le catalogue.`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. SIGNAL ÉPREUVES (orange → vert — « épreuves à préparer »)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Pour chaque examen OFFICIELLEMENT LANÇÉ (REGISTRATION_OPEN /
   * REGISTRATION_CLOSED / IN_PROGRESS) : matières attachées à la campagne et
   * état de préparation de l'épreuve (match par subjectId du catalogue, avec
   * repli sur le nom normalisé / le code pour les épreuves antérieures).
   *   - une matière sans épreuve → signal ORANGE ;
   *   - toutes les matières avec épreuve → VERT (ready).
   * Sert au bandeau du module Épreuves ET à la page Matières.
   */
  async getReadiness(tenantId: string, userId: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);

    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId: patronat.tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });

    const [exams, catalog] = await Promise.all([
      this.prisma.nationalExam.findMany({
        where: { tenantId: patronat.tenantId, status: { in: LAUNCHED_EXAM_STATUSES } },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.federisSubject.findMany({
        where: year
          ? { tenantId: patronat.tenantId, academicYearId: year.id, isActive: true }
          : { tenantId: patronat.tenantId, isActive: true },
        select: { id: true, examType: true, series: true, code: true, name: true, isActive: true },
      }),
    ]);

    const examReports = [];
    for (const exam of exams) {
      const [subjects, papers] = await Promise.all([
        this.prisma.nationalExamSubject.findMany({
          where: { examId: exam.id },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        }),
        this.prisma.federisExamPaper.findMany({
          where: {
            tenantId: patronat.tenantId,
            academicYearId: exam.academicYearId,
            examCategory: exam.examType,
          },
          select: { subjectId: true, subject: true, title: true, status: true },
        }),
      ]);

      // Index des épreuves : par subjectId (lien exact) + par nom normalisé
      const papersBySubjectId = new Set<string>();
      const papersByNormName = new Set<string>();
      for (const p of papers) {
        if (p.subjectId) papersBySubjectId.add(p.subjectId);
        if (p.subject) papersByNormName.add(normalizeSubjectName(p.subject));
      }

      const subjectRows = subjects.map((s) => {
        const sourceId = (s.metadata as any)?.sourceSubjectId ?? null;
        const hasPaper =
          (sourceId && papersBySubjectId.has(sourceId)) ||
          papersByNormName.has(normalizeSubjectName(s.name)) ||
          papersByNormName.has(normalizeSubjectName(s.code));
        return {
          subjectId: s.id,
          sourceSubjectId: sourceId,
          code: s.code,
          name: s.name,
          series: (s.metadata as any)?.series ?? '',
          coefficient: s.coefficient,
          hasPaper,
        };
      });

      const missing = subjectRows.filter((s) => !s.hasPaper);
      // Matières du catalogue du type NON rattachées à la campagne
      // (ajoutées après le lancement → synchronisation recommandée).
      const attachedSourceIds = new Set(
        subjectRows.map((s) => s.sourceSubjectId).filter(Boolean) as string[],
      );
      const catalogSeries = exam.examType === 'BAC' || exam.examType === 'CAP';
      const catalogUnattached = catalog
        .filter((c) => c.examType === exam.examType && !attachedSourceIds.has(c.id))
        .map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          series: c.series || '',
        }));

      examReports.push({
        examId: exam.id,
        code: exam.code,
        name: exam.name,
        examType: exam.examType,
        status: exam.status,
        showSeries: catalogSeries,
        subjectsCount: subjectRows.length,
        missingCount: missing.length,
        ready: subjectRows.length > 0 && missing.length === 0,
        subjects: subjectRows,
        missing,
        catalogUnattached,
      });
    }

    const totalSubjects = examReports.reduce((sum, e) => sum + e.subjectsCount, 0);
    const totalMissing = examReports.reduce((sum, e) => sum + e.missingCount, 0);

    return {
      launchedExams: examReports.length,
      totalSubjects,
      totalMissing,
      allReady: examReports.length === 0 || examReports.every((e) => e.ready),
      exams: examReports,
    };
  }
}
