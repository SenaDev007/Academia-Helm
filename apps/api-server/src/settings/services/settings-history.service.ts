import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour la gestion de l'historique des paramètres
 * (audit immuable)
 */
@Injectable()
export class SettingsHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre un changement de paramètre dans l'historique
   */
  async logSettingChange(
    tenantId: string | undefined,
    settingId: string | null,
    key: string,
    category: string,
    changes: Record<string, { old: any; new: any }>,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!tenantId || typeof tenantId !== 'string') {
      return;
    }
    // Créer une entrée d'historique pour chaque changement
    const historyEntries = Object.keys(changes).map((field) =>
      this.prisma.settingsHistory.create({
        data: {
          tenantId,
          settingId,
          key: `${key}.${field}`,
          category,
          oldValue: changes[field].old,
          newValue: changes[field].new,
          changedBy: userId,
          changedAt: new Date(),
          ipAddress,
          userAgent,
        },
      }),
    );

    await Promise.all(historyEntries);
  }

  /**
   * Enregistre un changement de feature flag dans l'historique
   */
  async logFeatureChange(
    tenantId: string | undefined,
    featureCode: string,
    oldStatus: string,
    newStatus: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!tenantId || typeof tenantId !== 'string') return;
    await this.prisma.settingsHistory.create({
      data: {
        tenantId,
        settingId: null,
        key: `feature.${featureCode}`,
        category: 'features',
        oldValue: { status: oldStatus },
        newValue: { status: newStatus, reason },
        changedBy: userId,
        changedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Récupère l'historique des changements de paramètres
   */
  async getHistory(
    tenantId: string,
    options?: {
      category?: string;
      key?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ) {
    const where: any = { tenantId };

    if (options?.category) {
      where.category = options.category;
    }

    if (options?.key) {
      where.key = { contains: options.key };
    }

    if (options?.startDate || options?.endDate) {
      where.changedAt = {};
      if (options.startDate) {
        where.changedAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.changedAt.lte = options.endDate;
      }
    }

    return this.prisma.settingsHistory.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: options?.limit || 100,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Récupère l'historique d'un paramètre spécifique
   */
  async getHistoryByKey(tenantId: string, key: string) {
    return this.prisma.settingsHistory.findMany({
      where: {
        tenantId,
        key: { contains: key },
      },
      orderBy: { changedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}

