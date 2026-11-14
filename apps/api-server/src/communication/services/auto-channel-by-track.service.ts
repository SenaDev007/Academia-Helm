/**
 * ============================================================================
 * AUTO CHANNEL BY TRACK SERVICE — Canaux Helm Connect par piste FR/EN
 * ============================================================================
 *
 * ⭐ V1 (2026-10-15) — Extension du système d'auto-groups pour supporter :
 *
 *   1. Canal administration FR  — membres administration piste francophone
 *   2. Canal administration EN  — membres administration piste anglophone (si bilingue)
 *   3. Canal pédagogique FR     — enseignants francophones
 *   4. Canal pédagogique EN     — enseignants anglophones (si bilingue)
 *   5. Canal général            — tous enseignants FR+EN + administration (conseil des classes)
 *   6. Canaux conseil par piste × niveau :
 *      - Conseil des classes – Maternelle (FR)
 *      - Conseil des classes – Primaire (FR)
 *      - Conseil des classes – Secondaire (FR)
 *      - Conseil des classes – Maternelle (EN) — si bilingue
 *      - Conseil des classes – Primaire (EN)   — si bilingue
 *      - Conseil des classes – Secondaire (EN) — si bilingue
 *
 * Logique de piste :
 *   - SettingsBilingual.isEnabled === true  → créer FR + EN
 *   - SettingsBilingual.isEnabled === false → créer FR uniquement
 *
 * Sources de participants :
 *   - Administration : StaffAdminAssignment.academicTrackId + Staff.assignedLanguages
 *   - Enseignants    : Teacher.assignedLanguages (JSON : ["FR"], ["EN"], ["FR","EN"], null)
 *   - Niveau         : SchoolLevel.code (MAT, PRI, SEC) + Class.schoolLevelId
 *
 * Invocation : HelmConnectBootstrapService.syncTenant() après AutoGroupService.syncAutoGroups()
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

// ─── Types étendus pour les auto-groups par piste ───────────────────────

export type TrackGroupType =
  | 'ADMIN_TRACK'           // Administration par piste (FR/EN)
  | 'PEDAGOGIC_TRACK'       // Pédagogique par piste (FR/EN)
  | 'GENERAL_COUNCIL'       // Canal général (tous + admin)
  | 'COUNCIL_BY_TRACK_LEVEL'; // Conseil par piste × niveau

export interface TrackAutoGroupConfig {
  groupType: TrackGroupType;
  name: string;
  description?: string;
  academicTrackId?: string | null;  // null = les deux pistes (pour GENERAL_COUNCIL)
  trackCode?: 'FR' | 'EN' | null;   // pour le nommage
  levelId?: string | null;          // pour COUNCIL_BY_TRACK_LEVEL
  levelCode?: string | null;         // MAT, PRI, SEC
  levelName?: string | null;         // pour le nommage
  metadata?: Record<string, any>;   // JSONB stocké sur chat_auto_groups + chat_conversations
}

@Injectable()
export class AutoChannelByTrackService {
  private readonly logger = new Logger(AutoChannelByTrackService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  syncTrackAutoGroups — point d'entrée principal
  // ═══════════════════════════════════════════════════════════════

  async syncTrackAutoGroups(
    tenantId: string,
    academicYearId: string,
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    total: number;
    channels: Array<{ id: string; name: string; groupType: string; track: string | null; level: string | null; participants: number }>;
  }> {
    this.logger.log(`[syncTrackAutoGroups] tenant=${tenantId} year=${academicYearId}`);

    // 1. Vérifier le mode bilingue
    const bilingualSettings = await this.getBilingualSettings(tenantId);
    const isBilingual = bilingualSettings?.isEnabled ?? false;
    this.logger.log(`  Mode bilingue: ${isBilingual ? 'ACTIVÉ' : 'désactivé'}`);

    // 2. Récupérer les pistes (FR toujours, EN si bilingue)
    const tracks = await this.getTracks(tenantId, isBilingual);
    this.logger.log(`  Pistes: ${tracks.map(t => t.code).join(', ')}`);

    // 3. Récupérer les niveaux actifs
    const levels = await this.getActiveLevels(tenantId);
    this.logger.log(`  Niveaux actifs: ${levels.map(l => `${l.code}(${l.name})`).join(', ')}`);

    const channels: Array<{ id: string; name: string; groupType: string; track: string | null; level: string | null; participants: number }> = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // 4. Canaux administration par piste
    for (const track of tracks) {
      const adminParticipants = await this.getAdminParticipantsByTrack(tenantId, academicYearId, track.id, track.code);
      if (adminParticipants.length === 0) {
        this.logger.log(`  Skip ADMIN_TRACK ${track.code}: aucun participant`);
        skipped++;
        continue;
      }
      const config: TrackAutoGroupConfig = {
        groupType: 'ADMIN_TRACK',
        name: `Administration (${track.code})`,
        description: `Membres de l'administration — piste ${track.code}`,
        academicTrackId: track.id,
        trackCode: track.code,
        metadata: { category: 'administration', trackCode: track.code, autoGenerated: true },
      };
      const result = await this.createOrUpdateTrackGroup(tenantId, academicYearId, config, adminParticipants, false);
      if (result.action === 'created') created++;
      else if (result.action === 'updated') updated++;
      else skipped++;
      channels.push({ id: result.conversationId, name: config.name, groupType: config.groupType, track: track.code, level: null, participants: adminParticipants.length });
    }

    // 5. Canaux pédagogiques par piste
    for (const track of tracks) {
      const pedagogicParticipants = await this.getPedagogicParticipantsByTrack(tenantId, academicYearId, track.id, track.code);
      if (pedagogicParticipants.length === 0) {
        this.logger.log(`  Skip PEDAGOGIC_TRACK ${track.code}: aucun participant`);
        skipped++;
        continue;
      }
      const config: TrackAutoGroupConfig = {
        groupType: 'PEDAGOGIC_TRACK',
        name: `Conseil pédagogique (${track.code})`,
        description: `Enseignants et direction — piste ${track.code}`,
        academicTrackId: track.id,
        trackCode: track.code,
        metadata: { category: 'pedagogique', trackCode: track.code, autoGenerated: true },
      };
      const result = await this.createOrUpdateTrackGroup(tenantId, academicYearId, config, pedagogicParticipants, false);
      if (result.action === 'created') created++;
      else if (result.action === 'updated') updated++;
      else skipped++;
      channels.push({ id: result.conversationId, name: config.name, groupType: config.groupType, track: track.code, level: null, participants: pedagogicParticipants.length });
    }

    // 6. Canal général (tous enseignants FR+EN + administration)
    {
      const allParticipants = await this.getGeneralCouncilParticipants(tenantId, academicYearId);
      if (allParticipants.length === 0) {
        this.logger.log(`  Skip GENERAL_COUNCIL: aucun participant`);
        skipped++;
      } else {
        const config: TrackAutoGroupConfig = {
          groupType: 'GENERAL_COUNCIL',
          name: `Conseil des classes`,
          description: `Tous les enseignants (FR+EN) et l'administration — conseil des classes`,
          academicTrackId: null,
          trackCode: null,
          metadata: { category: 'conseil-general', autoGenerated: true },
        };
        const result = await this.createOrUpdateTrackGroup(tenantId, academicYearId, config, allParticipants, false);
        if (result.action === 'created') created++;
        else if (result.action === 'updated') updated++;
        else skipped++;
        channels.push({ id: result.conversationId, name: config.name, groupType: config.groupType, track: null, level: null, participants: allParticipants.length });
      }
    }

    // 7. Canaux conseil de classe par piste × niveau
    for (const track of tracks) {
      for (const level of levels) {
        const councilParticipants = await this.getCouncilParticipantsByTrackAndLevel(
          tenantId,
          academicYearId,
          track.id,
          track.code,
          level.id,
          level.code,
        );
        if (councilParticipants.length === 0) {
          this.logger.log(`  Skip COUNCIL ${track.code}/${level.code}: aucun participant`);
          skipped++;
          continue;
        }
        const config: TrackAutoGroupConfig = {
          groupType: 'COUNCIL_BY_TRACK_LEVEL',
          name: `Conseil des classes – ${level.name} (${track.code})`,
          description: `Conseil de classe — piste ${track.code}, niveau ${level.name}`,
          academicTrackId: track.id,
          trackCode: track.code,
          levelId: level.id,
          levelCode: level.code,
          levelName: level.name,
          metadata: { category: 'conseil-classe', trackCode: track.code, levelCode: level.code, autoGenerated: true },
        };
        const result = await this.createOrUpdateTrackGroup(tenantId, academicYearId, config, councilParticipants, false);
        if (result.action === 'created') created++;
        else if (result.action === 'updated') updated++;
        else skipped++;
        channels.push({ id: result.conversationId, name: config.name, groupType: config.groupType, track: track.code, level: level.code, participants: councilParticipants.length });
      }
    }

    this.logger.log(`[syncTrackAutoGroups] Terminé: ${created} créés, ${updated} mis à jour, ${skipped} ignorés, ${channels.length} canaux au total`);

    return { created, updated, skipped, total: channels.length, channels };
  }

  // ═══════════════════════════════════════════════════════════════
  //  Helpers : récupération des données
  // ═══════════════════════════════════════════════════════════════

  private async getBilingualSettings(tenantId: string): Promise<{ isEnabled: boolean } | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ isEnabled: boolean }>>(
      `SELECT "isEnabled" FROM "settings_bilingual" WHERE "tenantId" = $1`,
      tenantId,
    );
    return rows.length > 0 ? rows[0] : null;
  }

  private async getTracks(tenantId: string, isBilingual: boolean): Promise<Array<{ id: string; code: string; name: string }>> {
    const where = isBilingual
      ? `("tenantId" = $1 OR "tenantId" IS NULL) AND "isActive" = true`
      : `("tenantId" = $1 OR "tenantId" IS NULL) AND "isActive" = true AND "code" = 'FR'`;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; name: string }>>(
      `SELECT "id", "code", "name" FROM "academic_tracks" WHERE ${where} ORDER BY "code" ASC`,
      tenantId,
    );
    return rows;
  }

  private async getActiveLevels(tenantId: string): Promise<Array<{ id: string; code: string; name: string }>> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; name: string }>>(
      `SELECT "id", "code", "name" FROM "school_levels" WHERE "tenantId" = $1 AND "isActive" = true ORDER BY "order" ASC`,
      tenantId,
    );
    return rows;
  }

  private async getAdminParticipantsByTrack(
    tenantId: string,
    academicYearId: string,
    trackId: string,
    trackCode: string,
  ): Promise<string[]> {
    // Membres de l'administration via StaffAdminAssignment + Staff.assignedLanguages
    // academicTrackId NULL = les deux pistes → on l'inclut dans FR et EN
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT DISTINCT u."id" AS "userId"
       FROM "staff_admin_assignments" saa
       JOIN "staff" s ON s."id" = saa."staffId"
       JOIN "users" u ON u."email" = s."email" AND u."tenantId" = $1
       WHERE saa."tenantId" = $1
         AND saa."isActive" = true
         AND (saa."academicYearId" = $2 OR saa."academicYearId" IS NULL)
         AND (
           saa."academicTrackId" = $3
           OR saa."academicTrackId" IS NULL  -- NULL = les deux pistes
           OR ($4 = 'FR' AND (s."assignedLanguages" IS NULL OR s."assignedLanguages"::text LIKE '%"FR"%'))
           OR ($4 = 'EN' AND s."assignedLanguages"::text LIKE '%"EN"%')
         )
       UNION
       -- Aussi les users avec rôles admin (PROMOTER, DIRECTEUR_*, CENSEUR, etc.)
       SELECT DISTINCT u."id"
       FROM "users" u
       JOIN "user_roles" ur ON ur."userId" = u."id"
       JOIN "roles" r ON r."id" = ur."roleId"
       WHERE u."tenantId" = $1
         AND u."status" = 'active'
         AND (
           r."name" ILIKE '%PROMOTER%' OR r."name" ILIKE '%DIRECTOR%' OR r."name" ILIKE '%DIRECTEUR%'
           OR r."name" ILIKE '%CENSEUR%' OR r."name" ILIKE '%COMPTABLE%' OR r."name" ILIKE '%ECONOME%'
           OR r."name" ILIKE '%PEDAGOGIC%' OR r."name" ILIKE '%SCHOOL_OWNER%' OR r."name" ILIKE '%SUPER_ADMIN%'
         )`,
      tenantId,
      academicYearId,
      trackId,
      trackCode,
    );
    return rows.map(r => r.userId);
  }

  private async getPedagogicParticipantsByTrack(
    tenantId: string,
    academicYearId: string,
    trackId: string,
    trackCode: string,
  ): Promise<string[]> {
    // Enseignants par piste via Teacher.assignedLanguages
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT DISTINCT u."id" AS "userId"
       FROM "teachers" t
       JOIN "users" u ON u."email" = t."email" AND u."tenantId" = $1
       WHERE u."status" = 'active'
         AND (
           ($4 = 'FR' AND (t."assignedLanguages" IS NULL OR t."assignedLanguages"::text LIKE '%"FR"%'))
           OR ($4 = 'EN' AND t."assignedLanguages"::text LIKE '%"EN"%')
         )
       UNION
       -- Direction (aussi incluse dans le conseil pédagogique)
       SELECT DISTINCT u."id"
       FROM "users" u
       JOIN "user_roles" ur ON ur."userId" = u."id"
       JOIN "roles" r ON r."id" = ur."roleId"
       WHERE u."tenantId" = $1 AND u."status" = 'active'
         AND (r."name" ILIKE '%DIRECTOR%' OR r."name" ILIKE '%DIRECTEUR%'
              OR r."name" ILIKE '%CENSEUR%' OR r."name" ILIKE '%PEDAGOGIC%')`,
      tenantId,
      academicYearId,
      trackId,
      trackCode,
    );
    return rows.map(r => r.userId);
  }

  private async getGeneralCouncilParticipants(tenantId: string, academicYearId: string): Promise<string[]> {
    // Tous les enseignants (FR+EN) + administration
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT DISTINCT u."id" AS "userId"
       FROM "teachers" t
       JOIN "users" u ON u."email" = t."email" AND u."tenantId" = $1
       WHERE u."status" = 'active'
       UNION
       SELECT DISTINCT u."id"
       FROM "staff_admin_assignments" saa
       JOIN "staff" s ON s."id" = saa."staffId"
       JOIN "users" u ON u."email" = s."email" AND u."tenantId" = $1
       WHERE saa."tenantId" = $1 AND saa."isActive" = true
         AND (saa."academicYearId" = $2 OR saa."academicYearId" IS NULL)
       UNION
       SELECT DISTINCT u."id"
       FROM "users" u
       JOIN "user_roles" ur ON ur."userId" = u."id"
       JOIN "roles" r ON r."id" = ur."roleId"
       WHERE u."tenantId" = $1 AND u."status" = 'active'
         AND (r."name" ILIKE '%DIRECTOR%' OR r."name" ILIKE '%DIRECTEUR%'
              OR r."name" ILIKE '%CENSEUR%' OR r."name" ILIKE '%PEDAGOGIC%'
              OR r."name" ILIKE '%PROMOTER%' OR r."name" ILIKE '%SCHOOL_OWNER%')`,
      tenantId,
      academicYearId,
    );
    return rows.map(r => r.userId);
  }

  private async getCouncilParticipantsByTrackAndLevel(
    tenantId: string,
    academicYearId: string,
    trackId: string,
    trackCode: string,
    levelId: string,
    levelCode: string,
  ): Promise<string[]> {
    // Enseignants affectés aux classes du niveau + piste + administration du niveau + profs principaux
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `-- Enseignants affectés aux classes du niveau et de la piste
       SELECT DISTINCT u."id" AS "userId"
       FROM "teacher_class_assignments" tca
       JOIN "classes" c ON c."id" = tca."classId"
       JOIN "teachers" t ON t."id" = tca."teacherId"
       JOIN "users" u ON u."email" = t."email" AND u."tenantId" = $1
       WHERE c."tenantId" = $1
         AND c."academicYearId" = $2
         AND c."schoolLevelId" = $5
         AND u."status" = 'active'
         AND (
           ($4 = 'FR' AND (c."language" IS NULL OR c."language" != 'EN'))
           OR ($4 = 'EN' AND c."language" = 'EN')
         )
       UNION
       -- Profs principaux (mainTeacherId sur AcademicClass)
       SELECT DISTINCT u."id"
       FROM "pedagogy_academic_classes" pac
       JOIN "teachers" t ON t."id" = pac."mainTeacherId"
       JOIN "users" u ON u."email" = t."email" AND u."tenantId" = $1
       JOIN "classes" c ON c."officialClassId" = pac."id"
       WHERE c."tenantId" = $1 AND c."academicYearId" = $2 AND c."schoolLevelId" = $5
         AND u."status" = 'active'
       UNION
       -- Administration du niveau (StaffAdminAssignment avec schoolLevelCode correspondant)
       SELECT DISTINCT u."id"
       FROM "staff_admin_assignments" saa
       JOIN "staff" s ON s."id" = saa."staffId"
       JOIN "users" u ON u."email" = s."email" AND u."tenantId" = $1
       WHERE saa."tenantId" = $1 AND saa."isActive" = true
         AND (saa."academicYearId" = $2 OR saa."academicYearId" IS NULL)
         AND (saa."schoolLevelCode" = $6 OR saa."schoolLevelCode" = 'ALL')
         AND (
           saa."academicTrackId" = $3
           OR saa."academicTrackId" IS NULL
           OR ($4 = 'FR' AND (s."assignedLanguages" IS NULL OR s."assignedLanguages"::text LIKE '%"FR"%'))
           OR ($4 = 'EN' AND s."assignedLanguages"::text LIKE '%"EN"%')
         )`,
      tenantId,
      academicYearId,
      trackId,
      trackCode,
      levelId,
      levelCode,
    );
    return rows.map(r => r.userId);
  }

  // ═══════════════════════════════════════════════════════════════
  //  createOrUpdateTrackGroup — création idempotente
  // ═══════════════════════════════════════════════════════════════

  private async createOrUpdateTrackGroup(
    tenantId: string,
    academicYearId: string,
    config: TrackAutoGroupConfig,
    participantIds: string[],
    dryRun: boolean,
  ): Promise<{ action: 'created' | 'updated' | 'skipped'; conversationId: string }> {
    if (dryRun) {
      this.logger.log(`  [DRY RUN] ${config.groupType} "${config.name}" — ${participantIds.length} participants`);
      return { action: 'skipped', conversationId: '' };
    }

    // Rechercher l'auto-group existant (idempotent)
    const existing = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      conversationId: string | null;
    }>>(
      `SELECT "id", "conversationId" FROM "chat_auto_groups"
       WHERE "tenantId" = $1 AND "academicYearId" = $2
         AND "groupType" = $3
         AND COALESCE("classId", '') = ''
         AND COALESCE("subjectId", '') = ''
         AND COALESCE("levelId", '') = COALESCE($4, '')
         AND COALESCE("academicTrackId", '') = COALESCE($5, '')`,
      tenantId,
      academicYearId,
      config.groupType,
      config.levelId ?? null,
      config.academicTrackId ?? null,
    );

    let autoGroupId: string;
    let conversationId: string;

    if (existing.length > 0 && existing[0].conversationId) {
      // UPDATE — mettre à jour le nom/description et les participants
      autoGroupId = existing[0].id;
      conversationId = existing[0].conversationId;

      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_auto_groups"
         SET "name" = $1, "description" = $2, "metadata" = $3::jsonb, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $4`,
        config.name,
        config.description ?? null,
        JSON.stringify(config.metadata ?? {}),
        autoGroupId,
      );
      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_conversations"
         SET "name" = $1, "description" = $2, "metadata" = $3::jsonb,
             "academicTrackId" = $4, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $5`,
        config.name,
        config.description ?? null,
        JSON.stringify(config.metadata ?? {}),
        config.academicTrackId ?? null,
        conversationId,
      );
      await this.syncParticipants(conversationId, tenantId, participantIds);
      this.logger.log(`  ✓ UPDATED ${config.groupType} "${config.name}" — ${participantIds.length} participants`);
      return { action: 'updated', conversationId };
    }

    // CREATE — nouvelle conversation + nouvel auto-group
    conversationId = randomUUID();
    autoGroupId = randomUUID();

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_conversations" ("id", "tenantId", "type", "name", "description", "createdBy", "academicTrackId", "metadata")
       VALUES ($1, $2, 'GROUP', $3, $4, 'system', $5, $6::jsonb)`,
      conversationId,
      tenantId,
      config.name,
      config.description ?? null,
      config.academicTrackId ?? null,
      JSON.stringify(config.metadata ?? {}),
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_auto_groups" ("id", "tenantId", "academicYearId", "conversationId", "groupType", "name", "description", "isActive", "autoSync", "levelId", "academicTrackId", "metadata")
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, $8, $9, $10::jsonb)`,
      autoGroupId,
      tenantId,
      academicYearId,
      conversationId,
      config.groupType,
      config.name,
      config.description ?? null,
      config.levelId ?? null,
      config.academicTrackId ?? null,
      JSON.stringify(config.metadata ?? {}),
    );

    await this.syncParticipants(conversationId, tenantId, participantIds);
    this.logger.log(`  ✓ CREATED ${config.groupType} "${config.name}" — ${participantIds.length} participants`);
    return { action: 'created', conversationId };
  }

  // ═══════════════════════════════════════════════════════════════
  //  syncParticipants — synchronise les membres d'une conversation
  // ═══════════════════════════════════════════════════════════════

  private async syncParticipants(conversationId: string, tenantId: string, targetUserIds: string[]): Promise<void> {
    // Récupérer les participants actuels (leftAt IS NULL)
    const current = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT "userId" FROM "chat_participants" WHERE "conversationId" = $1 AND "leftAt" IS NULL`,
      conversationId,
    );
    const currentSet = new Set(current.map(r => r.userId));
    const targetSet = new Set(targetUserIds);

    // Ajouter les nouveaux
    for (const userId of targetSet) {
      if (!currentSet.has(userId)) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role")
           VALUES ($1, $2, $3, $4, 'MEMBER')
           ON CONFLICT DO NOTHING`,
          randomUUID(),
          conversationId,
          userId,
          tenantId,
        );
      }
    }

    // Retirer les anciens (mark as left — ne pas DELETE pour préserver l'historique)
    for (const userId of currentSet) {
      if (!targetSet.has(userId)) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "chat_participants" SET "leftAt" = CURRENT_TIMESTAMP
           WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
          conversationId,
          userId,
        );
      }
    }
  }
}
