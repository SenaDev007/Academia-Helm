/**
 * ============================================================================
 * ACADEMIC AUDIT SERVICE - MODULE 3
 * ============================================================================
 * 
 * Suivi des modifications de notes, déverrouillages et corrections.
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AcademicAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogs(tenantId: string, filters: any) {
    // ⭐ V10b — Isolation des logs d'audit par niveau + piste linguistique.
    //
    // Les logs académiques référencent des verrous de notes (entityType
    // 'GRADE_LOCK', entityId → grade_locks.id). Le verrou porte un classId →
    // on rejoint classes pour filtrer par schoolLevelId + langue.
    // Règle linguistique identique au reste du module :
    //   FR : classes FR marquées + classes SANS marqueur (structure FR historique)
    //   EN : classes EN marquées uniquement
    // Les logs non résolvables vers une classe (futurs types d'entité) restent
    // visibles dans toutes les vues pour ne jamais masquer un événement critique.
    const params: any[] = [tenantId];
    let where = `WHERE aal."tenantId" = $1`;
    if (filters.entityType) {
      params.push(filters.entityType);
      where += ` AND aal."entityType" = $${params.length}`;
    }
    if (filters.academicYearId) {
      params.push(filters.academicYearId);
      where += ` AND aal."academicYearId" = $${params.length}`;
    }
    if (filters.schoolLevelId || filters.language) {
      params.push(filters.schoolLevelId ?? null);
      const levelIdx = params.length;
      params.push(filters.language ? String(filters.language).toUpperCase() : null);
      const langIdx = params.length;
      const lang = filters.language ? String(filters.language).toUpperCase() : null;
      const langSql = lang
        ? lang === 'FR'
          ? `(c."language" = $${langIdx}::text OR atr.code = $${langIdx}::text
             OR (c."language" IS NULL AND atr.code IS NULL))`
          : `(c."language" = $${langIdx}::text OR atr.code = $${langIdx}::text)`
        : `TRUE`;
      where += ` AND (
        c.id IS NULL
        OR (
          ($${levelIdx}::text IS NULL OR c."schoolLevelId" = $${levelIdx}::text)
          AND ${langSql}
        )
      )`;
    }

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT aal.*,
              u."firstName" AS "performedByFirstName",
              u."lastName" AS "performedByLastName",
              c.name AS "className",
              c."schoolLevelId" AS "classSchoolLevelId",
              c."language" AS "classLanguage"
       FROM "academic_audit_logs" aal
       LEFT JOIN "users" u ON u.id = aal."performedById"
       LEFT JOIN "grade_locks" gl ON gl.id = aal."entityId" AND aal."entityType" = 'GRADE_LOCK'
       LEFT JOIN "classes" c ON c.id = gl."classId"
       LEFT JOIN "academic_tracks" atr ON atr.id = c."academicTrackId"
       ${where}
       ORDER BY aal."createdAt" DESC
       LIMIT 100`,
      ...params,
    );

    return (rows as any[]).map((r) => ({
      ...r,
      performedByName: r.performedByFirstName
        ? `${r.performedByFirstName} ${r.performedByLastName}`
        : null,
    }));
  }

  async getCorrectionRequests(tenantId: string) {
    return this.prisma.gradeCorrectionRequest.findMany({
      where: { tenantId },
      include: {
        grade: {
          include: { student: true, evaluation: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async logAction(tenantId: string, data: any) {
    return this.prisma.academicAuditLog.create({
      data: {
        tenantId,
        ...data
      }
    });
  }
}
