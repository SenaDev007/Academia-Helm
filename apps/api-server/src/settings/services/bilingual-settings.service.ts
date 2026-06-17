import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';
import { BilingualValidationService } from '../../tenant-features/bilingual-validation.service';
import { TenantFeaturesService } from '../../tenant-features/tenant-features.service';
import { FeatureCode } from '../../tenant-features/entities/tenant-feature.entity';

/**
 * Service pour la gestion de l'option bilingue (mode académique structurant).
 * Impacte : structure pédagogique, matières, notes, bulletins, statistiques, tarification, ORION.
 *
 * SOURCE DE VÉRITÉ UNIQUE : SettingsBilingual.isEnabled
 * Quand isEnabled change, on synchronise automatiquement :
 * - TenantFeature.BILINGUAL_TRACK (feature flag pour le frontend)
 * - Subscription.bilingualEnabled (pour la facturation)
 * - AcademicTrack EN (créé/supprimé via TenantFeaturesService)
 */
@Injectable()
export class BilingualSettingsService {
  private readonly logger = new Logger(BilingualSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
    private readonly bilingualValidation: BilingualValidationService,
    private readonly tenantFeaturesService: TenantFeaturesService,
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
        ...prismaCreateDefaults(),
          tenantId,
          isEnabled: false,
          separateSubjects: true,
          separateGrades: true,
          defaultLanguage: 'FR',
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
      defaultLanguage?: string;
      defaultUILanguage?: string;
      billingImpactAcknowledged?: boolean;
      pricingSupplement?: number;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.getSettings(tenantId);

    // Désactivation : impossible si données EN existantes
    if (data.isEnabled === false && existing.isEnabled) {
      const hasEnData = await this.bilingualValidation.hasEnglishTrackData(tenantId);
      if (hasEnData) {
        const summary = await this.bilingualValidation.getEnglishTrackDataSummary(tenantId);
        throw new BadRequestException(
          'Impossible de désactiver le bilingue : des données anglaises existent (matières, notes, bulletins). ' +
          `Résumé : ${summary.subjects} matières, ${summary.examScores} notes d'examen, ${summary.reportCards} bulletins. ` +
          'Supprimez ou migrez ces données avant de désactiver.',
        );
      }
    }

    // Activation : vérifier migration si données existantes + avertissement facturation
    if (data.isEnabled === true && !existing.isEnabled) {
      const migrationNeeded = await this.checkMigrationNeeded(tenantId);
      if (migrationNeeded && !data.billingImpactAcknowledged) {
        throw new BadRequestException(
          'Des données existent déjà. L\'activation du bilingue nécessite une migration. ' +
          'Veuillez confirmer l\'impact sur la facturation (case à cocher).',
        );
      }
      if (migrationNeeded) {
        data['migrationRequired'] = true;
        data['migrationStatus'] = 'PENDING';
      }
      data['activatedAt'] = new Date();
    }

    const updatePayload: Record<string, unknown> = { ...data, updatedAt: new Date() };
    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && existing[key] !== data[key]) {
        changes[key] = { old: existing[key], new: data[key] };
      }
    });

    if (Object.keys(changes).length === 0 && !(data as any).activatedAt) {
      return existing;
    }

    const updated = await this.prisma.settingsBilingual.update({
      where: { tenantId },
      data: updatePayload as any,
    });

    // Mettre à jour le flag bilingue dans la souscription
    if (data.isEnabled !== undefined) {
      await this.prisma.subscription.updateMany({
        where: { tenantId },
        data: { bilingualEnabled: data.isEnabled },
      });

      // ─── Synchroniser le feature flag BILINGUAL_TRACK ───
      // C'est la source de vérité pour le frontend (useFeature, AcademicTrackSelector, etc.)
      try {
        const isEnabled = await this.tenantFeaturesService.isFeatureEnabled(
          FeatureCode.BILINGUAL_TRACK,
          tenantId,
        );
        if (data.isEnabled && !isEnabled) {
          // Activer le feature flag → crée aussi l'AcademicTrack EN via onFeatureEnabled
          await this.tenantFeaturesService.enableFeature(
            FeatureCode.BILINGUAL_TRACK,
            tenantId,
            userId,
            'Activated via Settings → Bilingual',
          );
          this.logger.log(`BILINGUAL_TRACK feature enabled for tenant ${tenantId}`);
        } else if (!data.isEnabled && isEnabled) {
          // Désactiver le feature flag
          // La vérification des données EN a déjà été faite ci-dessus
          await this.tenantFeaturesService.disableFeature(
            FeatureCode.BILINGUAL_TRACK,
            tenantId,
            userId,
            'Deactivated via Settings → Bilingual',
          );
          this.logger.log(`BILINGUAL_TRACK feature disabled for tenant ${tenantId}`);
        }
      } catch (syncErr: any) {
        // Non-bloquant : si le sync échoue (ex: feature déjà activée), on logge et continue
        this.logger.warn(`Failed to sync BILINGUAL_TRACK feature flag: ${syncErr.message}`);
      }
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
   * Lance la migration bilingue : marque les données existantes comme FR.
   * Les élèves et classes ne sont pas dupliqués ; seules les matières/notes/bulletins
   * sont explicitées avec une langue (FR) pour cohérence avec le mode bilingue.
   */
  async startMigration(tenantId: string, userId: string) {
    const settings = await this.getSettings(tenantId);

    if (!settings.migrationRequired) {
      throw new BadRequestException('Aucune migration n\'est requise.');
    }

    await this.prisma.settingsBilingual.update({
      where: { tenantId },
      data: {
        ...prismaUpdateDefaults(),
        migrationStatus: 'IN_PROGRESS',
        updatedAt: new Date(),
      },
    });

    try {
      // Marquer toutes les données existantes sans langue comme FR
      const [subjects, grades, examScores, reportCards] = await Promise.all([
        this.prisma.subject.updateMany({
          where: { tenantId, language: null },
          data: { language: 'FR', updatedAt: new Date() },
        }),
        this.prisma.grade.updateMany({
          where: { tenantId, language: null },
          data: { language: 'FR', updatedAt: new Date() },
        }),
        this.prisma.examScore.updateMany({
          where: { tenantId, language: null },
          data: { language: 'FR', updatedAt: new Date() },
        }),
        this.prisma.reportCard.updateMany({
          where: { tenantId, language: null },
          data: { language: 'FR', updatedAt: new Date() },
        }),
      ]);

      await this.prisma.settingsBilingual.update({
        where: { tenantId },
        data: {
        ...prismaUpdateDefaults(),
          migrationStatus: 'COMPLETED',
          migrationRequired: false,
          migratedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Migration terminée avec succès.',
        migrated: {
          subjects: subjects.count,
          grades: grades.count,
          examScores: examScores.count,
          reportCards: reportCards.count,
        },
      };
    } catch (error) {
      await this.prisma.settingsBilingual.update({
        where: { tenantId },
        data: {
        ...prismaUpdateDefaults(),
          migrationStatus: 'FAILED',
          updatedAt: new Date(),
        },
      });

      throw new BadRequestException(`Erreur lors de la migration: ${error.message}`);
    }
  }

  /**
   * Calcule l'impact sur la facturation (supplément bilingue).
   * Utilise pricingSupplement des paramètres si défini, sinon plan ou estimation.
   */
  async getBillingImpact(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { subscriptionPlan: true },
    });

    const currency = subscription?.currency ?? 'XOF';

    if (settings.pricingSupplement != null && settings.pricingSupplement > 0) {
      return {
        monthly: settings.pricingSupplement,
        annual: settings.pricingSupplement * 12,
        currency,
      };
    }

    if (!subscription) {
      return { monthly: 0, annual: 0, currency };
    }

    const plan = subscription.subscriptionPlan as any;
    const monthlyAddon = plan?.bilingualMonthlyAddon ?? plan?.bilingual_monthly_addon;
    const yearlyAddon = plan?.bilingualYearlyAddon ?? plan?.bilingual_yearly_addon;
    if (monthlyAddon != null || yearlyAddon != null) {
      return {
        monthly: monthlyAddon ?? 0,
        annual: yearlyAddon ?? (monthlyAddon ?? 0) * 12,
        currency,
      };
    }

    const bilingualSurcharge = 0.20;
    const baseMonthly = plan?.monthlyPrice ?? subscription.amount ?? 0;
    const baseAnnual = plan?.yearlyPrice ?? (subscription.amount ?? 0) * 12;

    return {
      monthly: Math.round(baseMonthly * bilingualSurcharge),
      annual: Math.round(baseAnnual * bilingualSurcharge),
      currency,
    };
  }
}
