/**
 * ============================================================================
 * HELM CONNECT V2.1 — Scheduled Announcements Dispatcher
 * ============================================================================
 *
 * Vérifie périodiquement les annonces avec scheduledAt <= NOW() et
 * publishedAt IS NULL, et les publie automatiquement.
 *
 * ⭐ Intégration :
 *   - Le service peut être appelé manuellement via GET /chat/announcements/dispatch-scheduled
 *   - Ou via un cron externe (Vercel Cron, Railway Cron, etc.) qui appelle l'endpoint
 *   - En V2.5, un @Cron() decorator NestJS pourra être ajouté pour un cron interne
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ScheduledAnnouncementDispatcher {
  private readonly logger = new Logger(ScheduledAnnouncementDispatcher.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vérifie les annonces programmées et publie celles dont l'heure est venue.
   * @returns nombre d'annonces publiées
   */
  async dispatchDueAnnouncements(): Promise<{
    publishedCount: number;
    skippedCount: number;
    publishedIds: string[];
  }> {
    // ⭐ Trouver toutes les annonces en attente dont l'heure est venue
    //    (scheduledAt <= NOW(), publishedAt IS NULL, deletedAt IS NULL)
    const due: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "tenantId", "authorId", "title", priority, "targetType"
      FROM "chat_announcements"
      WHERE "scheduledAt" IS NOT NULL
        AND "scheduledAt" <= NOW()
        AND "publishedAt" IS NULL
        AND "deletedAt" IS NULL
      ORDER BY "scheduledAt" ASC
      LIMIT 100
    `);

    if (due.length === 0) {
      this.logger.log('⭐ No scheduled announcements due.');
      return { publishedCount: 0, skippedCount: 0, publishedIds: [] };
    }

    this.logger.log(`⭐ Found ${due.length} scheduled announcement(s) due. Publishing...`);

    const publishedIds: string[] = [];
    let skipped = 0;

    for (const ann of due) {
      try {
        // ⭐ Update publishedAt — the announcement is now LIVE
        await this.prisma.$executeRawUnsafe(`
          UPDATE "chat_announcements"
          SET "publishedAt" = NOW(), "updatedAt" = NOW()
          WHERE "id" = $1 AND "publishedAt" IS NULL
        `, ann.id);
        publishedIds.push(ann.id);
        this.logger.log(`  ✓ Published: ${ann.id} (${ann.title}, priority=${ann.priority}, target=${ann.targetType})`);
      } catch (e: any) {
        this.logger.error(`  ✗ Failed to publish ${ann.id}: ${e.message}`);
        skipped++;
      }
    }

    this.logger.log(`⭐ Dispatched ${publishedIds.length} announcement(s), ${skipped} skipped.`);
    return {
      publishedCount: publishedIds.length,
      skippedCount: skipped,
      publishedIds,
    };
  }
}
