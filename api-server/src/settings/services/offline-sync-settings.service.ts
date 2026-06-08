import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion des paramètres de synchronisation offline
 */
@Injectable()
export class OfflineSyncSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère les paramètres de synchronisation offline pour un tenant
   */
  async getOfflineSyncSettings(tenantId: string) {
    let settings = await this.prisma.offlineSyncSettings.findUnique({
      where: { tenantId },
    });

    // Si aucun paramètre n'existe, créer les paramètres par défaut
    if (!settings) {
      settings = await this.prisma.offlineSyncSettings.create({
        data: {
        ...prismaCreateDefaults(),
          tenantId,
          isEnabled: true,
          syncFrequencyMinutes: 15,
          conflictResolution: 'SERVER_WINS',
          autoSyncOnConnect: true,
          maxOfflineDays: 7,
          allowOfflineModification: true,
          syncOnBackground: true,
        },
      });
    }

    return settings;
  }

  /**
   * Met à jour les paramètres de synchronisation offline
   */
  async updateOfflineSyncSettings(
    tenantId: string,
    data: {
      isEnabled?: boolean;
      syncFrequencyMinutes?: number;
      conflictResolution?: string;
      autoSyncOnConnect?: boolean;
      maxOfflineDays?: number;
      allowOfflineModification?: boolean;
      syncOnBackground?: boolean;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.getOfflineSyncSettings(tenantId);

    // Enregistrer l'historique des changements
    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && existing[key] !== data[key]) {
        changes[key] = { old: existing[key], new: data[key] };
      }
    });

    if (Object.keys(changes).length === 0) {
      return existing;
    }

    // Mettre à jour les paramètres
    const updated = await this.prisma.offlineSyncSettings.update({
      where: { tenantId },
      data: {
        ...prismaUpdateDefaults(),
        ...data,
        updatedAt: new Date(),
      },
    });

    // Enregistrer l'historique
    await this.historyService.logSettingChange(
      tenantId,
      null,
      'offline_sync_settings',
      'offline',
      changes,
      userId,
      ipAddress,
      userAgent,
    );

    return updated;
  }
}

