/**
 * FederisQuestionBankService — Banque d'épreuves (Academia Federis)
 *
 * Cahier des charges §7.7 : recensement et sécurisation des sujets
 * d'examens (accès restreint, verrouillage avant impression, traçabilité).
 *
 * Persisté dans la table question_bank_resources (VRAIES données — remplace
 * les données de démonstration de l'ancienne page) :
 *   GET    /federis/patronat/question-bank        — ressources du patronat
 *   POST   /federis/patronat/question-bank        — recenser une épreuve
 *   PATCH  /federis/patronat/question-bank/:id    — statut / accès / métadonnées
 *   DELETE /federis/patronat/question-bank/:id    — retirer une épreuve
 *
 * Règles de protection (pattern FederisBureauService) :
 *   - Lecture : tous les membres du patronat ;
 *   - Création / modification / suppression : COORDONNATEUR + ORGANISATEUR
 *     (WRITE_EXAM_ORG — périmètre organisation des examens).
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import {
  normalizePatronatFunction,
  WRITE_EXAM_ORG,
  type PatronatFunction,
} from './federis-roles';

/** Types de ressources recensables (cahier des charges §7.7). */
export const RESOURCE_TYPES = ['EXAM_PAPER', 'CORRECTION', 'SYLLABUS', 'REPORT'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Cycle de vie d'une épreuve : brouillon → validée → verrouillée. */
export const RESOURCE_STATUSES = ['DRAFT', 'VALIDATED', 'LOCKED', 'ARCHIVED'] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

/** Niveaux d'accès (pattern accès restreint Federis). */
export const ACCESS_LEVELS = ['RESTRICTED', 'COORDINATOR_ONLY', 'PUBLIC'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export class CreateQuestionBankResourceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  subject?: string;

  /** Classe / niveau (ex : BAC D, BEPC, CEP). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  classLevel?: string;

  /** Type d'examen (ex : BAC, BEPC — session visée). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  examType?: string;

  @IsIn(RESOURCE_TYPES as unknown as string[])
  resourceType!: ResourceType;

  /** Document — data URL (optimisée via /media/optimize) ou URL https. */
  @IsString()
  @MaxLength(2_000_000)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsIn(ACCESS_LEVELS as unknown as string[])
  accessLevel?: AccessLevel;
}

export class UpdateQuestionBankResourceDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  classLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  examType?: string;

  @IsOptional()
  @IsIn(RESOURCE_STATUSES as unknown as string[])
  status?: ResourceStatus;

  @IsOptional()
  @IsIn(ACCESS_LEVELS as unknown as string[])
  accessLevel?: AccessLevel;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  EXAM_PAPER: 'Sujet d\u2019examen',
  CORRECTION: 'Corrigé',
  SYLLABUS: 'Syllabus',
  REPORT: 'Rapport',
};

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  RESTRICTED: 'Accès restreint',
  COORDINATOR_ONLY: 'Coordonnateur uniquement',
  PUBLIC: 'Public',
};

@Injectable()
export class FederisQuestionBankService {
  private readonly logger = new Logger(FederisQuestionBankService.name);

  constructor(
    private readonly prisma: PrismaService,
    // ⭐ 2026-10-01 — AGRÉGATION NATIONALE : périmètre (national = tous les départements)
    private readonly scopeService: FederisScopeService,
  ) {}

  /** Résout le patronat + la fonction du demandeur (pattern FederisBureauService). */
  private async resolveContext(tenantId: string, userId?: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!patronat) {
      throw new NotFoundException('Aucun espace patronat associé à ce compte.');
    }

