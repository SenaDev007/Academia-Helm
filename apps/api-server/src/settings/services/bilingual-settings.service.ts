import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion de l'option bilingue
 */
@Injectable()
export class BilingualSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère les paramètres bilingues
   */
  async getSettings(tenantId: string) {
    let settings = await this.prisma.settingsBilingual.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await this.prisma.settingsBilingual.create({
        data: {
          tenantId,
          isEnabled: false,
          separateSubjects: true,
          separateGrades: true,
          defaultUILanguage: 'FR',
          migrationRequired: false,
          billingImpactAcknowledged: false,
        },
      });
    }

    return settings;
  }

  /**
   * Met à jour les paramètres bilingues
   */
  async updateSettings(
    tenantId: string,
    data: {
      isEnabled?: boolean;
      separateSubjects?: boolean;
      separateGrades?: boolean;
      defaultUILanguage?: string;
      billingImpactAcknowledged?: boolean;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.getSettings(tenantId);

    // Si on active le bilingue, vérifier si une migration est nécessaire
    if (data.isEnabled === true && !existing.isEnabled) {
      const migrationNeeded = await this.checkMigrationNeeded(tenantId);
      if (migrationNeeded && !data.billingImpactAcknowledged) {
        throw new BadRequestException(
          'Des données existent déjà. L\'activation du bilingue nécessite une migration. ' +
          'Veuillez confirmer l\'impact sur la facturation.',
        );
      }
      if (migrationNeeded) {
        data['migrationRequired'] = true;
        data['migrationStatus'] = 'PENDING';
      }
    }

    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && existing[key] !== data[key]) {
        changes[key] = { old: existing[key], new: data[key] };
      }
    });

    if (Object.keys(changes).length === 0) {
      return existing;
    }

    const updated = await this.prisma.settingsBilingual.update({
      where: { tenantId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Mettre à jour le flag bilingue dans la souscription
    if (data.isEnabled !== undefined) {
      await this.prisma.subscription.updateMany({
        where: { tenantId },
        data: { bilingualEnabled: data.isEnabled },
      });
    }

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'settings_bilingual',
      'bilingual',
      changes,
      userId,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  /**
   * Vérifie si une migration est nécessaire (données existantes)
   */
  async checkMigrationNeeded(tenantId: string): Promise<boolean> {
    const [gradesCount, subjectsCount] = await Promise.all([
      this.prisma.grade.count({ where: { tenantId } }),
      this.prisma.subject.count({ where: { tenantId } }),
    ]);

    return gradesCount > 0 || subjectsCount > 0;
  }

  /**
   * Lance la migration bilingue
   */
  async startMigration(tenantId: string, userId: string) {
    const settings = await this.getSettings(tenantId);

    if (!settings.migrationRequired) {
      throw new BadRequestException('Aucune migration n\'est requise.');
    }

    // Mettre à jour le statut
    await this.prisma.settingsBilingual.update({
      where: { tenantId },
      data: {
        migrationStatus: 'IN_PROGRESS',
        updatedAt: new Date(),
      },
    });

    try {
      // TODO: Implémenter la logique de migration
      // - Dupliquer les matières pour FR/EN
      // - Ajuster les structures de notes
      // - Mettre à jour les bulletins

      await this.prisma.settingsBilingual.update({
        where: { tenantId },
        data: {
          migrationStatus: 'COMPLETED',
          migrationRequired: false,
          migratedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return { success: true, message: 'Migration terminée avec succès.' };
    } catch (error) {
      await this.prisma.settingsBilingual.update({
        where: { tenantId },
        data: {
          migrationStatus: 'FAILED',
          updatedAt: new Date(),
        },
      });

      throw new BadRequestException(`Erreur lors de la migration: ${error.message}`);
    }
  }

  /**
   * Calcule l'impact sur la facturation
   */
  async getBillingImpact(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { subscriptionPlan: true },
    });

    if (!subscription) {
      return { monthly: 0, annual: 0 };
    }

    // Impact typique du bilingue : +20% sur le prix
    const bilingualSurcharge = 0.20;
    const baseMonthly = subscription.subscriptionPlan?.monthlyPrice || subscription.amount;
    const baseAnnual = subscription.subscriptionPlan?.yearlyPrice || (subscription.amount * 12);

    return {
      monthly: Math.round(baseMonthly * bilingualSurcharge),
      annual: Math.round(baseAnnual * bilingualSurcharge),
      currency: subscription.currency,
    };
  }
}
