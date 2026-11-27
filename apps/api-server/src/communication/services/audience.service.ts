/**
 * ============================================================================
 * AUDIENCE SERVICE — Helm Connect « à la WhatsApp / Telegram » (2026-11-27)
 * ============================================================================
 *
 * Retour promoteur : PLUS AUCUNE création automatique de groupes/canaux.
 * Le promoteur (ou son délégué) crée lui-même ses groupes et ses canaux, et
 * choisit QUI y intégrer. Ce service alimente ce choix :
 *
 *   GET  /chat/audiences         → catalogue : classes (+ effectifs parents /
 *                                  enseignants), niveaux, compteurs globaux
 *                                  (tous les parents, tous les enseignants,
 *                                  enseignants par niveau maternel/primaire/
 *                                  secondaire, personnel administratif) ;
 *   POST /chat/audiences/resolve → résout une audience en liste d'userId
 *                                  (aperçu « 142 parents seront ajoutés »).
 *
 * Types d'audience supportés :
 *   CLASS_PARENTS | CLASS_TEACHERS | CLASS_ALL   (classId)
 *   LEVEL_PARENTS                               (levelId)
 *   ALL_PARENTS | ALL_TEACHERS | ALL_STAFF | ADMINISTRATION
 *   TEACHERS_BY_CATEGORY                        (levelCategory)
 *
 * Toutes les requêtes respectent l'isolation stricte par tenant et ne
 * renvoient que des comptes users actifs.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type AudienceType =
  | 'CLASS_PARENTS'
  | 'CLASS_TEACHERS'
  | 'CLASS_ALL'
  | 'LEVEL_PARENTS'
  | 'ALL_PARENTS'
  | 'ALL_TEACHERS'
  | 'TEACHERS_BY_CATEGORY'
  | 'ALL_STAFF'
  | 'ADMINISTRATION';

export interface AudienceSelector {
  type: AudienceType;
  classId?: string;
  levelId?: string;
  levelCategory?: 'MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE';
}

/** Ensembles de rôles (alignés sur l'ancien auto-group.service — éprouvés en prod). */
const TEACHER_ROLES = [
  'ENSEIGNANT', 'TEACHER', 'TEACHER_RESP', 'PROFESSEUR', 'PROF', 'INSTITUTEUR', 'INSTITUTRICE',
];
const ADMINISTRATION_ROLES = [
  'PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'OWNER',
  'SUPER_DIRECTOR', 'DIRECTOR', 'DIRECTEUR', 'DIRECTEUR_GENERAL', 'DIRECTOR_GENERAL',
  'DIRECTEUR_ETABLISSEMENT', 'SCHOOL_DIRECTOR', 'DIRECTEUR_MAT_PRI',
  'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE',
  'DEPUTY_DIRECTOR', 'DIRECTEUR_ADJOINT',
  'ADMIN', 'SCHOOL_ADMIN', 'ADMINISTRATEUR', 'ADMINISTRATION',
  'CENSEUR', 'SURVEILLANT_GENERAL', 'SURVEILLANT', 'SECRETARY_GENERAL', 'SECRETAIRE_GENERAL',
  'COMPTABLE', 'ACCOUNTANT', 'ECONOME', 'CFO',
  'PEDAGOGIC_COORDINATOR', 'DIRECTEUR_PEDAGOGIQUE', 'PEDAGOGIC_DIRECTOR',
];
const PARENT_ROLES = ['PARENT', 'GUARDIAN', 'TUTEUR'];

