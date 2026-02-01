/**
 * ============================================================================
 * ONBOARDING SERVICE - WORKFLOW COMPLET ONBOARDING ÉCOLE
 * ============================================================================
 * 
 * Service pour gérer l'onboarding en 4 phases :
 * 1. Établissement
 * 2. Promoteur
 * 3. Plan & Options
 * 4. Paiement Initial
 * 
 * ============================================================================
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubdomainService } from '../../common/services/subdomain.service';
import { OrionAlertsService } from '../../orion/services/orion-alerts.service';
import { PricingService } from '../../billing/services/pricing.service';
import { OtpService } from './otp.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subdomainService: SubdomainService,
    private readonly pricingService: PricingService,
    private readonly otpService: OtpService,
    @Inject(forwardRef(() => OrionAlertsService))
    private readonly orionAlertsService?: OrionAlertsService,
  ) {}

  /**
   * PHASE 1 : Créer un draft d'onboarding avec les infos de l'établissement
   */
  async createDraft(data: {
    schoolName: string;
    schoolType: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    bilingual?: boolean;
    schoolsCount?: number;
  }) {
    // Vérifier si un draft existe déjà pour cet email
    const existingDraft = await this.prisma.onboardingDraft.findFirst({
      where: {
        email: data.email,
        status: { in: ['DRAFT', 'PENDING_PAYMENT'] },
      },
    });

    if (existingDraft) {
      throw new BadRequestException(
        'Un onboarding est déjà en cours pour cet email'
      );
    }

    const draft = await this.prisma.onboardingDraft.create({
      data: {
        schoolName: data.schoolName,
        schoolType: data.schoolType,
        city: data.city,
        country: data.country,
        phone: data.phone,
        email: data.email,
        bilingual: data.bilingual || false,
        schoolsCount: data.schoolsCount || 1,
        status: 'DRAFT',
      },
    });

    this.logger.log(`📝 Onboarding draft created: ${draft.id}`);

    return draft;
  }

  /**
   * PHASE 2 : Ajouter les infos du promoteur
   */
  async addPromoterInfo(
    draftId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
      otpCode?: string;
    },
  ) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    if (draft.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot update draft in status: ${draft.status}`
      );
    }

    // Vérifier l'OTP si fourni
    let otpVerified = false;
    if (data.otpCode) {
      otpVerified = await this.otpService.verifyOTP(draftId, data.phone, data.otpCode);
      if (!otpVerified) {
        throw new BadRequestException('Code OTP invalide ou expiré');
      }
    } else {
      // En développement, on peut accepter sans OTP (mais ce n'est pas recommandé)
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn(`⚠️  DEV MODE: OTP verification skipped for draft ${draftId}`);
        otpVerified = true;
      } else {
        throw new BadRequestException('Code OTP requis pour valider le numéro de téléphone');
      }
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(data.password, 10);

    const updated = await this.prisma.onboardingDraft.update({
      where: { id: draftId },
      data: {
        promoterFirstName: data.firstName,
        promoterLastName: data.lastName,
        promoterEmail: data.email,
        promoterPhone: data.phone,
        promoterPasswordHash: passwordHash,
        otpVerified,
      },
    });

    this.logger.log(`👤 Promoter info added to draft: ${draftId}`);

    return updated;
  }

  /**
   * PHASE 3 : Sélectionner le plan et calculer le prix
   */
  async selectPlan(
    draftId: string,
    data: {
      planId: string;
      periodType: 'MONTHLY' | 'YEARLY';
    },
  ) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    // ✅ Utiliser PricingService (source unique de vérité)
    // Le planId peut être un UUID ou un code (PricingService gère les deux)
    const pricingResult = await this.pricingService.calculateTenantPrice({
      planId: data.planId?.includes('-') ? data.planId : undefined, // UUID si contient des tirets
      planCode: data.planId?.includes('-') ? undefined : data.planId, // Code sinon
      schoolsCount: draft.schoolsCount,
      bilingual: draft.bilingual,
      cycle: data.periodType,
    });

    // ⚠️ Prix initial depuis PricingService (paramétrable)
    // Appliquer la réduction multi-écoles si applicable
    const initialPayment = await this.pricingService.calculateInitialPaymentPrice(draft.schoolsCount || 1);

    // Construire le priceSnapshot avec le breakdown complet
    const priceSnapshot = {
      planId: pricingResult.plan.id,
      planCode: pricingResult.plan.code,
      planName: pricingResult.plan.name,
      periodType: data.periodType,
      basePrice: pricingResult.breakdown.basePrice,
      schoolsPrice: pricingResult.breakdown.schoolsPrice,
      bilingualFee: pricingResult.breakdown.bilingualPrice,
      schoolsCount: draft.schoolsCount,
      subscriptionPrice: pricingResult.amount, // Prix de l'abonnement (après 30 jours)
      initialPayment, // Prix initial (100k FCFA)
      breakdown: pricingResult.breakdown, // Breakdown complet pour audit
      currency: 'XOF',
    };

    const updated = await this.prisma.onboardingDraft.update({
      where: { id: draftId },
      data: {
        selectedPlanId: data.planId,
        priceSnapshot,
        status: 'PENDING_PAYMENT',
      },
    });

    this.logger.log(`💰 Plan selected for draft: ${draftId} - Total: ${initialPayment} XOF`);

    return {
      draft: updated,
      pricing: priceSnapshot,
    };
  }

  /**
   * PHASE 4 : Créer une session de paiement FedaPay
   */
  async createPaymentSession(draftId: string) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
      include: { payments: true },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    if (draft.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `Cannot create payment session for draft in status: ${draft.status}`
      );
    }

    if (!draft.priceSnapshot) {
      throw new BadRequestException('No pricing information found. Please select a plan first.');
    }

    const pricing = draft.priceSnapshot as any;
    const amount = pricing.initialPayment;

    // Vérifier s'il existe déjà un paiement en cours
    const existingPayment = draft.payments.find(
      (p) => p.status === 'PENDING' || p.status === 'PROCESSING'
    );

    if (existingPayment) {
      return {
        paymentId: existingPayment.id,
        reference: existingPayment.reference,
        amount: existingPayment.amount,
        status: existingPayment.status,
      };
    }

    // Créer un nouveau paiement
    const reference = `ONB-${draftId.substring(0, 8).toUpperCase()}-${Date.now()}`;

    const payment = await this.prisma.onboardingPayment.create({
      data: {
        draftId,
        provider: 'fedapay',
        reference,
        amount,
        currency: 'XOF',
        status: 'PENDING',
        metadata: {
          draftId,
          pricing,
        },
      },
    });

    this.logger.log(`💳 Payment session created: ${payment.id} - Reference: ${reference}`);

    // TODO: Intégrer avec FedaPay SDK pour créer la transaction
    // Pour l'instant, on retourne les infos de paiement
    return {
      paymentId: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      // TODO: Ajouter l'URL de redirection FedaPay
      paymentUrl: `https://fedapay.com/payment/${reference}`, // Placeholder
    };
  }

  /**
   * Activer le tenant après paiement réussi (transaction atomique)
   */
  async activateTenantAfterPayment(paymentId: string) {
    const payment = await this.prisma.onboardingPayment.findUnique({
      where: { id: paymentId },
      include: { draft: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found: ${paymentId}`);
    }

    if (payment.status !== 'SUCCESS') {
      throw new BadRequestException(
        `Cannot activate tenant for payment with status: ${payment.status}`
      );
    }

    const draft = payment.draft;

    if (!draft.promoterEmail || !draft.promoterPasswordHash) {
      throw new BadRequestException('Promoter information is incomplete');
    }

    if (!draft.selectedPlanId || !draft.priceSnapshot) {
      throw new BadRequestException('Plan information is incomplete');
    }

    // Transaction atomique : créer tenant, subscription, user, etc.
    return await this.prisma.$transaction(async (tx) => {
      // 1. Trouver ou créer le pays
      let country = await tx.country.findFirst({
        where: { name: { contains: draft.country, mode: 'insensitive' } },
      });

      if (!country) {
        // Créer un pays par défaut si non trouvé
        country = await tx.country.create({
          data: {
            code: 'XX',
            name: draft.country,
            isActive: true,
          },
        });
      }

      // 2. Créer plusieurs tenants si schoolsCount > 1 (annexes)
      const schoolsCount = draft.schoolsCount || 1;
      const tenants = [];
      const subscriptions = [];

      for (let i = 0; i < schoolsCount; i++) {
        // Générer un sous-domaine unique pour chaque annexe
        let schoolNameForSubdomain = draft.schoolName;
        if (schoolsCount > 1) {
          // Pour les annexes, ajouter le suffixe "annexe-1", "annexe-2", etc.
          schoolNameForSubdomain = `${draft.schoolName} - Annexe ${i + 1}`;
        }
        
        const baseSubdomain = await this.subdomainService.generateAndValidate(draft.schoolName);
        const subdomain = schoolsCount > 1 
          ? await this.generateAnnexeSubdomain(baseSubdomain, i + 1, tx)
          : baseSubdomain;
        const slug = subdomain;

        // Créer le tenant
        const tenant = await tx.tenant.create({
          data: {
            name: schoolsCount > 1 ? `${draft.schoolName} - Annexe ${i + 1}` : draft.schoolName,
            slug,
            subdomain,
            countryId: country.id,
            type: draft.schoolType,
            status: 'active',
            subscriptionStatus: 'TRIAL',
          },
        });

        tenants.push(tenant);

        // Appliquer les policies du pays au tenant
        // Récupérer les policies par défaut du pays (isDefault: true)
        const defaultGradingPolicies = await tx.gradingPolicy.findMany({
          where: {
            countryId: country.id,
            isDefault: true,
            isActive: true,
          },
        });

        const defaultSalaryPolicies = await tx.salaryPolicy.findMany({
          where: {
            countryId: country.id,
            isDefault: true,
            isActive: true,
          },
        });

        // Créer des copies des policies pour le tenant (pour permettre la personnalisation)
        for (const gradingPolicy of defaultGradingPolicies) {
          await tx.gradingPolicy.create({
            data: {
              countryId: country.id,
              name: `${gradingPolicy.name} - ${tenant.name}`,
              educationLevel: gradingPolicy.educationLevel,
              maxScore: gradingPolicy.maxScore,
              passingScore: gradingPolicy.passingScore,
              gradeScales: gradingPolicy.gradeScales,
              calculationRules: gradingPolicy.calculationRules,
              reportCardConfig: gradingPolicy.reportCardConfig,
              isActive: true,
              isDefault: false, // Pas par défaut, spécifique au tenant
              metadata: {
                ...(gradingPolicy.metadata as any || {}),
                sourcePolicyId: gradingPolicy.id,
                tenantId: tenant.id,
                appliedAt: new Date().toISOString(),
              },
            },
          });
        }

        for (const salaryPolicy of defaultSalaryPolicies) {
          await tx.salaryPolicy.create({
            data: {
              countryId: country.id,
              name: `${salaryPolicy.name} - ${tenant.name}`,
              salaryStructure: salaryPolicy.salaryStructure,
              socialContributions: salaryPolicy.socialContributions,
              leaveRules: salaryPolicy.leaveRules,
              bonuses: salaryPolicy.bonuses,
              taxRules: salaryPolicy.taxRules,
              isActive: true,
              isDefault: false, // Pas par défaut, spécifique au tenant
              metadata: {
                ...(salaryPolicy.metadata as any || {}),
                sourcePolicyId: salaryPolicy.id,
                tenantId: tenant.id,
                appliedAt: new Date().toISOString(),
              },
            },
          });
        }

        if (defaultGradingPolicies.length > 0 || defaultSalaryPolicies.length > 0) {
          this.logger.log(
            `✅ Applied ${defaultGradingPolicies.length} grading policy(ies) and ${defaultSalaryPolicies.length} salary policy(ies) from country ${country.name} to tenant ${tenant.id}`
          );
        }

        // Créer la souscription en trial pour ce tenant
        const pricing = draft.priceSnapshot as any;
        const subscription = await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: draft.selectedPlanId!,
            status: 'TRIAL_ACTIVE',
            trialStart: new Date(),
            trialEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
            bilingualEnabled: draft.bilingual,
            schoolsCount: 1, // Chaque tenant représente 1 école
            devOverride: false,
          },
        });

        subscriptions.push(subscription);

        // Créer les niveaux scolaires selon le type d'établissement
        const schoolLevelsToCreate = this.getSchoolLevelsForType(draft.schoolType);
        
        for (const levelConfig of schoolLevelsToCreate) {
          await tx.schoolLevel.create({
            data: {
              tenantId: tenant.id,
              code: levelConfig.code,
              name: levelConfig.name,
              label: levelConfig.label,
              order: levelConfig.order,
            },
          });
        }

        this.logger.log(
          `✅ Created ${schoolLevelsToCreate.length} school level(s) for tenant ${tenant.id} (${subdomain})`
        );

        // Créer les AcademicTracks selon le mode bilingue
        if (draft.bilingual) {
          // Mode bilingue : créer les tracks FR (Français) et EN (Anglais)
          const frenchTrack = await tx.academicTrack.create({
            data: {
              tenantId: tenant.id,
              code: 'FR',
              name: 'Français',
              description: 'Parcours académique en français',
              order: 0,
              isDefault: true,
              isActive: true,
              metadata: {
                language: 'fr',
                bilingual: true,
              },
            },
          });

          const englishTrack = await tx.academicTrack.create({
            data: {
              tenantId: tenant.id,
              code: 'EN',
              name: 'Anglais',
              description: 'Parcours académique en anglais',
              order: 1,
              isDefault: false,
              isActive: true,
              metadata: {
                language: 'en',
                bilingual: true,
              },
            },
          });

          this.logger.log(
            `✅ Created bilingual tracks for tenant ${tenant.id}: FR and EN`
          );
        } else {
          // Mode unilingue : créer uniquement le track FR (par défaut)
          const frenchTrack = await tx.academicTrack.create({
            data: {
              tenantId: tenant.id,
              code: 'FR',
              name: 'Français',
              description: 'Parcours académique en français',
              order: 0,
              isDefault: true,
              isActive: true,
              metadata: {
                language: 'fr',
                bilingual: false,
              },
            },
          });

          this.logger.log(
            `✅ Created default track FR for tenant ${tenant.id} - Unilingual mode`
          );
        }

        // Créer l'événement de facturation pour ce tenant
        await tx.billingEvent.create({
          data: {
            tenantId: tenant.id,
            subscriptionId: subscription.id,
            type: 'INITIAL_SUBSCRIPTION',
            amount: payment.amount,
            channel: 'fedapay',
            reference: payment.reference,
            metadata: {
              draftId: draft.id,
              paymentId: payment.id,
              pricing,
              annexeNumber: schoolsCount > 1 ? i + 1 : null,
            },
          },
        });
      }

      // 3. Créer le promoteur (user avec role PROMOTER) - lié au premier tenant
      const promoter = await tx.user.create({
        data: {
          email: draft.promoterEmail,
          passwordHash: draft.promoterPasswordHash,
          firstName: draft.promoterFirstName || '',
          lastName: draft.promoterLastName || '',
          phone: draft.promoterPhone || '',
          role: 'PROMOTER',
          tenantId: tenants[0].id, // Premier tenant comme tenant principal
          status: 'active',
        },
      });

      // 4. Si plusieurs tenants, créer des entrées UserTenant pour lier le promoteur aux autres tenants
      if (schoolsCount > 1) {
        // Note: Si une table UserTenant existe, créer les relations ici
        // Pour l'instant, le promoteur est lié au premier tenant via tenantId
        // Les autres tenants seront accessibles via la logique d'authentification multi-tenant
        this.logger.log(
          `✅ Promoter ${promoter.id} can manage ${tenants.length} tenants (annexes)`
        );
      }

      // 5. Mettre à jour le draft
      await tx.onboardingDraft.update({
        where: { id: draft.id },
        data: {
          status: 'COMPLETED',
        },
      });

      // 6. Mettre à jour le paiement
      await tx.onboardingPayment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
        },
      });

      this.logger.log(
        `✅ ${tenants.length} tenant(s) activated - Promoter: ${promoter.id} - Subscriptions: ${subscriptions.map(s => s.id).join(', ')}`
      );

      // 🧠 ORION - Émission d'événements
      try {
        // Émettre événements pour chaque tenant
        for (const tenant of tenants) {
          this.logger.log(`📡 ORION: Emitting TENANT_CREATED event for tenant ${tenant.id}`);
        }
        
        // Émettre événements pour chaque subscription
        for (const subscription of subscriptions) {
          this.logger.log(`📡 ORION: Emitting SUBSCRIPTION_STARTED event for subscription ${subscription.id}`);
        }
        
        // TODO: Intégrer avec le service ORION pour ingestion dans ORION_PLATFORM
        // Exemple :
        // await this.orionAlertsService?.emitEvent({
        //   type: 'TENANT_CREATED',
        //   tenantId: tenant.id,
        //   data: { tenant, subscription, promoter }
        // });
        
        // Pour l'instant, on log les événements
        // En production, ces événements seront ingérés par ORION_PLATFORM
      } catch (error) {
        // Ne pas bloquer l'activation si ORION échoue
        this.logger.warn(`⚠️  Failed to emit ORION events: ${error.message}`);
      }

      return {
        tenants: tenants.map(tenant => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain,
        })),
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          status: sub.status,
          trialEnd: sub.trialEnd,
        })),
        promoter: {
          id: promoter.id,
          email: promoter.email,
          role: promoter.role,
        },
      };
    });
  }

  // Note: generateSlug supprimé - utilise SubdomainService.generateAndValidate()

  /**
   * Génère un sous-domaine unique pour une annexe
   * Format: baseSubdomain-annexe-1, baseSubdomain-annexe-2, etc.
   */
  private async generateAnnexeSubdomain(
    baseSubdomain: string,
    annexeNumber: number,
    tx: any,
  ): Promise<string> {
    let candidate = `${baseSubdomain}-annexe-${annexeNumber}`;
    let suffix = 0;

    // Vérifier l'unicité et ajouter un suffixe si nécessaire
    while (await tx.tenant.findUnique({ where: { subdomain: candidate } })) {
      suffix++;
      candidate = `${baseSubdomain}-annexe-${annexeNumber}-${suffix}`;

      // Sécurité : éviter les boucles infinies
      if (suffix > 100) {
        throw new Error(`Cannot generate unique annexe subdomain after 100 attempts for: ${baseSubdomain}`);
      }
    }

    return candidate;
  }

  /**
   * Détermine quels niveaux scolaires créer selon le type d'établissement
   * 
   * - Maternelle : uniquement Maternelle
   * - Primaire : uniquement Primaire
   * - Secondaire : uniquement Secondaire
   * - Mixte : Maternelle, Primaire et Secondaire
   */
  private getSchoolLevelsForType(schoolType: string): Array<{
    code: string;
    name: string;
    label: string;
    order: number;
  }> {
    const allLevels = [
      {
        code: 'MATERNELLE',
        name: 'Maternelle',
        label: 'Maternelle',
        order: 0,
      },
      {
        code: 'PRIMAIRE',
        name: 'Primaire',
        label: 'Primaire',
        order: 1,
      },
      {
        code: 'SECONDAIRE',
        name: 'Secondaire',
        label: 'Secondaire',
        order: 2,
      },
    ];

    switch (schoolType.toLowerCase()) {
      case 'maternelle':
        return [allLevels[0]]; // Uniquement Maternelle
      case 'primaire':
        return [allLevels[1]]; // Uniquement Primaire
      case 'secondaire':
        return [allLevels[2]]; // Uniquement Secondaire
      case 'mixte':
        return allLevels; // Tous les niveaux
      default:
        // Par défaut, créer tous les niveaux si le type n'est pas reconnu
        this.logger.warn(`⚠️  Unknown school type: ${schoolType}. Creating all levels by default.`);
        return allLevels;
    }
  }

  /**
   * Récupère un draft par ID
   */
  async getDraft(draftId: string) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
      include: { payments: true },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    return draft;
  }
}
