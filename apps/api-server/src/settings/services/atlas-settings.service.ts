import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion des paramètres ATLAS (Chatbot IA)
 */
@Injectable()
export class AtlasSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère les paramètres ATLAS pour un tenant
   */
  async getAtlasSettings(tenantId: string) {
    let settings = await this.prisma.atlasSettings.findUnique({
      where: { tenantId },
    });

    // Si aucun paramètre n'existe, créer les paramètres par défaut
    if (!settings) {
      settings = await this.prisma.atlasSettings.create({
        data: {
        ...prismaCreateDefaults(),
          tenantId,
          isEnabled: false,
          scope: 'LIMITED',
          allowedModules: [],
          allowHumanHandoff: true,
          conversationHistoryDays: 90,
          maxConversationsPerDay: null, // Illimité par défaut
          language: 'FR',
        },
      });
    }

    return settings;
  }

  /**
   * Met à jour les paramètres ATLAS
   */
  async updateAtlasSettings(
    tenantId: string,
    data: {
      isEnabled?: boolean;
      scope?: string;
      allowedModules?: string[];
      allowHumanHandoff?: boolean;
      conversationHistoryDays?: number;
      maxConversationsPerDay?: number | null;
      language?: string;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.getAtlasSettings(tenantId);

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
    const updated = await this.prisma.atlasSettings.update({
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
      'atlas_settings',
      'atlas',
      changes,
      userId,
      ipAddress,
      userAgent,
    );

    return updated;
  }
}