@Injectable()
export class AudienceService {
  private readonly logger = new Logger(AudienceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  CATALOGUE — GET /chat/audiences
  // ═════════════════════════════════════════════════════════════════

  async listAudiences(tenantId: string) {
    const [classes, levels, allParents, allTeachers, staff, teachersByCategory] = await Promise.all([
      this.listClassesWithCounts(tenantId),
      this.listLevelsWithCounts(tenantId),
      this.countAllParents(tenantId),
      this.countAllTeachers(tenantId),
      this.countStaff(tenantId),
      this.countTeachersByCategory(tenantId),
    ]);

    return {
      classes,
      levels,
      counts: {
        allParents,
        allTeachers,
        staff,
        teachersByCategory,
      },
    };
  }

  /** Classes de l'année active (hors miroirs EN) + effectifs parents / enseignants / élèves. */
  private async listClassesWithCounts(tenantId: string): Promise<any[]> {
    try {
      return await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT c."id",
               c."name",
               sl."name" AS "levelName",
               sl."code"  AS "levelCode",
               CASE
                 WHEN sl."code" ~* 'SEC|SECONDAIRE|COLLEGE|LYCEE' THEN 'SECONDAIRE'
                 WHEN sl."code" ~* 'PRIMAIRE|PRI' THEN 'PRIMAIRE'
                 WHEN sl."code" ~* 'MATERNEL|MAT' THEN 'MATERNELLE'
                 ELSE 'AUTRE'
               END AS "levelCategory",
               (SELECT COUNT(DISTINCT se."studentId")
                  FROM "student_enrollments" se
                 WHERE se."classId" = c."id" AND se."status" = 'ENROLLED') AS "studentCount",
               (SELECT COUNT(DISTINCT g."userId")
                  FROM "student_enrollments" se
                  JOIN "student_guardians" sg ON sg."studentId" = se."studentId"
                  JOIN "guardians" g ON g."id" = sg."guardianId"
                 WHERE se."classId" = c."id" AND se."status" = 'ENROLLED'
                   AND g."userId" IS NOT NULL AND g."tenantId" = $1) AS "parentCount",
               (SELECT COUNT(DISTINCT u."id")
                  FROM "teacher_class_assignments" tca
                  JOIN "teachers" t ON t."id" = tca."teacherId"
                  JOIN "users" u ON LOWER(u."email") = LOWER(t."email")
                 WHERE tca."classId" = c."id" AND tca."tenantId" = $1
                   AND u."tenantId" = $1 AND u."status" = 'active') AS "teacherCount"
          FROM "classes" c
          LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
         WHERE c."tenantId" = $1
           AND (c."language" IS NULL OR c."language" <> 'EN')
         ORDER BY sl."code" ASC NULLS LAST, c."name" ASC
      `, tenantId);
    } catch (e: any) {
      this.logger.warn(`listClassesWithCounts failed: ${e.message}`);
      return [];
    }
  }

  /** Niveaux de l'école + nombre de classes et de parents par niveau. */
  private async listLevelsWithCounts(tenantId: string): Promise<any[]> {
    try {
      return await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT sl."id", sl."name", sl."code",
               CASE
                 WHEN sl."code" ~* 'SEC|SECONDAIRE|COLLEGE|LYCEE' THEN 'SECONDAIRE'
                 WHEN sl."code" ~* 'PRIMAIRE|PRI' THEN 'PRIMAIRE'
                 WHEN sl."code" ~* 'MATERNEL|MAT' THEN 'MATERNELLE'
                 ELSE 'AUTRE'
               END AS "levelCategory",
               (SELECT COUNT(*) FROM "classes" c
                 WHERE c."schoolLevelId" = sl."id" AND c."tenantId" = $1
                   AND (c."language" IS NULL OR c."language" <> 'EN')) AS "classCount",
               (SELECT COUNT(DISTINCT g."userId")
                  FROM "classes" c
                  JOIN "student_enrollments" se ON se."classId" = c."id" AND se."status" = 'ENROLLED'
                  JOIN "student_guardians" sg ON sg."studentId" = se."studentId"
                  JOIN "guardians" g ON g."id" = sg."guardianId"
                 WHERE c."schoolLevelId" = sl."id" AND c."tenantId" = $1
                   AND g."userId" IS NOT NULL AND g."tenantId" = $1) AS "parentCount"
          FROM "school_levels" sl
         WHERE sl."tenantId" = $1
         ORDER BY sl."code" ASC
      `, tenantId);
    } catch (e: any) {
      this.logger.warn(`listLevelsWithCounts failed: ${e.message}`);
      return [];
    }
  }

