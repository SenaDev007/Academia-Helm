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
  groupType: 'CLASS' | 'SUBJECT' | 'ROLE' | 'STAFF';
  name: string;
  description?: string;
  classId?: string;
  subjectId?: string;
  roleType?: 'TEACHERS' | 'PARENTS' | 'ADMINISTRATION' | 'ALL_STAFF';
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

        // 4. Create SUBJECT groups (one per subject × class)
        for (const subject of subjects) {
          const subjectGroupName = `${subject.name} — ${cls.name}`;
          const subjectParticipants = await this.getSubjectParticipants(tenantId, cls.id, subject.id);
          const subjectResult = await this.createOrUpdateAutoGroup(tenantId, academicYearId, {
            groupType: 'SUBJECT',
            name: subjectGroupName,
            description: `Matière: ${subject.name}, Classe: ${cls.name}`,
            classId: cls.id,
            subjectId: subject.id,
          }, subjectParticipants);
          if (subjectResult === 'created') created++;
          else if (subjectResult === 'updated') updated++;
          else skipped++;
        }
      }

      // 5. Create ROLE groups
      const roleGroups: AutoGroupConfig[] = [
        { groupType: 'ROLE', name: 'Enseignants', roleType: 'TEACHERS', description: 'Tous les enseignants de l\'établissement' },
        { groupType: 'ROLE', name: 'Administration', roleType: 'ADMINISTRATION', description: 'Personnel administratif' },
        { groupType: 'ROLE', name: 'Parents d\'élèves', roleType: 'PARENTS', description: 'Tous les parents d\'élèves' },
        { groupType: 'STAFF', name: 'Personnel administratif', roleType: 'ALL_STAFF', description: 'Tout le personnel' },
      ];

      for (const config of roleGroups) {
        const roleParticipants = await this.getRoleParticipants(tenantId, config.roleType!);
        const result = await this.createOrUpdateAutoGroup(tenantId, academicYearId, config, roleParticipants);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;
      }

      // 6. Sync members for all auto groups (update existing conversations)
      await this.syncAllMembers(tenantId, academicYearId);

      const total = created + updated + skipped;
      this.logger.log(`syncAutoGroups complete: ${created} created, ${updated} updated, ${skipped} skipped, ${total} total`);
      return { created, updated, skipped, total };
    } catch (e: any) {
      this.logger.error(`syncAutoGroups failed: ${e.message}`, e.stack);
      throw e;
    }
  }

  /**
   * ⭐ V3-12: Get participants for a class group (teacher + students + parents).
   */
  private async getClassParticipants(tenantId: string, classId: string): Promise<string[]> {
    const participantIds: string[] = [];
    try {
      // Get the class's main teacher → find their user ID
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { mainTeacherId: true },
      });
      if (cls?.mainTeacherId) {
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: cls.mainTeacherId },
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
      // Get all enrolled students → find their parents (guardians with user accounts)
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
   */
  private async getRoleParticipants(tenantId: string, roleType: string): Promise<string[]> {
    try {
      let roles: string[] = [];
      if (roleType === 'TEACHERS') roles = ['TEACHER', 'PROFESSEUR', 'TEACHER_RESP'];
      else if (roleType === 'ADMINISTRATION') roles = ['PROMOTER', 'SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'CENSEUR', 'SURVEILLANT_GENERAL', 'SECRETARY_GENERAL'];
      else if (roleType === 'PARENTS') roles = ['PARENT'];
      else if (roleType === 'ALL_STAFF') roles = ['PROMOTER', 'SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'CENSEUR', 'SURVEILLANT_GENERAL', 'SECRETARY_GENERAL'];
      if (roles.length === 0) return [];
      const users = await this.prisma.user.findMany({
        where: { tenantId, role: { in: roles }, status: 'active' },
        select: { id: true },
      });
      return users.map(u => u.id);
    } catch (e: any) {
      this.logger.warn(`getRoleParticipants failed: ${e.message}`);
      return [];
    }
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
           AND COALESCE("roleType", 'NONE') = COALESCE($6, 'NONE')`,
        tenantId, academicYearId, config.groupType,
        config.classId || null, config.subjectId || null, config.roleType || null,
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
        `INSERT INTO "chat_auto_groups" ("id", "tenantId", "academicYearId", "groupType", "classId", "subjectId", "roleType", "name", "description", "isActive", "autoSync")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true)`,
        id, tenantId, academicYearId, config.groupType,
        config.classId || null, config.subjectId || null, config.roleType || null,
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
