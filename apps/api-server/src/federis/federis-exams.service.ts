/**
 * FederisExamsService — Workflow examens nationaux (Academia Federis)
 *
 * Chaîne opérationnelle complète (cahier des charges §9) :
 *   1. Examens nationaux        — création, cycle DRAFT → REGISTRATION → …
 *   2. Centres d'examen         — établissements d'accueil par examen
 *   3. Salles                   — capacité par centre (ExamRoom)
 *   4. Candidats                — ajout manuel + IMPORT EXCEL par lot
 *      (le fichier est analysé côté client avec SheetJS/xlsx — dépendance
 *      déjà présente dans web-app — puis les lignes sont envoyées en JSON)
 *   5. Numéros de table         — affectation automatique : répartition des
 *      candidats dans les salles selon leur capacité + numérotation
 *      séquentielle par centre (001, 002, …)
 *
 * Règles transverses :
 *   - NO ACADEMIC YEAR = NO DATA : toute écriture exige l'année active
 *   - Jamais de suppression physique : archivage via status
 *   - Permissions : coordonnateur + organisateur (organisation), secrétaire
 *     (candidats/registres) — vérifiées via federis-roles
 *   - AuditLog sur chaque mutation
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FederisPatronatService, FEDERIS_PLANS, type FederisPlanCode } from './federis-patronat.service';
// ⭐ Série (Baccalauréat) — les listes officielles transmises par les écoles
//    sont regroupées PAR SÉRIE côté patronat (jamais un mélange).
import { resolveSeriesFromClassNames } from './federis-school-exams.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  WRITE_CANDIDATES,
  WRITE_EXAM_ORG,
  normalizePatronatFunction,
  patronatFunctionLabel,
  type PatronatFunction,
} from './federis-roles';

// ── DTO ─────────────────────────────────────────────────────────────────────

/**
 * ⭐ La campagne d'examen est-elle une campagne de Baccalauréat (niveau
 * Terminale) ? Ces listes sont catégorisées PAR SÉRIE (A1, C, D…) —
 * contrairement au CEP/BEPC/CAP.
 */
function isBacLevel(level: string | null | undefined): boolean {
  const n = (level ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  if (!n) return false;
  return (n.startsWith('TERM') || n.startsWith('TLE') || n.startsWith('BAC')) && !n.includes('CAP');
}

// ⭐ FIX 2026-09-29 — décorateurs class-validator OBLIGATOIRES sur TOUS les
//    DTOs : le ValidationPipe global (whitelist + forbidNonWhitelisted) rejette
//    toute propriété sans décorateur (« property X should not exist ») et
//    l'AcademicYearEnforcementInterceptor injecte academicYearId dans le body
//    quand le DTO n'a aucune règle → double rejet 400 sur TOUS les POST/PATCH
//    du workflow examens (pattern documenté dans federis-patronat.service.ts).
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name!: string;

  @IsIn(['CEP', 'BEPC', 'BAC', 'CAP'])
  examType!: string;

  /** CM2 (CEP) | 3EME (BEPC) | TERMINALE (Baccalauréat) | CAP (filières techniques) */
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  level!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsString()
  registrationStartDate?: string;

  @IsOptional()
  @IsString()
  registrationEndDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'REGISTRATION_OPEN', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class CreateCenterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(190)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  contactEmail?: string;
}

export class UpdateCenterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  contactEmail?: string;
}

export class CreateRoomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsInt()
  @Min(1)
  @Max(2000)
  capacity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  floor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  building?: string;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  capacity?: number;

  @IsOptional()
  @IsIn(['AVAILABLE', 'FULL', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  floor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  building?: string;
}

export class ImportCandidateRow {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  matricule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  email?: string;
}

export class ImportCandidatesDto {
  /** Lignes déjà normalisées (analyse Excel côté client). */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCandidateRow)
  rows!: ImportCandidateRow[];
}

export class AddCandidateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  matricule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  email?: string;
}

export class AssignTablesDto {
  /** Ordre de répartition : NAME (alphabétique) ou SCHOOL (par école puis nom). */
  @IsOptional()
  @IsIn(['NAME', 'SCHOOL'])
  orderBy?: 'NAME' | 'SCHOOL';

  /**
   * Portée de la numérotation :
   *   CENTER (défaut) — séquentielle par centre ;
   *   ROOM — redémarre dans CHAQUE salle (2026-09-29) ;
   *   EXAM — globale à l'examen.
   */
  @IsOptional()
  @IsIn(['CENTER', 'ROOM', 'EXAM'])
  numberingScope?: 'CENTER' | 'ROOM' | 'EXAM';

  /** Premier numéro (défaut 1). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  startNumber?: number;
}

// ── DTO : format de matricule (module Paramètres — 2026-09-29) ──────────────

export class UpdateMatriculeFormatDto {
  /**
   * Modèle de génération, jetons : {EXAM} {EXAMTYPE} {ANNEE} {ANNEE2}
   * {SEQ} {SEQ:n} {PATRONAT}. Vide/null → réinitialise au format par défaut.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  format?: string | null;
}

// ── DTO : génération des anonymats ──────────────────────────────────────────

export class GenerateAnonymatsDto {
  /** true → régénère AUSSI les anonymats déjà émis (nouvelle série complète). */
  @IsOptional()
  regenerate?: boolean;
}

// ── Jetons du format de matricule ───────────────────────────────────────────

/**
 * Jetons reconnus dans le modèle de matricule :
 *   {EXAM}      — code de la campagne (ex. BAC26)
 *   {EXAMTYPE}  — type d'examen (CEP | BEPC | BAC | CAP)
 *   {ANNEE}     — année complète (2026)
 *   {ANNEE2}    — année sur 2 chiffres (26)
 *   {SEQ}       — numéro séquentiel brut
 *   {SEQ:n}     — séquentiel complété à n chiffres (ex. {SEQ:5} → 00042)
 *   {PATRONAT}  — sigle du patronat (accentué, majuscules, sans espaces)
 */
export const MATRICULE_TOKEN_RE = /\{(EXAM|EXAMTYPE|ANNEE|ANNEE2|SEQ(?::\d+)?|PATRONAT)\}/g;

/** Format appliqué quand le patronat n'a rien défini (module Paramètres). */
export const DEFAULT_MATRICULE_FORMAT = '{EXAM}-{ANNEE}-{SEQ:5}';

