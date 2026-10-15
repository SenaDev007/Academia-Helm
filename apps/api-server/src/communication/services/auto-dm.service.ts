/**
 * ============================================================================
 * AUTO DM SERVICE — Création automatique des discussions privées Helm Connect
 * ============================================================================
 *
 * ⭐ V1 (2026-10-15) :
 *
 * Crée automatiquement les DMs (discussions privées DIRECT) entre :
 *   1. Parent ↔ Enseignant de son enfant
 *      Pour chaque élève inscrit (StudentEnrollment), on trouve les
 *      enseignants de sa classe physique (TeacherClassAssignment) et on
 *      crée un DM entre le guardian (parent) du côté User et chaque
 *      enseignant (User).
 *
 *   2. Enseignant ↔ Collègue enseignant
 *      Pour chaque classe physique, on crée des DMs entre tous les
 *      enseignants affectés à cette classe (via TeacherClassAssignment).
 *
 *   3. Promoteur ↔ Tous les utilisateurs actifs du tenant
 *      Pour chaque User avec rôle PROMOTER/SCHOOL_OWNER, on crée des DMs
 *      avec tous les autres users actifs du tenant (administration,
 *      enseignants, secrétaires, etc.). ⚠️ VOLUME — on limite aux
 *      users ayant un compte actif (isActive=true) ET un rôle connu.
 *
 * Idempotent : createOrGetDirectConversation cherche d'abord une conv
 * existante (type=DIRECT, 2 participants) — si trouvée, retourne sans recréer.
 *
 * Invocation : HelmConnectBootstrapService.syncTenant() après
 * AutoChannelByTrackService.syncTrackAutoGroups().
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AutoDmService {
  private readonly logger = new Logger(AutoDmService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  syncAutoDms — point d'entrée principal
  // ═══════════════════════════════════════════════════════════════

  async syncAutoDms(
    tenantId: string,
    academicYearId: string,
  ): Promise<{
    created: number;
    skipped: number;
    total: number;
    parentTeacher: number;
    teacherColleague: number;
    promoterAnyone: number;
  }> {
    this.logger.log(`[syncAutoDms] tenant=${tenantId} year=${academicYearId}`);

    let created = 0;
    let skipped = 0;
    let parentTeacher = 0;
    let teacherColleague = 0;
    let promoterAnyone = 0;

    // 1. DMs Parent ↔ Enseignant
    try {
      const ptResult = await this.syncParentTeacherDms(tenantId, academicYearId);
      parentTeacher = ptResult.created;
      created += ptResult.created;
      skipped += ptResult.skipped;
    } catch (e: any) {
      this.logger.warn(`syncParentTeacherDms échoué: ${e.message}`);
    }

    // 2. DMs Enseignant ↔ Collègue
    try {
      const tcResult = await this.syncTeacherColleagueDms(tenantId, academicYearId);
      teacherColleague = tcResult.created;
      created += tcResult.created;
      skipped += tcResult.skipped;
    } catch (e: any) {
      this.logger.warn(`syncTeacherColleagueDms échoué: ${e.message}`);
    }

    // 3. DMs Promoteur ↔ Tous
    try {
      const prResult = await this.syncPromoterAnyoneDms(tenantId);
      promoterAnyone = prResult.created;
      created += prResult.created;
      skipped += prResult.skipped;
    } catch (e: any) {
      this.logger.warn(`syncPromoterAnyoneDms échoué: ${e.message}`);
    }

    this.logger.log(
      `[syncAutoDms] Terminé: ${created} créés, ${skipped} ignorés — parent↔enseignant=${parentTeacher}, collègues=${teacherColleague}, promoteur=${promoterAnyone}`,
    );

    return {
      created,
      skipped,
      total: created + skipped,
      parentTeacher,
      teacherColleague,
      promoterAnyone,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  1. DMs Parent ↔ Enseignant
  // ═══════════════════════════════════════════════════════════════

  private async syncParentTeacherDms(
    tenantId: string,
    academicYearId: string,
  ): Promise<{ created: number; skipped: number }> {
    // Pour chaque élève inscrit (StudentEnrollment avec classId non NULL),
    // on trouve les enseignants de sa classe (TeacherClassAssignment),
    // puis le guardian du parent (Guardian.userId),
    // et on crée un DM entre guardian.userId et chaque enseignant userId.
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        guardianUserId: string | null;
        teacherUserId: string | null;
      }>
    >(
      `SELECT DISTINCT
         g."userId" AS "guardianUserId",
         tu."id" AS "teacherUserId"
       FROM "student_enrollments" se
       JOIN "students" s ON s."id" = se."studentId"
       JOIN "student_guardians" sg ON sg."studentId" = s."id"
       JOIN "guardians" g ON g."id" = sg."guardianId"
       JOIN "teacher_class_assignments" tca ON tca."classId" = se."classId"
       JOIN "teachers" t ON t."id" = tca."teacherId"
       JOIN "users" tu ON tu."email" = t."email" AND tu."tenantId" = $1
       WHERE se."tenantId" = $1
         AND se."academicYearId" = $2
         AND se."status" IN ('ENROLLED', 'ACTIVE')
         AND se."classId" IS NOT NULL
         AND g."userId" IS NOT NULL
         AND tu."isActive" = true
         AND tca."academicYearId" = $2`,
      tenantId,
      academicYearId,
    );

    let created = 0;
    let skipped = 0;
    const seen = new Set<string>();

    for (const row of rows) {
      if (!row.guardianUserId || !row.teacherUserId) continue;
      // Éviter les doublons (un élève peut avoir plusieurs guardians)
      const key = [row.guardianUserId, row.teacherUserId].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);

      const result = await this.createOrGetDirect(tenantId, row.guardianUserId, row.teacherUserId);
      if (result === 'created') created++;
      else skipped++;
    }

    return { created, skipped };
  }

  // ═══════════════════════════════════════════════════════════════
  //  2. DMs Enseignant ↔ Collègue (même classe)
  // ═══════════════════════════════════════════════════════════════

  private async syncTeacherColleagueDms(
    tenantId: string,
    academicYearId: string,
  ): Promise<{ created: number; skipped: number }> {
    // Pour chaque classe, on récupère la liste des enseignants affectés,
    // puis on crée des DMs entre chaque paire d'enseignants.
    const classTeachers = await this.prisma.$queryRawUnsafe<
      Array<{ classId: string; teacherUserId: string }>
    >(
      `SELECT DISTINCT
         tca."classId",
         tu."id" AS "teacherUserId"
       FROM "teacher_class_assignments" tca
       JOIN "teachers" t ON t."id" = tca."teacherId"
       JOIN "users" tu ON tu."email" = t."email" AND tu."tenantId" = $1
       WHERE tca."academicYearId" = $2
         AND tu."isActive" = true
       ORDER BY tca."classId", tu."id"`,
      tenantId,
      academicYearId,
    );

    // Grouper par classId
    const byClass = new Map<string, string[]>();
    for (const row of classTeachers) {
      if (!byClass.has(row.classId)) byClass.set(row.classId, []);
      byClass.get(row.classId)!.push(row.teacherUserId);
    }

    let created = 0;
    let skipped = 0;
    const seen = new Set<string>();

    for (const [classId, teacherIds] of byClass) {
      if (teacherIds.length < 2) continue; // 1 seul enseignant → pas de collègue
      for (let i = 0; i < teacherIds.length; i++) {
        for (let j = i + 1; j < teacherIds.length; j++) {
          const u1 = teacherIds[i];
          const u2 = teacherIds[j];
          const key = [u1, u2].sort().join('::');
          if (seen.has(key)) continue;
          seen.add(key);

          const result = await this.createOrGetDirect(tenantId, u1, u2);
          if (result === 'created') created++;
          else skipped++;
        }
      }
    }

    return { created, skipped };
  }

  // ═══════════════════════════════════════════════════════════════
  //  3. DMs Promoteur ↔ Tous les users actifs
  // ═══════════════════════════════════════════════════════════════

  private async syncPromoterAnyoneDms(tenantId: string): Promise<{ created: number; skipped: number }> {
    // Récupérer tous les users avec rôle PROMOTER/SCHOOL_OWNER
    const promoters = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT DISTINCT u."id"
       FROM "users" u
       JOIN "user_roles" ur ON ur."userId" = u."id"
       JOIN "roles" r ON r."id" = ur."roleId"
       WHERE u."tenantId" = $1
         AND u."isActive" = true
         AND (r."name" ILIKE '%PROMOTER%' OR r."name" ILIKE '%SCHOOL_OWNER%')`,
      tenantId,
    );

    if (promoters.length === 0) return { created: 0, skipped: 0 };

    // Récupérer tous les autres users actifs du tenant (non promoteurs)
    const others = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT DISTINCT u."id"
       FROM "users" u
       WHERE u."tenantId" = $1
         AND u."isActive" = true
         AND u."id" NOT IN (
           SELECT ur."userId" FROM "user_roles" ur
           JOIN "roles" r ON r."id" = ur."roleId"
           WHERE r."name" ILIKE '%PROMOTER%' OR r."name" ILIKE '%SCHOOL_OWNER%'
         )`,
      tenantId,
    );

    let created = 0;
    let skipped = 0;

    for (const promoter of promoters) {
      for (const other of others) {
        const result = await this.createOrGetDirect(tenantId, promoter.id, other.id);
        if (result === 'created') created++;
        else skipped++;
      }
    }

    return { created, skipped };
  }

  // ═══════════════════════════════════════════════════════════════
  //  createOrGetDirect — création idempotente d'un DM (type DIRECT)
  // ═══════════════════════════════════════════════════════════════

  private async createOrGetDirect(
    tenantId: string,
    userIdA: string,
    userIdB: string,
  ): Promise<'created' | 'exists'> {
    if (userIdA === userIdB) return 'exists';

    // Vérifier si une conv DIRECT existe déjà entre ces 2 users
    const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT c."id"
       FROM "chat_conversations" c
       WHERE c."tenantId" = $1
         AND c."type" = 'DIRECT'
         AND c."id" IN (
           SELECT "conversationId" FROM "chat_participants" WHERE "userId" = $2 AND "leftAt" IS NULL
         )
         AND c."id" IN (
           SELECT "conversationId" FROM "chat_participants" WHERE "userId" = $3 AND "leftAt" IS NULL
         )
       LIMIT 1`,
      tenantId,
      userIdA,
      userIdB,
    );
    if (existing.length > 0) return 'exists';

    // Créer la conversation + les 2 participants
    const convId = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_conversations" ("id", "tenantId", "type", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, 'DIRECT', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      convId,
      tenantId,
    );
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role")
       VALUES ($1, $2, $3, $4, 'MEMBER')
       ON CONFLICT DO NOTHING`,
      randomUUID(),
      convId,
      userIdA,
      tenantId,
    );
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role")
       VALUES ($1, $2, $3, $4, 'ADMIN')
       ON CONFLICT DO NOTHING`,
      randomUUID(),
      convId,
      userIdB,
      tenantId,
    );

    return 'created';
  }
}
