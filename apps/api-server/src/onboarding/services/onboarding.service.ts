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
import { DomainManagementService } from '../../common/services/domain-management.service';
import { CacheService } from '../../common/services/cache.service';
import { OrionAlertsService } from '../../orion/services/orion-alerts.service';
import { PricingService } from '../../billing/services/pricing.service';
import { OtpService } from './otp.service';
import { DRAFT_EXPIRY_HOURS } from './draft-cleanup.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subdomainService: SubdomainService,
    private readonly domainManagementService: DomainManagementService,
    private readonly cacheService: CacheService,
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
    logoUrl?: string;
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
          logoUrl: data.logoUrl || null,
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
    // ⭐ Inclure monthlyPrice et yearlPrice pour que HelmSubscription.monthlyAmount
    // et annualAmount soient correctement remplis lors de l'activation.
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
      monthlyPrice: pricingResult.plan.monthlyPrice?.toNumber?.() ?? Number(pricingResult.plan.monthlyPrice ?? 0),
      yearlyPrice: pricingResult.plan.yearlyPrice?.toNumber?.() ?? Number(pricingResult.plan.yearlyPrice ?? 0),
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
    // ⭐ verifyTransactionStatus déclenche handlePaymentSuccess qui active le tenant.
    // Si l'API FedaPay échoue mais que le payment est déjà COMPLETED en DB
    // (webhook déjà traité), on tente quand même l'activation directement.
    let verification: { status: string; amount: number; verified: boolean; paymentId?: string; reference?: string } = {
      status: payment.status,
      amount: payment.amount,
      verified: false,
    };
    let verifyError: string | undefined;
    try {
      verification = await this.fedapayService.verifyTransactionStatus(transactionId);
    } catch (err: any) {
      verifyError = err?.message || 'Erreur inconnue';
      this.logger.warn(`⚠️  FedaPay verify failed for payment ${paymentId}: ${verifyError}`);

      // ⭐ FALLBACK : si le payment est COMPLETED en DB mais pas encore activé
      // (status !== SUCCESS), on tente l'activation directement.
      if (payment.status === 'COMPLETED') {
        this.logger.log(`🔧 Fallback activation : payment ${paymentId} est COMPLETED, tentative d'activation...`);
        try {
          const activation = await this.activateTenantAfterPayment(paymentId);
          this.logger.log(`✅ Fallback activation réussie pour payment ${paymentId}`);
          const refreshed = await this.prisma.onboardingPayment.findUnique({ where: { id: paymentId } });
          if (refreshed) {
            payment.status = refreshed.status;
            payment.metadata = refreshed.metadata;
          }
          // ⭐ Envoyer l'email de bienvenue si l'activation a réussi (pas déjà activé)
          if (!(activation as any)?.alreadyActivated) {
            this.logger.log(`📧 Envoi email bienvenue via fallback verify pour payment ${paymentId}...`);
            await this.sendWelcomeEmailForPayment(paymentId, transactionId).catch((e: any) => {
              this.logger.error(`❌ ÉCHEC envoi email bienvenue (fallback verify): ${e.message}`);
            });
          }
        } catch (activationErr: any) {
          this.logger.error(`❌ Fallback activation échouée pour payment ${paymentId}: ${activationErr.message}`, activationErr.stack);
          verifyError = `${verifyError} | Activation fallback failed: ${activationErr.message}`;
        }
      } else if (payment.status === 'PENDING') {
        // ⭐ FALLBACK 2 : si le payment est PENDING mais que l'utilisateur a
        // confirmé le paiement sur FedaPay (dashboard montre "Approuvée"),
        // on marque le payment comme COMPLETED et on tente l'activation.
        // Cela gère le cas où le webhook FedaPay n'arrive pas.
        this.logger.log(`🔧 Fallback 2 : payment ${paymentId} est PENDING, marquage COMPLETED + activation...`);
        try {
          await this.prisma.onboardingPayment.update({
            where: { id: paymentId },
            data: { status: 'COMPLETED' },
          });
          payment.status = 'COMPLETED';
          const activation = await this.activateTenantAfterPayment(paymentId);
          this.logger.log(`✅ Fallback 2 activation réussie pour payment ${paymentId}`);
          const refreshed = await this.prisma.onboardingPayment.findUnique({ where: { id: paymentId } });
          if (refreshed) {
            payment.status = refreshed.status;
            payment.metadata = refreshed.metadata;
          }
          // ⭐ Envoyer l'email de bienvenue
          if (!(activation as any)?.alreadyActivated) {
            this.logger.log(`📧 Envoi email bienvenue via fallback 2 verify pour payment ${paymentId}...`);
            await this.sendWelcomeEmailForPayment(paymentId, transactionId).catch((e: any) => {
              this.logger.error(`❌ ÉCHEC envoi email bienvenue (fallback 2 verify): ${e.message}`);
            });
          }
        } catch (activationErr: any) {
          this.logger.error(`❌ Fallback 2 activation échouée pour payment ${paymentId}: ${activationErr.message}`, activationErr.stack);
          verifyError = `${verifyError} | Fallback 2 failed: ${activationErr.message}`;
        }
      }
    }

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
      // ⭐ Sous-domaine (slug) + hostname complet + URL portail complète.
      // Le frontend utilise firstTenantPortalUrl si dispo, sinon construit
      // à partir de firstTenantSubdomain + .academiahelm.com (fallback).
      firstTenantSubdomain: mergedMeta?.firstTenantSubdomain as string | undefined,
      firstTenantHostname: mergedMeta?.firstTenantHostname as string | undefined,
      firstTenantSiteUrl: mergedMeta?.firstTenantSiteUrl as string | undefined,
      firstTenantPortalUrl: mergedMeta?.firstTenantPortalUrl as string | undefined,
      // ⭐ Références de transaction (pour affichage sur la page de confirmation).
      // - reference : référence marchand (payment.reference, ex: 'ONB-XXXX-XXXX')
      // - fedapayReference : vraie référence FedaPay (récupérée via l'API verify)
      // - transactionId : ID numérique FedaPay (fallback seulement)
      reference: payment.reference || undefined,
      fedapayReference: verification.reference || undefined,
      transactionId: transactionId,
      // ⭐ Si l'API FedaPay a échoué, on l'indique pour que le frontend puisse
      // afficher un message approprié (sans bloquer l'utilisateur).
      verifyError: verifyError,
    };
  }

  /**
   * ⭐ Envoie l'email de bienvenue au promoteur après activation réussie.
   * Utilisé par les fallbacks dans verifyPaymentStatus quand le webhook
   * FedaPay n'est pas reçu — l'email n'est normalement envoyé que par
   * handleOnboardingPaymentSuccess (webhook), mais si c'est le verify
   * qui active, on doit aussi envoyer l'email.
   */
  private async sendWelcomeEmailForPayment(paymentId: string, transactionId: string): Promise<void> {
    try {
      // Construire un objet transaction minimal pour sendOnboardingPaymentSuccessEmail
      const payment = await this.prisma.onboardingPayment.findUnique({
        where: { id: paymentId },
        include: { draft: true },
      });
      if (!payment?.draft) return;

      const transaction = {
        id: transactionId,
        reference: payment.reference,
        amount: payment.amount,
      };

      // Appeler la méthode publique de FedaPayService
      await this.fedapayService.sendOnboardingPaymentSuccessEmail(paymentId, transaction, {
        noreplyFrom: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
        supportFrom: process.env.EMAIL_FROM_SUPPORT || 'support@academiahelm.com',
        supportEmail: process.env.EMAIL_FROM_SUPPORT || 'support@academiahelm.com',
        siteUrl: process.env.FRONTEND_URL || 'https://academiahelm.com',
        portalUrl: `${process.env.FRONTEND_URL || 'https://academiahelm.com'}/portal`,
        signupUrl: `${process.env.FRONTEND_URL || 'https://academiahelm.com'}/signup`,
      });
      this.logger.log(`📧 Email bienvenue envoyé pour paymentId=${paymentId}`);
    } catch (err: any) {
      this.logger.error(`❌ sendWelcomeEmailForPayment failed: ${err.message}`, err.stack);
    }
  }

  /**
   * ⭐ Retrouver un payment par transactionId FedaPay.
   *
   * FedaPay redirige après paiement vers /signup/confirmation?id=470323&status=approved
   * SANS préserver les query params d'origine (draftId, paymentId).
   * Le frontend utilise cet endpoint pour retrouver le paymentId à partir
   * de l'ID numérique FedaPay (paramètre 'id' dans l'URL).
   */
  async findPaymentByTransactionId(transactionId: string) {
    const payment = await this.prisma.onboardingPayment.findFirst({
      where: {
        metadata: { path: ['transactionId'], equals: transactionId },
      },
      select: { id: true, reference: true, status: true, draftId: true },
    });
    if (!payment) {
      this.logger.warn(`⚠️  No payment found for FedaPay transactionId: ${transactionId}`);
      return { found: false, paymentId: null };
    }
    this.logger.log(`✅ Found payment ${payment.id} for FedaPay transactionId ${transactionId}`);
    return {
      found: true,
      paymentId: payment.id,
      reference: payment.reference,
      status: payment.status,
      draftId: payment.draftId,
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
        // ⭐ Ne PAS connecter subscriptionPlan (relation vers subscription_plans
        // qui est VIDE — anciens plans BASIC_MONTHLY supprimés).
        // Le champ `plan` (string) stocke le code du plan (SEED/GROW/LEAD/NETWORK).
        // La relation subscriptionPlan est optionnelle (@? dans le schéma).
        const subscription = await tx.subscription.create({
          data: {
            tenant: { connect: { id: tenant.id } },
            // ⭐ PAS de subscriptionPlan connect — la table subscription_plans est vide.
            // On stocke juste le code du plan dans le champ `plan` (string).
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

        // ─── Créer également un HelmSubscription (modèle principal du système
        // de billing actuel) pour que les endpoints /billing/* fonctionnent.
        // Le HelmSubscription stocke le plan d'abonnement (SEED/GROW/LEAD/NETWORK),
        // le cycle de facturation, les montants, et l'état bilingue.
        // ───
        const helmPlan = (pricing?.planCode as string) || 'SEED';
        const helmPlanEnum = (['SEED', 'GROW', 'LEAD', 'NETWORK'].includes(helmPlan) ? helmPlan : 'SEED') as any;
        const monthlyAmount = pricing?.monthlyPrice || 0;
        const annualAmount = pricing?.yearlyPrice || 0;
        const setupFee = Number(payment.amount) || 0;

        // Éviter le doublon : HelmSubscription a tenantId @unique
        const existingHelmSub = await tx.helmSubscription.findUnique({
          where: { tenantId: tenant.id },
          select: { id: true },
        });
        if (!existingHelmSub) {
          await tx.helmSubscription.create({
            data: {
              tenantId: tenant.id,
              plan: helmPlanEnum,
              billingCycle: periodType === 'YEARLY' ? 'ANNUAL' : 'MONTHLY',
              status: 'TRIALING',
              monthlyAmount,
              annualAmount,
              setupFee,
              currentPeriodStart: trialStart,
              currentPeriodEnd: trialEnd,
              trialEnd,
              bilingualEnabled: draft.bilingual,
              lastPaymentDate: new Date(),
              lastPaymentAmount: setupFee,
            },
          });
          this.logger.log(`✅ HelmSubscription created for tenant ${tenant.id} (plan=${helmPlanEnum})`);
        }

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

        // Créer l'entité School associée au tenant pour stocker
        // les informations collectées pendant l'onboarding (ville, téléphone,
        // email, logo) qui ne sont pas sur le modèle Tenant lui-même.
        // Une seule School par tenant (tenantId @unique dans le schéma).
        await tx.school.create({
          data: {
            tenantId: tenant.id,
            name: tenant.name,
            city: draft.city || null,
            primaryPhone: draft.phone || null,
            primaryEmail: draft.email || null,
            logo: draft.logoUrl || null,
            educationLevels: this.getSchoolLevelsForType(draft.schoolType).map(l => l.code),
          },
        });
        this.logger.log(`✅ School created for tenant ${tenant.id} (city=${draft.city || 'N/A'}, logo=${draft.logoUrl ? 'yes' : 'no'})`);
      }

      // 3. Créer ou réutiliser le promoteur (user avec role PROMOTER).
      // ⭐ L'email est @unique dans la table users. Si le promoteur a déjà un
      // compte (ex: il gère déjà une autre école), on réutilise son compte
      // existant et on crée une entrée UserTenant pour le lier au nouveau tenant.
      // Le promoteur garde accès à TOUTES ses écoles via la table user_tenants.
      let promoter = await tx.user.findUnique({
        where: { email: draft.promoterEmail },
      });

      if (promoter) {
        // Le user existe déjà — mettre à jour les infos et créer un UserTenant
        promoter = await tx.user.update({
          where: { id: promoter.id },
          data: {
            // Mettre à jour le password hash si fourni
            ...(draft.promoterPasswordHash && { passwordHash: draft.promoterPasswordHash }),
            firstName: draft.promoterFirstName || promoter.firstName,
            lastName: draft.promoterLastName || promoter.lastName,
            role: 'PROMOTER',
            status: 'active',
            // ⭐ Mettre à jour le tenantId par défaut vers le nouveau tenant
            tenantId: tenants[0].id,
          },
        });

        // ⭐ Créer l'entrée UserTenant pour lier le promoteur au nouveau tenant
        // (idempotent : si la relation existe déjà, on ne fait rien)
        const existingUserTenant = await tx.userTenant.findUnique({
          where: { userId_tenantId: { userId: promoter.id, tenantId: tenants[0].id } },
        }).catch(() => null); // Le compound unique peut ne pas exister si migration pas encore appliquée

        if (!existingUserTenant) {
          try {
            await tx.userTenant.create({
              data: {
                userId: promoter.id,
                tenantId: tenants[0].id,
                role: 'PROMOTER',
                isActive: true,
              },
            });
          } catch (e: any) {
            // Si la table user_tenants n'existe pas encore (migration pas appliquée),
            // on ignore l'erreur — le tenantId sur le User suffit.
            this.logger.warn(`⚠️ UserTenant creation skipped: ${e.message}`);
          }
        }

        this.logger.log(`✅ Promoter reused (existing user): ${promoter.id} → tenant ${tenants[0].id} (multi-tenant)`);
      } else {
        // Nouveau user — créer
        promoter = await tx.user.create({
          data: {
            email: draft.promoterEmail,
            passwordHash: draft.promoterPasswordHash,
            firstName: draft.promoterFirstName || '',
            lastName: draft.promoterLastName || '',
            role: 'PROMOTER',
            tenantId: tenants[0].id,
            status: 'active',
          },
        });

        // ⭐ Créer l'entrée UserTenant pour le nouveau user
        try {
          await tx.userTenant.create({
            data: {
              userId: promoter.id,
              tenantId: tenants[0].id,
              role: 'PROMOTER',
              isActive: true,
            },
          });
        } catch (e: any) {
          this.logger.warn(`⚠️ UserTenant creation skipped: ${e.message}`);
        }

        this.logger.log(`✅ Promoter created (new user): ${promoter.id} → tenant ${tenants[0].id}`);
      }

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
      // ⭐ Stocker le sous-domaine (slug) ET le nom d'hôte complet.
      // Le slug (ex: "academia-helm") est utilisé pour les recherches DB et le routing.
      // Le hostname complet (ex: "academia-helm.academiahelm.com") est utilisé pour
      // l'affichage à l'utilisateur (email + page confirmation).
      const baseDomain = (process.env.FRONTEND_URL || 'https://academiahelm.com')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '')
        .trim();
      const tenantSlug = tenants[0].subdomain || tenants[0].slug || '';
      const tenantHostname = tenantSlug ? `${tenantSlug}.${baseDomain}` : baseDomain;
      // ⭐ Construire l'URL de connexion avec paramètres (portal=SCHOOL&tenant=...&school_name=...).
      // Format : https://{subdomain}.{domaine}/login?portal=SCHOOL&tenant={subdomain}&school_name={encoded}
      const schoolNameEncoded = encodeURIComponent(draft.schoolName || '');
      const portalUrlParams = new URLSearchParams({
        portal: 'SCHOOL',
        tenant: tenantSlug,
        school_name: draft.schoolName || '',
      }).toString();
      await tx.onboardingPayment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          metadata: {
            ...paymentMeta,
            firstTenantSubdomain: tenantSlug,
            firstTenantHostname: tenantHostname,
            firstTenantSiteUrl: `https://${tenantHostname}/`,
            firstTenantPortalUrl: `https://${tenantHostname}/login?${portalUrlParams}`,
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

      // 🔗 Retourner les données AVANT les appels API (la transaction est complète)
      const activationResult = {
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

      // 🔗 DOMAIN MANAGEMENT - Créer les sous-domaines Cloudflare + Vercel (hors transaction)
      // Important : Les appels API Cloudflare/Vercel sont lents et ne doivent PAS
      // bloquer la transaction DB. On les exécute en arrière-plan.
      this.createSubdomainsAsync(tenants);

      // ⭐ Invalider le cache de la liste publique des écoles pour que le nouveau
      // tenant apparaisse immédiatement dans le modal de sélection du portail.
      // Sans cette invalidation, le cache Redis (60s) + cache Next.js BFF
      // empêchent le nouveau tenant d'apparaître pendant jusqu'à 60 secondes.
      try {
        await this.cacheService.invalidate('schools:list:all');
        await this.cacheService.invalidate('schools:list:with-jobs');
        this.logger.log(`✅ School list cache invalidated after tenant activation`);
      } catch (cacheErr: any) {
        this.logger.warn(`⚠️  Failed to invalidate school list cache: ${cacheErr.message}`);
      }

      return activationResult;
    });
  }

  // Note: generateSlug supprimé - utilise SubdomainService.generateAndValidate()

  /**
   * Crée les sous-domaines Cloudflare + Vercel de façon asynchrone (fire-and-forget).
   * Ne bloque PAS la transaction DB — les appels API réseau sont lents.
   * Si ça échoue, le tenant reste actif mais sans sous-domaine DNS configuré.
   */
  private createSubdomainsAsync(tenants: { id: string; subdomain: string | null; name: string }[]): void {
    if (!this.domainManagementService.isConfigured()) {
      this.logger.warn('⚠️  Domain management not configured — skipping subdomain creation. Configure CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, VERCEL_API_TOKEN, VERCEL_PROJECT_ID');
      return;
    }

    // Fire-and-forget : ne pas await, ne pas bloquer la réponse
    Promise.all(
      tenants.map(async (tenant) => {
        if (!tenant.subdomain) {
          this.logger.warn(`⚠️  No subdomain for tenant ${tenant.id} — skipping domain creation`);
          return;
        }

        try {
          const result = await this.domainManagementService.createSchoolSubdomain(
            tenant.subdomain,
            tenant.id,
          );

          if (result.success) {
            this.logger.log(
              `✅ Subdomain ${result.domain} created for tenant ${tenant.id} (CF: ${result.cloudflareCreated}, Vercel: ${result.vercelAdded}, Verified: ${result.vercelVerified})`,
            );
          } else {
            this.logger.warn(
              `⚠️  Subdomain creation partial/failed for ${result.domain}: ${result.error}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `❌ Unexpected error creating subdomain for tenant ${tenant.id}: ${error.message}`,
          );
        }
      }),
    ).catch((error) => {
      // Catch-all de sécurité (ne devrait jamais arriver)
      this.logger.error(`❌ Subdomain creation batch failed: ${error.message}`);
    });
  }

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

    // ⭐ Ne pas expirer les drafts COMPLETED ou PAYMENT_COMPLETED
    // (l'activation peut encore être en cours pour PAYMENT_COMPLETED)
    if (draft.createdAt < expiryThreshold && !['COMPLETED', 'PAYMENT_COMPLETED'].includes(draft.status)) {
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
