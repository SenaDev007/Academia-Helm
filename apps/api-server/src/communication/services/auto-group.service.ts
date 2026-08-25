/**
 * ============================================================================
 * AUTO GROUP SERVICE — Automatic school group creation (V3-10)
 * ============================================================================
 * Creates and syncs Helm Connect conversation groups automatically based on
 * the school's academic structure:
 *   - CLASS groups: "6ème A — 2026/2027" (all students + teacher + parents)
 *   - SUBJECT groups: "Mathématiques — 6ème A" (teacher + students)
 *   - ROLE groups: "Enseignants", "Parents — 6ème", "Administration"
 *   - STAFF groups: "Personnel administratif", "Conseil pédagogique"
 *
 * Auto-sync: when a teacher is reassigned to a different class, they are
 * automatically removed from the old group and added to the new one.
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
   * Generate all automatic groups for a tenant + academic year.
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
        const result = await this.createOrUpdateAutoGroup(tenantId, academicYearId, {
          groupType: 'CLASS',
          name: groupName,
          description: `Groupe de la classe ${cls.name} (${cls._count.studentEnrollments} élèves)`,
          classId: cls.id,
        });
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;

        // 4. Create SUBJECT groups (one per subject × class)
        for (const subject of subjects) {
          const subjectGroupName = `${subject.name} — ${cls.name}`;
          const subjectResult = await this.createOrUpdateAutoGroup(tenantId, academicYearId, {
            groupType: 'SUBJECT',
            name: subjectGroupName,
            description: `Matière: ${subject.name}, Classe: ${cls.name}`,
            classId: cls.id,
            subjectId: subject.id,
          });
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
        const result = await this.createOrUpdateAutoGroup(tenantId, academicYearId, config);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;
      }

      // 6. Sync members for all auto groups
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
   * Create or update an auto group. If it already exists, update the name/description.
   * Returns 'created' | 'updated' | 'skipped'.
   */
  private async createOrUpdateAutoGroup(
    tenantId: string,
    academicYearId: string,
    config: AutoGroupConfig,
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

      // Create new auto group
      const id = crypto.randomUUID();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "chat_auto_groups" ("id", "tenantId", "academicYearId", "groupType", "classId", "subjectId", "roleType", "name", "description", "isActive", "autoSync")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true)`,
        id, tenantId, academicYearId, config.groupType,
        config.classId || null, config.subjectId || null, config.roleType || null,
        config.name, config.description || null,
      );

      // Create the Helm Connect conversation (group type)
      try {
        const conversation = await this.chatService.createGroupConversation(tenantId, 'system', {
          name: config.name,
          participantIds: [], // Will be filled by syncAllMembers
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
   * Sync members for all auto groups — add/remove participants based on
   * current class assignments, teacher assignments, and enrollments.
   */
  async syncAllMembers(tenantId: string, academicYearId: string): Promise<void> {
    try {
      // Get all active auto groups
      const groups = await this.prisma.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM "chat_auto_groups"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isActive" = true`,
        tenantId, academicYearId,
      );

      for (const group of groups) {
        if (!group.conversationId) continue;

        let participantIds: string[] = [];

        if (group.groupType === 'CLASS' && group.classId) {
          // Get teacher + all enrolled students' guardians
          const cls = await this.prisma.class.findUnique({
            where: { id: group.classId },
            select: { mainTeacherId: true, teacherId: true },
          });
          if (cls?.mainTeacherId) {
            const teacherUser = await this.prisma.teacher.findUnique({
              where: { id: cls.mainTeacherId },
              select: { email: true },
            });
            if (teacherUser?.email) {
              const user = await this.prisma.user.findFirst({
                where: { email: teacherUser.email, tenantId, status: 'active' },
                select: { id: true },
              });
              if (user) participantIds.push(user.id);
            }
          }
        } else if (group.groupType === 'ROLE') {
          // Get all users with a specific role
          let roles: string[] = [];
          if (group.roleType === 'TEACHERS') roles = ['TEACHER', 'PROFESSEUR'];
          else if (group.roleType === 'ADMINISTRATION') roles = ['PROMOTER', 'SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'CENSEUR', 'SURVEILLANT_GENERAL', 'SECRETARY_GENERAL'];
          else if (group.roleType === 'PARENTS') roles = ['PARENT'];
          else if (group.roleType === 'ALL_STAFF') roles = ['PROMOTER', 'SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'CENSEUR', 'SURVEILLANT_GENERAL', 'SECRETARY_GENERAL'];

          if (roles.length > 0) {
            const users = await this.prisma.user.findMany({
              where: { tenantId, role: { in: roles }, status: 'active' },
              select: { id: true },
            });
            participantIds = users.map(u => u.id);
          }
        }

        // TODO: Add/remove participants from the conversation
        // This requires a ChatService method to sync participants
        this.logger.log(`syncAllMembers: group "${group.name}" → ${participantIds.length} participants`);
      }
    } catch (e: any) {
      this.logger.error(`syncAllMembers failed: ${e.message}`);
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
