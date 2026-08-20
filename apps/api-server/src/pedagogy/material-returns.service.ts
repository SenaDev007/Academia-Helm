/**
 * ============================================================================
 * MATERIAL RETURNS SERVICE — Logique métier pour le suivi des retours
 * ============================================================================
 *
 * Utilise des requêtes SQL brutes ($queryRawUnsafe / $executeRawUnsafe) car
 * les nouveaux champs (returnQuantity, returnStatus, etc.) ne sont pas encore
 * régénérés dans le client Prisma. Cette approche est plus résiliente et
 * indépendante des variations du schéma Prisma.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MaterialReturnsService {
  private readonly logger = new Logger(MaterialReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /// Résout user.id → teacher.id (identique au pattern cahier de texte).
  private async resolveTeacherId(tenantId: string, userId: string): Promise<string | null> {
    const directTeacher: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "teachers" WHERE "id" = $1 AND "tenantId" = $2`,
      userId, tenantId,
    );
    if (directTeacher && directTeacher.length > 0) {
      return directTeacher[0].id;
    }

    const user: any = await this.prisma.$queryRawUnsafe(
      `SELECT "email" FROM "users" WHERE "id" = $1 AND "tenantId" = $2`,
      userId, tenantId,
    );
    if (user && user.length > 0 && user[0].email) {
      const teacher: any = await this.prisma.$queryRawUnsafe(
        `SELECT "id" FROM "teachers" WHERE "email" = $1 AND "tenantId" = $2`,
        user[0].email, tenantId,
      );
      if (teacher && teacher.length > 0) return teacher[0].id;
    }
    return null;
  }

  /// Récupère toutes les attributions de l'enseignant pour l'année.
  ///    Inclut le matériel, la classe, le niveau scolaire, et l'état du retour.
  async getMyAssignments(tenantId: string, userId: string, academicYearId: string) {
    const teacherId = await this.resolveTeacherId(tenantId, userId);
    if (!teacherId) {
      return { hasTeacherProfile: false, assignments: [] };
    }

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         tma.*,
         pm."name" AS "materialName",
         pm."code" AS "materialCode",
         pm."category" AS "materialCategory",
         pm."description" AS "materialDescription",
         s."name" AS "subjectName",
         sl."name" AS "schoolLevelName",
         sl."code" AS "schoolLevelCode",
         c."name" AS "className",
         c."code" AS "classCode"
       FROM "teacher_material_assignments" tma
       LEFT JOIN "pedagogical_materials" pm ON pm."id" = tma."materialId"
       LEFT JOIN "subjects" s ON s."id" = pm."subjectId"
       LEFT JOIN "school_levels" sl ON sl."id" = tma."schoolLevelId"
       LEFT JOIN "classes" c ON c."id" = tma."classId"
       WHERE tma."tenantId" = $1
         AND tma."academicYearId" = $2
         AND tma."teacherId" = $3
       ORDER BY pm."category" ASC, pm."name" ASC`,
      tenantId, academicYearId, teacherId,
    );

    return {
      hasTeacherProfile: true,
      teacherId,
      assignments: Array.isArray(rows) ? rows : [],
    };
  }

  /// Met à jour les infos de retour pour une attribution.
  ///    Rejette si l'attribution est déjà SUBMITTED/VALIDATED (verrouillage).
  async updateReturnInfo(
    tenantId: string,
    assignmentId: string,
    data: { returnQuantity?: number; returnCondition?: string; returnNotes?: string },
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "returnStatus", "quantity" FROM "teacher_material_assignments"
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Attribution non trouvée');
    }
    const row = existing[0];
    if (row.returnStatus === 'SUBMITTED' || row.returnStatus === 'VALIDATED') {
      throw new BadRequestException(
        `Impossible de modifier : retour déjà ${row.returnStatus.toLowerCase()}`,
      );
    }

    // Validation : returnQuantity ≤ quantity
    if (data.returnQuantity !== undefined && data.returnQuantity > row.quantity) {
      throw new BadRequestException(
        `returnQuantity (${data.returnQuantity}) ne peut pas dépasser la quantité attribuée (${row.quantity})`,
      );
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (data.returnQuantity !== undefined) {
      updates.push(`"returnQuantity" = $${paramIdx++}`);
      params.push(data.returnQuantity);
      updates.push(`"lostQuantity" = $${paramIdx++}`);
      params.push(row.quantity - data.returnQuantity);
    }
    if (data.returnCondition !== undefined) {
      updates.push(`"returnCondition" = $${paramIdx++}`);
      params.push(data.returnCondition);
    }
    if (data.returnNotes !== undefined) {
      updates.push(`"returnNotes" = $${paramIdx++}`);
      params.push(data.returnNotes);
    }
    updates.push(`"updatedAt" = NOW()`);

    if (updates.length === 1) return { skipped: true };

    params.push(assignmentId, tenantId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET ${updates.join(', ')}
       WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    return { success: true };
  }

  /// Soumet TOUTES les attributions PENDING de l'enseignant pour l'année.
  ///    La signature est attachée à chaque ligne (pour conserver l'historique
  ///    même si la signature globale est supprimée plus tard).
  async submitReturn(
    tenantId: string,
    userId: string,
    academicYearId: string,
    signatureUrl: string,
  ) {
    const teacherId = await this.resolveTeacherId(tenantId, userId);
    if (!teacherId) {
      throw new BadRequestException(
        'Aucun profil Teacher trouvé pour cet utilisateur',
      );
    }

    // Vérifier qu'il y a au moins une attribution PENDING
    const pending: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "quantity", "returnQuantity" FROM "teacher_material_assignments"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3
         AND "returnStatus" = 'PENDING'`,
      tenantId, academicYearId, teacherId,
    );
    if (!pending || pending.length === 0) {
      throw new BadRequestException(
        'Aucune attribution en attente — toutes vos attributions ont déjà été soumises ou validées.',
      );
    }

    // Vérifier que chaque ligne a au moins returnQuantity (par défaut 0 si non renseigné)
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET "returnStatus" = 'SUBMITTED',
           "returnSentAt" = NOW(),
           "returnSignatureUrl" = $4,
           "lostQuantity" = COALESCE("quantity" - COALESCE("returnQuantity", 0), "quantity"),
           "updatedAt" = NOW()
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3
         AND "returnStatus" = 'PENDING'`,
      tenantId, academicYearId, teacherId, signatureUrl,
    );

    this.logger.log(
      `[submitReturn] ${pending.length} attributions soumises par teacherId=${teacherId}`,
    );

    return {
      success: true,
      submittedCount: pending.length,
      message: `${pending.length} attribution(s) soumise(s) à la direction`,
    };
  }

  /// Liste les soumissions SUBMITTED en attente de validation (vue direction).
  async getPendingReturns(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
  ) {
    const params: any[] = [tenantId, academicYearId];
    let schoolLevelFilter = '';
    if (schoolLevelId) {
      params.push(schoolLevelId);
      schoolLevelFilter = ` AND tma."schoolLevelId" = $${params.length}`;
    }

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         tma.*,
         pm."name" AS "materialName",
         pm."code" AS "materialCode",
         pm."category" AS "materialCategory",
         s."name" AS "subjectName",
         sl."name" AS "schoolLevelName",
         sl."code" AS "schoolLevelCode",
         c."name" AS "className",
         t."firstName" AS "teacherFirstName",
         t."lastName" AS "teacherLastName",
         t."matricule" AS "teacherMatricule"
       FROM "teacher_material_assignments" tma
       LEFT JOIN "pedagogical_materials" pm ON pm."id" = tma."materialId"
       LEFT JOIN "subjects" s ON s."id" = pm."subjectId"
       LEFT JOIN "school_levels" sl ON sl."id" = tma."schoolLevelId"
       LEFT JOIN "classes" c ON c."id" = tma."classId"
       LEFT JOIN "teachers" t ON t."id" = tma."teacherId"
       WHERE tma."tenantId" = $1
         AND tma."academicYearId" = $2
         AND tma."returnStatus" = 'SUBMITTED'
         ${schoolLevelFilter}
       ORDER BY t."lastName" ASC, t."firstName" ASC, pm."category" ASC`,
      ...params,
    );
    return Array.isArray(rows) ? rows : [];
  }

  /// Vue historique : toutes les attributions de l'année (validées ou non).
  ///    Filtrable par teacherId et classId.
  async getHistory(
    tenantId: string,
    academicYearId: string,
    teacherId?: string,
    classId?: string,
  ) {
    const params: any[] = [tenantId, academicYearId];
    let filters = '';
    if (teacherId) {
      params.push(teacherId);
      filters += ` AND tma."teacherId" = $${params.length}`;
    }
    if (classId) {
      params.push(classId);
      filters += ` AND tma."classId" = $${params.length}`;
    }

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT
         tma.*,
         pm."name" AS "materialName",
         pm."code" AS "materialCode",
         pm."category" AS "materialCategory",
         sl."name" AS "schoolLevelName",
         c."name" AS "className",
         t."firstName" AS "teacherFirstName",
         t."lastName" AS "teacherLastName",
         t."matricule" AS "teacherMatricule"
       FROM "teacher_material_assignments" tma
       LEFT JOIN "pedagogical_materials" pm ON pm."id" = tma."materialId"
       LEFT JOIN "school_levels" sl ON sl."id" = tma."schoolLevelId"
       LEFT JOIN "classes" c ON c."id" = tma."classId"
       LEFT JOIN "teachers" t ON t."id" = tma."teacherId"
       WHERE tma."tenantId" = $1
         AND tma."academicYearId" = $2
         ${filters}
       ORDER BY t."lastName" ASC, t."firstName" ASC, pm."category" ASC, pm."name" ASC`,
      ...params,
    );
    return Array.isArray(rows) ? rows : [];
  }

  /// La direction valide une soumission de retour.
  async validateReturn(
    tenantId: string,
    assignmentId: string,
    validatedBy: string,
    lostQuantity: number,
    lostNotes?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "returnStatus", "quantity", "returnQuantity"
       FROM "teacher_material_assignments"
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Attribution non trouvée');
    }
    if (existing[0].returnStatus !== 'SUBMITTED') {
      throw new BadRequestException(
        `Impossible de valider : statut actuel = ${existing[0].returnStatus}`,
      );
    }

    const effectiveLostQty = lostQuantity
      ?? (existing[0].quantity - (existing[0].returnQuantity ?? 0));

    await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET "returnStatus" = 'VALIDATED',
           "returnValidatedAt" = NOW(),
           "returnValidatedBy" = $3,
           "lostQuantity" = $4,
           "lostNotes" = COALESCE($5, "lostNotes"),
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId, validatedBy, effectiveLostQty, lostNotes,
    );

    return { success: true, lostQuantity: effectiveLostQty };
  }

  /// La direction refuse une soumission de retour (avec motif).
  async rejectReturn(
    tenantId: string,
    assignmentId: string,
    validatedBy: string,
    rejectionReason: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "returnStatus" FROM "teacher_material_assignments"
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Attribution non trouvée');
    }
    if (existing[0].returnStatus !== 'SUBMITTED') {
      throw new BadRequestException(
        `Impossible de refuser : statut actuel = ${existing[0].returnStatus}`,
      );
    }

    // Re-pass to PENDING so teacher can amend and resubmit
    await this.prisma.$executeRawUnsafe(
      `UPDATE "teacher_material_assignments"
       SET "returnStatus" = 'PENDING',
           "returnRejectionReason" = $3,
           "returnValidatedBy" = $4,
           "returnValidatedAt" = NOW(),
           "returnSignatureUrl" = NULL,
           "returnSentAt" = NULL,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      assignmentId, tenantId, rejectionReason, validatedBy,
    );

    return { success: true, reason: rejectionReason };
  }
}
