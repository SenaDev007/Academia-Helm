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
// ⭐ V6 (spec §4/§6) — Helm Connect : canaux officiels + communautés auto
//    dès l'activation d'un établissement
import { HelmConnectBootstrapService } from '../../communication/services/helm-connect-bootstrap.service';
import { isSchoolTenantType, schoolTenantTypeFilter } from '../../common/constants/school-tenant-types';
// ⭐ Barème progressif du coût d'activation (écoles annexes — contrat Article 4)
import {
  getAnnexActivationPricing,
  getGroupActivationTiers,
  ANNEX_NEGOTIATED_RANK,
  ANNEX_NEGOTIATED_MESSAGE,
} from '../../common/utils/annex-activation-pricing';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * ⭐ Échéancier de paiement par tranches (espèces — mode YEHI OR Tech).
 * Saisi dans le wizard (étape 3), persisté dans priceSnapshot.paymentMarked,
 * repris dans le contrat (Article 4) et les métadonnées du paiement cash.
 */
export interface OnboardingInstallment {
  label: string;
  amount: number; // FCFA (entier)
  dueDate?: string; // ISO — tranche 1 = acompte à la signature si absent
}

export interface CashPaymentMarking {
  subscriptionPaid?: boolean;
  bilingualPaid?: boolean;
  receivedBy?: string;
  paymentPlan?: 'full' | 'installments';
  installments?: OnboardingInstallment[];
  downPaymentReceived?: boolean;
  // ⭐ Contrat déjà signé manuellement (version papier) — persisté dans
  //    priceSnapshot.paymentMarked pour la traçabilité et le contrat.
  signedManually?: boolean;
}

/**
 * ⭐ Statut global de la création des sous-domaines d'une activation.
 *    - 'created'        : tous les sous-domaines sont créés (DNS + Vercel + DB)
 *    - 'partial'        : au moins un créé, au moins un en échec
 *    - 'failed'         : aucun créé (échec API) — l'école reste fonctionnelle
 *    - 'not_configured' : le service de domaines n'est pas configuré sur le
 *                         serveur API (VERCEL_API_TOKEN / VERCEL_PROJECT_ID
 *                         absents) — VISIBLE au lieu d'un échec silencieux.
 */
export type DomainCreationStatus = 'created' | 'partial' | 'failed' | 'not_configured';

/**
 * ⭐ Rapport de création de sous-domaine pour UNE école (tenant).
 *    Remonte jusqu'à la réponse de /onboarding/contract/sign : l'appelant
 *    SAIT si {subdomain}.academiahelm.com existe réellement.
 */
