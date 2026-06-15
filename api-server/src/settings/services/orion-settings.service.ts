import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion des paramètres ORION (IA de pilotage)
 */
@Injectable()
export class OrionSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère les paramètres ORION pour un tenant
   */
  async getOrionSettings(tenantId: string) {
    let settings = await this.prisma.orionSettings.findUnique({
      where: { tenantId },
    });

    // Si aucun paramètre n'existe, créer les paramètres par défaut
    if (!settings) {
      settings = await this.prisma.orionSettings.create({
        data: {
        ...prismaCreateDefaults(),
          tenantId,
          isEnabled: true,
          alertThresholdCritical: 5,
          alertThresholdWarning: 10,
          kpiCalculationFrequency: 'DAILY',
          autoGenerateInsights: true,
          insightsFrequency: 'WEEKLY',
          visibleKPICategories: ['PEDAGOGICAL', 'FINANCIAL', 'RH', 'QHSE'],
          allowOrionExports: true,
        },
      });
    }

    return settings;
  }

  /**
   * Met à jour les paramètres ORION
   */
  async updateOrionSettings(
    tenantId: string,
    data: {
      isEnabled?: boolean;
      alertThresholdCritical?: number;
      alertThresholdWarning?: number;
      kpiCalculationFrequency?: string;
      autoGenerateInsights?: boolean;
      insightsFrequency?: string;
      visibleKPICategories?: string[];
      allowOrionExports?: boolean;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.getOrionSettings(tenantId);

    // Enregistrer l'historique des changements
    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && JSON.stringify(existing[key]) !== JSON.stringify(data[key])) {
        changes[key] = { old: existing[key], new: data[key] };
      }
    });

    if (Object.keys(changes).length === 0) {
      return existing;
    }

    // Mettre à jour les paramètres
    const updated = await this.prisma.orionSettings.update({
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
      'orion_settings',
      'orion',
      changes,
      userId,
      ipAddress,
      userAgent,
    );

    return updated;
  }
}