  private async countAllParents(tenantId: string): Promise<number> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
        SELECT COUNT(DISTINCT u."id") AS count
          FROM "users" u
         WHERE u."tenantId" = $1 AND u."status" = 'active'
           AND (UPPER(u."role") = ANY($2::text[])
                OR EXISTS (SELECT 1 FROM "guardians" g
                            WHERE g."userId" = u.id AND g."tenantId" = $1))
      `, tenantId, PARENT_ROLES.map(r => r.toUpperCase()));
      return Number(rows[0]?.count || 0);
    } catch (e: any) {
      this.logger.warn(`countAllParents failed: ${e.message}`);
      return 0;
    }
  }

  private async countAllTeachers(tenantId: string): Promise<number> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
        SELECT COUNT(*) AS count FROM "users"
         WHERE "tenantId" = $1 AND "status" = 'active'
           AND UPPER("role") = ANY($2::text[])
      `, tenantId, TEACHER_ROLES.map(r => r.toUpperCase()));
      return Number(rows[0]?.count || 0);
    } catch (e: any) {
      this.logger.warn(`countAllTeachers failed: ${e.message}`);
      return 0;
    }
  }

  /** Personnel administratif : UNIQUEMENT le module Personnel (staff ADMIN/ADMINISTRATION). */
  private async countStaff(tenantId: string): Promise<number> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
        SELECT COUNT(*) AS count
          FROM "users" u
         WHERE u."tenantId" = $1 AND u."status" = 'active'
           AND EXISTS (SELECT 1 FROM "staff" s
                        WHERE s."tenantId" = $1
                          AND UPPER(COALESCE(s."roleType", '')) IN ('ADMIN', 'ADMINISTRATION')
                          AND s."email" IS NOT NULL AND u."email" IS NOT NULL
                          AND LOWER(s."email") = LOWER(u."email"))
      `, tenantId);
      return Number(rows[0]?.count || 0);
    } catch (e: any) {
      this.logger.warn(`countStaff failed: ${e.message}`);
      return 0;
    }
  }

  /** Enseignants par catégorie de niveau (affectations réelles aux classes du niveau). */
  private async countTeachersByCategory(tenantId: string): Promise<Record<string, number>> {
    const result: Record<string, number> = { MATERNELLE: 0, PRIMAIRE: 0, SECONDAIRE: 0 };
    for (const category of Object.keys(result)) {
      const ids = await this.getTeacherIdsForLevelCategory(tenantId, category as any);
      result[category] = ids.length;
    }
    return result;
  }

  // ═════════════════════════════════════════════════════════════════
  //  RÉSOLUTION — POST /chat/audiences/resolve
  // ═════════════════════════════════════════════════════════════════

  async resolveAudience(tenantId: string, audience: AudienceSelector): Promise<{ userIds: string[]; label: string }> {
    let userIds: string[] = [];
    let label = '';

    switch (audience.type) {
      case 'CLASS_PARENTS': {
        if (!audience.classId) break;
        userIds = await this.getClassParentIds(tenantId, audience.classId);
        label = 'Parents de la classe';
        break;
      }
      case 'CLASS_TEACHERS': {
        if (!audience.classId) break;
        userIds = await this.getClassTeacherIds(tenantId, audience.classId);
        label = 'Enseignants de la classe';
        break;
      }
      case 'CLASS_ALL': {
        if (!audience.classId) break;
        const [parents, teachers] = await Promise.all([
          this.getClassParentIds(tenantId, audience.classId),
          this.getClassTeacherIds(tenantId, audience.classId),
        ]);
        userIds = Array.from(new Set([...parents, ...teachers]));
        label = 'Parents et enseignants de la classe';
        break;
      }
      case 'LEVEL_PARENTS': {
        if (!audience.levelId) break;
        userIds = await this.getLevelParentIds(tenantId, audience.levelId);
        label = 'Parents du niveau';
        break;
      }
      case 'ALL_PARENTS': {
        userIds = await this.getAllParentIds(tenantId);
        label = 'Tous les parents de l\u2019établissement';
        break;
      }
      case 'ALL_TEACHERS': {
        userIds = await this.getAllTeacherIds(tenantId);
        label = 'Tous les enseignants de l\u2019établissement';
        break;
      }
      case 'TEACHERS_BY_CATEGORY': {
        if (!audience.levelCategory) break;
        userIds = await this.getTeacherIdsForLevelCategory(tenantId, audience.levelCategory);
        const names: Record<string, string> = {
          MATERNELLE: 'Enseignants du niveau maternel',
          PRIMAIRE: 'Enseignants du niveau primaire',
          SECONDAIRE: 'Enseignants du niveau secondaire',
        };
        label = names[audience.levelCategory] || 'Enseignants';
        break;
      }
      case 'ALL_STAFF': {
        userIds = await this.getStaffIds(tenantId);
        label = 'Personnel administratif';
        break;
      }
      case 'ADMINISTRATION': {
        userIds = await this.getAdministrationIds(tenantId);
        label = 'Administration de l\u2019établissement';
        break;
      }
      default:
        break;
    }

    return { userIds, label };
  }

  // ── Résolveurs (SQL éprouvée de l'ancien auto-group.service) ──

  private async getClassParentIds(tenantId: string, classId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT DISTINCT u."id"
          FROM "student_enrollments" se
          JOIN "student_guardians" sg ON sg."studentId" = se."studentId"
          JOIN "guardians" g ON g."id" = sg."guardianId"
          JOIN "users" u ON u."id" = g."userId"
         WHERE se."classId" = $1 AND se."status" = 'ENROLLED'
           AND g."userId" IS NOT NULL
           AND u."tenantId" = $2 AND u."status" = 'active'
      `, classId, tenantId);
      return rows.map(r => r.id);
    } catch (e: any) {
      this.logger.warn(`getClassParentIds failed: ${e.message}`);
      return [];
    }
  }

  private async getClassTeacherIds(tenantId: string, classId: string): Promise<string[]> {
    const emails: string[] = [];
    try {
      const assigned = await this.prisma.$queryRawUnsafe<Array<{ email: string }>>(`
        SELECT DISTINCT t."email"
          FROM "teacher_class_assignments" tca
          JOIN "teachers" t ON t."id" = tca."teacherId"
         WHERE tca."tenantId" = $1 AND tca."classId" = $2 AND t."email" IS NOT NULL
      `, tenantId, classId);
      for (const a of assigned) emails.push(a.email);
    } catch { /* table absente — continuer */ }
    // Professeur principal de la classe (classe physique → classe officielle)
    try {
      const mainTeacher = await this.prisma.$queryRawUnsafe<Array<{ email: string }>>(`
        SELECT t."email"
          FROM "classes" c
          JOIN "pedagogy_academic_classes" pac ON pac."id" = c."officialClassId"
          JOIN "teachers" t ON t."id" = pac."mainTeacherId"
         WHERE c."id" = $1 AND t."email" IS NOT NULL
         LIMIT 1
      `, classId);
      if (mainTeacher.length > 0) emails.push(mainTeacher[0].email);
    } catch { /* pas de classe officielle / prof non désigné */ }
    if (emails.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { email: { in: Array.from(new Set(emails.map(e => e.toLowerCase()))) }, tenantId, status: 'active' },
      select: { id: true },
    });
    return users.map(u => u.id);
  }

  private async getLevelParentIds(tenantId: string, levelId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT DISTINCT u."id"
          FROM "classes" c
          JOIN "student_enrollments" se ON se."classId" = c."id" AND se."status" = 'ENROLLED'
          JOIN "student_guardians" sg ON sg."studentId" = se."studentId"
          JOIN "guardians" g ON g."id" = sg."guardianId"
          JOIN "users" u ON u."id" = g."userId"
         WHERE c."schoolLevelId" = $1 AND c."tenantId" = $2
           AND (c."language" IS NULL OR c."language" <> 'EN')
           AND g."userId" IS NOT NULL
           AND u."tenantId" = $2 AND u."status" = 'active'
      `, levelId, tenantId);
      return rows.map(r => r.id);
    } catch (e: any) {
      this.logger.warn(`getLevelParentIds failed: ${e.message}`);
      return [];
    }
  }

  private async getAllParentIds(tenantId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT DISTINCT u."id" FROM "users" u
         WHERE u."tenantId" = $1 AND u."status" = 'active'
           AND (UPPER(u."role") = ANY($2::text[])
                OR EXISTS (SELECT 1 FROM "guardians" g
                            WHERE g."userId" = u.id AND g."tenantId" = $1))
      `, tenantId, PARENT_ROLES.map(r => r.toUpperCase()));
      return rows.map(r => r.id);
    } catch (e: any) {
      this.logger.warn(`getAllParentIds failed: ${e.message}`);
      return [];
    }
  }

  private async getAllTeacherIds(tenantId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT "id" FROM "users"
         WHERE "tenantId" = $1 AND "status" = 'active'
           AND UPPER("role") = ANY($2::text[])
      `, tenantId, TEACHER_ROLES.map(r => r.toUpperCase()));
      return rows.map(r => r.id);
    } catch (e: any) {
      this.logger.warn(`getAllTeacherIds failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Enseignants affectés à au moins une classe du niveau (maternel /
   * primaire / secondaire) — via teacher_class_assignments + code du niveau.
   */
  private async getTeacherIdsForLevelCategory(
    tenantId: string,
    category: 'MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE',
  ): Promise<string[]> {
    const pattern =
      category === 'SECONDAIRE' ? 'SEC|SECONDAIRE|COLLEGE|LYCEE'
      : category === 'PRIMAIRE' ? 'PRIMAIRE|PRI'
      : 'MATERNEL|MAT';
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT DISTINCT u."id"
          FROM "teacher_class_assignments" tca
          JOIN "teachers" t ON t."id" = tca."teacherId"
          JOIN "users" u ON LOWER(u."email") = LOWER(t."email")
          JOIN "classes" c ON c."id" = tca."classId"
          JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
         WHERE tca."tenantId" = $1
           AND u."tenantId" = $1 AND u."status" = 'active'
           AND (c."language" IS NULL OR c."language" <> 'EN')
           AND sl."code" ~* $2
      `, tenantId, pattern);
      return rows.map(r => r.id);
    } catch (e: any) {
      this.logger.warn(`getTeacherIdsForLevelCategory failed: ${e.message}`);
      return [];
    }
  }

  /** Personnel administratif (module Personnel — staff ADMIN/ADMINISTRATION). */
  private async getStaffIds(tenantId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT u."id"
          FROM "users" u
         WHERE u."tenantId" = $1 AND u."status" = 'active'
           AND EXISTS (SELECT 1 FROM "staff" s
                        WHERE s."tenantId" = $1
                          AND UPPER(COALESCE(s."roleType", '')) IN ('ADMIN', 'ADMINISTRATION')
                          AND s."email" IS NOT NULL AND u."email" IS NOT NULL
                          AND LOWER(s."email") = LOWER(u."email"))
      `, tenantId);
      return rows.map(r => r.id);
    } catch (e: any) {
      this.logger.warn(`getStaffIds failed: ${e.message}`);
      return [];
    }
  }

  /** Direction + administration (rôles). */
  private async getAdministrationIds(tenantId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT "id" FROM "users"
         WHERE "tenantId" = $1 AND "status" = 'active'
           AND UPPER("role") = ANY($2::text[])
      `, tenantId, ADMINISTRATION_ROLES.map(r => r.toUpperCase()));
      return rows.map(r => r.id);
    } catch (e: any) {
      this.logger.warn(`getAdministrationIds failed: ${e.message}`);
      return [];
    }
  }
}