export interface TenantDomainReport {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  domain: string;
  status: 'created' | 'failed' | 'not_configured';
  cloudflareCreated?: boolean;
  vercelAdded?: boolean;
  vercelVerified?: boolean;
  dbTracked?: boolean;
  error?: string;
}

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
    // ⭐ V6 (spec §4/§6) — Helm Connect : canaux officiels + communautés auto
    private readonly helmConnectBootstrap?: HelmConnectBootstrapService,
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
    /** ⭐ Écoles annexes déclarées dès l'onboarding (multi-écoles). */
    annexes?: { name: string; city?: string }[];
    preferredSubdomain?: string;
    logoUrl?: string;
  }) {
    // ⭐ Multi-écoles : normaliser annexes + schoolsCount (cohérence garantie :
    //    schoolsCount = 1 + nombre d'annexes ; les doublons de noms vides sont rejetés).
    const annexList = (data.annexes || [])
      .map((a) => ({
        name: String(a?.name || '').trim(),
        city: a?.city ? String(a.city).trim() : undefined,
      }))
      .filter((a) => a.name.length >= 2);
    if (annexList.length > 9) {
      throw new BadRequestException('Au maximum 9 écoles annexes par onboarding.');
    }
    const effectiveSchoolsCount = Math.max(1, data.schoolsCount ?? annexList.length + 1);
    // ⚠️ schoolsCount doit refléter la réalité déclarée (1 principale + N annexes)
    if (annexList.length > 0 && effectiveSchoolsCount !== annexList.length + 1) {
      throw new BadRequestException(
        `Incohérence multi-écoles : ${annexList.length} annexe(s) déclarée(s) mais schoolsCount=${effectiveSchoolsCount} (attendu : ${annexList.length + 1}).`,
      );
    }
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
          schoolsCount: annexList.length > 0 ? annexList.length + 1 : effectiveSchoolsCount,
          ...(annexList.length > 0 ? { annexes: annexList as unknown as Prisma.InputJsonValue } : {}),
          preferredSubdomain,
          logoUrl: data.logoUrl || null,
          status: 'DRAFT',
        },
      });

      this.logger.log(`📝 Onboarding draft created: ${draft.id}` + (preferredSubdomain ? ` (sous-domaine: ${preferredSubdomain})` : '') + (annexList.length > 0 ? ` — MULTI-ÉCOLES : ${annexList.length + 1} établissements` : ''));

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
      creationMode?: string;
      adminEmail?: string;
      adminPassword?: string;
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

    // ⭐ Mode YEHI OR Tech : l'équipe YEHI OR Tech crée l'école elle-même.
    //    Pas d'OTP : la sécurité repose sur la validation des credentials
    //    d'un compte plateforme (SUPER_ADMIN / isSuperAdmin) contre la DB.
    if (data.creationMode === 'yehi-or-tech') {
      const adminEmail = data.adminEmail;
      const adminPassword = data.adminPassword;
      if (!adminEmail || !adminPassword) {
        throw new BadRequestException(
          'Identifiants plateforme requis : email et mot de passe de votre compte YEHI OR Tech.'
        );
      }
      const admin = await this.validatePlatformAdminCredentials(adminEmail, adminPassword);
      if (!admin) {
        throw new BadRequestException(
          'Identifiants plateforme invalides. Seul un compte Super Admin / Platform Owner peut créer une école via le mode YEHI OR Tech.'
        );
      }
      this.logger.log(`🔐 Mode YEHI OR Tech : credentials plateforme validés (${adminEmail}) pour draft ${draftId}`);
      otpVerified = true; // Email vérifié par l'agent YEHI OR Tech en présentiel
    } else {
      // ⭐ Mode self-service : verrouillable par env (ENABLE_SELF_SIGNUP=true pour le réactiver).
      //    Par défaut le mode self-service est désactivé — seul le mode YEHI OR Tech est autorisé.
      if (process.env.ENABLE_SELF_SIGNUP !== 'true') {
        throw new BadRequestException(
          'Le mode de création en ligne (self-service) est actuellement verrouillé. La création des écoles est assurée par YEHI OR Tech.'
        );
      }
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
   * ⭐ Valide les credentials d'un compte plateforme (mode YEHI OR Tech).
   *
   * 2 sources acceptées (dans l'ordre) :
   *   1. DB — Users avec role = 'SUPER_ADMIN' OU isSuperAdmin = true, actifs,
   *      avec un mot de passe qui matche (bcrypt).
   *   2. ENV (fallback) — ADMIN_EMAILS (whitelist) + ADMIN_PASSWORDS
   *      (JSON { email: hash bcrypt }), exactement comme le login du
   *      back-office admin.academiahelm.com, qui ne passe PAS par la table
   *      users. Si l'api-server (Railway) partage ces variables, les
   *      identifiants back-office fonctionnent donc aussi ici, même sans
   *      compte SUPER_ADMIN en DB (ou après un changement de mot de passe
   *      back-office non répliqué en DB).
   *
   * Ne JAMAIS révéler si c'est l'email ou le mot de passe qui est faux —
   * on retourne null dans tous les cas d'échec (anti-énumération).
   *
   * @returns l'utilisateur admin (sans le hash) ou null
   */
  async validatePlatformAdminCredentials(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; firstName: string | null; lastName: string | null } | null> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return null;
    }

    const admin = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        status: 'active',
        OR: [
          { role: 'SUPER_ADMIN' },
          { isSuperAdmin: true },
        ],
      },
      select: { id: true, email: true, firstName: true, lastName: true, passwordHash: true },
    });

    if (!admin?.passwordHash) {
      this.logger.warn(
        `🔐 Platform admin validation failed: no matching SUPER_ADMIN account for ${normalizedEmail} — tentative fallback env`,
      );
      return this.validateAdminViaEnvCredentials(normalizedEmail, password);
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      this.logger.warn(
        `🔐 Platform admin validation failed: wrong password for ${normalizedEmail} — tentative fallback env`,
      );
      return this.validateAdminViaEnvCredentials(normalizedEmail, password);
    }

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
    };
  }

  /**
   * ⭐ Fallback env — synchronisation avec le back-office admin.academiahelm.com.
   *
   * Le login back-office s'authentifie via ADMIN_EMAILS (whitelist, liste
   * d'emails séparés par des virgules) + ADMIN_PASSWORDS (JSON
   * { "email": "<hash bcrypt>" }) — SANS passer par la table users. Pour que
   * les mêmes identifiants plateforme fonctionnent dans le wizard
   * d'onboarding même sans compte SUPER_ADMIN en DB, on accepte aussi ces
   * sources si elles sont configurées côté api-server (Railway).
   *
   * Règles (fail-safe) :
   *   - ADMIN_PASSWORDS absent → fallback désactivé (DB uniquement, comportement
   *     historique inchangé).
   *   - ADMIN_EMAILS absent OU vide → whitelist ignorée (ADMIN_PASSWORDS seul
   *     décide) ; sinon l'email DOIT y figurer.
   *   - Anti-énumération conservée : null dans tous les cas d'échec.
   *
   * @returns un pseudo-compte admin (sans le hash) ou null
   */
  private async validateAdminViaEnvCredentials(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; firstName: string | null; lastName: string | null } | null> {
    const passwordsRaw = process.env.ADMIN_PASSWORDS;
    if (!passwordsRaw) {
      return null; // Fallback désactivé — DB uniquement
    }

    const whitelistRaw = process.env.ADMIN_EMAILS || '';
    const whitelist = whitelistRaw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (whitelist.length > 0 && !whitelist.includes(email)) {
      return null;
    }

    try {
      const passwords = JSON.parse(passwordsRaw) as Record<string, string>;
      const hash = passwords[email];
      if (!hash) {
        return null;
      }
      const matches = await bcrypt.compare(password, hash);
      if (!matches) {
        return null;
      }
      return {
        id: `platform-${email}`,
        email,
        firstName: null,
        lastName: null,
      };
    } catch (err) {
      this.logger.warn(
        `🔐 Platform admin env fallback: ADMIN_PASSWORDS illisible (${err instanceof Error ? err.message : 'erreur inconnue'})`,
      );
      return null;
    }
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

    // ⚠️ Prix initial — ⭐ priorité au plan (pricing_plans.initialFee, éditable
    //    back-office, aligné contrat Article 4 : 500 000 FCFA uniformes).
    //    Fallback : PricingService (pricing_configs + réduction multi-écoles le
    //    cas échéant). Corrige l'ancien bug où le snapshot embarquait
    //    initialPayment=100 000 (config de test) au lieu de 500 000.
    const planInitialFee = pricingResult.plan.initialFee != null
      ? Number(pricingResult.plan.initialFee)
      : null;
    const initialPayment = planInitialFee != null
      ? planInitialFee
      : await this.pricingService.calculateInitialPaymentPrice(draft.schoolsCount || 1);

    // ⭐ Barème progressif du coût d'activation (contrat Article 4) — appliqué
    //    PAR RANG : 1re école 100 % (500 000), 2e −15 % (425 000),
    //    3e −20 % (400 000), 4e −25 % (375 000). À partir de la 5e école,
    //    tarification NÉGOCIÉE : la souscription en libre-service est
    //    bloquée ici (défense serveur — le wizard limite à 3 annexes).
    //    Mono-école : pas de barème (l'annexe créée depuis les paramètres
    //    reçoit sa remise de rang dans createAnnexDraft).
    const schoolsCountN = Math.max(1, draft.schoolsCount || 1);
    const activationBaseFee = initialPayment; // tarif de base = rang 1 (école principale)
    const groupTiers = getGroupActivationTiers(schoolsCountN, activationBaseFee);
    if (groupTiers.negotiated) {
      throw new BadRequestException(ANNEX_NEGOTIATED_MESSAGE);
    }

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
      subscriptionPrice: pricingResult.amount, // Prix de l'abonnement annuel
      monthlyPrice: pricingResult.plan.monthlyPrice ?? 0,
      yearlyPrice: pricingResult.plan.yearlyPrice ?? 0,
      initialFee: planInitialFee ?? initialPayment, // ⭐ Frais d'activation (contrat Article 4 — lu en priorité par le contrat / paiement cash)
      initialPayment, // Alias historique (mêmes frais d'activation)
      // ⭐ Barème progressif du coût d'activation (écoles 2..N remisées) :
      //    total d'activation du groupe + lignes par rang — consommés par le
      //    contrat (Article 3/4) et le paiement cash (total Année 1).
      activationBaseFee,
      ...(schoolsCountN > 1
        ? {
            activationTotal: groupTiers.total,
            activationTiers: groupTiers.tiers as unknown as Prisma.InputJsonValue,
          }
        : {}),
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

    // ⭐ Paiement en espèces (mode YEHI OR Tech) : pas de transaction FedaPay
    //    à interroger ni de webhook. Le paiement est déjà COMPLETED/SUCCESS en DB.
    //    On retourne directement le statut (avec activation idempotente si besoin).
    if (payment.provider === 'cash') {
      if (payment.status === 'COMPLETED') {
        // Paiement marqué payé mais tenant pas encore activé (échec antérieur) → activer
        try {
          await this.activateTenantAfterPayment(paymentId);
          const refreshed = await this.prisma.onboardingPayment.findUnique({ where: { id: paymentId } });
          if (refreshed) {
            payment.status = refreshed.status;
            payment.metadata = refreshed.metadata;
          }
        } catch (activationErr: any) {
          this.logger.error(`❌ Cash payment activation failed for ${paymentId}: ${activationErr.message}`);
        }
      }
      const cashMeta = (payment.metadata as any) || {};
      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        verified: payment.status === 'SUCCESS',
        transactionStatus: null,
        draftId: payment.draftId,
        tenantActivated: payment.status === 'SUCCESS',
        firstTenantSubdomain: cashMeta.firstTenantSubdomain as string | undefined,
        firstTenantHostname: cashMeta.firstTenantHostname as string | undefined,
        firstTenantSiteUrl: cashMeta.firstTenantSiteUrl as string | undefined,
        firstTenantPortalUrl: cashMeta.firstTenantPortalUrl as string | undefined,
        reference: payment.reference || undefined,
        fedapayReference: undefined,
        transactionId: undefined,
        verifyError: undefined,
      };
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
      // ⚠️ On NE marque JAMAIS un paiement PENDING comme COMPLETED sans
      //    confirmation FedaPay : un paiement PENDING reste PENDING tant que
      //    le webhook ou l'API FedaPay ne l'a pas confirmé (pas d'activation
      //    sur simple échec réseau — risque d'activation sans paiement réel).
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
        // Paiement toujours PENDING et FedaPay injoignable → on ne fait rien.
        // Le webhook (chemin nominal) ou un prochain verify tranchera.
        this.logger.warn(
          `⚠️  Payment ${paymentId} toujours PENDING et API FedaPay injoignable — pas d'activation sans confirmation du PSP.`,
        );
        verifyError = `${verifyError} | Paiement PENDING non confirmé (API FedaPay injoignable)`;
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
    // ⭐ Le résultat est capturé puis COMPLÉTÉ après le commit (sous-domaines,
    //    Helm Connect, caches) — voir la fin de la méthode.
    const activationResult = await this.prisma.$transaction(async (tx) => {
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

      // ⭐ MULTI-ÉCOLES — annexes déclarées à l'étape 1 : chaque école a son
      //    PROPRE nom et sa PROPRE ville (quartier/ville différente — miroir
      //    mono-école par tenant). Fallback historique si non déclarées :
      //    « {École principale} - Annexe N » + ville du draft principal.
      const declaredAnnexes = Array.isArray((draft as any).annexes)
        ? ((draft as any).annexes as { name?: string; city?: string }[])
        : [];
      const annexName = (i: number) => {
        const declared = declaredAnnexes[i - 1];
        const name = declared?.name?.trim();
        return name && name.length >= 2 ? name : `${draft.schoolName} - Annexe ${i}`;
      };
      const annexCity = (i: number) => {
        const declared = declaredAnnexes[i - 1];
        const city = declared?.city?.trim();
        return city && city.length >= 2 ? city : (draft.city || null);
      };

      for (let i = 0; i < schoolsCount; i++) {
        let schoolNameForSubdomain = draft.schoolName;
        if (i > 0) {
          schoolNameForSubdomain = annexName(i);
        }

        const subdomain = schoolsCount > 1
          ? await this.generateAnnexeSubdomain(firstTenantSubdomain, i + 1, tx)
          : firstTenantSubdomain;
        const slug = subdomain;

        // Créer le tenant — nom réel de l'école (annexe déclarée ou fallback)
        const tenant = await tx.tenant.create({
          data: {
            name: i === 0 ? draft.schoolName : annexName(i),
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

        // ⭐ Créer la souscription ACTIVE (pas de trial — aligné sur le contrat)
        //    Le contrat prévoit : frais d'activation à la signature + frais annuels
        //    à la date d'échéance annuelle. Pas de période d'essai.
        const pricing = draft.priceSnapshot as any;
        const subscriptionStart = new Date();
        const subscriptionEnd = new Date(subscriptionStart);
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1); // 1 an
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
            status: 'ACTIVE', // ⭐ Actif immédiatement (pas de trial)
            startDate: subscriptionStart,
            trialStart: null, // ⭐ Pas de trial
            trialEnd: null, // ⭐ Pas de trial
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
        // ⭐ setupFee = frais d'activation réels (Article 4 : 500 000 FCFA).
        //    En mode espèces, payment.amount = total Année 1 (activation + annuel + bilingue)
        //    → on ne doit PAS le confondre avec les frais d'activation seuls.
        const setupFee = Number(pricing?.initialPayment ?? pricing?.initialFee ?? payment.amount) || 0;

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
              status: 'ACTIVE', // ⭐ Actif immédiatement (pas de trial)
              monthlyAmount,
              annualAmount,
              setupFee,
              currentPeriodStart: subscriptionStart,
              currentPeriodEnd: subscriptionEnd, // 1 an
              trialEnd: null, // ⭐ Pas de trial
              bilingualEnabled: draft.bilingual,
              lastPaymentDate: new Date(),
              lastPaymentAmount: Number(payment.amount) || 0, // Montant réellement encaissé
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

        // ⭐ Créer l'année académique par défaut (unification des flux paiement/contrat).
        //    Pattern identique à AcademicYearSettingsService : label requis +
        //    contrainte @@unique([tenantId, label]).
        try {
          const currentYear = new Date().getFullYear();
          const nextYear = currentYear + 1;
          await tx.academicYear.create({
            data: {
              tenantId: tenant.id,
              name: `${currentYear}-${nextYear}`,
              label: `Année scolaire ${currentYear}-${nextYear}`,
              startDate: new Date(currentYear, 8, 1), // 1er septembre
              endDate: new Date(nextYear, 7, 31), // 31 août
              isActive: true,
              isAutoGenerated: true,
            },
          });
        } catch (yearErr: any) {
          // Non-bloquant : l'année peut déjà exister (reprise/idempotence)
          this.logger.warn(`⚠️  Could not create default academic year for tenant ${tenant.id}: ${yearErr.message}`);
        }

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
            // ⭐ Canal réel du paiement : 'fedapay' (self-service) ou 'cash' (mode YEHI OR Tech)
            channel: (payment.provider as string) || 'fedapay',
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
        // ⭐ Multi-écoles : la ville est celle DÉCLARÉE pour cette annexe
        //    (quartier/ville différente) — fallback ville du draft principal.
        await tx.school.create({
          data: {
            tenantId: tenant.id,
            name: tenant.name,
            city: i === 0 ? (draft.city || null) : annexCity(i),
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

      // ⭐ 3bis. Assigner le rôle système PROMOTEUR à l'utilisateur (unification des flux).
      //    Le rôle système est créé sous le nom 'PROMOTEUR' (français) par
      //    RolesPermissionsBootstrapService — on cherche les deux variantes
      //    ('PROMOTEUR' et 'PROMOTER') pour être résilient au nom utilisé.
      try {
        const promoterRole = await tx.role.findFirst({
          where: { name: { in: ['PROMOTEUR', 'PROMOTER'] }, isSystemRole: true },
        });
        if (promoterRole) {
          const existingUserRole = await tx.userRole.findFirst({
            where: { userId: promoter.id, roleId: promoterRole.id, tenantId: tenants[0].id },
          });
          if (!existingUserRole) {
            await tx.userRole.create({
              data: {
                userId: promoter.id,
                roleId: promoterRole.id,
                tenantId: tenants[0].id,
              },
            });
          }
        } else {
          this.logger.warn(`⚠️  System role PROMOTEUR/PROMOTER not found — skipping UserRole assignment`);
        }
      } catch (err: any) {
        this.logger.warn(`⚠️  Could not assign PROMOTER role: ${err.message}`);
      }

      // 4. ⭐ MULTI-ÉCOLES : lier le promoteur à CHACUN des tenants créés.
      //    Une UserTenant active par école — même périmètre que
      //    auth.service (getAvailableTenants / selectTenant) et que
      //    analytics.resolveScope : sans elle, une annexe créée ici serait
      //    invisible dans la vue groupe et INACCESSIBLE (selectTenant → 403).
      //    La 1re école est déjà couverte par les branches promoteur ci-dessus
      //    (contrôle idempotent ci-dessous) ; les annexes 2..N le sont ici.
      //    Résilient : si la table user_tenants n'existe pas encore en base
      //    (migration non appliquée), on log et on continue (le tenantId
      //    direct sur le User garantit au minimum l'accès à la 1re école).
      for (const tenant of tenants) {
        const existingUserTenant = await tx.userTenant
          .findUnique({
            where: { userId_tenantId: { userId: promoter.id, tenantId: tenant.id } },
          })
          .catch(() => null); // table absente → null → on tentera le create (catché aussi)
        if (existingUserTenant) continue;
        try {
          await tx.userTenant.create({
            data: {
              userId: promoter.id,
              tenantId: tenant.id,
              role: 'PROMOTER',
              isActive: true,
            },
          });
          this.logger.log(
            `✅ UserTenant created: promoter ${promoter.id} → tenant ${tenant.id}`,
          );
        } catch (e: any) {
          this.logger.warn(
            `⚠️ UserTenant creation skipped for tenant ${tenant.id}: ${e.message}`,
          );
        }
      }
      this.logger.log(
        `✅ Promoter ${promoter.id} can manage ${tenants.length} tenant(s) (annexes)`
      );

      // 5. Mettre à jour le draft
      //    ⭐ Purger le hash du mot de passe : le compte promoteur est créé,
      //    conserver le hash bcrypt dans le draft n'a plus d'utilité et constitue
      //    une surface d'attaque inutile (les drafts COMPLETED ne sont jamais purgés).
      await tx.onboardingDraft.update({
        where: { id: draft.id },
        data: {
          status: 'COMPLETED',
          promoterPasswordHash: null,
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

      // 🔗 Retourner les données — la transaction se limite aux écritures DB.
      //    Tout ce qui suit (sous-domaines, Helm Connect, caches) s'exécute
      //    APRÈS le commit : un échec réseau ne fait JAMAIS rollbacker l'école.
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

    // 🔗 DOMAIN MANAGEMENT — APRÈS le commit de la transaction.
    // ⭐ AWAITÉ : la création du sous-domaine (Cloudflare + Vercel + trace
    //    TenantDomain en DB) fait partie intégrante de la création complète
    //    de l'école (« du fond en comble »). Le rapport remonte dans la
    //    réponse de l'activation — fini le fire-and-forget silencieux qui
    //    laissait des écoles créées SANS sous-domaine, sans qu'aucune erreur
    //    ne soit visible nulle part.
    const domainReports = await this.createSubdomains(activationResult.tenants);
    const domainStatus = this.computeDomainStatus(domainReports);
    if (domainStatus !== 'created') {
      this.logger.warn(
        `⚠️  Sous-domaines : statut « ${domainStatus} » après activation de ` +
        `${activationResult.tenants.length} école(s) — ${domainReports.map(r => `${r.domain}:${r.status}${r.error ? ` (${r.error})` : ''}`).join(' | ')}`,
      );
    }

    // ⭐ V6 (spec §4/§6) — HELM CONNECT : provisionnement automatique des
    //    canaux officiels (Direction, Vie scolaire, Transport, Finance,
    //    Infos pédagogiques, Calendrier scolaire) + abonnement du promoteur,
    //    puis communautés automatiques dès qu'une année scolaire sera active.
    //    Fire-and-forget : ne bloque JAMAIS l'activation.
    this.provisionHelmConnectAsync(activationResult.tenants);

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

    this.logger.log(
      `✅ ${activationResult.tenants.length} tenant(s) activated - Promoter: ${activationResult.promoter.id} - Subscriptions: ${activationResult.subscriptions.map(s => s.id).join(', ')}`,
    );

    return { ...activationResult, domainReports, domainStatus };
  }

  // Note: generateSlug supprimé - utilise SubdomainService.generateAndValidate()

  /**
   * ⭐ V6 (spec §4/§6) — Provisionne Helm Connect pour un nouveau tenant :
   *    crée les 6 canaux officiels de diffusion + abonne tous les comptes
   *    existants (dont le promoteur fraîchement créé), et tente la création
   *    des communautés automatiques si une année scolaire est déjà active.
   *    Fire-and-forget : aucune erreur ne remonte à l'activation.
   */
  private provisionHelmConnectAsync(tenants: { id: string; subdomain: string | null; name: string }[]): void {
    if (!this.helmConnectBootstrap) {
      this.logger.warn('⚠️  HelmConnectBootstrapService indisponible — provisionnement Helm Connect ignoré');
      return;
    }
    const bootstrap = this.helmConnectBootstrap;
    Promise.all(
      tenants.map(async (tenant) => {
        try {
          const result = await bootstrap.syncTenant(tenant.id);
          this.logger.log(
            `✅ Helm Connect provisionné pour « ${tenant.name} » : ${result.channels.created} canal(aux) officiel(s) créé(s), ${result.channels.subscribed} abonnement(s)`,
          );
        } catch (e: any) {
          this.logger.warn(`⚠️  Helm Connect provisionnement échoué pour « ${tenant.name} »: ${e.message} — la sync périodique rattrapera`);
        }
      }),
    ).catch(() => { /* déjà géré par tenant */ });
  }

  /**
   * ⭐ Crée les sous-domaines Cloudflare + Vercel et les traque en DB —
   *    AWAITÉ (la création fait partie de l'école « du fond en comble »).
   *
   *    Remplace l'ancien createSubdomainsAsync (fire-and-forget silencieux) :
   *    un échec ou une absence de configuration est maintenant RETOURNÉ dans
   *    un rapport par école, qui remonte jusqu'à la réponse HTTP de la
   *    signature du contrat. Idempotent par nature :
   *    - Cloudflare : vérifie l'enregistrement existant avant création ;
   *    - Vercel : 409 (déjà présent) = succès ;
   *    - TenantDomain : upsert (création ou réactivation).
   */
  private async createSubdomains(
    tenants: { id: string; subdomain: string | null; name: string }[],
  ): Promise<TenantDomainReport[]> {
    const baseDomain = (process.env.APP_BASE_DOMAIN
      || (process.env.FRONTEND_URL || 'https://academiahelm.com')
        .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim()
    );

    if (!this.domainManagementService.isConfigured()) {
      // ⭐ ERROR (et plus un simple warn) : sans tokens Vercel/Cloudflare, les
      //    écoles sont créées SANS sous-domaine — c'est un incident de config
      //    qui doit être visible, pas une simple note de log.
      this.logger.error(
        '❌ DOMAIN MANAGEMENT NON CONFIGURÉ — les écoles seront créées SANS sous-domaine. ' +
        'Configurez VERCEL_API_TOKEN + VERCEL_PROJECT_ID (et idéalement CLOUDFLARE_API_TOKEN + ' +
        'CLOUDFLARE_ZONE_ID pour les CNAME individuels) sur le serveur API.',
      );
      return tenants.map((tenant) => ({
        tenantId: tenant.id,
        tenantName: tenant.name,
        subdomain: tenant.subdomain || '',
        domain: tenant.subdomain ? `${tenant.subdomain}.${baseDomain}` : '',
        status: 'not_configured' as const,
        dbTracked: false,
        error: 'Gestion des domaines non configurée sur le serveur API (VERCEL_API_TOKEN / VERCEL_PROJECT_ID absents)',
      }));
    }

    const reports: TenantDomainReport[] = [];
    for (const tenant of tenants) {
      if (!tenant.subdomain) {
        this.logger.warn(`⚠️  No subdomain for tenant ${tenant.id} — skipping domain creation`);
        reports.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          subdomain: '',
          domain: '',
          status: 'failed',
          error: 'Aucun sous-domaine défini pour ce tenant',
        });
        continue;
      }

      try {
        const result = await this.domainManagementService.createSchoolSubdomain(
          tenant.subdomain,
          tenant.id,
        );
        reports.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          subdomain: tenant.subdomain,
          domain: result.domain,
          status: result.success ? 'created' : 'failed',
          cloudflareCreated: !!result.cloudflareCreated,
          vercelAdded: !!result.vercelAdded,
          vercelVerified: !!result.vercelVerified,
          dbTracked: !!result.dbTracked,
          error: result.error,
        });

        if (result.success) {
          this.logger.log(
            `✅ Subdomain ${result.domain} created for tenant ${tenant.id} ` +
            `(CF: ${result.cloudflareCreated}, Vercel: ${result.vercelAdded}, Verified: ${result.vercelVerified})`,
          );
        } else {
          this.logger.warn(
            `⚠️  Subdomain creation partial/failed for ${result.domain}: ${result.error}`,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `❌ Unexpected error creating subdomain for tenant ${tenant.id}: ${error.message}`,
        );
        reports.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          subdomain: tenant.subdomain,
          domain: `${tenant.subdomain}.${baseDomain}`,
          status: 'failed',
          error: error.message,
        });
      }
    }
    return reports;
  }

  /**
   * ⭐ Agrège les rapports par école en un statut global d'activation des
   *    domaines : 'created' / 'partial' / 'failed' / 'not_configured'.
   */
  private computeDomainStatus(reports: TenantDomainReport[]): DomainCreationStatus {
    if (reports.length === 0) return 'not_configured';
    const statuses = reports.map((r) => r.status);
    if (statuses.every((s) => s === 'not_configured')) return 'not_configured';
    const created = statuses.filter((s) => s === 'created').length;
    if (created === reports.length) return 'created';
    if (created > 0) return 'partial';
    return 'failed';
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

  /**
   * ⭐ Enregistre le marquage de paiement en espèces (mode YEHI OR Tech).
   *
   * Le wizard collecte à l'étape plan/paiement :
   *   - paiement intégral : cases « souscription payée (espèces) » et
   *     « frais bilingue payés (annuel) » ;
   *   - paiement par tranches : échéancier (libellé, montant, échéance) +
     *     flag « acompte encaissé à la signature ».
   *
   * On persiste le tout dans priceSnapshot.paymentMarked pour :
   *   - la génération du contrat (échéancier à l'Article 4) ;
   *   - la signature différée (les données survivent au rechargement) ;
   *   - l'activation (montant + métadonnées du paiement cash).
   */
  async markCashPayment(
    draftId: string,
    marking: CashPaymentMarking,
  ) {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }
    const snapshot = ((draft.priceSnapshot as any) || {});
    const existing = snapshot.paymentMarked || {};
    // ⭐ Normaliser l'échéancier : montants entiers > 0, 6 tranches max,
    //    labels par défaut — évite d'insérer des données incohérentes.
    const rawInstallments = marking.installments ?? (existing as any).installments;
    const installments = Array.isArray(rawInstallments)
      ? rawInstallments
          .map((inst: any, i: number) => ({
            label: String(inst?.label || (i === 0 ? 'Acompte à la signature' : `Tranche ${i + 1}`)),
            amount: Math.max(0, Math.round(Number(inst?.amount) || 0)),
            dueDate: inst?.dueDate || undefined,
          }))
          .filter((inst: any) => inst.amount > 0)
          .slice(0, 6)
      : undefined;
    const paymentMarked = {
      ...existing,
      ...marking,
      ...(installments !== undefined ? { installments } : {}),
      markedAt: new Date().toISOString(),
    };
    await this.prisma.onboardingDraft.update({
      where: { id: draftId },
      data: {
        priceSnapshot: {
          ...snapshot,
          paymentMarked,
        } as any,
      },
    });
    this.logger.log(`💵 Payment marking saved for draft ${draftId}: ${JSON.stringify(paymentMarked)}`);
    return paymentMarked;
  }

  /**
   * ⭐ Active le tenant après signature du contrat (mode YEHI OR Tech).
   *
   * Ce flux est déclenché par ContractController.signContract() quand le
   * promoteur et le représentant YEHI OR Tech signent le contrat — QUE LE
   * CONTRAT SOIT SIGNÉ NUMÉRIQUEMENT OU DÉJÀ SIGNÉ MANUELLEMENT (papier) :
   * les deux chemins convergent ici et produisent la MÊME création complète
   * de l'école (tenant + souscription + école + niveaux + année + promoteur
   * + UserTenant + SOUS-DOMAINE Cloudflare/Vercel).
   *
   * Il n'y a PAS de paiement FedaPay : le paiement est encaissé en ESPÈCES
   * par l'agent YEHI OR Tech, qui le marque comme payé dans le wizard
   * (cases « souscription payée » et « frais bilingue payés »).
   *
   * ⭐ UNIFICATION : ce flux crée un OnboardingPayment provider='cash'
   *    en statut COMPLETED, puis DÉLÈGUE à activateTenantAfterPayment() —
   *    exactement le même flux d'activation que le mode self-service :
   *    policies pays, Subscription, HelmSubscription, SchoolLevels,
   *    AcademicTracks, AcademicYear, BillingEvent, School, User promoteur
   *    (+ rôle système PROMOTEUR + UserTenant). Les deux modes produisent
   *    donc des écoles strictement identiques.
   *
   * ⭐ AUTO-RÉPARATION : si le draft est déjà COMPLETED mais que le
   *    sous-domaine de l'école n'a jamais été créé (ex : activation
   *    interrompue puis réparée en base), un NOUVEL appel à ce flux recrée
   *    le domaine manquant (idempotent) au lieu de simplement retourner.
   *
   * @param draftId ID du draft d'onboarding
   * @param options Flags de paiement en espèces marqués par l'agent
   * @returns { tenantId, subdomain, hostname, portalUrl, domainStatus, domainReports }
   */
  async activateTenantAfterContractSign(
    draftId: string,
    options?: CashPaymentMarking,
  ): Promise<{
    tenantId: string | null;
    subdomain: string;
    hostname?: string;
    portalUrl?: string;
    domainStatus?: DomainCreationStatus;
    domainReports?: TenantDomainReport[];
  }> {
    this.logger.log(`🔧 Activating tenant after contract sign for draft ${draftId}`);

    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
      include: { payments: true },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    // Idempotence : si le draft est déjà COMPLETED, le tenant a déjà été créé.
    // ⭐ On ne se contente PLUS de retourner : on garantit aussi que le
    //    SOUS-DOMAINE existe (auto-réparation idempotente — cas réel : école
    //    activée en urgence en base sans que le domaine n'ait jamais été
    //    créé par le flux applicatif).
    if (draft.status === 'COMPLETED') {
      this.logger.log(`✅ Draft ${draftId} already completed — finding existing tenant`);
      // ⭐ Retrouver le tenant via le paiement SUCCESS (métadonnées firstTenantSubdomain),
      //    fallback par preferredSubdomain, fallback par nom d'école.
      const successPayment = draft.payments.find((p) => p.status === 'SUCCESS');
      const successMeta = (successPayment?.metadata as any) || {};
      let found: { id: string; name: string; subdomain: string } | null = null;
      if (successMeta.firstTenantSubdomain) {
        found = await this.prisma.tenant.findUnique({
          where: { subdomain: successMeta.firstTenantSubdomain },
          select: { id: true, name: true, subdomain: true },
        });
      }
      if (!found && draft.preferredSubdomain) {
        found = await this.prisma.tenant.findUnique({
          where: { subdomain: draft.preferredSubdomain },
          select: { id: true, name: true, subdomain: true },
        });
      }
      if (!found) {
        found = await this.prisma.tenant.findFirst({
          where: { name: draft.schoolName },
          select: { id: true, name: true, subdomain: true },
        });
      }
      if (found) {
        // ⭐ AUTO-RÉPARATION du sous-domaine (idempotent : ne refait rien si
        //    le domaine est déjà créé et traqué — recrée sinon).
        const domainReports = found.subdomain
          ? await this.createSubdomains([found])
          : [];
        return {
          tenantId: found.id,
          subdomain: found.subdomain || '',
          hostname: successMeta.firstTenantHostname,
          portalUrl: successMeta.firstTenantPortalUrl,
          domainStatus: this.computeDomainStatus(domainReports),
          domainReports,
        };
      }
      // Draft COMPLETED mais tenant introuvable — on continue la création
      this.logger.warn(`⚠️  Draft ${draftId} is COMPLETED but no tenant found — recreating`);
    }

    if (!draft.promoterEmail) {
      throw new BadRequestException('Promoter information is incomplete (missing email)');
    }

    if (!draft.selectedPlanId || !draft.priceSnapshot) {
      throw new BadRequestException('Plan information is incomplete');
    }

    // ─── 1. Enregistrer le paiement en espèces (OnboardingPayment CASH) ───
    const pricing = (draft.priceSnapshot as any) || {};
    // Flags de marquage : options explicites > flags persistés dans le snapshot > défauts
    const snapshotMarked = (pricing.paymentMarked as any) || {};
    const subscriptionPaid = options?.subscriptionPaid ?? snapshotMarked.subscriptionPaid ?? true;
    const bilingualPaid = options?.bilingualPaid ?? snapshotMarked.bilingualPaid ?? draft.bilingual;
    const receivedBy = options?.receivedBy ?? snapshotMarked.receivedBy ?? undefined;
    // ⭐ Échéancier par tranches (paymentPlan='installments') : repris du
    //    snapshot (persisté à l'étape 3) — les options explicites priment.
    const paymentPlan = options?.paymentPlan ?? snapshotMarked.paymentPlan ?? 'full';
    const installments = (options?.installments ?? snapshotMarked.installments) as any[] | undefined;
    const downPaymentReceived = options?.downPaymentReceived ?? snapshotMarked.downPaymentReceived ?? undefined;

    // Montant total Année 1 encaissé en espèces :
    //   frais d'activation + frais annuels du plan + option bilingue (annuelle)
    // subscriptionPrice (snapshot PricingService) inclut déjà l'option bilingue.
    const activationFee = Number(pricing.initialPayment ?? pricing.initialFee ?? 500000) || 0;
    const annualFee = Number(pricing.yearlyPrice ?? 50000) || 0;
    const bilingualFee = draft.bilingual ? Number(pricing.bilingualFee ?? 100000) || 0 : 0;
    const totalFromSnapshot = Number(pricing.subscriptionPrice ?? 0) || 0;
    // ⭐ MULTI-ÉCOLES : chaque école fondée paie sa propre souscription
    //    (activation + frais annuels + option bilingue) — « c'est payant en
    //    fonction du nombre d'écoles ». Le paiement unique du contrat couvre
    //    l'ensemble du groupe déclaré à l'onboarding.
    const schoolsCount = Math.max(1, draft.schoolsCount || 1);
    const perSchoolTotal = totalFromSnapshot > 0
      ? Math.round(activationFee + totalFromSnapshot)
      : Math.round(activationFee + annualFee + bilingualFee);
    // ⭐ Barème progressif du coût d'activation : le total du groupe n'est PAS
    //    activation × N — chaque rang porte sa remise (2e −15 %, 3e −20 %,
    //    4e −25 %). Mono-école (annexe depuis les paramètres) : initialFee est
    //    DÉJÀ le tarif remisé (patch createAnnexDraft) → formule inchangée.
    const activationTotal = Number(pricing.activationTotal ?? 0) || 0;
    const totalAmount = schoolsCount > 1
      ? (activationTotal > 0
        ? Math.round(activationTotal + (perSchoolTotal - activationFee) * schoolsCount)
        : perSchoolTotal * schoolsCount)
      : perSchoolTotal;

    // Réutiliser un paiement cash existant (idempotence), sinon le créer
    let payment = draft.payments.find((p) => p.provider === 'cash');
    if (!payment) {
      const hasInstallments = paymentPlan === 'installments' && Array.isArray(installments) && installments.length > 0;
      const scheduleTotal = hasInstallments
        ? installments!.reduce((sum, inst) => sum + (Number(inst?.amount) || 0), 0)
        : 0;
      // ⭐ Mode tranches : le montant du paiement reste le TOTAL Année 1
      //    (valeur de la souscription). L'échéancier est conservé en
      //    métadonnées (installments) avec le statut d'encaissement de
      //    l'acompte ; la collecte du solde est suivie hors plateforme.
      payment = await this.prisma.onboardingPayment.create({
        data: {
          draftId: draft.id,
          provider: 'cash',
          reference: `CASH-${draft.id.substring(0, 8).toUpperCase()}-${Date.now()}`,
          amount: hasInstallments && scheduleTotal > 0 ? scheduleTotal : totalAmount,
          currency: (pricing.currency as string) || 'XOF',
          status: 'COMPLETED', // Encaissé en espèces — marqué payé par l'agent YEHI OR Tech
          metadata: {
            paymentMarked: {
              subscriptionPaid,
              bilingualPaid,
              receivedBy: receivedBy || null,
              markedAt: new Date().toISOString(),
            },
            breakdown: {
              activationFee, annualFee, bilingualFee, schoolsCount, perSchoolTotal, total: totalAmount,
              // ⭐ Barème progressif du coût d'activation (audit — contrat Article 4)
              ...(activationTotal > 0 ? { activationTotal } : {}),
              ...(pricing.activationBaseFee != null ? { activationBaseFee: Number(pricing.activationBaseFee) } : {}),
              ...(pricing.activationDiscountPercent != null
                ? { activationDiscountPercent: Number(pricing.activationDiscountPercent) }
                : {}),
              ...(pricing.annexRank != null ? { annexRank: Number(pricing.annexRank) } : {}),
            },
            ...(hasInstallments
              ? {
                  paymentPlan: 'installments' as const,
                  installments,
                  downPaymentReceived: downPaymentReceived ?? false,
                  scheduleTotal,
                  remainingBalance: Math.max(0, scheduleTotal - (downPaymentReceived ? Number(installments![0]?.amount) || 0 : 0)),
                  note: "Paiement en espèces PAR TRANCHES encaissé/suivi par YEHI OR Tech (aucun PSP en ligne — pas de webhook) — échéancier en métadonnées, solde suivi hors plateforme",
                }
              : {
                  note: "Paiement encaissé en espèces par YEHI OR Tech (aucun PSP en ligne — pas de webhook)",
                }),
          } as any,
        },
      });
      this.logger.log(
        `💵 Cash payment recorded for draft ${draftId}: ${payment.amount} XOF (réf. ${payment.reference})` +
        (hasInstallments ? ` — ${installments!.length} tranches (acompte ${downPaymentReceived ? 'encaissé' : 'à encaisser'})` : ''),
      );
    }

    // ─── 2. Déléguer au flux d'activation UNIFIÉ (identique au mode self-service) ───
    const activation = await this.activateTenantAfterPayment(payment.id) as any;
    this.logger.log(`✅ Tenant activated after contract sign for draft ${draftId}`);

    // ─── 2bis. Envoyer l'email de bienvenue avec les identifiants ───
    // ⭐ EXACTEMENT le même email que le flux self-service FedaPay
    //    (sendOnboardingPaymentSuccessEmail → template paymentSuccess
    //    « ✅ Bienvenue sur Academia Helm — Vos accès sont prêts » :
    //    récapitulatif du plan, carte identifiants or, URL de connexion).
    //    Le contrôleur envoie en parallèle l'email du contrat signé (PDF
    //    en pièce jointe) — le promoteur reçoit donc les DEUX messages.
    //    Non-bloquant (l'email est catché en interne) ; uniquement sur
    //    activation fraîche (pas en mode idempotent déjà activé).
    if (!activation?.alreadyActivated) {
      await this.sendWelcomeEmailForPayment(payment.id, payment.reference);
    }

    // ─── 3. Retourner les infos de connexion (sous-domaine, portail) ───
    //    ⭐ + l'état RÉEL de la création du sous-domaine (rapport par école) :
    //    l'appelant sait si {subdomain}.academiahelm.com existe ou non.
    const refreshedPayment = await this.prisma.onboardingPayment.findUnique({
      where: { id: payment.id },
    });
    const meta = (refreshedPayment?.metadata as any) || {};
    const domainReports = (activation?.domainReports as TenantDomainReport[] | undefined) || [];
    return {
      tenantId: activation?.tenants?.[0]?.id || null,
      subdomain: meta.firstTenantSubdomain || draft.preferredSubdomain || '',
      hostname: meta.firstTenantHostname,
      portalUrl: meta.firstTenantPortalUrl,
      domainStatus: (activation?.domainStatus as DomainCreationStatus | undefined)
        || this.computeDomainStatus(domainReports),
      domainReports,
    };
  }

  /**
   * ============================================================================
   * MULTI-ÉCOLES — Éligibilité et création d'annexe (paramètres promoteur)
   * ============================================================================
   */

  /**
   * Éligibilité multi-écoles du promoteur courant :
   * écoles déjà gérées (UserTenant ∪ direct) + prix de la prochaine annexe.
   */
  async getAnnexEligibility(user: { sub: string; role?: string; tenantId?: string }) {
    // ⭐ Même périmètre que auth.service.getAvailableTenants / selectTenant /
    //    analytics.resolveScope : UserTenant actives ∪ tenant direct.
    const tenantIds = new Set<string>();
    if (user.tenantId) tenantIds.add(user.tenantId);
    try {
      const userTenants = await this.prisma.userTenant.findMany({
        where: { userId: user.sub, isActive: true },
        select: { tenantId: true },
      });
      for (const ut of userTenants) tenantIds.add(ut.tenantId);
    } catch (err: any) {
      this.logger.warn(`⚠️ UserTenant indisponible (éligibilité réduite au tenant direct) : ${err?.message || err}`);
    }

    const schools = tenantIds.size > 0
      ? await this.prisma.tenant.findMany({
          where: { id: { in: Array.from(tenantIds) }, status: 'active', type: schoolTenantTypeFilter() },
          select: {
            id: true, name: true, subdomain: true,
            schools: { select: { city: true } },
            _count: { select: { students: true } },
          },
          orderBy: { name: 'asc' },
        }).catch(() => [])
      : [];

    const bySchool = (schools as any[]).map((t) => ({
      tenantId: t.id,
      name: t.name,
      subdomain: t.subdomain,
      city: t.schools?.city || null,
    }));

    // Prix d'une nouvelle annexe : PAR ÉCOLE (contrat Article 3/4) —
    // activation + frais annuels du plan + option bilingue.
    // ⭐ Barème progressif du COÛT D'ACTIVATION selon le rang de l'annexe
    //    dans le groupe : 1re école 100 % (500 000), 2e −15 % (425 000),
    //    3e −20 % (400 000), 4e −25 % (375 000), 5e et + NÉGOCIÉ.
    const plans = await this.prisma.pricingPlan
      .findMany({
        where: { code: { in: ['SEED', 'GROW', 'LEAD', 'NETWORK'] }, isActive: true },
        select: { code: true, name: true, initialFee: true, yearlyAmount: true, studentMin: true, studentMax: true },
      })
      .catch(() => [] as any[]);

    let bilingualYearly = 100000;
    try {
      const bilingualPlan = await this.prisma.pricingPlan.findUnique({ where: { code: 'BILINGUAL' } });
      if (bilingualPlan?.yearlyAmount != null) bilingualYearly = Number(bilingualPlan.yearlyAmount);
    } catch {
      // fallback constant
    }

    // ⭐ Rang de la prochaine annexe → tarif d'activation remisé (ou négocié)
    const nextAnnexIndex = bySchool.length + 1;
    const baseActivationFee = plans.length > 0 && (plans as any[])[0].initialFee != null
      ? Number((plans as any[])[0].initialFee)
      : 500000;
    const annexActivation = getAnnexActivationPricing(nextAnnexIndex, baseActivationFee);

    return {
      eligible: bySchool.length >= 1,
      currentSchools: bySchool,
      nextAnnexIndex,
      // ⭐ Tarif d'activation de la prochaine annexe (barème progressif).
      //    negotiated = true dès la 5e école : aucun tarif automatique,
      //    l'UI oriente vers la tarification négociée (contact support).
      annexActivation: {
        rank: annexActivation.rank,
        negotiated: annexActivation.negotiated,
        baseFee: annexActivation.baseFee,
        fee: annexActivation.fee,
        discountPercent: annexActivation.discountPercent,
      },
      pricing: {
        currency: 'XOF',
        bilingualYearly,
        plans: (plans as any[]).map((p) => {
          const planBase = Number(p.initialFee ?? 500000);
          const tier = getAnnexActivationPricing(nextAnnexIndex, planBase);
          // Non négocié : tarif remisé par rang ; négocié : tarif de base
          // (l'UI affiche la mention « tarification négociée » et bloque).
          const activationFee = tier.negotiated ? planBase : (tier.fee as number);
          return {
            code: p.code,
            name: p.name,
            activationFee,
            annualFee: Number(p.yearlyAmount ?? 0),
            yearOnePerSchool: activationFee + Number(p.yearlyAmount ?? 0),
            studentMin: p.studentMin ?? 0,
            studentMax: p.studentMax ?? null,
          };
        }),
      },
    };
  }

  /**
   * Crée le draft d'onboarding de l'ÉCOLE ANNEXE pour un promoteur
   * AUTHENTIFIÉ (activation multi-écoles depuis les paramètres).
   *
   * Le promoteur est une source de confiance : ses infos (email, noms) sont
   * pré-remplies depuis son compte — aucune validation d'agent YEHI OR Tech
   * n'est requise (contrairement au signup public). Le draft est mono-école
   * (l'annexe) ; l'activation le reliera au groupe du promoteur via
   * UserTenant (branche « promoteur existant réutilisé » + boucle annexes).
   */
  async createAnnexDraft(
    identity: { userId: string; email?: string; firstName?: string; lastName?: string },
    data: {
      annexName: string;
      annexCity: string;
      schoolType: string;
      phone: string;
      email: string;
      planCode: string;
      estimatedStudentCount: number;
      bilingual?: boolean;
      preferredSubdomain?: string;
    },
  ) {
    // 1. Profil complet du promoteur (le JWT ne porte pas les noms)
    const promoter = await this.prisma.user.findUnique({
      where: { id: identity.userId },
      select: { id: true, email: true, firstName: true, lastName: true, tenantId: true, status: true },
    });
    if (!promoter || promoter.status !== 'active') {
      throw new BadRequestException('Compte promoteur introuvable ou inactif.');
    }

    // 2. Le promoteur doit gérer au moins une école (multi-écoles = extension)
    const managedTenantIds = new Set<string>();
    if (promoter.tenantId) managedTenantIds.add(promoter.tenantId);
    try {
      const userTenants = await this.prisma.userTenant.findMany({
        where: { userId: promoter.id, isActive: true },
        select: { tenantId: true },
      });
      for (const ut of userTenants) managedTenantIds.add(ut.tenantId);
    } catch {
      // table absente → tenant direct seulement
    }
    if (managedTenantIds.size === 0) {
      throw new BadRequestException(
        'Aucune école rattachée à ce compte — le multi-écoles étend un groupe existant.',
      );
    }

    // 2bis. ⭐ Barème progressif du coût d'activation : rang de l'annexe =
    //       nombre d'écoles ACTIVES déjà gérées + 1 (1re école = principale).
    //       2e école −15 %, 3e −20 %, 4e −25 % — à partir de la 5e école,
    //       tarification NÉGOCIÉE : la création en libre-service est bloquée,
    //       le promoteur est orienté vers la négociation avec la plateforme.
    let managedSchoolCount = 0;
    if (managedTenantIds.size > 0) {
      try {
        managedSchoolCount = await this.prisma.tenant.count({
          where: { id: { in: Array.from(managedTenantIds) }, status: 'active', type: schoolTenantTypeFilter() },
        });
      } catch {
        // Type absent (base non migrée) → approximation prudente
        managedSchoolCount = managedTenantIds.size;
      }
    }
    const annexRank = Math.max(1, managedSchoolCount + 1);
    if (annexRank >= ANNEX_NEGOTIATED_RANK) {
      throw new BadRequestException(ANNEX_NEGOTIATED_MESSAGE);
    }

    // 3. Pays : celui du tenant courant du promoteur (annexe même pays)
    const currentTenant = await this.prisma.tenant.findFirst({
      where: { id: { in: Array.from(managedTenantIds) } },
      select: { countryId: true, country: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const countryName = currentTenant?.country?.name || 'Bénin';

    // 4. Créer le draft (mono-école — l'annexe) via le flux standard
    const draft = await this.createDraft({
      schoolName: data.annexName,
      schoolType: data.schoolType === 'mixte' || data.schoolType === 'SCHOOL' ? 'MIXTE' : data.schoolType,
      city: data.annexCity,
      country: countryName,
      phone: data.phone,
      email: data.email,
      bilingual: data.bilingual || false,
      schoolsCount: 1,
      preferredSubdomain: data.preferredSubdomain,
    });

    // 5. Pré-remplir les infos promoteur DEPUIS LA SESSION (source de
    //    confiance — pas d'OTP, pas de validation agent) et verrouiller
    //    l'étape : otpVerified=true, promoteur = compte existant.
    const updated = await this.prisma.onboardingDraft.update({
      where: { id: draft.id },
      data: {
        promoterFirstName: promoter.firstName || identity.firstName || '',
        promoterLastName: promoter.lastName || identity.lastName || '',
        promoterEmail: promoter.email, // ⭐ le compte EXISTANT est réutilisé à l'activation
        promoterPhone: data.phone,
        otpVerified: true,
        // ⭐ Annexe depuis les paramètres : pas de mot de passe à définir —
        //    l'activation met à jour le user existant sans y toucher si absent.
      },
    });

    // 6. Sélectionner le plan (snapshot de prix complet — même machinerie)
    const planSelection = await this.selectPlan(updated.id, {
      planId: data.planCode,
      periodType: 'YEARLY',
    });

    // 6bis. ⭐ Barème progressif — le coût d'activation de l'annexe est
    //       remisé selon son rang (2e école −15 % → 425 000, 3e −20 % →
    //       400 000, 4e −25 % → 375 000). Le snapshot de prix (source de
    //       vérité du contrat, du paiement cash et de la reprise de draft)
    //       porte le tarif remisé + les métadonnées du barème (base, remise,
    //       rang) pour que le contrat en tienne compte à tous les niveaux.
    const annexSnapshot = (planSelection.pricing as any) || {};
    const baseActivationFee = Number(annexSnapshot.initialFee ?? annexSnapshot.initialPayment ?? 500000) || 500000;
    const annexTier = getAnnexActivationPricing(annexRank, baseActivationFee);
    if (!annexTier.negotiated && annexTier.fee != null) {
      const patchedSnapshot = {
        ...annexSnapshot,
        initialFee: annexTier.fee,
        initialPayment: annexTier.fee, // alias historique — même tarif remisé
        activationBaseFee: baseActivationFee,
        activationDiscountPercent: annexTier.discountPercent,
        annexRank: annexTier.rank,
      };
      await this.prisma.onboardingDraft.update({
        where: { id: updated.id },
        data: { priceSnapshot: patchedSnapshot as unknown as Prisma.InputJsonValue },
      });
      planSelection.pricing = patchedSnapshot;
      updated.priceSnapshot = patchedSnapshot as unknown as Prisma.InputJsonValue;
      this.logger.log(
        `🎓 Barème activation annexe appliqué (draft ${updated.id}) : rang ${annexTier.rank} → ` +
        `${annexTier.fee} XOF (−${annexTier.discountPercent} % sur ${baseActivationFee})`,
      );
    }

    this.logger.log(
      `🏫 Annexe draft created for promoter ${promoter.email}: ${draft.id} « ${data.annexName} » (plan ${data.planCode}${data.bilingual ? ' + bilingue' : ''})`,
    );

    return {
      draftId: draft.id,
      draft: updated,
      pricing: planSelection.pricing,
      promoter: {
        email: promoter.email,
        firstName: promoter.firstName,
        lastName: promoter.lastName,
      },
    };
  }
}
