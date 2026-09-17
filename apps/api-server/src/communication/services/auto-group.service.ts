/**
 * ============================================================================
 * AUTO GROUP SERVICE — Automatic school group creation (V3-12)
 * ============================================================================
 * Creates and syncs Helm Connect conversation groups automatically based on
 * the school's academic structure:
 *   - CLASS groups: "6ème A — 2026/2027" (all students + teacher + parents)
 *   - SUBJECT groups: "Mathématiques — 6ème A" (teacher + students)
 *   - ROLE groups: "Enseignants", "Parents — 6ème", "Administration"
 *   - STAFF groups: "Personnel administratif", "Conseil pédagogique"
 *
 * ⭐ V3-12 FIX: The previous version created conversations with EMPTY
 *   participantIds (which threw BadRequestException), so no conversation was
 *   ever created and no user ever saw the auto-groups in their Helm Connect.
 *   Now we compute participants FIRST, then create the conversation with them.
 *
 * ⭐ V3-12: Role-based filtering — parents can only see groups they're
 *   a participant of (PARENTS groups + CLASS groups for their children).
 *   Teachers can see TEACHERS + ADMINISTRATION + CLASS + SUBJECT groups.
 *   The filtering is handled at the chat.service.ts listConversations() level
 *   (only returns conversations the user is a participant of).
 *
 * Called:
 *   - On academic year rollover (automatically by a cron job)
 *   - Manually by the director (POST /chat/auto-groups/sync)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ChatService } from './chat.service';

export interface AutoGroupConfig {
  groupType: 'CLASS' | 'SUBJECT' | 'ROLE' | 'STAFF' | 'LEVEL' | 'TEACHER_SUBJECT' | 'COUNCIL';
  name: string;
  description?: string;
  classId?: string;
  subjectId?: string;
  levelId?: string;
  roleType?: 'TEACHERS' | 'PARENTS' | 'ADMINISTRATION' | 'ALL_STAFF' | 'PEDAGOGICAL_COUNCIL';
}

@Injectable()
export class AutoGroupService {
  private readonly logger = new Logger(AutoGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Sync auto groups for a tenant + academic year.
   * Called on academic year rollover or manually by the director.
   */
  async syncAutoGroups(tenantId: string, academicYearId: string): Promise<{
    created: number;
    updated: number;
    skipped: number;
    purged: number;
    total: number;
  }> {
    this.logger.log(`syncAutoGroups: tenant=${tenantId}, year=${academicYearId}`);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    try {
      // 1. Get all classes for this tenant + academic year
      const classes = await this.prisma.class.findMany({
        where: { tenantId, academicYearId },
        include: {
          schoolLevel: { select: { name: true } },
          _count: { select: { studentEnrollments: true } },
        },
      });

      // 2. Get all subjects for this tenant
      const subjects = await this.prisma.subject.findMany({
        where: { tenantId, academicYearId },
        select: { id: true, name: true },
      });

      // 3. Create CLASS groups (one per class)
      for (const cls of classes) {
        const groupName = `${cls.name} — ${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
        // ⭐ V3-12: Compute participants BEFORE creating the conversation
        const participantIds = await this.getClassParticipants(tenantId, cls.id);
        const result = await this.createOrUpdateAutoGroup(tenantId, academicYearId, {
          groupType: 'CLASS',
          name: groupName,
          description: `Groupe de la classe ${cls.name} (${cls._count.studentEnrollments} élèves)`,
          classId: cls.id,
        }, participantIds);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;

        // ⭐ TASK 77 — PLUS DE GROUPES « Matière × Classe » AUTO-CRÉÉS.
        //    La spécification §4 (groupes scolaires automatiques) demande :
        //    classes, enseignants par matière, personnel, parents par niveau,
        //    conseil pédagogique. Les conversations pédagogiques liées à une
        //    matière (§8) sont créées PAR L'ENSEIGNANT à la demande — pas en
        //    bloc (l'ancienne génération avait créé ~950 groupes vides
        //    « Vocabulaire systématique — 3ème » etc., jamais utilisés).
        //    Les groupes SUBJECT existants vides sont purgés par
        //    purgeEmptySubjectGroups() ci-dessous.
      }

      // 5. Create ROLE groups
      //    ⭐ (sept. 2026 — retour promoteur « faire la part des choses au
      //    niveau de chaque canal ») — DEUX communautés DISTINCTES :
      //    • « Administration » : direction et cadres administratifs (rôles
      //      users : promoteur, directeurs, censeur, SG…) — instance de
      //      décision de l'établissement (Communautés → Administration,
      //      structure finale de la spéc.) ;
      //    • « Personnel administratif » : personnel administratif INSCRIT
      //      DANS LE MODULE PERSONNEL (staff.roleType ADMIN/ADMINISTRATION,
      //      mappé sur comptes users par email) — les enseignants en sont
      //      EXCLUS (avant : ALL_STAFF mélangeait tout le personnel →
      //      « tu les as tous mélangés dans les différents canaux »).
      const roleGroups: AutoGroupConfig[] = [
        { groupType: 'ROLE', name: 'Enseignants', roleType: 'TEACHERS', description: 'Tous les enseignants de l\'établissement' },
        { groupType: 'ROLE', name: 'Administration', roleType: 'ADMINISTRATION', description: 'Direction et cadres administratifs — instance de décision de l\'établissement' },
        { groupType: 'ROLE', name: 'Parents d\'élèves', roleType: 'PARENTS', description: 'Tous les parents d\'élèves' },
        { groupType: 'STAFF', name: 'Personnel administratif', roleType: 'ALL_STAFF', description: 'Personnel administratif (module Personnel — administration & services, hors enseignants)' },
      ];

      for (const config of roleGroups) {
        const roleParticipants = await this.getRoleParticipants(tenantId, config.roleType!);
        const result = await this.createOrUpdateAutoGroup(tenantId, academicYearId, config, roleParticipants);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;
      }

      // ⭐ V6 (spec §4) — GROUPES PAR NIVEAU : « Parents – 6ème » (parents des
      //    élèves des classes de chaque niveau). Dynamique : si un élève change
      //    de niveau, la sync le retire/ajoute automatiquement.
      const levels = await this.prisma.schoolLevel.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, label: true },
      });
      const classesWithLevel = await this.prisma.class.findMany({
        where: { tenantId, academicYearId },
        select: { id: true, schoolLevelId: true },
      });
      const classesByLevel = new Map<string, string[]>();
      for (const cls of classesWithLevel) {
        if (!cls.schoolLevelId) continue;
        const arr = classesByLevel.get(cls.schoolLevelId) || [];
        arr.push(cls.id);
        classesByLevel.set(cls.schoolLevelId, arr);
      }
      for (const level of levels) {
        const levelClassIds = classesByLevel.get(level.id) || [];
        if (levelClassIds.length === 0) continue; // niveau sans classe cette année
        const levelName = (level.label || level.name || 'Niveau').trim();
        const parentIds = await this.getLevelParentParticipants(levelClassIds);
        if (parentIds.length === 0) continue;
        const result = await this.createOrUpdateAutoGroup(tenantId, academicYearId, {
          groupType: 'LEVEL',
          name: `Parents – ${levelName}`,
          description: `Parents des élèves du niveau ${levelName}`,
          levelId: level.id,
        }, parentIds);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;
      }

      // ⭐ V6 (spec §4) — ENSEIGNANTS PAR MATIÈRE : « Enseignants de
      //    mathématiques » (tous les enseignants assignés à la matière,
      //    toutes classes confondues).
      for (const subject of subjects) {
        const subjectTeacherIds = await this.getSubjectTeacherParticipants(tenantId, subject.id);
        if (subjectTeacherIds.length === 0) continue;
        const result = await this.createOrUpdateAutoGroup(tenantId, academicYearId, {
          groupType: 'TEACHER_SUBJECT',
          name: `Enseignants de ${subject.name}`,
          description: `Tous les enseignants de la matière ${subject.name}`,
          subjectId: subject.id,
        }, subjectTeacherIds);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;
      }

      // ⭐ V6 (spec §4) — CONSEIL PÉDAGOGIQUE : direction + professeurs
      //    principaux de toutes les classes.
      {
        const councilParticipants = await this.getPedagogicalCouncilParticipants(tenantId, academicYearId);
        if (councilParticipants.length > 0) {
          const result = await this.createOrUpdateAutoGroup(tenantId, academicYearId, {
            groupType: 'COUNCIL',
            name: 'Conseil pédagogique',
            description: 'Direction et professeurs principaux — coordination pédagogique',
            roleType: 'PEDAGOGICAL_COUNCIL',
          }, councilParticipants);
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
          else skipped++;
        }
      }

      // 6. Sync members for all auto groups (update existing conversations)
      await this.syncAllMembers(tenantId, academicYearId);

      // ⭐ TASK 77 — purge des groupes SUBJECT auto-créés devenus obsolètes
      //    (génération supprimée ci-dessus) : uniquement les groupes VIDES
      //    (aucun message) — un groupe avec de l'activité est conservé.
      const purged = await this.purgeEmptySubjectGroups(tenantId);

      const total = created + updated + skipped;
      this.logger.log(`syncAutoGroups complete: ${created} created, ${updated} updated, ${skipped} skipped, ${purged} purged, ${total} total`);
      return { created, updated, skipped, purged, total };
    } catch (e: any) {
      this.logger.error(`syncAutoGroups failed: ${e.message}`, e.stack);
      throw e;
    }
  }

  /**
   * ⭐ TASK 77 — Purge des groupes SUBJECT auto-créés (génération supprimée
   * de syncAutoGroups). Supprime UNIQUEMENT les groupes vides : chat_auto_groups
   * + conversation + participants. Idempotent — les groupes purgés ne
   * reviennent plus (plus de génération).
   */
  async purgeEmptySubjectGroups(tenantId: string): Promise<number> {
    // Groupes SUBJECT sans aucun message (conversation miroir vide)
    const emptySubjectGroups: Array<{ id: string; conversationId: string }> =
      await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT g."id", g."conversationId"
         FROM "chat_auto_groups" g
         WHERE g."tenantId" = $1 AND g."groupType" = 'SUBJECT'
           AND (
             g."conversationId" IS NULL
             OR NOT EXISTS (SELECT 1 FROM "chat_messages" m WHERE m."conversationId" = g."conversationId")
           )`,
        tenantId,
      );
    for (const grp of emptySubjectGroups) {
      if (grp.conversationId) {
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "chat_participants" WHERE "conversationId" = $1`, grp.conversationId,
        );
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "chat_messages" WHERE "conversationId" = $1`, grp.conversationId,
        );
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "chat_conversations" WHERE "id" = $1`, grp.conversationId,
        );
      }
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "chat_auto_groups" WHERE "id" = $1`, grp.id,
      );
    }
    if (emptySubjectGroups.length > 0) {
      this.logger.log(`purgeEmptySubjectGroups: ${emptySubjectGroups.length} groupe(s) Matière×Classe vide(s) supprimé(s) (tenant ${tenantId})`);
    }
    return emptySubjectGroups.length;
  }

  /**
   * ⭐ V3-12: Get participants for a class group (teacher + students + parents).
   * ⭐ (sept. 2026 — spéc. §4) : le groupe de classe inclut AUSSI
   *    l'administration (élèves + enseignants + professeur principal +
   *    administration + parents-tuteurs). Avant, les comptes admin
   *    n'étaient pas membres → le promoteur/directeur ne VOYAIT AUCUN
   *    groupe de classe dans Communautés (« on ne voit rien de tout ça »).
   */
  private async getClassParticipants(tenantId: string, classId: string): Promise<string[]> {
    const participantIds: string[] = [];
    try {
      // 0. Administration (spéc. §4) : direction + cadres — membres du
      //    groupe de classe, la communauté de la classe peut joindre
      //    l'administration et inversement.
      const adminIds = await this.getRoleParticipants(tenantId, 'ADMINISTRATION');
      participantIds.push(...adminIds);

      // 1. ENSEIGNANTS DE LA CLASSE (spéc. §4) — via teacher_class_assignments
      //    (les vraies affectations du module Pédagogie/Personnel).
      //    ⭐ BUG LATENT CORRIGÉ (sept. 2026) : l'ancien code lisait
      //    prisma.class.mainTeacherId — ce champ n'existe PAS sur le modèle
      //    Class (il vit sur AcademicClass, module pédagogie) → Prisma
      //    rejetait la requête → le catch avalait → AUCUN enseignant n'a
      //    jamais été membre d'un groupe de classe. On utilise la table
      //    réelle des affectations + le prof principal de la classe
      //    officielle (best-effort, champ mainTeacherId d'AcademicClass)
      //    quand il est désigné.
      const teacherEmails: string[] = [];
      try {
        const assigned: Array<{ email: string }> = await this.prisma.$queryRawUnsafe<Array<{ email: string }>>(
          `SELECT DISTINCT t."email"
           FROM teacher_class_assignments tca
           JOIN teachers t ON t.id = tca."teacherId"
           WHERE tca."tenantId" = $1 AND tca."classId" = $2 AND t."email" IS NOT NULL`,
          tenantId, classId,
        );
        for (const a of assigned) teacherEmails.push(a.email);
      } catch { /* table absente — continuer */ }
      // Professeur principal : classe physique → classe officielle (module
      // pédagogie) → mainTeacherId. Best-effort : souvent non désigné encore.
      try {
        const mainTeacher: Array<{ email: string }> = await this.prisma.$queryRawUnsafe<Array<{ email: string }>>(
          `SELECT t."email"
           FROM classes c
           JOIN pedagogy_academic_classes pac ON pac.id = c."officialClassId"
           JOIN teachers t ON t.id = pac."mainTeacherId"
           WHERE c."id" = $1 AND t."email" IS NOT NULL
           LIMIT 1`,
          classId,
        );
        if (mainTeacher.length > 0) teacherEmails.push(mainTeacher[0].email);
      } catch { /* pas de classe officielle / prof non désigné */ }
      if (teacherEmails.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { email: { in: Array.from(new Set(teacherEmails)) }, tenantId, status: 'active' },
          select: { id: true },
        });
        participantIds.push(...users.map(u => u.id));
      }

      // 2. Parents des élèves inscrits (guardians avec comptes users) —
      //    apparaîtront à l'onboarding des parents.
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: { classId, status: 'ENROLLED' },
        select: { student: { select: { guardianId: true } } },
      });
      for (const enr of enrollments) {
        if (enr.student?.guardianId) {
          const guardian = await this.prisma.guardian.findUnique({
            where: { id: enr.student.guardianId },
            select: { userId: true },
          });
          if (guardian?.userId) participantIds.push(guardian.userId);
        }
      }
    } catch (e: any) {
      this.logger.warn(`getClassParticipants failed: ${e.message}`);
    }
    return Array.from(new Set(participantIds));
  }

  /**
   * ⭐ V3-12: Get participants for a subject group (teacher of the class).
   */
  private async getSubjectParticipants(tenantId: string, classId: string, subjectId: string): Promise<string[]> {
    const participantIds: string[] = [];
    try {
      // Find the teacher assigned to this subject × class
      const assignment = await this.prisma.teacherSubjectAssignment.findFirst({
        where: { classId, subjectId, tenantId },
        select: { teacherId: true },
      }).catch(() => null);
      if (assignment?.teacherId) {
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: assignment.teacherId },
          select: { email: true },
        });
        if (teacher?.email) {
          const user = await this.prisma.user.findFirst({
            where: { email: teacher.email, tenantId, status: 'active' },
            select: { id: true },
          });
          if (user) participantIds.push(user.id);
        }
      }
      // Also add all students of the class (so they can see subject materials)
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: { classId, status: 'ENROLLED' },
        select: { student: { select: { guardianId: true } } },
      });
      for (const enr of enrollments) {
        if (enr.student?.guardianId) {
          const guardian = await this.prisma.guardian.findUnique({
            where: { id: enr.student.guardianId },
            select: { userId: true },
          });
          if (guardian?.userId) participantIds.push(guardian.userId);
        }
      }
    } catch (e: any) {
      this.logger.warn(`getSubjectParticipants failed: ${e.message}`);
    }
    return Array.from(new Set(participantIds));
  }

  /**
   * ⭐ V3-12: Get participants for a role-based group.
   *
   * ⭐ V6.1 FIX (groupes ROLE/STAFF vides) : la production utilise des rôles
   *    FRANÇAIS (ENSEIGNANT, DIRECTEUR, DIRECTEUR_MAT_PRI, COMPTABLE…)
   *    alors que les listes précédentes ne contenaient que les libellés
   *    anglais (TEACHER, DIRECTOR…) avec un match Prisma `in` SENSIBLE À LA
   *    CASSE → aucun utilisateur n'était jamais trouvé → groupes vides.
   *    On passe en SQL brut avec UPPER("role") IN (...) — insensible à la
   *    casse et couverture complète FR/EN (alignée sur announcement.service
   *    et dynamic-group.service).
   */
  private async getRoleParticipants(tenantId: string, roleType: string): Promise<string[]> {
    try {
      // ⭐ (sept. 2026 — retour promoteur) : « Personnel administratif »
      //    (roleType ALL_STAFF) = UNIQUEMENT le personnel administratif du
      //    MODULE PERSONNEL (staff.roleType ADMIN/ADMINISTRATION), mappé sur
      //    les comptes users actifs par email. AVANT : l'ensemble
      //    « rôles admin + rôles enseignants » y était mélangé — le groupe
      //    « Personnel administratif » affichait aussi l'équipe pédagogique
      //    (« tu as mis tout le personnel administratif comme équipe
      //    pédagogique, tu les as tous mélangés »). Le module Personnel
      //    (RH) fait référence : tout y est correctement paramétré.
      if (roleType === 'ALL_STAFF') {
        const rows: Array<{ id: string }> = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT u.id
           FROM "users" u
           JOIN LATERAL (
             SELECT 1 FROM "staff" s
             WHERE s."tenantId" = $1
               AND UPPER(COALESCE(s."roleType", '')) IN ('ADMIN', 'ADMINISTRATION')
               AND s."email" IS NOT NULL AND u."email" IS NOT NULL
               AND LOWER(s."email") = LOWER(u."email")
             LIMIT 1
           ) staff_match ON true
           WHERE u."tenantId" = $1 AND u."status" = 'active'`,
          tenantId,
        );
        return rows.map(r => r.id);
      }

      const ROLE_SETS: Record<string, string[]> = {
        TEACHERS: [
          'ENSEIGNANT', 'TEACHER', 'TEACHER_RESP', 'PROFESSEUR', 'PROF', 'INSTITUTEUR', 'INSTITUTRICE',
        ],
        ADMINISTRATION: [
          'PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'OWNER',
          'SUPER_DIRECTOR', 'DIRECTOR', 'DIRECTEUR', 'DIRECTEUR_GENERAL', 'DIRECTOR_GENERAL',
          'DIRECTEUR_ETABLISSEMENT', 'SCHOOL_DIRECTOR', 'DIRECTEUR', 'DIRECTEUR_MAT_PRI',
          'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE',
          'DEPUTY_DIRECTOR', 'DIRECTEUR_ADJOINT',
          'ADMIN', 'SCHOOL_ADMIN', 'ADMINISTRATEUR', 'ADMINISTRATION',
          'CENSEUR', 'SURVEILLANT_GENERAL', 'SURVEILLANT', 'SECRETARY_GENERAL', 'SECRETAIRE_GENERAL',
          'COMPTABLE', 'ACCOUNTANT', 'ECONOME', 'CFO',
          'PEDAGOGIC_COORDINATOR', 'DIRECTEUR_PEDAGOGIQUE', 'PEDAGOGIC_DIRECTOR',
        ],
        PARENTS: ['PARENT', 'GUARDIAN', 'TUTEUR'],
        ALL_STAFF: [
          'PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'OWNER',
          'SUPER_DIRECTOR', 'DIRECTOR', 'DIRECTEUR', 'DIRECTEUR_GENERAL', 'DIRECTOR_GENERAL',
          'DIRECTEUR_ETABLISSEMENT', 'SCHOOL_DIRECTOR', 'DIRECTEUR_MAT_PRI',
          'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE',
          'DEPUTY_DIRECTOR', 'ADMIN', 'SCHOOL_ADMIN', 'ADMINISTRATEUR',
          'CENSEUR', 'SURVEILLANT_GENERAL', 'SURVEILLANT', 'SECRETARY_GENERAL', 'SECRETAIRE_GENERAL',
          'ENSEIGNANT', 'TEACHER', 'TEACHER_RESP', 'PROFESSEUR', 'PROF',
          'COMPTABLE', 'ACCOUNTANT', 'ECONOME', 'CFO',
          'PEDAGOGIC_COORDINATOR', 'DIRECTEUR_PEDAGOGIQUE', 'PEDAGOGIC_DIRECTOR',
        ],
      };
      const roles = ROLE_SETS[roleType] || [];
      if (roles.length === 0) return [];
      // ⭐ PARENTS : inclure AUSSI les guardians liés à un compte user
      //    (certains comptes parents n'ont pas le rôle PARENT sur users).
      if (roleType === 'PARENTS') {
        const rows: Array<{ id: string }> = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT u.id FROM "users" u
           WHERE u."tenantId" = $1 AND u."status" = 'active'
             AND (UPPER(u."role") = ANY($2::text[])
                  OR EXISTS (SELECT 1 FROM "guardians" g WHERE g."userId" = u.id AND g."tenantId" = $1))`,
          tenantId, roles.map(r => r.toUpperCase()),
        );
        return rows.map(r => r.id);
      }
      const rows: Array<{ id: string }> = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "users"
         WHERE "tenantId" = $1 AND "status" = 'active'
           AND UPPER("role") = ANY($2::text[])`,
        tenantId, roles.map(r => r.toUpperCase()),
      );
      return rows.map(r => r.id);
    } catch (e: any) {
      this.logger.warn(`getRoleParticipants failed: ${e.message}`);
      return [];
    }
  }

  /**
   * ⭐ V6 (spec §4) — Participants des groupes par niveau : parents des
   *    élèves inscrits dans les classes du niveau (via guardian → user).
   */
  private async getLevelParentParticipants(classIds: string[]): Promise<string[]> {
    const participantIds: string[] = [];
    try {
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: { classId: { in: classIds }, status: 'ENROLLED' },
        select: { student: { select: { guardianId: true } } },
      });
      const guardianIds = Array.from(new Set(
        enrollments.map(e => e.student?.guardianId).filter((g): g is string => !!g),
      ));
      if (guardianIds.length > 0) {
        const guardians = await this.prisma.guardian.findMany({
          where: { id: { in: guardianIds }, userId: { not: null } },
          select: { userId: true },
        });
        for (const g of guardians) {
          if (g.userId) participantIds.push(g.userId);
        }
      }
    } catch (e: any) {
      this.logger.warn(`getLevelParentParticipants failed: ${e.message}`);
    }
    return Array.from(new Set(participantIds));
  }

  /**
   * ⭐ V6 (spec §4) — Participants « Enseignants de {matière} » : tous les
   *    enseignants assignés à la matière (toutes classes confondues).
   */
  private async getSubjectTeacherParticipants(tenantId: string, subjectId: string): Promise<string[]> {
    const participantIds: string[] = [];
    try {
      const assignments = await this.prisma.teacherSubjectAssignment.findMany({
        where: { subjectId, tenantId },
        select: { teacherId: true, teacher: { select: { email: true } } },
      }).catch(() => [] as any[]);
      const teacherEmails = Array.from(new Set(
        assignments.map(a => a.teacher?.email).filter((e): e is string => !!e),
      ));
      if (teacherEmails.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { email: { in: teacherEmails }, tenantId, status: 'active' },
          select: { id: true },
        });
        for (const u of users) participantIds.push(u.id);
      }
    } catch (e: any) {
      this.logger.warn(`getSubjectTeacherParticipants failed: ${e.message}`);
    }
    return Array.from(new Set(participantIds));
  }

  /**
   * ⭐ V6 (spec §4) — Participants du Conseil pédagogique : direction
   *    (rôles administratifs) + professeurs principaux de toutes les classes.
   */
  private async getPedagogicalCouncilParticipants(tenantId: string, academicYearId: string): Promise<string[]> {
    const participantIds: string[] = [];
    try {
      // 1. Direction / administration
      const adminIds = await this.getRoleParticipants(tenantId, 'ADMINISTRATION');
      participantIds.push(...adminIds);
      // 2. Professeurs principaux de toutes les classes : classe physique →
      //    classe officielle (module pédagogie) → mainTeacherId.
      //    ⭐ BUG LATENT CORRIGÉ (sept. 2026) : l'ancien code faisait
      //    prisma.class.findMany({ mainTeacherId: { not: null } }) — champ
      //    inexistant sur le modèle Class (il vit sur AcademicClass) → Prisma
      //    rejetait → le conseil n'a jamais contenu de profs principaux.
      //    Best-effort : le conseil s'enrichit dès que l'école désigne des
      //    profs principaux dans le module Pédagogie.
      const mainTeacherEmails: string[] = [];
      try {
        const rows: Array<{ email: string }> = await this.prisma.$queryRawUnsafe<Array<{ email: string }>>(
          `SELECT DISTINCT t."email"
           FROM classes c
           JOIN pedagogy_academic_classes pac ON pac.id = c."officialClassId"
           JOIN teachers t ON t.id = pac."mainTeacherId"
           WHERE c."tenantId" = $1 AND c."academicYearId" = $2 AND t."email" IS NOT NULL`,
          tenantId, academicYearId,
        );
        for (const r of rows) mainTeacherEmails.push(r.email);
      } catch { /* pas de classes officielles / profs non désignés */ }
      if (mainTeacherEmails.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { email: { in: Array.from(new Set(mainTeacherEmails)) }, tenantId, status: 'active' },
          select: { id: true },
        });
        participantIds.push(...users.map(u => u.id));
      }
    } catch (e: any) {
      this.logger.warn(`getPedagogicalCouncilParticipants failed: ${e.message}`);
    }
    return Array.from(new Set(participantIds));
  }

  /**
   * Create or update an auto group. If it already exists, update the name/description.
   * Returns 'created' | 'updated' | 'skipped'.
   * ⭐ V3-12: Now accepts precomputed participantIds and uses them to create
   *   the conversation (fixes the empty-participants bug).
   */
  private async createOrUpdateAutoGroup(
    tenantId: string,
    academicYearId: string,
    config: AutoGroupConfig,
    participantIds: string[] = [],
  ): Promise<'created' | 'updated' | 'skipped'> {
    try {
      // Check if it already exists
      const existing = await this.prisma.$queryRawUnsafe<Array<any>>(
        `SELECT id, "conversationId" FROM "chat_auto_groups"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "groupType" = $3
           AND COALESCE("classId", '00000000-0000-0000-0000-000000000000') = COALESCE($4, '00000000-0000-0000-0000-000000000000')
           AND COALESCE("subjectId", '00000000-0000-0000-0000-000000000000') = COALESCE($5, '00000000-0000-0000-0000-000000000000')
           AND COALESCE("roleType", 'NONE') = COALESCE($6, 'NONE')
           AND COALESCE("levelId", '00000000-0000-0000-0000-000000000000') = COALESCE($7, '00000000-0000-0000-0000-000000000000')`,
        tenantId, academicYearId, config.groupType,
        config.classId || null, config.subjectId || null, config.roleType || null, config.levelId || null,
      );

      if (existing.length > 0) {
        // Update name + description
        await this.prisma.$executeRawUnsafe(
          `UPDATE "chat_auto_groups" SET "name" = $2, "description" = $3, "updatedAt" = NOW()
           WHERE "id" = $1`,
          existing[0].id, config.name, config.description || null,
        );
        return 'updated';
      }

      // Create new auto group record
      const id = crypto.randomUUID();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "chat_auto_groups" ("id", "tenantId", "academicYearId", "groupType", "classId", "subjectId", "levelId", "roleType", "name", "description", "isActive", "autoSync")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true)`,
        id, tenantId, academicYearId, config.groupType,
        config.classId || null, config.subjectId || null, config.levelId || null, config.roleType || null,
        config.name, config.description || null,
      );

      // ⭐ V3-12: Create the Helm Connect conversation WITH the precomputed
      //   participants. If participantIds is empty, we still create the group
      //   with a placeholder 'system' participant so createGroupConversation
      //   doesn't throw (it requires ≥1 participant).
      try {
        const effectiveParticipants = participantIds.length > 0
          ? participantIds
          : ['system']; // placeholder — syncAllMembers will replace it
        const conversation = await this.chatService.createGroupConversation(tenantId, 'system', {
          name: config.name,
          participantIds: effectiveParticipants,
          description: config.description,
        });

        // Link the conversation to the auto group
        await this.prisma.$executeRawUnsafe(
          `UPDATE "chat_auto_groups" SET "conversationId" = $2 WHERE "id" = $1`,
          id, conversation.id,
        );
      } catch (convErr: any) {
        this.logger.warn(`createOrUpdateAutoGroup: conversation creation failed for "${config.name}": ${convErr.message}`);
      }

      return 'created';
    } catch (e: any) {
      this.logger.error(`createOrUpdateAutoGroup failed: ${e.message}`);
      return 'skipped';
    }
  }

  /**
   * Sync all members for all auto groups of a tenant + academic year.
   * ⭐ V3-12: Now actually adds/removes participants from the conversation
   *   (previously was a TODO — participants were computed but never applied).
   */
  async syncAllMembers(tenantId: string, academicYearId: string): Promise<void> {
    this.logger.log(`syncAllMembers: tenant=${tenantId}, year=${academicYearId}`);
    try {
      const groups = await this.prisma.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM "chat_auto_groups"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isActive" = true AND "conversationId" IS NOT NULL
         ORDER BY "groupType", "name"`,
        tenantId, academicYearId,
      );

      for (const group of groups) {
        let participantIds: string[] = [];

        if (group.groupType === 'CLASS' && group.classId) {
          participantIds = await this.getClassParticipants(tenantId, group.classId);
        } else if (group.groupType === 'SUBJECT' && group.classId && group.subjectId) {
          participantIds = await this.getSubjectParticipants(tenantId, group.classId, group.subjectId);
        } else if (group.groupType === 'LEVEL' && group.levelId) {
          // ⭐ V6 — Parents du niveau : recalcul via les classes du niveau
          const levelClasses = await this.prisma.class.findMany({
            where: { tenantId, academicYearId, schoolLevelId: group.levelId },
            select: { id: true },
          });
          participantIds = await this.getLevelParentParticipants(levelClasses.map(c => c.id));
        } else if (group.groupType === 'TEACHER_SUBJECT' && group.subjectId) {
          // ⭐ V6 — Enseignants de la matière
          participantIds = await this.getSubjectTeacherParticipants(tenantId, group.subjectId);
        } else if (group.groupType === 'COUNCIL') {
          // ⭐ V6 — Conseil pédagogique
          participantIds = await this.getPedagogicalCouncilParticipants(tenantId, academicYearId);
        } else if (group.groupType === 'ROLE' || group.groupType === 'STAFF') {
          participantIds = await this.getRoleParticipants(tenantId, group.roleType);
        }

        // ⭐ V3-12: Actually sync participants to the conversation
        if (group.conversationId && participantIds.length > 0) {
          await this.syncConversationParticipants(tenantId, group.conversationId, participantIds);
        }
        this.logger.log(`syncAllMembers: group "${group.name}" → ${participantIds.length} participants synced`);
      }
    } catch (e: any) {
      this.logger.error(`syncAllMembers failed: ${e.message}`);
    }
  }

  /**
   * ⭐ V3-12: Sync participants for a conversation — adds new participants
   *   and removes old ones. This is the method that was previously a TODO.
   */
  private async syncConversationParticipants(
    tenantId: string,
    conversationId: string,
    newParticipantIds: string[],
  ): Promise<void> {
    try {
      // Get current participants
      const current = await this.prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "userId" FROM "chat_participants" WHERE "conversationId" = $1 AND "tenantId" = $2`,
        conversationId, tenantId,
      );
      const currentIds = new Set(current.map((c: any) => c.userId));
      const newIds = new Set(newParticipantIds);

      // Add new participants that aren't in the conversation yet
      const toAdd = newParticipantIds.filter(id => !currentIds.has(id));
      for (const userId of toAdd) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role", "joinedAt")
           VALUES ($1, $2, $3, $4, 'MEMBER', NOW())
           ON CONFLICT DO NOTHING`,
          crypto.randomUUID(), conversationId, userId, tenantId,
        );
      }

      // Remove old participants that are no longer in the auto-group
      const toRemove = Array.from(currentIds).filter(id => !newIds.has(id) && id !== 'system');
      for (const userId of toRemove) {
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "chat_participants" WHERE "conversationId" = $1 AND "userId" = $2`,
          conversationId, userId,
        );
      }

      if (toAdd.length > 0 || toRemove.length > 0) {
        this.logger.log(`syncConversationParticipants: ${conversationId} → +${toAdd.length} added, -${toRemove.length} removed`);
      }
    } catch (e: any) {
      this.logger.warn(`syncConversationParticipants failed: ${e.message}`);
    }
  }

  /**
   * List all auto groups for a tenant + academic year.
   */
  async listAutoGroups(tenantId: string, academicYearId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT * FROM "chat_auto_groups"
       WHERE "tenantId" = $1 AND "academicYearId" = $2
       ORDER BY "groupType", "name"`,
      tenantId, academicYearId,
    );
  }
}