/** Construit un matricule à partir du modèle + du contexte. */
export function renderMatricule(
  format: string,
  ctx: {
    examCode: string;
    examType: string;
    year: number;
    seq: number;
    patronatName?: string | null;
  },
): string {
  return format.replace(MATRICULE_TOKEN_RE, (_m, token: string) => {
    switch (token) {
      case 'EXAM':
        return ctx.examCode;
      case 'EXAMTYPE':
        return ctx.examType;
      case 'ANNEE':
        return String(ctx.year);
      case 'ANNEE2':
        return String(ctx.year).slice(-2);
      case 'PATRONAT':
        return (ctx.patronatName ?? '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 12);
      default:
        if (token.startsWith('SEQ')) {
          const width = parseInt(token.slice(4), 10);
          if (Number.isFinite(width) && width >= 1 && width <= 10) {
            return String(ctx.seq).padStart(width, '0');
          }
          return String(ctx.seq);
        }
        return '';
    }
  });
}

/** Valide un modèle de matricule : jetons reconnus + longueur utile ≥ 4. */
export function validateMatriculeFormat(format: string): string[] {
  const errors: string[] = [];
  // Retire tous les jetons VALIDES du modèle — tout {XXX} restant est inconnu
  // (approche sans état : le regex global MATRICULE_TOKEN_RE garde lastIndex).
  const stripped = format.replace(MATRICULE_TOKEN_RE, '');
  const unknown = stripped.match(/\{[^}]*\}/g) ?? [];
  for (const raw of unknown) {
    errors.push(
      `Jeton inconnu ${raw} — jetons reconnus : {EXAM} {EXAMTYPE} {ANNEE} {ANNEE2} {SEQ} {SEQ:n} {PATRONAT}.`,
    );
  }
  if (!/{SEQ(:\d+)?}/.test(format)) {
    errors.push(
      'Le jeton {SEQ} (ou {SEQ:n}) est obligatoire pour garantir l\u2019unicité des matricules.',
    );
  }
  if (format.length > 60) {
    errors.push('Le modèle ne peut dépasser 60 caractères.');
  }
  return errors;
}

const EXAM_BLOCKED_STATUSES = ['COMPLETED', 'CANCELLED', 'ARCHIVED'];

@Injectable()
export class FederisExamsService {
  private readonly logger = new Logger(FederisExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
  ) {}

  // ── Auto-guérison du schéma (pattern FederisSupervisorsService) ──────────
  //
  // Miroir EXACT de la migration 20260929170000_federis_candidates_anonymats :
  // le déploiement Railway n'exécute pas prisma migrate deploy au démarrage
  // (SKIP_MIGRATIONS=true) — les colonnes sont créées idempotemment au
  // premier appel du service.
  //  - exam_candidates.anonymatCode + anonymatIssuedAt (+ index composite)
  //  - patronats.matriculeFormat (format personnalisé, module Paramètres)

