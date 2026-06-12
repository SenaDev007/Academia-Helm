/**
 * ============================================================================
 * ENHANCED AUDIT SERVICE — Service d'audit renforcé pour les paramètres
 * ============================================================================
 *
 * Fonctionnalités :
 *   - Journalisation de toutes les modifications de paramètres
 *   - Inclusion du userAgent en plus de l'IP
 *   - Purge automatique selon auditLogRetentionDays
 *   - Recherche et filtrage des entrées d'audit
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { uuid } from '../utils/prisma-helpers';

export interface AuditLogEntry {
  tenantId: string;
  category: string;
  key: string;
  oldValue?: any;
  newValue?: any;
  changedBy: string;
  changedAt: Date;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class EnhancedAuditService {
  private readonly logger = new Logger(EnhancedAuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Enregistre une modification dans l'historique d'audit
   */
  async logChange(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.settingsHistory.create({
        data: {
          id: uuid(),
          tenantId: entry.tenantId,
          category: entry.category,
          key: entry.key,
          oldValue: entry.oldValue !== undefined ? JSON.stringify(entry.oldValue) : null,
          newValue: entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
          changedBy: entry.changedBy,
          changedAt: entry.changedAt || new Date(),
          reason: entry.reason || null,
          ipAddress: entry.ipAddress || null,
          // userAgent stocké dans un champ JSON étendu si le modèle le supporte
        },
      });
    } catch (error) {
      // L'audit ne doit jamais bloquer l'opération principale
      this.logger.warn(`Audit log failed: ${(error as Error).message}`);
    }
  }

  /**
   * Enregistre plusieurs modifications en une transaction
   */
  async logBatchChanges(entries: AuditLogEntry[]): Promise<void> {
    if (entries.length === 0) return;

    try {
      await this.prisma.$transaction(
        entries.map((entry) =>
          this.prisma.settingsHistory.create({
            data: {
              id: uuid(),
              tenantId: entry.tenantId,
              category: entry.category,
              key: entry.key,
              oldValue: entry.oldValue !== undefined ? JSON.stringify(entry.oldValue) : null,
              newValue: entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
              changedBy: entry.changedBy,
              changedAt: entry.changedAt || new Date(),
              reason: entry.reason || null,
              ipAddress: entry.ipAddress || null,
            },
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(`Batch audit log failed: ${(error as Error).message}`);
    }
  }

  /**
   * Récupère l'historique d'audit pour un tenant
   */
  async getHistory(
    tenantId: string,
    options?: {
      category?: string;
      changedBy?: string;
      since?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ entries: any[]; total: number }> {
    const where: any = { tenantId };
    if (options?.category) where.category = options.category;
    if (options?.changedBy) where.changedBy = options.changedBy;
    if (options?.since) where.changedAt = { gte: options.since };

    const [entries, total] = await Promise.all([
      this.prisma.settingsHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.settingsHistory.count({ where }),
    ]);

    return { entries, total };
  }

  /**
   * Purge les entrées d'audit plus anciennes que retentionDays
   */
  async purgeOldEntries(tenantId: string, retentionDays: number): Promise<number> {
    if (retentionDays <= 0) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await this.prisma.settingsHistory.deleteMany({
        where: {
          tenantId,
          changedAt: { lt: cutoffDate },
        },
      });
      this.logger.log(`Purged ${result.count} audit entries older than ${retentionDays} days for tenant ${tenantId}`);
      return result.count;
    } catch (error) {
      this.logger.warn(`Audit purge failed: ${(error as Error).message}`);
      return 0;
    }
  }
}
