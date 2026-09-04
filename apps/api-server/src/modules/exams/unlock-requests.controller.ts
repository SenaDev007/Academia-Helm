import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';

/**
 * ============================================================================
 * UNLOCK REQUESTS CONTROLLER - MODULE EXAMEN
 * ============================================================================
 *
 * Gestion des demandes de déverrouillage d'évaluations :
 *   - Un enseignant soumet une demande quand il veut modifier des notes
 *     déjà soumises/validées.
 *   - La direction (DIRECTOR/PROMOTER/ADMIN) voit les demandes et peut les
 *     approuver (l'évaluation repasse en OPEN_FOR_GRADING) ou les rejeter.
 *
 * Endpoints :
 *   GET    /                                   — liste filtrée (par statut, classe, niveau)
 *   POST   /                                   — créer une demande (ouvert aux enseignants)
 *   GET    /:id                                — détail d'une demande
 *   PATCH  /:id/approve                        — approuver (réouvre l'évaluation)
 *   PATCH  /:id/reject                         — rejeter (avec motif)
 * ============================================================================
 */
@Controller('institutional-exams/unlock-requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UnlockRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste des demandes de déverrouillage.
   * Filtres supportés : status, classId, schoolLevelId, academicYearId, language.
   */
  @Get()
  @Permissions('exams.read')
  async findAll(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query() filters: any,
  ) {
    // ⭐ V10b — Construction paramétrée propre (plus de positions calculées) :
    // isole par niveau (schoolLevelId) ET piste linguistique (language) —
    // les sections EN partagent le schoolLevelId de leur miroir FR.
    // Règle linguistique : FR = classes FR + classes non marquées (historique),
    // EN = classes EN marquées uniquement.
    const params: any[] = [tenantId];
    let whereSql = `WHERE ur."tenantId" = $1`;
    const push = (value: any, fragment: (idx: number) => string) => {
      params.push(value);
      whereSql += ` AND ${fragment(params.length)}`;
    };

    if (filters.status) push(filters.status, (i) => `ur.status = $${i}`);
    if (filters.classId) push(filters.classId, (i) => `ur."classId" = $${i}`);
    if (filters.schoolLevelId) push(filters.schoolLevelId, (i) => `ur."schoolLevelId" = $${i}`);
    if (academicYearId) push(academicYearId, (i) => `e."academicYearId" = $${i}`);
    if (filters.language) {
      const lang = String(filters.language).toUpperCase();
      const frUnmarked = lang === 'FR' ? `OR (c."language" IS NULL AND atr.code IS NULL)` : '';
      push(lang, (i) => `(
        c."language" = $${i}::text
        OR atr.code = $${i}::text
        ${frUnmarked}
      )`);
    }

    const requests = await this.prisma.$queryRawUnsafe(`
      SELECT
        ur.id, ur."tenantId", ur."evaluationId", ur."requestedById", ur."classId",
        ur."subjectId", ur."periodId", ur."schoolLevelId", ur.reason, ur.status,
        ur."reviewedById", ur."reviewedAt", ur."reviewComment",
        ur."createdAt", ur."updatedAt",
        e.title AS "evaluationTitle",
        e.status AS "evaluationStatus",
        e."evaluationDate",
        c.name AS "className",
        s.name AS "subjectName",
        et.code AS "evaluationTypeCode",
        et.name AS "evaluationTypeName",
        sl.code AS "schoolLevelCode",
        sl.name AS "schoolLevelName",
        ap.name AS "periodName",
        u_req."firstName" AS "requestedByFirstName",
        u_req."lastName" AS "requestedByLastName",
        u_req.email AS "requestedByEmail",
        u_rev."firstName" AS "reviewedByFirstName",
        u_rev."lastName" AS "reviewedByLastName"
      FROM evaluation_unlock_requests ur
      LEFT JOIN evaluations e ON e.id = ur."evaluationId"
      LEFT JOIN classes c ON c.id = ur."classId"
      LEFT JOIN academic_tracks atr ON atr.id = c."academicTrackId"
      LEFT JOIN subjects s ON s.id = ur."subjectId"
      LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN school_levels sl ON sl.id = ur."schoolLevelId"
      LEFT JOIN academic_periods ap ON ap.id = ur."periodId"
      LEFT JOIN users u_req ON u_req.id = ur."requestedById"
      LEFT JOIN users u_rev ON u_rev.id = ur."reviewedById"
      ${whereSql}
      ORDER BY ur."createdAt" DESC
      LIMIT 200
    `, ...params);

    return requests;
  }

  /**
   * Détail d'une demande.
   */
  @Get(':id')
  @Permissions('exams.read')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    const requests = await this.prisma.$queryRawUnsafe(`
      SELECT
        ur.*, e.title AS "evaluationTitle", e.status AS "evaluationStatus",
        c.name AS "className", s.name AS "subjectName",
        et.code AS "evaluationTypeCode", et.name AS "evaluationTypeName"
      FROM evaluation_unlock_requests ur
      LEFT JOIN evaluations e ON e.id = ur."evaluationId"
      LEFT JOIN classes c ON c.id = ur."classId"
      LEFT JOIN subjects s ON s.id = ur."subjectId"
      LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      WHERE ur.id = $1 AND ur."tenantId" = $2
    `, id, tenantId);

    if (!Array.isArray(requests) || requests.length === 0) {
      throw new NotFoundException('Demande non trouvée');
    }
    return requests[0];
  }

  /**
   * Crée une demande de déverrouillage.
   * Body : { evaluationId, reason, classId?, subjectId?, periodId?, schoolLevelId? }
   */
  @Post()
  @Permissions('exams.manage')
  async create(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() body: any,
  ) {
    if (!body.evaluationId) throw new BadRequestException('evaluationId requis');
    if (!body.reason || body.reason.trim().length < 10) {
      throw new BadRequestException('reason requis (min 10 caractères)');
    }

    // Récupérer l'évaluation pour les infos contexte
    const evals = await this.prisma.$queryRawUnsafe(`
      SELECT id, "classId", "subjectId", "periodId", "academicYearId", status
      FROM evaluations WHERE id = $1 AND "tenantId" = $2
    `, body.evaluationId, tenantId);

    if (!Array.isArray(evals) || evals.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    const ev = evals[0] as any;

    // Vérifier qu'il n'y a pas déjà une demande PENDING pour cette évaluation
    const existing = await this.prisma.$queryRawUnsafe(`
      SELECT id, status FROM evaluation_unlock_requests
      WHERE "evaluationId" = $1 AND "tenantId" = $2 AND status = 'PENDING'
      LIMIT 1
    `, body.evaluationId, tenantId);

    if (Array.isArray(existing) && existing.length > 0) {
      return {
        success: false,
        message: 'Une demande de déverrouillage est déjà en attente pour cette évaluation',
        existingRequestId: existing[0].id,
      };
    }

    // Créer la demande
    const created = await this.prisma.$queryRawUnsafe(`
      INSERT INTO evaluation_unlock_requests (
        id, "tenantId", "evaluationId", "requestedById",
        "classId", "subjectId", "periodId", "schoolLevelId",
        reason, status, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
        $8, 'PENDING', NOW(), NOW()
      ) RETURNING id
    `,
      tenantId,
      body.evaluationId,
      userId,
      body.classId || ev.classId,
      body.subjectId || ev.subjectId,
      body.periodId || ev.periodId,
      body.schoolLevelId || null,
      body.reason.trim(),
    );

    return {
      success: true,
      message: 'Demande de déverrouillage envoyée à l\'administration',
      requestId: Array.isArray(created) && created.length > 0 ? created[0].id : null,
    };
  }

  /**
   * Approuver une demande — repasse l'évaluation en OPEN_FOR_GRADING.
   */
  @Patch(':id/approve')
  @Permissions('exams.validate')
  async approve(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() body: { reviewComment?: string },
  ) {
    // Vérifier que la demande existe et est PENDING
    const requests = await this.prisma.$queryRawUnsafe(`
      SELECT id, "evaluationId", status FROM evaluation_unlock_requests
      WHERE id = $1 AND "tenantId" = $2
    `, id, tenantId);

    if (!Array.isArray(requests) || requests.length === 0) {
      throw new NotFoundException('Demande non trouvée');
    }
    const req = requests[0] as any;
    if (req.status !== 'PENDING') {
      throw new BadRequestException(`La demande n'est plus en attente (statut actuel: ${req.status})`);
    }

    // Marquer la demande comme APPROVED
    await this.prisma.$queryRawUnsafe(`
      UPDATE evaluation_unlock_requests
      SET status = 'APPROVED', "reviewedById" = $1, "reviewedAt" = NOW(),
          "reviewComment" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, userId, body.reviewComment || null, id);

    // Repasser l'évaluation en OPEN_FOR_GRADING pour permettre la modification
    await this.prisma.$queryRawUnsafe(`
      UPDATE evaluations
      SET status = 'OPEN_FOR_GRADING', "updatedAt" = NOW()
      WHERE id = $1
    `, req.evaluationId);

    // TODO: Notifier l'enseignant que la demande a été approuvée

    return {
      success: true,
      message: 'Demande approuvée — l\'évaluation est maintenant modifiable',
      evaluationId: req.evaluationId,
    };
  }

  /**
   * Rejeter une demande.
   */
  @Patch(':id/reject')
  @Permissions('exams.validate')
  async reject(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() body: { reviewComment: string },
  ) {
    if (!body.reviewComment || body.reviewComment.trim().length < 5) {
      throw new BadRequestException('reviewComment requis (min 5 caractères)');
    }

    const requests = await this.prisma.$queryRawUnsafe(`
      SELECT id, status FROM evaluation_unlock_requests
      WHERE id = $1 AND "tenantId" = $2
    `, id, tenantId);

    if (!Array.isArray(requests) || requests.length === 0) {
      throw new NotFoundException('Demande non trouvée');
    }
    const req = requests[0] as any;
    if (req.status !== 'PENDING') {
      throw new BadRequestException(`La demande n'est plus en attente (statut actuel: ${req.status})`);
    }

    await this.prisma.$queryRawUnsafe(`
      UPDATE evaluation_unlock_requests
      SET status = 'REJECTED', "reviewedById" = $1, "reviewedAt" = NOW(),
          "reviewComment" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, userId, body.reviewComment.trim(), id);

    // TODO: Notifier l'enseignant que la demande a été rejetée

    return {
      success: true,
      message: 'Demande rejetée — l\'enseignant sera notifié',
    };
  }
}
