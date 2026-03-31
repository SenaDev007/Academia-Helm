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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SubdomainService } from '../../common/services/subdomain.service';
import { OrionAlertsService } from '../../orion/services/orion-alerts.service';
import { PricingService } from '../../billing/services/pricing.service';
import { OtpService } from './otp.service';
import { DRAFT_EXPIRY_HOURS } from './draft-cleanup.service';
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
    @Inject(forwardRef(() => {
      // Import dynamique pour éviter la dépendance circulaire
      const { FedaPayService } = require('../../billing/services/fedapay.service');
      return FedaPayService;
    }))
    private readonly fedapayService: any, // Type 'any' temporaire pour éviter l'erreur de référence circulaire
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
    preferredSubdomain?: string;
  }) {
    // Vérifier si un draft existe déjà pour cet email
    const existingDraft = await this.prisma.onboardingDraft.findFirst({
      where: {
        email: data.email,
        status: { in: ['DRAFT', 'PENDING_PAYMENT'] },
      },
    });

    if (existingDraft) {
      const errorResponse = {
        message: 'Un onboarding est déjà en cours pour cet email',
        existingDraftId: existingDraft.id,
        status: existingDraft.status,
        hint: 'Pour recommencer : annulez le draft en cours (POST /api/onboarding/draft/:draftId/cancel avec ce existingDraftId) puis recréez un draft.',
      };
      throw new BadRequestException(errorResponse);
    }

    let preferredSubdomain: string | null = null;
    if (data.preferredSubdomain != null && String(data.preferredSubdomain).trim() !== '') {
      const raw = String(data.preferredSubdomain).trim().toLowerCase();
      const validation = this.subdomainService.validateSubdomain(raw);
      if (!validation.valid) {
        throw new BadRequestException(validation.error || 'Sous-domaine invalide');
      }
      const exists = await this.subdomainService.subdomainExists(raw);
      if (exists) {
        throw new BadRequestException('Ce sous-domaine est déjà utilisé. Choisissez-en un autre.');
      }
      preferredSubdomain = raw;
    }

    try {
      const draft = await this.prisma.onboardingDraft.create({
        data: {
          schoolName: data.schoolName,
          schoolType: data.schoolType,
          city: data.city,
          country: data.country,
          phone: data.phone,
          email: data.email,
          bilingual: data.bilingual || false,
          schoolsCount: data.schoolsCount ?? 1,
          preferredSubdomain,
          status: 'DRAFT',
        },
      });

      this.logger.log(`📝 Onboarding draft created: ${draft.id}` + (preferredSubdomain ? ` (sous-domaine: ${preferredSubdomain})` : ''));

      return draft;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new BadRequestException('Une contrainte d\'unicité est violée (email ou sous-domaine peut-être déjà utilisé).');
        }
        if (err.code === 'P2003') {
          throw new BadRequestException('Référence invalide (clé étrangère).');
        }
      }
      this.logger.error(`createDraft Prisma error: ${err?.message}`, err?.stack);
      throw err;
    }
  }

  /**
   * Annule un draft (DRAFT ou PENDING_PAYMENT) pour permettre de recommencer avec le même email.
   * Impossible si un paiement est déjà COMPLETED.
   */
  async cancelDraft(draftId: string) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
      include: { payments: true },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    if (draft.status !== 'DRAFT' && draft.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `Impossible d'annuler un draft en statut ${draft.status}. Seuls DRAFT ou PENDING_PAYMENT peuvent être annulés.`
      );
    }

    const hasCompletedPayment = draft.payments.some((p) => p.status === 'COMPLETED' || p.status === 'SUCCESS');
    if (hasCompletedPayment) {
      throw new BadRequestException(
        'Impossible d\'annuler ce draft : un paiement a déjà été validé. Contactez le support si besoin.'
      );
    }

    await this.prisma.onboardingDraft.update({
      where: { id: draftId },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`📋 Draft ${draftId} cancelled (email: ${draft.email})`);
    return { success: true, message: 'Draft annulé. Vous pouvez recommencer un nouvel onboarding avec le même email.' };
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

    // Permettre la mise à jour si le draft est en DRAFT ou PENDING_PAYMENT
    // L'utilisateur peut revenir en arrière pour corriger ses informations avant de payer
    if (draft.status !== 'DRAFT' && draft.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `Cannot update draft in status: ${draft.status}. Only DRAFT or PENDING_PAYMENT drafts can be updated.`
      );
    }

    // Normaliser le numéro de téléphone avant la vérification OTP
    // Utiliser la même logique de normalisation que dans OtpService
    const normalizePhoneForOTP = (phone: string): string => {
      if (!phone) return '';
      let normalized = phone.replace(/\s+/g, '').trim();
      if (!normalized.startsWith('+')) {
        normalized = '+' + normalized;
      }
      normalized = normalized.replace(/[^\d+]/g, '');
      normalized = '+' + normalized.replace(/^\+/, '').replace(/\+/g, '');
      
      // Pour le Bénin (+229) : retirer le "01" initial si présent
      if (normalized.startsWith('+22901')) {
        normalized = '+229' + normalized.substring(6);
      }
      
      return normalized;
    };
    
    const normalizedPhone = normalizePhoneForOTP(data.phone);

    // Vérifier l'OTP si fourni
    let otpVerified = false;
    if (data.otpCode) {
      // D'abord, vérifier si un OTP a déjà été vérifié pour ce draft et ce téléphone (normalisé)
      const hasValidOTP = await this.otpService.hasValidOTP(draftId, normalizedPhone);
      if (hasValidOTP) {
        // L'OTP a déjà été vérifié via l'endpoint /otp/verify
        otpVerified = true;
        this.logger.log(`✅ OTP already verified for draft ${draftId} - Phone: ${normalizedPhone} (original: ${data.phone})`);
      } else {
        // Sinon, vérifier l'OTP fourni avec le numéro normalisé
        otpVerified = await this.otpService.verifyOTP(draftId, normalizedPhone, data.otpCode);
        if (!otpVerified) {
          throw new BadRequestException('Code OTP invalide ou expiré');
        }
      }
    } else {
      // Si aucun code OTP n'est fourni, vérifier si un OTP a déjà été vérifié (avec le numéro normalisé)
      const hasValidOTP = await this.otpService.hasValidOTP(draftId, normalizedPhone);
      if (hasValidOTP) {
        otpVerified = true;
        this.logger.log(`✅ Using previously verified OTP for draft ${draftId} - Phone: ${normalizedPhone} (original: ${data.phone})`);
      } else {
        // En développement, on peut accepter sans OTP (mais ce n'est pas recommandé)
        if (process.env.NODE_ENV === 'development') {
          this.logger.warn(`⚠️  DEV MODE: OTP verification skipped for draft ${draftId}`);
          otpVerified = true;
        } else {
          throw new BadRequestException('Code OTP requis pour valider le numéro de téléphone');
        }
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
        promoterPhone: normalizedPhone, // Stocker le numéro normalisé
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
      breakdown: pricingResult.breakdown as unknown as Prisma.InputJsonValue, // Breakdown complet pour audit
      currency: 'XOF',
    };

    const updated = await this.prisma.onboardingDraft.update({
      where: { id: draftId },
      data: {
        selectedPlanId: data.planId,
        priceSnapshot: priceSnapshot as unknown as Prisma.InputJsonValue,
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
    // Déléguer à FedaPayService qui gère la création complète de la transaction
    // avec support du checkout intégré
    return this.fedapayService.createOnboardingPaymentSession(draftId);
  }

  /**
   * Vérifie le statut d'un paiement
   * 
   * ⚠️ CRITIQUE : Cette méthode vérifie le statut réel depuis FedaPay
   * et enregistre le résultat dans la base de données
   * 
   * Le frontend ne doit JAMAIS faire confiance au callback onComplete.
   * Il doit toujours appeler cet endpoint pour vérifier le statut.
   */
  async verifyPaymentStatus(paymentId: string) {
    // Récupérer le paiement
    const payment = await this.prisma.onboardingPayment.findUnique({
      where: { id: paymentId },
      include: { draft: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found: ${paymentId}`);
    }

    // Récupérer le transactionId depuis les métadonnées
    const metadata = payment.metadata as any;
    const transactionId = metadata?.transactionId;

    if (!transactionId) {
      throw new BadRequestException('Transaction ID not found in payment metadata');
    }

    // Vérifier le statut via FedaPay API
    const verification = await this.fedapayService.verifyTransactionStatus(transactionId);

    // Recharger le paiement (après possible activation du tenant dans verifyTransactionStatus)
    const updatedPayment = await this.prisma.onboardingPayment.findUnique({
      where: { id: paymentId },
    });

    const mergedMeta = (updatedPayment?.metadata || payment.metadata) as Record<string, unknown> | null;

    return {
      paymentId: payment.id,
      status: updatedPayment?.status || payment.status,
      amount: payment.amount,
      verified: verification.verified,
      transactionStatus: verification.status,
      draftId: payment.draftId,
      tenantActivated: updatedPayment?.status === 'SUCCESS',
      firstTenantSubdomain: mergedMeta?.firstTenantSubdomain as string | undefined,
    };
  }

  /**
   * Activer le tenant après paiement réussi (transaction atomique).
   * Accepte les statuts COMPLETED (après webhook/vérification FedaPay) et SUCCESS (idempotence).
   */
  async activateTenantAfterPayment(paymentId: string) {
    const payment = await this.prisma.onboardingPayment.findUnique({
      where: { id: paymentId },
      include: { draft: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found: ${paymentId}`);
    }

    // Idempotence : déjà activé
    if (payment.status === 'SUCCESS') {
      this.logger.log(`✅ Tenant already activated for payment ${paymentId}`);
      return { alreadyActivated: true };
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Cannot activate tenant for payment with status: ${payment.status}. Expected COMPLETED or SUCCESS.`
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
      const periodType = ((draft.priceSnapshot as any)?.periodType as 'MONTHLY' | 'YEARLY') || 'MONTHLY';

      // Sous-domaine du premier tenant : préférer celui choisi par l'utilisateur si valide et disponible
      let firstTenantSubdomain: string;
      if (draft.preferredSubdomain) {
        const validation = this.subdomainService.validateSubdomain(draft.preferredSubdomain);
        if (!validation.valid) {
          throw new BadRequestException(`Sous-domaine invalide: ${validation.error}`);
        }
        const existing = await tx.tenant.findUnique({ where: { subdomain: draft.preferredSubdomain } });
        if (existing) {
          throw new BadRequestException('Ce sous-domaine est déjà utilisé. Un nouvel onboarding avec un autre sous-domaine est nécessaire.');
        }
        firstTenantSubdomain = draft.preferredSubdomain;
      } else {
        firstTenantSubdomain = await this.subdomainService.generateAndValidate(draft.schoolName);
      }

      for (let i = 0; i < schoolsCount; i++) {
        let schoolNameForSubdomain = draft.schoolName;
        if (schoolsCount > 1) {
          schoolNameForSubdomain = `${draft.schoolName} - Annexe ${i + 1}`;
        }

        const subdomain = schoolsCount > 1
          ? await this.generateAnnexeSubdomain(firstTenantSubdomain, i + 1, tx)
          : firstTenantSubdomain;
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
        const trialStart = new Date();
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 30);
        const subscription = await tx.subscription.create({
          data: {
            tenant: { connect: { id: tenant.id } },
            subscriptionPlan: { connect: { id: draft.selectedPlanId! } },
            plan: (pricing?.planCode as string) || 'UNKNOWN',
            status: 'TRIAL_ACTIVE',
            startDate: trialStart,
            trialStart,
            trialEnd, // 30 jours
            amount: Number(payment.amount) || 0,
            currency: 'XOF',
            billingCycle: periodType === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
            autoRenew: true,
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

      // 6. Mettre à jour le paiement (statut SUCCESS + sous-domaine pour la redirection)
      const paymentMeta = (payment.metadata as Record<string, unknown>) || {};
      await tx.onboardingPayment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          metadata: {
            ...paymentMeta,
            firstTenantSubdomain: tenants[0].subdomain,
          },
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
   * Vérifie si un draft existe pour un email
   * Supprime automatiquement les drafts expirés (après DRAFT_EXPIRY_HOURS)
   */
  async checkDraftByEmail(email: string) {
    await this.deleteExpiredDraftsForEmail(email);

    const existingDraft = await this.prisma.onboardingDraft.findFirst({
      where: {
        email,
        status: { in: ['DRAFT', 'PENDING_PAYMENT'] },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return existingDraft;
  }

  /**
   * Supprime les drafts expirés (après DRAFT_EXPIRY_HOURS) pour un email
   */
  private async deleteExpiredDraftsForEmail(email: string) {
    const expiryThreshold = new Date();
    expiryThreshold.setHours(expiryThreshold.getHours() - DRAFT_EXPIRY_HOURS);

    const deleted = await this.prisma.onboardingDraft.deleteMany({
      where: {
        email,
        createdAt: { lt: expiryThreshold },
        status: { in: ['DRAFT', 'PENDING_PAYMENT'] },
      },
    });

    if (deleted.count > 0) {
      this.logger.log(`🗑️  Deleted ${deleted.count} expired draft(s) for email: ${email}`);
    }
  }

  /**
   * Récupère un draft par ID
   * Supprime et renvoie une erreur si le draft est expiré (après DRAFT_EXPIRY_HOURS)
   */
  async getDraft(draftId: string) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
      include: { payments: true },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    const expiryThreshold = new Date();
    expiryThreshold.setHours(expiryThreshold.getHours() - DRAFT_EXPIRY_HOURS);

    if (draft.createdAt < expiryThreshold && draft.status !== 'COMPLETED') {
      await this.deleteDraft(draftId);
      throw new NotFoundException(`Onboarding draft expired and has been deleted: ${draftId}`);
    }

    return draft;
  }

  /**
   * Supprime un draft
   */
  async deleteDraft(draftId: string) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    // Supprimer le draft et toutes ses relations
    await this.prisma.onboardingDraft.delete({
      where: { id: draftId },
    });

    this.logger.log(`🗑️  Onboarding draft deleted: ${draftId}`);

    return {
      message: 'Draft supprimé avec succès',
      draftId,
    };
  }
}
