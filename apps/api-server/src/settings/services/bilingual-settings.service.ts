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
   * Lance la migration bilingue : marque les données existantes avec une langue.
   *
   * Étapes (M1 — migration étendue) :
   * 1. Créer l'AcademicTrack EN s'il n'existe pas (via feature flag sync)
   * 2. Pour les AcademicClass avec languageTrack='EN', inférer la langue des
   *    Subjects/Exams/Grades liés
   * 3. Backfill FR sur toutes les données sans langue explicite
   * 4. Backfill Class.language depuis AcademicClass.languageTrack
   * 5. Backfill Exam.language depuis Subject.language
   *
   * Les élèves ne sont PAS dupliqués (conforme au cahier des charges).
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
      // ─── Étape 1 : Créer l'AcademicTrack EN via feature flag ───
      try {
        const isEnabled = await this.tenantFeaturesService.isFeatureEnabled(
          FeatureCode.BILINGUAL_TRACK,
          tenantId,
        );
        if (!isEnabled) {
          await this.tenantFeaturesService.enableFeature(
            FeatureCode.BILINGUAL_TRACK,
            tenantId,
            userId,
            'Created during bilingual migration',
          );
          this.logger.log(`AcademicTrack EN created for tenant ${tenantId} during migration`);
        }
      } catch (trackErr: any) {
        this.logger.warn(`Could not create AcademicTrack EN during migration: ${trackErr.message}`);
      }

      // ─── Étape 2 : Inférer la langue depuis AcademicClass.languageTrack ───
      // Pour les classes pédagogiques avec languageTrack='EN', on marque leurs
      // matières et examens liés comme EN. Le reste reste FR.
      const enClasses = await this.prisma.academicClass.findMany({
        where: { tenantId, languageTrack: 'EN' },
        select: { id: true },
      });
      const enClassIds = enClasses.map((c) => c.id);

      let enSubjectsCount = 0;
      let enExamsCount = 0;
      let enGradesCount = 0;

      if (enClassIds.length > 0) {
        // Marquer les matières des classes EN comme EN
        const enSubjects = await this.prisma.subject.updateMany({
          where: {
            tenantId,
            language: null,
            // Les matières liées aux classes EN via ClassSubject
            classSubjects: { some: { classId: { in: enClassIds } } },
          },
          data: { language: 'EN', updatedAt: new Date() },
        });
        enSubjectsCount = enSubjects.count;

        // Marquer les examens des classes EN comme EN
        const enExams = await this.prisma.exam.updateMany({
          where: {
            tenantId,
            language: null,
            classId: { in: enClassIds },
          },
          data: { language: 'EN', updatedAt: new Date() },
        });
        enExamsCount = enExams.count;

        // Marquer les notes des examens EN comme EN
        if (enExamsCount > 0) {
          const enGrades = await this.prisma.grade.updateMany({
            where: {
              tenantId,
              language: null,
              exam: { language: 'EN' },
            },
            data: { language: 'EN', updatedAt: new Date() },
          });
          enGradesCount = enGrades.count;
        }
      }

      // ─── Étape 3 : Backfill FR sur toutes les données restantes sans langue ───
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

      // ─── Étape 4 : Backfill Class.language depuis AcademicClass.languageTrack ───
      // Les classes (table `classes`) qui n'ont pas de langue explicite
      // héritent de la langue de leur AcademicClass correspondante (si elle existe)
      const classesWithoutLanguage = await this.prisma.class.findMany({
        where: { tenantId, language: null },
        select: { id: true, code: true },
      });

      let classesBackfilled = 0;
      for (const cls of classesWithoutLanguage) {
        // Chercher l'AcademicClass correspondante par code
        const academicClass = await this.prisma.academicClass.findFirst({
          where: { tenantId, code: cls.code },
          select: { languageTrack: true },
        });
        const inferredLanguage = academicClass?.languageTrack || 'FR';
        await this.prisma.class.update({
          where: { id: cls.id },
          data: { language: inferredLanguage },
        });
        classesBackfilled++;
      }

      // ─── Étape 5 : Backfill Exam.language depuis Subject.language ───
      // Pour les examens qui n'ont pas de classeId (et donc pas été traités à l'étape 2)
      const examsWithoutLanguage = await this.prisma.exam.findMany({
        where: { tenantId, language: null },
        select: { id: true, subjectId: true },
      });

      let examsBackfilled = 0;
      for (const exam of examsWithoutLanguage) {
        const subject = await this.prisma.subject.findUnique({
          where: { id: exam.subjectId },
          select: { language: true },
        });
        const inferredLanguage = subject?.language || 'FR';
        await this.prisma.exam.update({
          where: { id: exam.id },
          data: { language: inferredLanguage },
        });
        examsBackfilled++;
      }

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

      this.logger.log(
        `Migration bilingue terminée pour tenant ${tenantId}: ` +
        `${enSubjectsCount} matières EN, ${enExamsCount} examens EN, ${enGradesCount} notes EN, ` +
        `${subjects.count} matières FR, ${grades.count} notes FR, ${examScores.count} scores FR, ` +
        `${reportCards.count} bulletins FR, ${classesBackfilled} classes backfillées, ${examsBackfilled} examens backfillés`,
      );

      return {
        success: true,
        message: 'Migration terminée avec succès.',
        migrated: {
          // Données marquées EN (inférées depuis AcademicClass.languageTrack)
          enSubjects: enSubjectsCount,
          enExams: enExamsCount,
          enGrades: enGradesCount,
          // Données marquées FR (backfill par défaut)
          subjects: subjects.count,
          grades: grades.count,
          examScores: examScores.count,
          reportCards: reportCards.count,
          // Données additionnelles backfillées
          classesBackfilled,
          examsBackfilled,
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