    let fn: PatronatFunction = 'VIEWER';
    if (userId) {
      const link = await this.prisma.patronatUser.findFirst({
        where: { tenantId, userId, isActive: true },
        select: { role: true },
      });
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      fn = normalizePatronatFunction(link?.role ?? user?.role);
    }
    return { patronat, fn };
  }

  private assertCanWrite(fn: PatronatFunction): void {
    if (!WRITE_EXAM_ORG.includes(fn)) {
      throw new ForbiddenException(
        'La banque d\u2019épreuves est gérée par le coordonnateur et l\u2019organisateur du patronat.',
      );
    }
  }

  /** Année scolaire active du patronat (pattern getActiveYear). */
  private async getActiveYear(tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    return year;
  }

  /** Liste des épreuves recensées (lecture : tous les membres). */
  async listResources(tenantId: string, userId?: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);

    // ⭐ 2026-10-01 — AGRÉGATION NATIONALE : la banque du national consolide
    //    ses ressources + celles de tous ses départements.
    const scope = await this.scopeService.resolveScope(tenantId, userId);

    const resources = await this.prisma.questionBankResource.findMany({
      where: { patronatId: { in: scope.scopePatronatIds }, status: { not: 'ARCHIVED' } },
      include: { patronat: { select: { name: true, territoryName: true } } },
      orderBy: { uploadedAt: 'desc' },
      take: 200,
    });

    return {
      resources: resources.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        resourceType: r.resourceType,
        resourceTypeLabel: RESOURCE_TYPE_LABELS[r.resourceType] ?? r.resourceType,
        subject: r.subject,
        classLevel: r.class,
        examType: r.examType,
        fileUrl: r.fileUrl,
        mimeType: r.mimeType,
        fileSize: r.fileSize,
        accessLevel: r.accessLevel,
        accessLevelLabel: ACCESS_LEVEL_LABELS[r.accessLevel] ?? r.accessLevel,
        // ⭐ Département propriétaire (vue agrégée nationale)
        department: (r as any).patronat
          ? { name: (r as any).patronat.name, territoryName: (r as any).patronat.territoryName ?? null }
          : null,
        status: r.status,
        downloadCount: r.downloadCount,
        uploadedAt: r.uploadedAt,
      })),
      catalog: {
        resourceTypes: RESOURCE_TYPES.map((t) => ({ key: t, label: RESOURCE_TYPE_LABELS[t] })),
        statuses: RESOURCE_STATUSES,
        accessLevels: ACCESS_LEVELS.map((l) => ({ key: l, label: ACCESS_LEVEL_LABELS[l] })),
      },
      canManage: WRITE_EXAM_ORG.includes(fn),
    };
  }

  /** Recenser une épreuve (coordonnateur / organisateur). */
  async createResource(tenantId: string, userId: string, dto: CreateQuestionBankResourceDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);
    // ★ Garde nationale : lecture seule sauf délégation d'un département
    await this.scopeService.assertWritable(tenantId, userId, patronat.id);

    const academicYear = await this.getActiveYear(patronat.tenantId);
    if (!academicYear) {
      throw new BadRequestException(
        'Aucune année scolaire active — générez une année depuis les Paramètres.',
      );
    }

    const isHttp = /^https:\/\//i.test(dto.fileUrl);
    const isDataUrl = /^data:[a-z0-9.-]+\/[a-z0-9.+-]+;base64,/i.test(dto.fileUrl);
    if (!isHttp && !isDataUrl) {
      throw new BadRequestException(
        'Document invalide : fournissez un fichier (data URL) ou une URL https.',
      );
    }

    let fileSize: number | null = null;
    let mimeType: string | null = null;
    if (isDataUrl) {
      mimeType = dto.fileUrl.slice(5, dto.fileUrl.indexOf(';')) || null;
      fileSize = Math.floor((dto.fileUrl.length - dto.fileUrl.indexOf(',')) * 0.75);
    }

    const resource = await this.prisma.questionBankResource.create({
      data: {
        tenantId: patronat.tenantId,
        patronatId: patronat.id,
        academicYearId: academicYear.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        resourceType: dto.resourceType,
        subject: dto.subject?.trim() || null,
        class: dto.classLevel?.trim() || null,
        examType: dto.examType?.trim() || null,
        fileUrl: dto.fileUrl,
        fileSize,
        mimeType,
        accessLevel: dto.accessLevel ?? 'RESTRICTED',
        uploadedBy: userId,
        status: 'DRAFT',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_QUESTION_BANK_RESOURCE_CREATED',
        resource: 'QuestionBankResource',
        resourceId: resource.id,
        tableName: 'question_bank_resources',
        recordId: resource.id,
        newData: { title: resource.title, resourceType: resource.resourceType },
      },
    });

    this.logger.log(
      `Épreuve recensée : « ${resource.title} » (${resource.resourceType}) — patronat ${patronat.id}`,
    );
    return { success: true, resource };
  }

  /** Modifier une épreuve (statut, accès, métadonnées). */
  async updateResource(
    tenantId: string,
    userId: string,
    resourceId: string,
    dto: UpdateQuestionBankResourceDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);

    // ★ 2026-10-01 — PÉRIMÈTRE étendu (national = tous les départements)
    const scope = await this.scopeService.resolveScope(tenantId, userId);
    const existing = await this.prisma.questionBankResource.findFirst({
      where: { id: resourceId, patronatId: { in: scope.scopePatronatIds } },
    });
    if (!existing) {
      throw new NotFoundException('Épreuve introuvable dans la banque du patronat.');
    }
    // ★ Garde nationale : écriture uniquement si le département propriétaire
    //    a délégué ses droits au compte national connecté.
    await this.scopeService.assertNationalWritable(scope, userId, existing.patronatId);

    const resource = await this.prisma.questionBankResource.update({
      where: { id: resourceId },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject?.trim() || null } : {}),
        ...(dto.classLevel !== undefined ? { class: dto.classLevel?.trim() || null } : {}),
        ...(dto.examType !== undefined ? { examType: dto.examType?.trim() || null } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.accessLevel ? { accessLevel: dto.accessLevel } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_QUESTION_BANK_RESOURCE_UPDATED',
        resource: 'QuestionBankResource',
        resourceId: resource.id,
        tableName: 'question_bank_resources',
        recordId: resource.id,
        newData: {
          title: resource.title,
          status: resource.status,
          accessLevel: resource.accessLevel,
        },
      },
    });

    return { success: true, resource };
  }

  /** Retirer définitivement une épreuve. */
  async deleteResource(tenantId: string, userId: string, resourceId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);

    // ★ 2026-10-01 — PÉRIMÈTRE étendu (national = tous les départements)
    const scope = await this.scopeService.resolveScope(tenantId, userId);
    const existing = await this.prisma.questionBankResource.findFirst({
      where: { id: resourceId, patronatId: { in: scope.scopePatronatIds } },
    });
    if (!existing) {
      throw new NotFoundException('Épreuve introuvable dans la banque du patronat.');
    }
    // ★ Garde nationale : écriture uniquement si le département propriétaire
    //    a délégué ses droits au compte national connecté.
    await this.scopeService.assertNationalWritable(scope, userId, existing.patronatId);

    await this.prisma.questionBankResource.delete({ where: { id: resourceId } });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_QUESTION_BANK_RESOURCE_REMOVED',
        resource: 'QuestionBankResource',
        resourceId: resourceId,
        tableName: 'question_bank_resources',
        recordId: resourceId,
        newData: { title: existing.title, resourceType: existing.resourceType },
      },
    });

    this.logger.log(`Épreuve retirée de la banque : « ${existing.title} »`);
    return { success: true };
  }
}
// ★ 2026-10-01 — AGRÉGATION NATIONALE : périmètre (national = tous les départements)
import { FederisScopeService } from './federis-scope.service';