  private schemaReady = false;

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      const cols: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='exam_candidates' AND column_name IN ('anonymatCode','anonymatIssuedAt')`,
      )) as any[];
      if (!cols || cols.length < 2) throw new Error('colonnes anonymat absentes');
      const pcols: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='patronats' AND column_name='matriculeFormat'`,
      )) as any[];
      if (!pcols || pcols.length < 1) throw new Error('colonne matriculeFormat absente');
      this.schemaReady = true;
      return;
    } catch {
      /* colonnes absentes → création idempotente ci-dessous */
    }

    const statements = [
      `ALTER TABLE "exam_candidates" ADD COLUMN IF NOT EXISTS "anonymatCode" TEXT`,
      `ALTER TABLE "exam_candidates" ADD COLUMN IF NOT EXISTS "anonymatIssuedAt" TIMESTAMP(3)`,
      `CREATE INDEX IF NOT EXISTS "exam_candidates_examId_anonymatCode_idx"
          ON "exam_candidates"("examId", "anonymatCode")`,
      `ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "matriculeFormat" TEXT`,
    ];
    for (const sql of statements) {
      await this.prisma.$executeRawUnsafe(sql);
    }
    this.schemaReady = true;
    this.logger.log('Schéma candidats/anonymats assuré (migration 20260929170000)');
  }

  // ── Contexte & permissions ───────────────────────────────────────────────

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
    // PatronatUser.role (fonction courte) prime ; sinon User.role (PATRONAT_*)
    const fn = this.normalize(link?.role ?? user?.role);
    return { patronat, fn, fnLabel: patronatFunctionLabel(fn) };
  }

  private normalize(role?: string | null): PatronatFunction {
    return normalizePatronatFunction(role);
  }

  private assertRead(fn: PatronatFunction): void {
    if (!ALL_PATRONAT_FUNCTIONS.includes(fn)) {
      throw new ForbiddenException('Accès réservé aux membres du patronat.');
    }
  }

  private assertWriteOrg(fn: PatronatFunction): void {
    if (!WRITE_EXAM_ORG.includes(fn)) {
      throw new ForbiddenException(
        "L'organisation des examens (centres, salles, affectations) est réservée au coordonnateur et à l'organisateur.",
      );
    }
  }

  private assertWriteCandidates(fn: PatronatFunction): void {
    if (!WRITE_CANDIDATES.includes(fn)) {
      throw new ForbiddenException(
        "La gestion des candidats est réservée au coordonnateur, à l'organisateur et au secrétaire.",
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
        "Aucune année scolaire active — la création de données est bloquée (NO ACADEMIC YEAR = NO DATA).",
      );
    }
    return year;
  }

  /** Examen appartenant au patronat (scope tenant). */
  private async getOwnedExam(patronatTenantId: string, examId: string) {
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronatTenantId },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');
    return exam;
  }

  // ── 1. Examens nationaux ─────────────────────────────────────────────────

  async listExams(tenantId: string, userId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId: patronat.tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });

    const exams = year
      ? await this.prisma.nationalExam.findMany({
          where: { patronatId: patronat.id, academicYearId: year.id },
          include: { _count: { select: { centers: true, candidates: true } } },
          orderBy: { startDate: 'desc' },
        })
      : [];

    return {
      academicYear: year ? { id: year.id, label: year.label } : null,
      exams: exams.map((e) => ({
        id: e.id,
        code: e.code,
        name: e.name,
        examType: e.examType,
        level: e.level,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate,
        registrationStartDate: e.registrationStartDate,
        registrationEndDate: e.registrationEndDate,
        centersCount: e._count.centers,
        candidatesCount: e._count.candidates,
        totalCandidates: e.totalCandidates,
        totalCenters: e.totalCenters,
      })),
    };
  }

  async createExam(tenantId: string, userId: string, dto: CreateExamDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const year = await this.getActiveYear(patronat.tenantId);

    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('Le code et le nom de l\'examen sont requis.');
    }
    if (!dto.startDate || !dto.endDate || new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('Dates invalides : la fin doit suivre le début.');
    }

    const duplicate = await this.prisma.nationalExam.findFirst({
      where: {
        tenantId: patronat.tenantId,
        academicYearId: year.id,
        code: dto.code.trim().toUpperCase(),
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Un examen portant le code ${dto.code.trim().toUpperCase()} existe déjà pour cette année scolaire.`,
      );
    }

    // Quota de campagnes actives du plan
    const plan =
      FEDERIS_PLANS[(patronat.subscriptionPlan as FederisPlanCode)] ?? FEDERIS_PLANS.ESSENTIEL;
    const activeCampaigns = await this.prisma.nationalExam.count({
      where: {
        patronatId: patronat.id,
        academicYearId: year.id,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'ARCHIVED'] },
      },
    });
    if (activeCampaigns >= plan.maxActiveCampaigns) {
      throw new BadRequestException(
        `Quota de campagnes actives atteint pour l'offre ${plan.name} (${plan.maxActiveCampaigns}).`,
      );
    }

    const exam = await this.prisma.$transaction(async (tx) => {
      const created = await tx.nationalExam.create({
        data: {
          tenantId: patronat.tenantId,
          patronatId: patronat.id,
          academicYearId: year.id,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          examType: dto.examType?.trim() || 'NATIONAL',
          level: dto.level?.trim() || 'CM2',
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          registrationStartDate: dto.registrationStartDate
            ? new Date(dto.registrationStartDate)
            : new Date(),
          registrationEndDate: dto.registrationEndDate
            ? new Date(dto.registrationEndDate)
            : new Date(dto.startDate),
          status: 'DRAFT',
          createdBy: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_EXAM_CREATED',
          resource: 'NationalExam',
          resourceId: created.id,
          tableName: 'national_exams',
          recordId: created.id,
          newData: { code: created.code, name: created.name, level: created.level },
        },
      });
      return created;
    });

    this.logger.log(`Examen créé : ${exam.code} — ${exam.name} (${patronat.name})`);
    return { success: true, exam };
  }

  async updateExam(tenantId: string, userId: string, examId: string, dto: UpdateExamDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const data: any = { updatedAt: new Date() };
    if (dto.name?.trim()) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.status) {
      const allowed = [
        'DRAFT',
        'REGISTRATION_OPEN',
        'REGISTRATION_CLOSED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'ARCHIVED',
      ];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(`Statut invalide. Statuts acceptés : ${allowed.join(', ')}.`);
      }
      data.status = dto.status;
    }
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    const updated = await this.prisma.nationalExam.update({ where: { id: exam.id }, data });
    return { success: true, exam: updated };
  }

  // ── 2. Centres d'examen ──────────────────────────────────────────────────

  async listCenters(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const centers = await this.prisma.examCenter.findMany({
      where: { examId: exam.id, status: { not: 'ARCHIVED' } },
      include: {
        _count: { select: { candidates: true } },
        examRooms: { orderBy: { code: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });

    return {
      exam: { id: exam.id, code: exam.code, name: exam.name, level: exam.level },
      centers: centers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        address: c.address,
        capacity: c.capacity,
        status: c.status,
        contactName: c.contactName,
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
        rooms: c.examRooms.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          capacity: r.capacity,
          currentOccupancy: r.currentOccupancy,
          floor: r.floor,
          building: r.building,
          status: r.status,
        })),
        roomsCount: c.examRooms.length,
        roomsCapacity: c.examRooms.reduce((sum, r) => sum + r.capacity, 0),
        assignedCandidates: c._count.candidates,
      })),
    };
  }

  async createCenter(tenantId: string, userId: string, examId: string, dto: CreateCenterDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (EXAM_BLOCKED_STATUSES.includes(exam.status)) {
      throw new BadRequestException("Examen terminé ou annulé — plus de modification possible.");
    }
    const year = await this.getActiveYear(patronat.tenantId);

    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('Le code et le nom du centre sont requis.');
    }

    const duplicate = await this.prisma.examCenter.findFirst({
      where: {
        tenantId: patronat.tenantId,
        academicYearId: year.id,
        examId: exam.id,
        code: dto.code.trim().toUpperCase(),
      },
    });
    if (duplicate) {
      throw new BadRequestException(`Le centre ${dto.code.trim().toUpperCase()} existe déjà pour cet examen.`);
    }

    const center = await this.prisma.$transaction(async (tx) => {
      const created = await tx.examCenter.create({
        data: {
          tenantId: patronat.tenantId,
          academicYearId: year.id,
          examId: exam.id,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          address: dto.address?.trim() || null,
          contactName: dto.contactName?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null,
          contactEmail: dto.contactEmail?.trim().toLowerCase() || null,
          createdBy: userId,
        },
      });
      await tx.nationalExam.update({
        where: { id: exam.id },
        data: { totalCenters: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_EXAM_CENTER_CREATED',
          resource: 'ExamCenter',
          resourceId: created.id,
          tableName: 'exam_centers',
          recordId: created.id,
          newData: { code: created.code, name: created.name, exam: exam.code },
        },
      });
      return created;
    });

    return { success: true, center };
  }

  async updateCenter(tenantId: string, userId: string, centerId: string, dto: UpdateCenterDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const center = await this.prisma.examCenter.findFirst({
      where: { id: centerId, tenantId: patronat.tenantId },
    });
    if (!center) throw new NotFoundException('Centre introuvable dans votre périmètre.');

    const data: any = { updatedAt: new Date() };
    if (dto.name?.trim()) data.name = dto.name.trim();
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.contactName !== undefined) data.contactName = dto.contactName?.trim() || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone?.trim() || null;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail?.trim().toLowerCase() || null;
    if (dto.status) {
      if (!['ACTIVE', 'ARCHIVED', 'MAINTENANCE'].includes(dto.status)) {
        throw new BadRequestException('Statut de centre invalide (ACTIVE, ARCHIVED, MAINTENANCE).');
      }
      data.status = dto.status;
    }

    const updated = await this.prisma.examCenter.update({ where: { id: center.id }, data });
    return { success: true, center: updated };
  }

  // ── 3. Salles ────────────────────────────────────────────────────────────

  async createRoom(tenantId: string, userId: string, centerId: string, dto: CreateRoomDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const center = await this.prisma.examCenter.findFirst({
      where: { id: centerId, tenantId: patronat.tenantId },
    });
    if (!center) throw new NotFoundException('Centre introuvable dans votre périmètre.');
    if (!dto.code?.trim()) throw new BadRequestException('Le code de la salle est requis.');
    if (!dto.capacity || dto.capacity < 1) {
      throw new BadRequestException('La capacité doit être supérieure à 0.');
    }

    const duplicate = await this.prisma.examRoom.findFirst({
      where: { centerId: center.id, code: dto.code.trim().toUpperCase() },
    });
    if (duplicate) throw new BadRequestException(`La salle ${dto.code.trim().toUpperCase()} existe déjà dans ce centre.`);

    const room = await this.prisma.$transaction(async (tx) => {
      const created = await tx.examRoom.create({
        data: {
          tenantId: patronat.tenantId,
          academicYearId: center.academicYearId,
          examId: center.examId,
          centerId: center.id,
          code: dto.code.trim().toUpperCase(),
          name: dto.name?.trim() || `Salle ${dto.code.trim().toUpperCase()}`,
          capacity: Math.floor(dto.capacity),
          floor: dto.floor ?? null,
          building: dto.building?.trim() || null,
          createdBy: userId,
        },
      });
      await tx.examCenter.update({
        where: { id: center.id },
        data: { totalRooms: { increment: 1 }, capacity: { increment: Math.floor(dto.capacity) } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_EXAM_ROOM_CREATED',
          resource: 'ExamRoom',
          resourceId: created.id,
          tableName: 'exam_rooms',
          recordId: created.id,
          newData: { code: created.code, capacity: created.capacity, center: center.code },
        },
      });
      return created;
    });

    return { success: true, room };
  }

  async updateRoom(tenantId: string, userId: string, roomId: string, dto: UpdateRoomDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const room = await this.prisma.examRoom.findFirst({
      where: { id: roomId, tenantId: patronat.tenantId },
    });
    if (!room) throw new NotFoundException('Salle introuvable dans votre périmètre.');

    const data: any = { updatedAt: new Date() };
    if (dto.name?.trim()) data.name = dto.name.trim();
    if (dto.building !== undefined) data.building = dto.building?.trim() || null;
    if (dto.floor !== undefined) data.floor = dto.floor;
    if (dto.status) {
      if (!['AVAILABLE', 'FULL', 'MAINTENANCE'].includes(dto.status)) {
        throw new BadRequestException('Statut de salle invalide (AVAILABLE, FULL, MAINTENANCE).');
      }
      data.status = dto.status;
    }
    if (dto.capacity !== undefined) {
      if (dto.capacity < room.currentOccupancy) {
        throw new BadRequestException(
          `Capacité inférieure à l'occupation actuelle (${room.currentOccupancy} candidats déjà affectés).`,
        );
      }
      data.capacity = Math.floor(dto.capacity);
    }

    const updated = await this.prisma.examRoom.update({ where: { id: room.id }, data });
    return { success: true, room: updated };
  }

  // ── 4. Candidats (liste, ajout manuel, import Excel) ─────────────────────

  async listCandidates(tenantId: string, userId: string, examId: string, search?: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const where: any = { examId: exam.id };
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { matricule: { contains: q, mode: 'insensitive' } },
        { registrationNumber: { contains: q, mode: 'insensitive' } },
        { tableNumber: { contains: q } },
        { anonymatCode: { contains: q } },
      ];
    }

    const [candidatesRaw, total] = await Promise.all([
      this.prisma.examCandidate.findMany({
        where,
        include: {
          center: { select: { id: true, code: true, name: true } },
          room: { select: { id: true, code: true, name: true } },
          schoolTenant: { select: { id: true, name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 500,
      }),
      this.prisma.examCandidate.count({ where: { examId: exam.id } }),
    ]);

    // ⭐ anonymatCode : colonne récente — le client Prisma déployé la renvoie,
    //    en sandbox locale elle peut manquer → lecture brute de secours.
    let anonymatById = new Map<string, string | null>();
    try {
      const rows: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT "id", "anonymatCode" FROM "exam_candidates" WHERE "examId" = $1`,
        exam.id,
      )) as any[];
      anonymatById = new Map(rows.map((r) => [r.id, r.anonymatCode ?? null]));
    } catch {
      /* colonne absente → anonymats à null partout */
    }

    const candidates = candidatesRaw.map((c) => ({
      ...c,
      anonymatCode:
        (c as any).anonymatCode ?? anonymatById.get(c.id) ?? null,
    }));

    return {
      exam: {
        id: exam.id,
        code: exam.code,
        name: exam.name,
        status: exam.status,
        examType: exam.examType,
        level: exam.level,
      },
      total,
      withoutCenter: candidates.filter((c) => !c.centerId).length,
      withoutTable: candidates.filter((c) => !c.tableNumber).length,
      withoutAnonymat: candidates.filter((c) => !c.anonymatCode).length,
      candidates: candidates.map((c) => ({
        id: c.id,
        registrationNumber: c.registrationNumber,
        matricule: c.matricule,
        tableNumber: c.tableNumber,
        anonymatCode: c.anonymatCode,
        firstName: c.firstName,
        lastName: c.lastName,
        gender: c.gender,
        dateOfBirth: c.dateOfBirth,
        status: c.status,
        school: c.schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
        center: c.center ? { code: c.center.code, name: c.center.name } : null,
        room: c.room ? { code: c.room.code, name: c.room.name } : null,
      })),
    };
  }

  // ── 4 bis. Listes officielles transmises par les écoles (2026-09-29) ─────
  //
  // Une fois l'adhésion acceptée par l'école (PatronatSchool JOINED), celle-ci
  // transmet sa liste officielle de candidats (module Examen → Examens
  // nationaux → sous-onglet CEP / BEPC / Baccalauréat / CAP). Cette vue
  // regroupe les candidats de la campagne PAR ÉCOLE, avec les informations de
  // l'établissement (ville, département, contact) — « les informations de
  // l'école peuvent dorénavant s'afficher » côté patronat.

  async listSchoolLists(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const candidates = await this.prisma.examCandidate.findMany({
      where: { examId: exam.id },
      include: {
        schoolTenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            subdomain: true,
            type: true,
            schools: {
              select: {
                logo: true,
                city: true,
                department: true,
                address: true,
                primaryPhone: true,
                primaryEmail: true,
              },
            },
          },
        },
        center: { select: { code: true, name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    // Regroupement par école (les saisies manuelles du patronat sont
    // regroupées sous « Saisie patronat » — elles ne proviennent d'aucune
    // école rattachée).
    const groups = new Map<
      string,
      {
        schoolTenantId: string | null;
        name: string;
        slug: string | null;
        subdomain: string | null;
        tenantType: string | null;
        logo: string | null;
        city: string | null;
        department: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        students: any[];
      }
    >();

    for (const c of candidates) {
      const key = c.schoolTenantId ?? '__PATRONAT__';
      if (!groups.has(key)) {
        const t = c.schoolTenant;
        groups.set(key, {
          schoolTenantId: c.schoolTenantId,
          name: t?.name ?? (c.metadata as any)?.schoolName ?? 'Saisie patronat',
          slug: t?.slug ?? null,
          subdomain: t?.subdomain ?? null,
          tenantType: t?.type ?? null,
          logo: t?.schools?.logo ?? null,
          city: t?.schools?.city ?? null,
          department: t?.schools?.department ?? null,
          address: t?.schools?.address ?? null,
          phone: t?.schools?.primaryPhone ?? null,
          email: t?.schools?.primaryEmail ?? null,
          students: [],
        });
      }
      const meta = (c.metadata as any) ?? {};
      // ⭐ Série (Baccalauréat) : série transmise par l'école (metadata.series),
      //    sinon inférée depuis le nom de classe — regroupement PAR SÉRIE.
      const series =
        (typeof meta.series === 'string' && meta.series) ||
        resolveSeriesFromClassNames(meta.schoolClass, null, null) ||
        null;
      groups.get(key)!.students.push({
        id: c.id,
        matricule: c.matricule,
        registrationNumber: c.registrationNumber,
        tableNumber: c.tableNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        gender: c.gender,
        dateOfBirth: c.dateOfBirth,
        status: c.status,
        schoolClass: meta.schoolClass ?? null,
        series,
        submittedAt: meta.submittedAt ?? null,
        source: meta.source ?? null,
        center: c.center ? { code: c.center.code, name: c.center.name } : null,
      });
    }

    const schools = [...groups.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr'),
    );

    return {
      exam: {
        id: exam.id,
        code: exam.code,
        name: exam.name,
        level: exam.level,
        status: exam.status,
        startDate: exam.startDate,
        endDate: exam.endDate,
      },
      // ⭐ Baccalauréat : listes catégorisées PAR SÉRIE (l'école transmet la
      //    série de chaque candidat — jamais un mélange).
      hasSeries: isBacLevel(exam.level),
      totalSchools: schools.filter((s) => s.schoolTenantId).length,
      totalCandidates: candidates.length,
      schools,
    };
  }

  // ── 4 ter. Format de matricule (module Paramètres — 2026-09-29) ──────────
  //
  // Le patronat définit LIBREMENT le modèle de génération des matricules
  // candidats (jetons {EXAM} {EXAMTYPE} {ANNEE} {ANNEE2} {SEQ} {SEQ:n}
  // {PATRONAT}). Quand il ne définit RIEN, le backend applique le format par
  // défaut établi : {EXAM}-{ANNEE}-{SEQ:5} (ex. BAC26-2026-00001).

  async getMatriculeSettings(tenantId: string, userId: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const format = (patronat as any).matriculeFormat ?? null;
    const year = new Date().getFullYear();
    return {
      format,
      defaultFormat: DEFAULT_MATRICULE_FORMAT,
      isDefault: !format,
      tokens: [
        { token: '{EXAM}', description: 'Code de la campagne (ex. BAC26)' },
        { token: '{EXAMTYPE}', description: 'Type d\u2019examen (CEP, BEPC, BAC, CAP)' },
        { token: '{ANNEE}', description: `Année complète (${year})` },
        { token: '{ANNEE2}', description: `Année sur 2 chiffres (${String(year).slice(-2)})` },
        { token: '{SEQ}', description: 'Numéro séquentiel (1, 2, 3…)' },
        { token: '{SEQ:n}', description: 'Séquentiel complété à n chiffres ({SEQ:5} → 00042)' },
        { token: '{PATRONAT}', description: 'Sigle du patronat (majuscules, sans espaces)' },
      ],
      // Aperçu pour l'UI (module Paramètres) : séquence d'exemple 42
      preview: renderMatricule(format ?? DEFAULT_MATRICULE_FORMAT, {
        examCode: 'BAC26',
        examType: 'BAC',
        year,
        seq: 42,
        patronatName: patronat.name,
      }),
      canManage: WRITE_CANDIDATES.includes(fn),
    };
  }

  async updateMatriculeSettings(tenantId: string, userId: string, dto: UpdateMatriculeFormatDto) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteCandidates(fn);

    // null/'' → retour au format par défaut
    const format = dto.format?.trim() || null;
    if (format) {
      const errors = validateMatriculeFormat(format);
      if (errors.length > 0) {
        throw new BadRequestException(errors.join(' '));
      }
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "patronats" SET "matriculeFormat" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
      format,
      patronat.id,
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_MATRICULE_FORMAT_UPDATE',
        resource: 'Patronat',
        resourceId: patronat.id,
        tableName: 'patronats',
        recordId: patronat.id,
        newData: { format: format ?? '(défaut)' },
      },
    });

    this.logger.log(
      `Format matricule ${format ? `« ${format} »` : '(défaut)'} enregistré (${patronat.name})`,
    );

    return this.getMatriculeSettings(tenantId, userId);
  }

  /** Génère le matricule suivant, selon le format du patronat (ou le défaut). */
  private async nextMatricule(
    exam: { code: string; examType: string },
    patronat: { tenantId: string; name: string },
  ): Promise<string> {
    await this.ensureSchema();
    // Format personnalisé (lecture brute — robuste client Prisma non régénéré)
    let format: string | null = null;
    try {
      const rows: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT "matriculeFormat" FROM "patronats" WHERE "tenantId" = $1 LIMIT 1`,
        patronat.tenantId,
      )) as any[];
      format = rows?.[0]?.matriculeFormat ?? null;
    } catch {
      format = null;
    }
    const template = format ?? DEFAULT_MATRICULE_FORMAT;
    const year = new Date().getFullYear();

    const count = await this.prisma.examCandidate.count({
      where: { tenantId: patronat.tenantId },
    });
    let seq = count + 1;
    // Garde-fou collision : incrémente jusqu'à disponibilité (unicité globale)
    for (let i = 0; i < 200; i++) {
      const candidate = renderMatricule(template, {
        examCode: exam.code,
        examType: exam.examType,
        year,
        seq,
        patronatName: patronat.name,
      });
      const exists = await this.prisma.examCandidate.findUnique({
        where: { matricule: candidate },
      });
      if (!exists) return candidate;
      seq++;
    }
    return renderMatricule('{EXAM}-{ANNEE}-{SEQ}-{SEQ:6}', {
      examCode: exam.code,
      examType: exam.examType,
      year,
      seq: Date.now(),
      patronatName: patronat.name,
    });
  }

  async addCandidate(tenantId: string, userId: string, examId: string, dto: AddCandidateDto) {
    const rows = await this.importCandidates(tenantId, userId, examId, {
      rows: [
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth,
          gender: dto.gender,
          schoolName: dto.schoolName,
          matricule: dto.matricule,
          phone: dto.phone,
          email: dto.email,
        },
      ],
    });
    return {
      success: rows.created > 0,
      candidate: rows.createdRows?.[0] ?? null,
      warnings: rows.report.errors,
    };
  }

  /**
   * Import de candidats par lot (lignes déjà extraites du fichier Excel côté
   * client). Validation ligne à ligne : champs requis, unicité matricule /
   * numéro d'inscription, doublons (prénom + nom + date de naissance).
   */
  async importCandidates(
    tenantId: string,
    userId: string,
    examId: string,
    dto: ImportCandidatesDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteCandidates(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (EXAM_BLOCKED_STATUSES.includes(exam.status)) {
      throw new BadRequestException("Examen terminé ou annulé — import impossible.");
    }
    const year = await this.getActiveYear(patronat.tenantId);

    const rows = dto.rows ?? [];
    if (rows.length === 0) throw new BadRequestException('Aucune ligne à importer.');
    if (rows.length > 5000) throw new BadRequestException('Import limité à 5 000 lignes par lot.');

    // Quota de candidats du plan
    const plan =
      FEDERIS_PLANS[(patronat.subscriptionPlan as FederisPlanCode)] ?? FEDERIS_PLANS.ESSENTIEL;
    const currentCount = await this.prisma.examCandidate.count({
      where: { tenantId: patronat.tenantId, academicYearId: year.id },
    });
    if (currentCount + rows.length > plan.maxCandidates) {
      throw new BadRequestException(
        `Quota de candidats de l'offre ${plan.name} dépassé (${plan.maxCandidates} max, ${currentCount} enregistrés). Passez à l'offre Institution.`,
      );
    }

    // Résolution écoles : rattachées (Helm) par nom, sinon stockage metadata
    // (annotation any[] — le typage Prisma complet arrive à la génération client)
    const linkedSchools: any[] = await this.prisma.patronatSchool.findMany({
      where: { patronatId: patronat.id, status: 'JOINED' },
      include: { schoolTenant: { select: { id: true, name: true } } },
    });
    const schoolsByName = new Map(
      linkedSchools
        .filter((s) => s.schoolTenant)
        .map((s) => [(s.schoolTenant!.name ?? '').toLowerCase(), s]),
    );

    const report = { created: 0, skipped: 0, errors: [] as string[] };
    const createdRows: any[] = [];
    const seenMatricules = new Set<string>();
    const seenIdentities = new Set<string>();

    // Doublons existants en base (une seule passe)
    const matricules = rows.map((r) => r.matricule?.trim()).filter(Boolean) as string[];
    const existingMatricules = new Set(
      matricules.length
        ? (
            await this.prisma.examCandidate.findMany({
              where: { matricule: { in: matricules } },
              select: { matricule: true },
            })
          ).map((m) => m.matricule)
        : [],
    );

    const toCreate: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = i + 2; // ligne Excel (1 = en-tête)
      const firstName = row.firstName?.trim() ?? '';
      const lastName = row.lastName?.trim() ?? '';

      if (!firstName || !lastName) {
        report.errors.push(`Ligne ${line} : prénom et nom obligatoires — ligne ignorée.`);
        report.skipped++;
        continue;
      }

      let matricule = row.matricule?.trim() ?? '';
      if (matricule) {
        if (existingMatricules.has(matricule) || seenMatricules.has(matricule)) {
          report.errors.push(`Ligne ${line} : le matricule ${matricule} existe déjà — ligne ignorée.`);
          report.skipped++;
          continue;
        }
        seenMatricules.add(matricule);
      }

      const dob = row.dateOfBirth ? new Date(row.dateOfBirth) : null;
      const identityKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dob?.toISOString().slice(0, 10) ?? ''}`;
      if (seenIdentities.has(identityKey)) {
        report.errors.push(`Ligne ${line} : doublon dans le fichier (${firstName} ${lastName}) — ligne ignorée.`);
        report.skipped++;
        continue;
      }
      seenIdentities.add(identityKey);

      const schoolEntry = row.schoolName
        ? schoolsByName.get(row.schoolName.trim().toLowerCase())
        : undefined;

      toCreate.push({
        firstName,
        lastName,
        dateOfBirth: dob && !isNaN(dob.getTime()) ? dob : null,
        gender: row.gender?.trim()?.toUpperCase()?.slice(0, 10) || null,
        placeOfBirth: row.placeOfBirth?.trim() || null,
        matricule, // généré plus bas si vide
        registrationNumber: row.registrationNumber?.trim() || null,
        phone: row.phone?.trim() || null,
        email: row.email?.trim()?.toLowerCase() || null,
        schoolTenantId: schoolEntry?.schoolTenantId ?? null,
        metadata: {
          schoolName: row.schoolName?.trim() || null,
          importedAt: new Date().toISOString(),
        },
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const c of toCreate) {
          if (!c.matricule) c.matricule = await this.nextMatricule(exam, patronat);
          if (!c.registrationNumber) c.registrationNumber = c.matricule;
          const created = await tx.examCandidate.create({
            data: {
              tenantId: patronat.tenantId,
              academicYearId: year.id,
              examId: exam.id,
              schoolTenantId: c.schoolTenantId,
              firstName: c.firstName,
              lastName: c.lastName,
              dateOfBirth: c.dateOfBirth,
              gender: c.gender,
              placeOfBirth: c.placeOfBirth,
              matricule: c.matricule,
              registrationNumber: c.registrationNumber,
              phone: c.phone,
              email: c.email,
              metadata: c.metadata,
              status: 'REGISTERED',
              createdBy: userId,
            },
          });
          report.created++;
          createdRows.push({
            id: created.id,
            matricule: created.matricule,
            firstName: created.firstName,
            lastName: created.lastName,
          });
        }
        await tx.nationalExam.update({
          where: { id: exam.id },
          data: { totalCandidates: { increment: toCreate.length } },
        });
        await tx.auditLog.create({
          data: {
            tenantId: patronat.tenantId,
            userId,
            action: 'FEDERIS_CANDIDATES_IMPORTED',
            resource: 'ExamCandidate',
            resourceId: exam.id,
            tableName: 'exam_candidates',
            recordId: exam.id,
            newData: { created: toCreate.length, skipped: report.skipped, exam: exam.code },
          },
        });
      });
    }

    this.logger.log(
      `Import candidats ${exam.code} : ${report.created} créés, ${report.skipped} ignorés (${patronat.name})`,
    );

    return {
      success: true,
      created: report.created,
      skipped: report.skipped,
      errors: report.errors.slice(0, 50),
      totalAfter: currentCount + report.created,
      quota: { used: currentCount + report.created, max: plan.maxCandidates },
      createdRows,
      report,
    };
  }

  // ── 4 quater. Anonymats (post-composition — 2026-09-29) ──────────────────
  //
  // L'anonymat remplace l'identité du candidat pour la saisie des notes et
  // toute la correction : après l'évaluation, les correcteurs ne voient PLUS
  // les noms — uniquement un code. Chaque candidat de l'examen reçoit un code
  // unique AU SEIN DE L'EXAMEN, attribué dans l'ordre alphabétique :
  //   <année 2 chiffres><initiale du type d'examen><séquence 5 chiffres>
  //   ex. BEPC 2026 → 26B00001, 26B00002… / CEP 2026 → 26C00001…
  // (l'initiale CEP/BEPC/BAC/CAP peut coïncider entre deux examens DIFFÉRENTS
  //  — pas de collision : les codes sont uniques PAR examen.)

  async generateAnonymats(
    tenantId: string,
    userId: string,
    examId: string,
    dto: GenerateAnonymatsDto,
  ) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteCandidates(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (EXAM_BLOCKED_STATUSES.includes(exam.status)) {
      throw new BadRequestException("Examen terminé ou annulé — anonymats verrouillés.");
    }

    const candidates = await this.prisma.examCandidate.findMany({
      where: {
        examId: exam.id,
        status: { not: 'CANCELLED' },
        ...(dto.regenerate ? {} : { anonymatCode: null }),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, anonymatCode: true },
    });

    if (candidates.length === 0) {
      return {
        success: true,
        generated: 0,
        message: dto.regenerate
          ? 'Aucun candidat actif sur cet examen.'
          : 'Tous les candidats ont déjà un anonymat (utilisez « Régénérer » pour une nouvelle série).',
      };
    }

    // Codes déjà utilisés DANS CET EXAMEN (pour éviter toute collision lors
    // d'une génération partielle). En régénération complète, la série est
    // réinitialisée (00001) après effacement des anciens codes.
    const existing: any[] = (await this.prisma.$queryRawUnsafe(
      `SELECT "anonymatCode" FROM "exam_candidates"
       WHERE "examId" = $1 AND "anonymatCode" IS NOT NULL`,
      exam.id,
    )) as any[];
    const used = new Set<string>(
      dto.regenerate ? [] : existing.map((r) => r.anonymatCode as string),
    );

    const yy = String(new Date().getFullYear()).slice(-2);
    const initial = (exam.examType ?? 'X').charAt(0).toUpperCase();
    const issuedAt = new Date();

    let seq = 1;
    const updates: Array<{ id: string; code: string }> = [];
    for (const c of candidates) {
      let code = `${yy}${initial}${String(seq).padStart(5, '0')}`;
      // Collision (génération partielle après retraits) → avance la séquence
      while (used.has(code)) {
        seq++;
        code = `${yy}${initial}${String(seq).padStart(5, '0')}`;
      }
      used.add(code);
      updates.push({ id: c.id, code });
      seq++;
    }

    await this.prisma.$transaction(async (tx) => {
      // Régénération : efface l'ancienne série (contrainte de cohérence en fin
      // de transaction — les nouveaux codes sont posés juste après).
      if (dto.regenerate) {
        await tx.$executeRawUnsafe(
          `UPDATE "exam_candidates" SET "anonymatCode" = NULL, "anonymatIssuedAt" = NULL
           WHERE "examId" = $1`,
          exam.id,
        );
      }
      for (const u of updates) {
        await tx.$executeRawUnsafe(
          `UPDATE "exam_candidates" SET "anonymatCode" = $1, "anonymatIssuedAt" = $2
           WHERE "id" = $3`,
          u.code,
          issuedAt,
          u.id,
        );
      }
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_ANONYMATS_GENERATED',
          resource: 'ExamCandidate',
          resourceId: exam.id,
          tableName: 'exam_candidates',
          recordId: exam.id,
          newData: {
            exam: exam.code,
            generated: updates.length,
            regenerate: !!dto.regenerate,
          },
        },
      });
    });

    this.logger.log(
      `Anonymats générés ${exam.code} : ${updates.length} candidat(s)${dto.regenerate ? ' (régénération)' : ''} (${patronat.name})`,
    );

    return {
      success: true,
      generated: updates.length,
      message: `${updates.length} anonymat(s) généré(s) — les correcteurs utiliseront ces codes pour la saisie des notes (identités masquées).`,
    };
  }

  // ── 5. Affectation des numéros de table ──────────────────────────────────

  /**
   * Affectation automatique des candidats aux salles + numéros de table.
   *
   * Algorithme :
   *   1. Candidats actifs (statut ≠ CANCELLED) triés — par école puis nom
   *      (SCHOOL, défaut : mélange les écoles pour limiter la copie entre
   *      voisins) ou alphabétique pur (NAME)
   *   2. Parallélisation logistique : on remplit chaque salle du centre
   *      jusqu'à sa capacité, centre par centre (ordre code)
   *   3. Numérotation séquentielle :
   *      • CENTER (défaut) — redémarre à chaque centre ;
   *      • ROOM (2026-09-29) — redémarre dans CHAQUE SALLE de composition
   *        (001, 002… par salle — repérage immédiat pour les surveillants) ;
   *      • EXAM — globale à l'examen
   *   4. Mise à jour transactionnelle : candidates.centerId/roomId/tableNumber
   *      + salles currentOccupancy/status + audit
   */
  async assignTableNumbers(tenantId: string, userId: string, examId: string, dto: AssignTablesDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWriteOrg(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (EXAM_BLOCKED_STATUSES.includes(exam.status)) {
      throw new BadRequestException("Examen terminé ou annulé — affectation impossible.");
    }

    const [candidates, centers] = await Promise.all([
      this.prisma.examCandidate.findMany({
        where: { examId: exam.id, status: { not: 'CANCELLED' } },
        include: { schoolTenant: { select: { name: true } } },
      }),
      this.prisma.examCenter.findMany({
        where: { examId: exam.id, status: 'ACTIVE' },
        include: { examRooms: { where: { status: 'AVAILABLE' }, orderBy: { code: 'asc' } } },
        orderBy: { code: 'asc' },
      }),
    ]);

    const rooms = centers.flatMap((c) =>
      c.examRooms.map((r) => ({ room: r, center: c, capacity: r.capacity })),
    );
    const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
    if (rooms.length === 0) {
      throw new BadRequestException(
        "Aucune salle disponible. Créez d'abord des centres et des salles pour cet examen.",
      );
    }

    // Tri des candidats
    const orderBy = dto.orderBy ?? 'SCHOOL';
    const sorted = [...candidates].sort((a, b) => {
      if (orderBy === 'SCHOOL') {
        const schoolA = a.schoolTenant?.name ?? (a.metadata as any)?.schoolName ?? 'zzz';
        const schoolB = b.schoolTenant?.name ?? (b.metadata as any)?.schoolName ?? 'zzz';
        const cmp = String(schoolA).localeCompare(String(schoolB), 'fr');
        if (cmp !== 0) return cmp;
      }
      const nameCmp = a.lastName.localeCompare(b.lastName, 'fr');
      if (nameCmp !== 0) return nameCmp;
      return a.firstName.localeCompare(b.firstName, 'fr');
    });

    const scope = dto.numberingScope ?? 'CENTER';
    const start = Math.max(1, dto.startNumber ?? 1);
    let globalCounter = start - 1;

    // Attribution
    const assignments: Array<{
      candidateId: string;
      centerId: string;
      roomId: string;
      tableNumber: string;
    }> = [];
    const roomOccupancy = new Map<string, number>();
    let roomIndex = 0;

    for (const candidate of sorted) {
      // Cherche la prochaine salle avec de la place
      while (roomIndex < rooms.length && rooms[roomIndex].capacity <= (roomOccupancy.get(rooms[roomIndex].room.id) ?? 0)) {
        roomIndex++;
      }
      if (roomIndex >= rooms.length) break; // capacité épuisée

      const target = rooms[roomIndex];
      const occupied = (roomOccupancy.get(target.room.id) ?? 0) + 1;
      roomOccupancy.set(target.room.id, occupied);

      if (scope === 'EXAM') {
        globalCounter++;
      } else if (scope === 'ROOM') {
        // ⭐ Numérotation PAR SALLE (2026-09-29) : la série redémarre à chaque
        //    salle de composition — 001, 002… dans CHAQUE salle.
        globalCounter = start + occupied - 1;
      } else {
        // Compteur par centre : nombre déjà affecté dans CE centre + start
        const perCenter = assignments.filter((a) => a.centerId === target.center.id).length;
        globalCounter = start + perCenter;
      }

      assignments.push({
        candidateId: candidate.id,
        centerId: target.center.id,
        roomId: target.room.id,
        tableNumber: String(globalCounter).padStart(3, '0'),
      });
    }

    const unassigned = sorted.length - assignments.length;

    await this.prisma.$transaction(async (tx) => {
      for (const a of assignments) {
        await tx.examCandidate.update({
          where: { id: a.candidateId },
          data: {
            centerId: a.centerId,
            roomId: a.roomId,
            tableNumber: a.tableNumber,
          },
        });
      }
      for (const [roomId, occupancy] of roomOccupancy.entries()) {
        const room = rooms.find((r) => r.room.id === roomId)!;
        await tx.examRoom.update({
          where: { id: roomId },
          data: {
            currentOccupancy: occupancy,
            status: occupancy >= room.capacity ? 'FULL' : 'AVAILABLE',
          },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_TABLE_NUMBERS_ASSIGNED',
          resource: 'ExamCandidate',
          resourceId: exam.id,
          tableName: 'exam_candidates',
          recordId: exam.id,
          newData: {
            exam: exam.code,
            assigned: assignments.length,
            unassigned,
            orderBy,
            numberingScope: scope,
          },
        },
      });
    });

    // Résumé par centre (pour l'UI)
    const perCenter = centers.map((c) => {
      const centerAssignments = assignments.filter((a) => a.centerId === c.id);
      return {
        centerCode: c.code,
        centerName: c.name,
        candidates: centerAssignments.length,
        rooms: c.examRooms.map((r) => ({
          code: r.code,
          capacity: r.capacity,
          occupancy: roomOccupancy.get(r.id) ?? 0,
        })),
      };
    });

    this.logger.log(
      `Numéros affectés ${exam.code} : ${assignments.length} candidats, ${unassigned} non affectés (${patronat.name})`,
    );

    return {
      success: true,
      assigned: assignments.length,
      unassigned,
      totalCapacity,
      orderBy,
      numberingScope: scope,
      perCenter,
      message:
        unassigned > 0
          ? `${assignments.length} candidats affectés. Capacité insuffisante pour ${unassigned} candidat(s) — ajoutez des salles.`
          : `${assignments.length} candidats affectés avec numéro de table.`,
    };
  }
}
