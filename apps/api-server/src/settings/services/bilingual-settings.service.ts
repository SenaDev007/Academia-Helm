import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { getBilingualAddonPrice } from '../../common/utils/bilingual-addon-pricing';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';
import { BilingualValidationService } from '../../tenant-features/bilingual-validation.service';
import { TenantFeaturesService } from '../../tenant-features/tenant-features.service';
import { FeatureCode } from '../../tenant-features/entities/tenant-feature.entity';
import { BilingualStructureService } from '../../bilingual-structure/bilingual-structure.service';
import { EmailService } from '../../communication/services/email.service';
import * as crypto from 'crypto';

/**
 * ⭐ Adresse email de YEHI OR Tech qui reçoit les OTP d'activation bilingue.
 *    Quand une école clique sur « Activer le mode bilingue », un code OTP est
 *    envoyé à cette adresse. L'école doit ensuite saisir le code reçu pour
 *    confirmer l'activation — cela garantit que le paiement a été effectué
 *    (YEHI OR Tech communique le code à l'école après paiement).
 */
const BILINGUAL_OTP_RECIPIENT_EMAIL = 's.akpovitohou@gmail.com';
const BILINGUAL_OTP_VALIDITY_MINUTES = 30; // ⭐ 30 min (plus long que l'OTP login classique car l'école doit contacter YEHI OR Tech)
const BILINGUAL_OTP_MAX_ATTEMPTS = 5;

/**
 * ⭐ Tenants exemptés d'OTP — considérés comme déjà en règle (paiement effectué).
 *    Ces tenants peuvent activer le mode bilingue sans code OTP et ont une
 *    expiration très lointaine (10 ans).
 *
 *    CSPEB-Eveil d'Afrique Education : école pilote du projet, déjà en règle.
 */
