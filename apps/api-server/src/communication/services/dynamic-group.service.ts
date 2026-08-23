/**
 * ============================================================================
 * HELM CONNECT V2.2 — Dynamic Groups Service
 * ============================================================================
 *
 * Génère et synchronise automatiquement des conversations Helm Connect pour :
 *   - Classes (ex: "6ème A — 2026/2027" avec élèves, enseignants, parents)
 *   - Niveaux (ex: "Tous les enseignants - Maternelle")
 *   - Matières (ex: "Enseignants de mathématiques")
 *   - Rôles (ex: "Personnel administratif")
 *   - Conseil pédagogique (directeurs + coordinateurs pédagogiques)
 *
 * ⭐ Caractéristique clé : Les membres sont recalculés dynamiquement.
 *    Si un enseignant quitte une classe, il est automatiquement retiré du groupe.
 *
 * ⭐ Implémentation :
 *   - createDynamicGroup() : crée l'enregistrement + la conversation GROUP
 *   - syncDynamicGroup() : recalcule les membres (ajoute/supprime)
 *   - getMembersForSource() : détermine la liste des userIds selon sourceType
 *
 * ⭐ Note: Ne supprime JAMAIS les anciens messages — un utilisateur retiré
 *    ne voit plus les nouveaux messages mais peut consulter l'historique.
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ChatService } from './chat.service';
import { randomUUID } from 'crypto';

export type DynamicGroupSourceType =
  | 'CLASS'
  | 'LEVEL'
  | 'SUBJECT'
  | 'ROLE'
  | 'ALL_TEACHERS'
  | 'ALL_PARENTS'
  | 'ALL_STAFF'
  | 'PEDAGOGIC_COUNCIL';

export interface DynamicGroup {
  id: string;
  tenantId: string;
  conversationId: string;
  sourceType: DynamicGroupSourceType;
  sourceClassId?: string;
  sourceLevel?: string;
  sourceSubjectId?: string;
  sourceRole?: string;
  academicYearId?: string;
  displayName: string;
  description?: string;
  autoSync: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Computed
  memberCount?: number;
}

const PUBLISHER_ROLES = new Set([
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'DIRECTEUR',
  'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE', 'DIRECTEUR_MAT_PRI',
  'SUPER_DIRECTOR', 'DEPUTY_DIRECTOR',
  'SCHOOL_ADMIN', 'ADMIN', 'ADMINISTRATEUR',
  'SUPER_ADMIN', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
  'PROMOTER', 'SCHOOL_OWNER', 'PROMOTEUR',
]);

@Injectable()
export class DynamicGroupService {
  private readonly logger = new Logger(DynamicGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  //  CREATE — Créer un groupe dynamique (admin only)
  // ═════════════════════════════════════════════════════════════════
  async createDynamicGroup(
    tenantId: string,
    creatorId: string,
    data: {
      sourceType: DynamicGroupSourceType;
      sourceClassId?: string;
      sourceLevel?: string;
      sourceSubjectId?: string;
      sourceRole?: string;
      academicYearId?: string;
      displayName?: string;       // if not provided, auto-generated
      description?: string;
    },
  ): Promise<DynamicGroup> {
    // Verify publisher role
    const userRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "role" FROM "users" WHERE id = $1
    `, creatorId);
    const userRole = (userRow[0]?.role || '').toUpperCase();
    if (!PUBLISHER_ROLES.has(userRole)) {
      throw new ForbiddenException(`Role ${userRole} is not allowed to create dynamic groups`);
    }

    if (!data.sourceType) {
      throw new BadRequestException('sourceType is required');
    }
    // Validate source-specific fields
    if (data.sourceType === 'CLASS' && !data.sourceClassId) {
      throw new BadRequestException('sourceClassId is required for sourceType=CLASS');
    }
    if (data.sourceType === 'LEVEL' && !data.sourceLevel) {
      throw new BadRequestException('sourceLevel is required for sourceType=LEVEL');
    }
    if (data.sourceType === 'SUBJECT' && !data.sourceSubjectId) {
      throw new BadRequestException('sourceSubjectId is required for sourceType=SUBJECT');
    }
    if (data.sourceType === 'ROLE' && !data.sourceRole) {
      throw new BadRequestException('sourceRole is required for sourceType=ROLE');
    }

    // Auto-generate display name if not provided
    const displayName = data.displayName || await this.generateDisplayName(tenantId, data);

    // Check for duplicate
    const existing: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id FROM "chat_dynamic_groups"
      WHERE "tenantId" = $1
        AND "sourceType" = $2
        AND COALESCE("sourceClassId", '') = COALESCE($3, '')
        AND COALESCE("sourceLevel", '') = COALESCE($4, '')
        AND COALESCE("sourceSubjectId", '') = COALESCE($5, '')
        AND COALESCE("sourceRole", '') = COALESCE($6, '')
        AND COALESCE("academicYearId", '') = COALESCE($7, '')
    `, tenantId, data.sourceType, data.sourceClassId || '', data.sourceLevel || '',
       data.sourceSubjectId || '', data.sourceRole || '', data.academicYearId || '');
    if (existing.length > 0) {
      throw new BadRequestException('A dynamic group with the same source already exists');
    }

    // Create the conversation GROUP
    const conv = await this.chatService.createGroupConversation(tenantId, creatorId, {
      name: displayName,
      description: data.description || `Groupe automatique — ${data.sourceType}`,
      participantIds: [], // Will be populated by syncDynamicGroup
    });

    // Create the dynamic group record
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_dynamic_groups"
        ("id", "tenantId", "conversationId", "sourceType", "sourceClassId", "sourceLevel",
         "sourceSubjectId", "sourceRole", "academicYearId", "displayName", "description",
         "autoSync", "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         TRUE, NOW(), NOW())
    `, id, tenantId, conv.id, data.sourceType, data.sourceClassId || null, data.sourceLevel || null,
       data.sourceSubjectId || null, data.sourceRole || null, data.academicYearId || null,
       displayName, data.description || null);

    this.logger.log(`⭐ Dynamic group created: id=${id}, type=${data.sourceType}, name="${displayName}"`);

    // Sync members immediately
    await this.syncDynamicGroup(tenantId, id);

    return this.getDynamicGroup(tenantId, id);
  }

  // ═════════════════════════════════════════════════════════════════
  //  READ — Get dynamic group details
  // ═════════════════════════════════════════════════════════════════
  async getDynamicGroup(tenantId: string, groupId: string): Promise<DynamicGroup> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "chat_dynamic_groups"
      WHERE "id" = $1 AND "tenantId" = $2
    `, groupId, tenantId);
    if (rows.length === 0) {
      throw new NotFoundException('Dynamic group not found');
    }
    // Compute member count
    const memberCountRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT count(*)::int AS cnt FROM "chat_participants"
      WHERE "conversationId" = $1 AND "leftAt" IS NULL
    `, rows[0].conversationId);
    return { ...rows[0], memberCount: memberCountRow[0]?.cnt || 0 };
  }

  // ═════════════════════════════════════════════════════════════════
  //  LIST — List all dynamic groups for the tenant
  // ═════════════════════════════════════════════════════════════════
  async listDynamicGroups(
    tenantId: string,
    options: { sourceType?: DynamicGroupSourceType } = {},
  ): Promise<DynamicGroup[]> {
    const targetFilter = options.sourceType ? `AND "sourceType" = $2` : '';
    const params: any[] = options.sourceType ? [tenantId, options.sourceType] : [tenantId];
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "chat_dynamic_groups"
      WHERE "tenantId" = $1 ${targetFilter}
      ORDER BY "sourceType" ASC, "displayName" ASC
    `, ...params);

    // Compute member counts (batch)
    if (rows.length === 0) return [];
    const convIds = rows.map(r => r.conversationId);
    const counts: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "conversationId", count(*)::int AS cnt
      FROM "chat_participants"
      WHERE "conversationId" = ANY($1::text[]) AND "leftAt" IS NULL
      GROUP BY "conversationId"
    `, convIds);
    const countMap = new Map(counts.map(c => [c.conversationId, c.cnt]));

    return rows.map(r => ({ ...r, memberCount: countMap.get(r.conversationId) || 0 }));
  }

  // ═════════════════════════════════════════════════════════════════
  //  SYNC — Recalculate members (add new ones, remove those who left)
  // ═════════════════════════════════════════════════════════════════
  async syncDynamicGroup(tenantId: string, groupId: string): Promise<{
    addedCount: number;
    removedCount: number;
    currentMembers: string[];
  }> {
    const group = await this.getDynamicGroup(tenantId, groupId);

    // Determine the correct set of member userIds
    const targetUserIds = await this.getMembersForSource(tenantId, group);
    const targetSet = new Set(targetUserIds);

    // Fetch current participants
    const current: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "userId" FROM "chat_participants"
      WHERE "conversationId" = $1 AND "leftAt" IS NULL
    `, group.conversationId);
    const currentSet = new Set(current.map(c => c.userId));

    // Add missing members
    let added = 0;
    for (const userId of targetSet) {
      if (!currentSet.has(userId)) {
        try {
          await this.prisma.$executeRawUnsafe(`
            INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role", "joinedAt")
            VALUES ($1, $2, $3, $4, 'MEMBER', NOW())
            ON CONFLICT DO NOTHING
          `, randomUUID(), group.conversationId, userId, tenantId);
          added++;
        } catch (e: any) {
          this.logger.warn(`Failed to add user ${userId} to group ${groupId}: ${e.message}`);
        }
      }
    }

    // Mark removed members as left (don't delete — preserve history)
    let removed = 0;
    for (const userId of currentSet) {
      if (!targetSet.has(userId)) {
        try {
          await this.prisma.$executeRawUnsafe(`
            UPDATE "chat_participants"
            SET "leftAt" = NOW()
            WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
          `, group.conversationId, userId);
          removed++;
        } catch (e: any) {
          this.logger.warn(`Failed to remove user ${userId} from group ${groupId}: ${e.message}`);
        }
      }
    }

    // Update lastSyncAt
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_dynamic_groups"
      SET "lastSyncAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = $1
    `, groupId);

    this.logger.log(`⭐ Synced dynamic group ${groupId}: +${added} added, -${removed} removed, ${targetUserIds.length} total.`);

    return {
      addedCount: added,
      removedCount: removed,
      currentMembers: targetUserIds,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  SYNC ALL — Re-sync all dynamic groups (called periodically by cron)
  // ═════════════════════════════════════════════════════════════════
  async syncAllDynamicGroups(tenantId?: string): Promise<{
    syncedCount: number;
    totalAdded: number;
    totalRemoved: number;
  }> {
    const filter = tenantId ? `WHERE "tenantId" = $1 AND "autoSync" = TRUE` : `WHERE "autoSync" = TRUE`;
    const params: any[] = tenantId ? [tenantId] : [];
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "tenantId" FROM "chat_dynamic_groups" ${filter}
    `, ...params);

    let synced = 0;
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const r of rows) {
      try {
        const result = await this.syncDynamicGroup(r.tenantId, r.id);
        synced++;
        totalAdded += result.addedCount;
        totalRemoved += result.removedCount;
      } catch (e: any) {
        this.logger.error(`Failed to sync dynamic group ${r.id}: ${e.message}`);
      }
    }
    this.logger.log(`⭐ Synced ${synced} dynamic groups (+${totalAdded}, -${totalRemoved}).`);
    return { syncedCount: synced, totalAdded, totalRemoved };
  }

  // ═════════════════════════════════════════════════════════════════
  //  HELPER — Generate display name from source
  // ═════════════════════════════════════════════════════════════════
  private async generateDisplayName(
    tenantId: string,
    data: {
      sourceType: DynamicGroupSourceType;
      sourceClassId?: string;
      sourceLevel?: string;
      sourceSubjectId?: string;
      sourceRole?: string;
      academicYearId?: string;
    },
  ): Promise<string> {
    switch (data.sourceType) {
      case 'CLASS': {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT c.name, ay.code AS "yearCode"
          FROM "academic_classes" c
          LEFT JOIN "academic_years" ay ON ay.id = $2
          WHERE c.id = $1
        `, data.sourceClassId, data.academicYearId || null);
        const className = r[0]?.name || 'Classe';
        const year = r[0]?.yearCode || new Date().getFullYear();
        return `${className} — ${year}`;
      }
      case 'LEVEL':
        return `Tous — Niveau ${data.sourceLevel}`;
      case 'SUBJECT': {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT name FROM "subjects" WHERE id = $1
        `, data.sourceSubjectId);
        const subjectName = r[0]?.name || 'Matière';
        return `Enseignants de ${subjectName}`;
      }
      case 'ROLE':
        return `Personnel — ${data.sourceRole}`;
      case 'ALL_TEACHERS':
        return 'Tous les enseignants';
      case 'ALL_PARENTS':
        return 'Tous les parents';
      case 'ALL_STAFF':
        return 'Tout le personnel';
      case 'PEDAGOGIC_COUNCIL':
        return 'Conseil pédagogique';
      default:
        return `Groupe — ${data.sourceType}`;
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  HELPER — Get all userIds that should be members for a given source
  // ═════════════════════════════════════════════════════════════════
  private async getMembersForSource(
    tenantId: string,
    group: DynamicGroup,
  ): Promise<string[]> {
    const { sourceType, sourceClassId, sourceLevel, sourceSubjectId, sourceRole } = group;

    try {
      if (sourceType === 'ALL_TEACHERS') {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT id FROM "users"
          WHERE "tenantId" = $1
            AND UPPER("role") IN ('ENSEIGNANT','TEACHER','TEACHER_RESP','RESP_SECONDAIRE','RESP_PRIMAIRE','RESP_MATERNELLE','PEDAGOGIC_COORDINATOR','DIRECTEUR_PEDAGOGIQUE')
        `, tenantId);
        return r.map(x => x.id);
      }

      if (sourceType === 'ALL_PARENTS') {
        // All guardians who have a user account
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT g."userId"
          FROM "guardians" g
          WHERE g."tenantId" = $1 AND g."userId" IS NOT NULL
        `, tenantId);
        return r.map(x => x.userId);
      }

      if (sourceType === 'ALL_STAFF') {
        // All non-parent users (teachers, admin, etc.)
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT id FROM "users"
          WHERE "tenantId" = $1
            AND UPPER("role") NOT IN ('PARENT','GUARDIAN','STUDENT','ELEVE')
        `, tenantId);
        return r.map(x => x.id);
      }

      if (sourceType === 'PEDAGOGIC_COUNCIL') {
        // Directors + pedagogic coordinators
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT id FROM "users"
          WHERE "tenantId" = $1
            AND UPPER("role") IN ('DIRECTEUR_GENERAL','DIRECTEUR_ETABLISSEMENT','DIRECTEUR','DIRECTEUR_MATERNELLE','DIRECTEUR_PRIMAIRE','DIRECTEUR_SECONDAIRE','DIRECTEUR_MAT_PRI','PEDAGOGIC_COORDINATOR','DIRECTEUR_PEDAGOGIQUE','SUPER_DIRECTOR','DEPUTY_DIRECTOR','CENSEUR')
        `, tenantId);
        return r.map(x => x.id);
      }

      if (sourceType === 'ROLE' && sourceRole) {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT id FROM "users"
          WHERE "tenantId" = $1 AND UPPER("role") = UPPER($2)
        `, tenantId, sourceRole);
        return r.map(x => x.id);
      }

      if (sourceType === 'LEVEL' && sourceLevel) {
        // All parents who have a student in this level + all teachers of classes in this level
        const parentsR: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT g."userId"
          FROM "students" s
          JOIN "student_guardians" sg ON sg."studentId" = s.id
          JOIN "guardians" g ON g.id = sg."guardianId"
          WHERE s."tenantId" = $1 AND s."schoolLevel" = $2 AND g."userId" IS NOT NULL
        `, tenantId, sourceLevel);
        return parentsR.map(x => x.userId);
      }

      if (sourceType === 'SUBJECT' && sourceSubjectId) {
        // All teachers assigned to this subject
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT t."userId"
          FROM "teacher_class_assignments" tca
          JOIN "teachers" t ON t.id = tca."teacherId"
          JOIN "class_subjects" cs ON cs.id = tca."classSubjectId"
          WHERE cs."subjectId" = $1 AND t."userId" IS NOT NULL
            AND t."tenantId" = $2
        `, sourceSubjectId, tenantId);
        return r.map(x => x.userId);
      }

      if (sourceType === 'CLASS' && sourceClassId) {
        // Teachers assigned + parents of students in class
        const teachersR: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT t."userId"
          FROM "teacher_class_assignments" tca
          JOIN "teachers" t ON t.id = tca."teacherId"
          WHERE tca."classId" = $1 AND t."userId" IS NOT NULL
        `, sourceClassId);
        const parentsR: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT g."userId"
          FROM "students" s
          JOIN "student_guardians" sg ON sg."studentId" = s.id
          JOIN "guardians" g ON g.id = sg."guardianId"
          WHERE s."currentClassId" = $1 AND g."userId" IS NOT NULL
            AND s."tenantId" = $2
        `, sourceClassId, tenantId);
        // Combine and dedupe
        const seen = new Set<string>();
        const all: string[] = [];
        for (const r of [...teachersR, ...parentsR]) {
          if (r.userId && !seen.has(r.userId)) {
            seen.add(r.userId);
            all.push(r.userId);
          }
        }
        return all;
      }
    } catch (e: any) {
      this.logger.error(`Failed to compute members for group ${group.id} (${sourceType}): ${e.message}`);
      return [];
    }

    return [];
  }
}