const OTP_EXEMPTED_TENANTS = new Set([
  '59b8c348-ae5f-4d67-8fbd-af6aefa1f394', // CSPEB-Eveil d'Afrique Education
]);

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
    private readonly bilingualStructureService: BilingualStructureService,
    private readonly emailService: EmailService,
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

    // Activation : vérifier OTP + migration si données existantes
    if (data.isEnabled === true && !existing.isEnabled) {
      // ⭐ Bypass OTP pour les tenants exemptés (ex: CSPEB — déjà en règle)
      if (!OTP_EXEMPTED_TENANTS.has(tenantId)) {
        // Vérification OTP obligatoire — le code doit avoir été vérifié avant l'activation
        if (!data.otpCode) {
          throw new BadRequestException(
            'Code OTP requis pour activer le mode bilingue. ' +
            'Cliquez sur « Demander un code OTP » pour recevoir un code par email à YEHI OR Tech.',
          );
        }
        // Vérifier le code OTP stocké dans pendingOtpCode
        const now = new Date();
        if (!existing.pendingOtpCode || !existing.pendingOtpExpiresAt || existing.pendingOtpExpiresAt < now) {
          throw new BadRequestException(
            'Aucun code OTP valide. Veuillez demander un nouveau code OTP.',
          );
        }
        if (existing.pendingOtpAttempts >= BILINGUAL_OTP_MAX_ATTEMPTS) {
          throw new BadRequestException(
            'Trop de tentatives OTP échouées. Veuillez demander un nouveau code OTP.',
          );
        }
        const hashedInput = this.hashCode(data.otpCode);
        if (hashedInput !== existing.pendingOtpCode) {
          // Incrémenter le compteur de tentatives
          await this.prisma.settingsBilingual.update({
            where: { tenantId },
            data: { pendingOtpAttempts: { increment: 1 } },
          });
          throw new BadRequestException('Code OTP incorrect. Veuillez réessayer.');
        }
      } else {
        this.logger.log(`[Bilingual] Tenant ${tenantId} is OTP-exempted — skipping OTP verification`);
      }

      // OTP valide (ou tenant exempté) — marquer l'activation
      const migrationNeeded = await this.checkMigrationNeeded(tenantId);
      if (migrationNeeded) {
        data['migrationRequired'] = true;
        data['migrationStatus'] = 'PENDING';
      }
      const activatedAt = new Date();
      data['activatedAt'] = activatedAt;
      data['otpActivatedAt'] = activatedAt;
      // ⭐ Expiration : 31 août de l'année suivante (ou 10 ans pour les tenants exemptés)
      const expiresAt = this.computeBilingualExpiry(activatedAt, tenantId);
      data['expiresAt'] = expiresAt;
      data['isExpired'] = false;
      // Réinitialiser les champs OTP
      data['pendingOtpCode'] = null;
      data['pendingOtpExpiresAt'] = null;
      data['pendingOtpAttempts'] = 0;
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

      // ─── ⭐ Auto-création de la structure pédagogique EN ───
      //    Quand le mode bilingue passe de OFF → ON, on crée automatiquement
      //    la structure EN miroir (Nursery 1/2, Primary 1-6) pour tous les
      //    niveaux FR existants. Opération idempotente — ne recrée pas ce
      //    qui existe déjà. Ne lance PAS d'erreur si le seed échoue partiellement
      //    (l'utilisateur peut relancer manuellement via l'endpoint dédié).
      //
      //    ⚠️ NB : les matières EN ne sont PAS créées ici — elles sont spécifiques
      //    à la piste EN et créées manuellement par l'admin dans le module Pédagogie.
      if (data.isEnabled && !existing.isEnabled) {
        try {
          const stats = await this.bilingualStructureService.seedEnglishStructureForTenant(tenantId);
          this.logger.log(
            `Bilingual structure seeded for tenant ${tenantId}: ` +
            `${stats.academicClassesCreated} EN academic classes, ` +
            `${stats.classroomsCreated} EN classrooms created`,
          );
        } catch (seedErr: any) {
          // Non-bloquant : l'activation bilingue réussit même si le seed échoue.
          // L'utilisateur pourra relancer le seed via l'endpoint dédié.
          this.logger.error(
            `Failed to seed EN structure for tenant ${tenantId}: ${seedErr.message}`,
            seedErr.stack,
          );
        }
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
   *
   * ⭐ Source centrale en base, contrôlable depuis le back-office
   *    (admin.academiahelm.com → Abonnements & Plans → carte « BILINGUAL ») :
   *      1. pricing_plans code 'BILINGUAL' (bilingualMonthly / bilingualYearly)
   *      2. pricing_configs active (bilingualMonthlyAddon / bilingualYearlyAddon)
   *      3. settings_bilingual.pricingSupplement (override legacy par tenant,
   *         uniquement si aucune source centrale n'existe en base)
   *      4. Défauts (10 000 FCFA/mois de référence → 100 000 FCFA/an, 2 mois offerts)
   *
   * Retourne { monthly, annual, monthsFree, currency, source } — monthsFree
   * indique la réduction annuelle en mois offerts (ex. 100 000 vs 120 000 → 2).
   */
  async getBillingImpact(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    const currency = subscription?.currency ?? 'XOF';

    // Source centrale (BILINGUAL → config → défauts), lue en DB avec cache 60 s
    const addon = await getBilingualAddonPrice(this.prisma);
    let monthly = addon.monthly;
    let annual = addon.yearly;
    let source = addon.source;

    // Override legacy par tenant — n'entre en jeu que si AUCUNE source centrale
    // (plan BILINGUAL ou pricing_configs) n'est définie en base.
    if (
      source === 'DEFAULT' &&
      settings.pricingSupplement != null &&
      settings.pricingSupplement > 0
    ) {
      monthly = settings.pricingSupplement;
      annual = settings.pricingSupplement * 12;
      source = 'TENANT_OVERRIDE';
      this.logger.warn(
        `Bilingue ${tenantId} : tarif issu de l'override legacy pricingSupplement ` +
          `(${settings.pricingSupplement}/mois) — aucune source centrale en base. ` +
          `Créez le plan BILINGUAL (back-office) pour piloter ce tarif centralement.`,
      );
    }

    // Mois offerts en annuel (arrondi prudent vers le bas, jamais surestimé) :
    // ex. 10 000/mois → 100 000/an = 20 000 économisés = 2 mois offerts.
    const monthsFree =
      monthly && monthly > 0 && annual < monthly * 12
        ? Math.max(0, Math.floor((monthly * 12 - annual) / monthly))
        : 0;

    return { monthly, annual, monthsFree, currency, source };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ⭐ OTP pour activation bilingue
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Hash un code OTP pour stockage sécurisé (jamais en clair en DB).
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Génère un code OTP à 6 chiffres.
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * ⭐ Calcule la date d'expiration du mode bilingue.
   *    Règle : le mode bilingue expire le 31 août de l'année scolaire en cours.
   *    - Si on active entre janvier et août → expiration le 31 août de cette année
   *    - Si on active entre septembre et décembre → expiration le 31 août de l'année suivante
   *
   *    ⭐ Tenants exemptés (ex: CSPEB) : expiration à 10 ans (considérés comme toujours en règle).
   *
   *    L'école doit re-activer avec un nouveau OTP avant le 1er septembre de
   *    chaque année scolaire (rentrée).
   */
  private computeBilingualExpiry(activatedAt: Date, tenantId: string): Date {
    // ⭐ Tenants exemptés : expiration à 10 ans (considérés comme toujours en règle)
    if (OTP_EXEMPTED_TENANTS.has(tenantId)) {
      const tenYears = new Date(activatedAt);
      tenYears.setFullYear(tenYears.getFullYear() + 10);
      return tenYears;
    }
    const year = activatedAt.getFullYear();
    const month = activatedAt.getMonth(); // 0 = janvier, 8 = septembre
    // Si on est entre janvier et août (mois 0-7), expiration = 31 août de cette année
    // Si on est entre septembre et décembre (mois 8-11), expiration = 31 août de l'année suivante
    const expiryYear = month <= 7 ? year : year + 1;
    // 31 août à 23:59:59 (fin de journée)
    return new Date(expiryYear, 7, 31, 23, 59, 59, 999); // mois 7 = août (0-indexed)
  }

  /**
   * ⭐ Demande d'un code OTP pour activer le mode bilingue.
   *    Génère un code à 6 chiffres, le hash en DB, et envoie l'email à
   *    s.akpovitohou@gmail.com (YEHI OR Tech). L'école doit ensuite contacter
   *    YEHI OR Tech pour obtenir le code (après paiement).
   *
   *    Le code est valable 30 minutes (plus long que l'OTP login classique car
   *    l'école doit contacter YEHI OR Tech par téléphone/WhatsApp pour obtenir
   *    le code après paiement).
   */
  async requestActivationOtp(tenantId: string): Promise<{ sent: boolean; expiresAt: Date }> {
    const settings = await this.getSettings(tenantId);
    const code = this.generateOtpCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + BILINGUAL_OTP_VALIDITY_MINUTES * 60 * 1000);

    // Stocker le hash du code en DB
    await this.prisma.settingsBilingual.update({
      where: { tenantId },
      data: {
        ...prismaUpdateDefaults(),
        pendingOtpCode: codeHash,
        pendingOtpExpiresAt: expiresAt,
        pendingOtpAttempts: 0,
      },
    });

    // Récupérer le nom du tenant pour l'email
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const tenantName = tenant?.name || 'École non identifiée';

    // Envoyer l'email à YEHI OR Tech
    try {
      await this.emailService.sendEmail({
        to: BILINGUAL_OTP_RECIPIENT_EMAIL,
        subject: `[Academia Helm] Code OTP d'activation bilingue — ${tenantName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1e3a8a;">Demande d'activation du mode bilingue</h2>
            <p>Une école a demandé à activer le mode bilingue sur Academia Helm.</p>
            <p><strong>École :</strong> ${tenantName}</p>
            <p><strong>Tenant ID :</strong> ${tenantId}</p>
            <p>Code OTP à communiquer à l'école (après vérification du paiement) :</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e3a8a; background: #eff6ff; padding: 12px 24px; border-radius: 12px;">${code}</span>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Ce code est valable ${BILINGUAL_OTP_VALIDITY_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">Academia Helm — YEHI OR Tech</p>
          </div>
        `,
        text: `Demande d'activation bilingue — École: ${tenantName} (Tenant: ${tenantId}). Code OTP: ${code}. Valable ${BILINGUAL_OTP_VALIDITY_MINUTES} minutes.`,
      });
      this.logger.log(`[Bilingual OTP] Code sent to ${BILINGUAL_OTP_RECIPIENT_EMAIL} for tenant ${tenantId} (${tenantName})`);
      return { sent: true, expiresAt };
    } catch (err: any) {
      this.logger.error(`[Bilingual OTP] Failed to send email to ${BILINGUAL_OTP_RECIPIENT_EMAIL}: ${err.message}`, err.stack);
      throw new BadRequestException(
        `Impossible d'envoyer l'email OTP à YEHI OR Tech. Veuillez réessayer ou contacter le support. Détail: ${err.message}`,
      );
    }
  }

  /**
   * ⭐ Vérifie l'expiration du mode bilingue et le désactive si expiré.
   *    À appeler avant chaque lecture des settings bilingue (getSettings) ou
   *    avant chaque opération qui dépend du mode bilingue.
   *
   *    Si expiresAt est dans le passé ET isEnabled est true, on désactive
   *    automatiquement le mode bilingue (isEnabled = false, isExpired = true).
   *    L'école devra demander un nouveau code OTP pour ré-activer.
   */
  async checkAndApplyExpiry(tenantId: string): Promise<{ expired: boolean; expiresAt: Date | null }> {
    const settings = await this.prisma.settingsBilingual.findUnique({
      where: { tenantId },
      select: { isEnabled: true, expiresAt: true, isExpired: true },
    });
    if (!settings || !settings.isEnabled || !settings.expiresAt) {
      return { expired: false, expiresAt: settings?.expiresAt || null };
    }
    const now = new Date();
    if (settings.expiresAt > now) {
      // Pas encore expiré
      if (settings.isExpired) {
        // Réinitialiser isExpired si on a re-activé entre-temps
        await this.prisma.settingsBilingual.update({
          where: { tenantId },
          data: { ...prismaUpdateDefaults(), isExpired: false },
        });
      }
      return { expired: false, expiresAt: settings.expiresAt };
    }
    // ⭐ Expiré — désactiver le mode bilingue automatiquement
    this.logger.warn(`[Bilingual] Mode bilingue expiré pour tenant ${tenantId} (expiresAt=${settings.expiresAt.toISOString()}). Désactivation automatique.`);
    await this.prisma.settingsBilingual.update({
      where: { tenantId },
      data: {
        ...prismaUpdateDefaults(),
        isEnabled: false,
        isExpired: true,
      },
    });
    // ⭐ Aussi désactiver le feature flag BILINGUAL_TRACK
    try {
      const isEnabled = await this.tenantFeaturesService.isFeatureEnabled(
        FeatureCode.BILINGUAL_TRACK,
        tenantId,
      );
      if (isEnabled) {
        await this.tenantFeaturesService.disableFeature(
          FeatureCode.BILINGUAL_TRACK,
          tenantId,
          'system',
          'Bilingual mode expired (annual expiry on August 31)',
        );
        this.logger.log(`[Bilingual] BILINGUAL_TRACK feature flag disabled for tenant ${tenantId} due to expiry`);
      }
    } catch (syncErr: any) {
      this.logger.warn(`[Bilingual] Failed to disable BILINGUAL_TRACK feature flag on expiry: ${syncErr.message}`);
    }
    return { expired: true, expiresAt: settings.expiresAt };
  }

  /**
   * ⭐ Renvoie le statut d'expiration du mode bilingue (sans le modifier).
   *    Utilisé par le frontend pour afficher le compteur de jours restants.
   */
  async getExpiryStatus(tenantId: string): Promise<{
    isEnabled: boolean;
    isExpired: boolean;
    expiresAt: Date | null;
    daysUntilExpiry: number | null;
    otpPending: boolean;
    otpExpiresAt: Date | null;
    otpAttempts: number;
  }> {
    const settings = await this.prisma.settingsBilingual.findUnique({
      where: { tenantId },
      select: {
        isEnabled: true,
        isExpired: true,
        expiresAt: true,
        pendingOtpCode: true,
        pendingOtpExpiresAt: true,
        pendingOtpAttempts: true,
      },
    });
    if (!settings) {
      return {
        isEnabled: false,
        isExpired: false,
        expiresAt: null,
        daysUntilExpiry: null,
        otpPending: false,
        otpExpiresAt: null,
        otpAttempts: 0,
      };
    }
    let daysUntilExpiry: number | null = null;
    if (settings.expiresAt) {
      const now = new Date();
      const diffMs = settings.expiresAt.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    const otpPending = !!settings.pendingOtpCode && !!settings.pendingOtpExpiresAt && settings.pendingOtpExpiresAt > new Date();
    return {
      isEnabled: settings.isEnabled,
      isExpired: settings.isExpired,
      expiresAt: settings.expiresAt,
      daysUntilExpiry,
      otpPending,
      otpExpiresAt: settings.pendingOtpExpiresAt,
      otpAttempts: settings.pendingOtpAttempts,
    };
  }
}
