/**
 * FederisFedapayService — Paiement Fedapay des abonnements patronat
 * ═══════════════════════════════════════════════════════════════════════════
 * Academia Federis (cahier des charges §12) — MÊME PATTER QUE ACADEMIA HELM
 * (billing/services/fedapay.service.ts + onboarding.service.ts) :
 *
 *   1. Init paiement      POST /federis/patronat/checkout (protégé JWT)
 *      → transaction Fedapay créée via le SDK officiel avec metadata
 *        (type: federis_subscription + federisInvoiceId…), callbackUrl qui
 *        ramène vers la page succès (FedaPay REMPLACE les query params par
 *        ?id={transactionId}&status=approved — d'où le lookup by-transaction)
 *        et webhook_url propre à Federis.
 *   2. Webhook            POST /federis/public/fedapay/webhook (public)
 *      → vérification de signature HMAC (FEDAPAY_WEBHOOK_SECRET, fail-closed
 *        en production), parsing du payload, routage par événement :
 *          transaction.approved / completed → activation de l'abonnement
 *              + attribution du sous-domaine + email identifiants
 *          transaction.declined / failed    → facture marquée en échec
 *          transaction.canceled             → tentative annulée
 *   3. Vérification       POST /federis/public/checkout/verify (public)
 *      → interroge l'API Fedapay RÉELLE (verifyTransactionStatus du module
 *        billing Helm) ; si approuvé → activation idempotente (fallback si
 *        le webhook n'est pas arrivé — MÊME pattern que
 *        onboarding.service.verifyPaymentStatus). Le frontend ne fait
 *        JAMAIS confiance au callback navigateur.
 *   4. Lookup             GET /federis/public/checkout/by-transaction/:id
 *      → retrouve la facture depuis l'ID numérique Fedapay (param ?id= de la
 *        redirection) — pattern onboarding findPaymentByTransactionId.
 *
 * Sous-domaines patronat (attribution à l'activation, après paiement) :
 *   - National    → patronatnational.academiahelm.com
 *   - Département → patronat{département}.academiahelm.com
 *     (ex: Atlantique → patronatatlantique) — suffixe -2, -3… en cas de
 *     collision (unicité tenant.subdomain), pattern Helm subdomainService.
 *
 * Sécurité & robustesse (identiques au module billing Helm) :
 *   - Signature obligatoire en production (jamais de mode permissif)
 *   - Montant vérifié contre la facture avant activation (montant Fedapay
 *     réel : metadata.amountFedapay — plafonné en sandbox — sinon facture)
 *   - Idempotence : facture déjà PAYEE → webhook ignoré proprement
 *   - Transaction Prisma : facture + paiement + patronat + tenant + audit
 *   - PaymentWebhookLog en cas d'erreur de traitement
 *   - Les transactions non-Federis (onboarding Helm…) reçues sur cette URL
 *     sont ignorées sans erreur (metadata.type ≠ federis_subscription)
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { FedaPayService } from '../billing/services/fedapay.service';
import { EmailService } from '../communication/services/email.service';
import { federisEmailTemplates } from './federis-email-templates';
import type { FederisPlanCode } from './federis-patronat.service';

/** Marker metadata des transactions d'abonnement Federis. */
export const FEDERIS_TX_TYPE = 'federis_subscription';

/** Plafond API test Fedapay sandbox (même limite que le module Helm). */
const FEDAPAY_SANDBOX_MAX = 20_000;

/** Slugifie un libellé (accents supprimés, minuscules, sans séparateurs). */
function slugifyCompact(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 40) || ''
  );
}

@Injectable()
export class FederisFedapayService {
  private readonly logger = new Logger(FederisFedapayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    /** Passerelle Fedapay partagée avec Academia Helm (SDK + signature). */
    private readonly fedapayService: FedaPayService,
    private readonly emailService: EmailService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // 0. CONFIGURATION (pattern Helm)
  // ══════════════════════════════════════════════════════════════════════

  /** Clé secrète Fedapay configurée ? (sinon checkout en mode manuel) */
  isConfigured(): boolean {
    const key = (this.configService.get<string>('FEDAPAY_API_KEY') || '').trim();
    return key.length > 0;
  }

  /**
   * Mode live Fedapay ? (même logique de détection que le module Helm :
   * FEDAPAY_ENVIRONMENT explicite, sinon préfixe de la clé sk_live_.)
   */
  private isLiveMode(): boolean {
    const explicit = (this.configService.get<string>('FEDAPAY_ENVIRONMENT') || '')
      .trim()
      .toLowerCase();
    if (explicit === 'live') return true;
    if (explicit === 'sandbox') return false;
    const apiKey = (this.configService.get<string>('FEDAPAY_API_KEY') || '').trim();
    return apiKey.startsWith('sk_live_') || apiKey.startsWith('pk_live_');
  }

  /**
   * Base publique de l'API pour le webhook Federis (même chaîne d'env que
   * Helm : FEDAPAY_WEBHOOK_BASE_URL → PUBLIC_API_URL → API_URL).
   * Ex. prod : https://api.academiahelm.com/api/federis/public/fedapay/webhook
   */
  buildWebhookUrl(): string {
    const base = (
      this.configService.get<string>('FEDAPAY_WEBHOOK_BASE_URL') ||
      this.configService.get<string>('PUBLIC_API_URL') ||
      this.configService.get<string>('API_URL') ||
      ''
    )
      .trim()
      .replace(/\/$/, '');
    return `${base}/api/federis/public/fedapay/webhook`;
  }

  /** URL publique de l'application Federis (satellite academiafederis). */
  private federisAppBaseUrl(): string {
    return (
      this.configService.get<string>('FEDERIS_APP_URL') ||
      this.configService.get<string>('FEDERIS_CHECKOUT_RETURN_URL') ||
      'https://academiafederis.academiahelm.com'
    )
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/checkout\/success$/, '');
  }

  /**
   * Domaine racine du frontend (pattern Helm buildTenantSiteUrl : on retire
   * www. et tout sous-domaine pour reconstruire {sub}.{domaine}).
   */
  private frontendRootDomain(): string {
    const frontend = (this.configService.get<string>('FRONTEND_URL') || 'https://academiahelm.com')
      .trim()
      .replace(/\/+$/, '');
    try {
      const u = new URL(frontend);
      let host = u.hostname;
      if (host.startsWith('www.')) host = host.slice(4);
      // Retirer un éventuel sous-domaine applicatif (academiafederis., app., portal.)
      const parts = host.split('.');
      if (parts.length > 2) return parts.slice(-2).join('.');
      return host;
    } catch {
      return 'academiahelm.com';
    }
  }

  /** URL de la landing page publique du patronat : https://{sub}.{domaine}/ */
  buildPatronatSiteUrl(subdomain: string): string {
    return `https://${subdomain}.${this.frontendRootDomain()}`;
  }

  /** URL de connexion Federis du patronat : https://{sub}.{domaine}/login */
  buildPatronatLoginUrl(subdomain: string): string {
    return `${this.buildPatronatSiteUrl(subdomain)}/login`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. SOUS-DOMAINES PATRONAT (pattern Helm subdomainService)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Sous-domaine de base d'un patronat :
   *   - National    → patronatnational
   *   - Département → patronat{département} (ex: Atlantique → patronatatlantique)
   * Fallback : patronat + nom du patronat si le département est inconnu.
   */
  buildPatronatSubdomain(patronat: {
    orgLevel: string | null;
    territoryName?: string | null;
    name: string;
  }): string {
    if (patronat.orgLevel === 'NATIONAL') {
      return 'patronatnational';
    }
    const territory = slugifyCompact(patronat.territoryName ?? '');
    if (territory) {
      return `patronat${territory}`;
    }
    const name = slugifyCompact(patronat.name);
    return name ? `patronat${name}` : 'patronat';
  }

  /** Rend un sous-domaine unique (suffixe -2, -3… — pattern Helm generateAndValidate). */
  private async ensureUniqueSubdomain(base: string): Promise<string> {
    let candidate = base;
    let suffix = 2;
    // tenant.subdomain est unique ; tenant.slug aussi mais distinct.
    while (await this.prisma.tenant.findUnique({ where: { subdomain: candidate } })) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }

  /**
   * Attribue le sous-domaine au tenant du patronat (idempotent).
   * ⭐ Appelé à l'ACTIVATION (après paiement), comme Helm qui crée le tenant
   *    avec son sous-domaine dans activateTenantAfterPayment.
   */
  async assignPatronatSubdomain(patronat: {
    id: string;
    tenantId: string;
    name: string;
    orgLevel: string | null;
    territoryName?: string | null;
  }): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: patronat.tenantId },
      select: { id: true, subdomain: true, slug: true },
    });
    if (tenant?.subdomain) {
      return tenant.subdomain;
    }

    let assigned: string | null = null;
    for (let attempt = 0; attempt < 5 && !assigned; attempt++) {
      const base = this.buildPatronatSubdomain(patronat);
      const candidate = await this.ensureUniqueSubdomain(base);
      try {
        const updated = await this.prisma.tenant.update({
          where: { id: patronat.tenantId },
          data: { subdomain: candidate },
          select: { subdomain: true },
        });
        assigned = updated.subdomain;
      } catch (err: any) {
        // Collision concurrente sur l'unique → retenter avec le suffixe suivant
        if (err?.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }
    if (!assigned) {
      throw new Error(`Impossible d'attribuer un sous-domaine unique au patronat ${patronat.id}`);
    }

    // Tracer l'attribution sur la fiche patronat (metadata.subdomainAssignedAt)
    // ⚠️ Prisma remplace tout le champ Json : on RECHARGE le metadata courant
    //    (ex: organismType posé à l'inscription) avant d'écrire.
    const patronatMeta = await this.prisma.patronat
      .findUnique({ where: { id: patronat.id }, select: { metadata: true } })
      .catch(() => null);
    await this.prisma.patronat
      .update({
        where: { id: patronat.id },
        data: {
          metadata: {
            ...((patronatMeta?.metadata as Record<string, unknown>) ?? {}),
            subdomain: assigned,
            subdomainAssignedAt: new Date().toISOString(),
          },
        } as any,
      })
      .catch(() => undefined);

    this.logger.log(
      `🌐 Sous-domaine patronat attribué : ${assigned} (tenant ${patronat.tenantId})`,
    );
    return assigned;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. CRÉATION DE TRANSACTION (pattern Helm — createOnboardingPaymentSession)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Crée la transaction Fedapay d'une facture d'abonnement (SDK officiel,
   * même chemin que Helm). callbackUrl ramène à la page succès avec
   * l'identifiant de facture ; FedaPay REMPLACE les query params par
   * ?id={transactionId}&status=approved → la page succès utilise le lookup
   * by-transaction pour retrouver la facture (pattern Helm /signup/confirmation).
   *
   * ⭐ Sandbox : montant plafonné à 20 000 XOF (limite API test Fedapay) —
   *    le montant RÉEL reste sur la facture (pattern Helm).
   */
  async createSubscriptionTransaction(params: {
    invoice: { id: string; number: string; amount: number };
    patronat: {
      id: string;
      tenantId: string;
      name: string;
      primaryEmail?: string | null;
      primaryPhone?: string | null;
    };
    plan: { code: FederisPlanCode; name: string };
  }): Promise<{ paymentUrl: string | null; transactionId: string | null; amountFedapay: number }> {
    const { invoice, patronat, plan } = params;

    // ⭐ Montant envoyé à Fedapay : réel en live, plafonné en sandbox (Helm).
    const amountReal = invoice.amount;
    const amountFedapay = this.isLiveMode()
      ? amountReal
      : Math.min(amountReal, FEDAPAY_SANDBOX_MAX);
    if (amountFedapay !== amountReal) {
      this.logger.log(
        `🧪 Sandbox Fedapay : montant réel ${amountReal} XOF → montant transaction ${amountFedapay} XOF (plafonné). La facture ${invoice.number} conserve le montant réel.`,
      );
    }

    const appBase = this.federisAppBaseUrl();
    // FedaPay remplace les query params à la redirection — invoiceId est un
    // best-effort, le lookup by-transaction reste le chemin nominal.
    const callbackUrl = `${appBase}/checkout/success?invoiceId=${encodeURIComponent(invoice.id)}`;
    const cancelUrl = `${appBase}/checkout`;

    const metadata = {
      type: FEDERIS_TX_TYPE,
      federisInvoiceId: invoice.id,
      invoiceNumber: invoice.number,
      patronatId: patronat.id,
      tenantId: patronat.tenantId,
      plan: plan.code,
      amountReal,
      amountFedapay,
      // ⭐ Le SDK recopie webhookUrl dans transactionData.webhook_url —
      //    chaque transaction Federis porte SON webhook (pattern Helm).
      webhookUrl: this.buildWebhookUrl(),
    };

    const tx = await this.fedapayService.createTransaction({
      amount: amountFedapay,
      description: `${plan.name} — ${patronat.name} (${invoice.number})`,
      callbackUrl,
      cancelUrl,
      currency: 'XOF',
      metadata,
      ...(patronat.primaryEmail
        ? {
            customer: {
              email: patronat.primaryEmail,
              firstname: patronat.name.slice(0, 60),
              ...(patronat.primaryPhone ? { phone_number: patronat.primaryPhone } : {}),
              countryName: 'Bénin',
            },
          }
        : {}),
    });

    return {
      paymentUrl: tx.paymentUrl ?? null,
      transactionId: tx.transactionId != null ? String(tx.transactionId) : null,
      amountFedapay,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. WEBHOOK (pattern Helm — assertValidFedaPayWebhookSignature + parse)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Point d'entrée du webhook : signature → parsing → routage.
   * ⚠️ CRITIQUE : le body BRUT (req.rawBody) est obligatoire pour que le
   * HMAC corresponde (même exigence que le module billing Helm).
   */
  async handleWebhook(payloadString: string, signatureHeader: string | undefined, payload: any) {
    await this.fedapayService.assertValidFedaPayWebhookSignature(payloadString, signatureHeader);

    const { event, transaction } = this.fedapayService.parseFedaPayWebhookPayload(payload);

    this.logger.log(`📥 Webhook Fedapay Federis : ${event} — Transaction ${transaction?.id}`);

    switch (event) {
      case 'transaction.approved':
      case 'transaction.completed':
        return this.handlePaymentApproved(transaction);
      case 'transaction.declined':
      case 'transaction.failed':
        return this.handlePaymentDeclined(transaction, 'DECLINED');
      case 'transaction.canceled':
        return this.handlePaymentDeclined(transaction, 'CANCELED');
      default:
        this.logger.warn(`⚠️  Événement Fedapay non géré : ${event}`);
        return { received: true, processed: false };
    }
  }

  /**
   * Normalise metadata + custom_metadata d'une transaction Fedapay (le
   * payload peut renvoyer l'un, l'autre, ou un JSON string — même logique
   * que BillingService.normalizeFedaPayTransactionMetadata).
   */
  private normalizeMetadata(transaction: any): Record<string, any> {
    const merge = (obj: unknown): Record<string, any> => {
      if (obj == null) return {};
      if (typeof obj === 'string') {
        try {
          const p = JSON.parse(obj);
          return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : {};
        } catch {
          return {};
        }
      }
      if (typeof obj === 'object' && !Array.isArray(obj)) return { ...(obj as any) };
      return {};
    };
    return { ...merge(transaction?.metadata), ...merge(transaction?.custom_metadata) };
  }

  /** Résout la facture Federis visée par une transaction webhook. */
  private async findInvoiceForTransaction(
    transaction: any,
    meta: Record<string, any>,
  ): Promise<{
    id: string;
    number: string;
    amount: number;
    status: string;
    patronatId: string;
    tenantId: string;
    metadata: any;
  } | null> {
    // 1. Identifiant direct (metadata de la transaction créée au checkout)
    const invoiceId = typeof meta.federisInvoiceId === 'string' ? meta.federisInvoiceId : null;
    if (invoiceId) {
      const byId = await this.prisma.federisInvoice.findUnique({ where: { id: invoiceId } });
      if (byId) return byId;
    }

    // 2. Référence transaction stockée sur la facture au moment du checkout
    const txId = transaction?.id != null ? String(transaction.id) : null;
    const txRef = transaction?.reference ?? transaction?.reference_id ?? null;
    if (txId || txRef) {
      const candidates = await this.prisma.federisInvoice.findMany({
        where: { status: { in: ['UNPAID', 'PENDING'] } },
        take: 200,
        orderBy: { createdAt: 'desc' },
      });
      const matched = candidates.find((inv) => {
        const m = (inv.metadata as any) ?? {};
        return (
          (txId && m.providerTransactionId === txId) || (txRef && m.providerReference === txRef)
        );
      });
      if (matched) return matched;
    }

    return null;
  }

  /** Journalise une erreur de traitement dans PaymentWebhookLog (best-effort). */
  private async logWebhookError(
    reference: string,
    event: string,
    payload: any,
    error: unknown,
  ): Promise<void> {
    try {
      await this.prisma.paymentWebhookLog.create({
        data: {
          reference,
          provider: 'fedapay-federis',
          eventType: event,
          payload: payload as any,
          processedAt: new Date(),
          metadata: {
            status: 'ERROR',
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        },
      });
    } catch (logError) {
      this.logger.error(`Journalisation webhook impossible : ${logError}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. PAIEMENT APPROUVÉ → ACTIVATION + SOUS-DOMAINE + EMAIL (pattern Helm)
  // ══════════════════════════════════════════════════════════════════════

  private async handlePaymentApproved(transaction: any) {
    const meta = this.normalizeMetadata(transaction);

    // Transactions d'autres modules (onboarding Helm…) éventuellement
    // reçues sur cette URL : ignorées proprement.
    if (meta.type && meta.type !== FEDERIS_TX_TYPE) {
      this.logger.log(`Transaction non-Federis ignorée (type=${meta.type}).`);
      return { received: true, processed: false, reason: 'not_federis' };
    }

    const invoice = await this.findInvoiceForTransaction(transaction, meta);
    if (!invoice) {
      this.logger.error(
        `❌ Facture Federis introuvable pour la transaction ${transaction?.id} (réf ${transaction?.reference}).`,
      );
      await this.logWebhookError(
        String(transaction?.reference ?? transaction?.id ?? 'unknown'),
        'transaction.approved',
        transaction,
        'invoice_not_found',
      );
      return { received: true, processed: false, reason: 'invoice_not_found' };
    }

    // Activation idempotente (sous-domaine + email identifiants). Un mismatch
    // de montant lève BadRequestException : on ne renvoie PAS d'erreur HTTP à
    // Fedapay (retries infinis) mais une réponse structurée non traitée.
    try {
      const activation = await this.activateSubscriptionAfterPayment(
        invoice,
        transaction,
        'webhook',
      );
      return {
        received: true,
        processed: !activation.alreadyActivated,
        invoiceNumber: invoice.number,
        plan: activation.planCode,
        subdomain: activation.subdomain,
        expiresAt: activation.expiresAt,
        alreadyActivated: activation.alreadyActivated,
      };
    } catch (activationErr: any) {
      if (activationErr instanceof BadRequestException) {
        this.logger.error(
          `❌ Activation refusée pour la facture ${invoice.number} : ${activationErr.message}`,
        );
        return { received: true, processed: false, reason: 'activation_rejected' };
      }
      throw activationErr;
    }
  }

  /**
   * ⭐ CŒUR DU PATTERN HELM (activateTenantAfterPayment + email bienvenue) :
   * activation idempotente de l'abonnement + attribution du sous-domaine +
   * email automatique avec identifiants et domaine.
   *
   * Appelé par :
   *   - le webhook (transaction.approved) — chemin nominal ;
   *   - POST /federis/public/checkout/verify — fallback si le webhook
   *     n'est pas arrivé (MÊME logique que onboarding.service).
   */
  async activateSubscriptionAfterPayment(
    invoice: {
      id: string;
      number: string;
      amount: number;
      status: string;
      patronatId: string;
      tenantId: string;
      metadata: any;
    },
    transaction: any,
    source: 'webhook' | 'verify',
  ): Promise<{
    alreadyActivated: boolean;
    planCode: FederisPlanCode;
    subdomain: string;
    siteUrl: string;
    loginUrl: string;
    expiresAt: string;
  }> {
    // Idempotence : déjà payée → on garantit juste le sous-domaine et on
    // renvoie l'état (l'email n'est PAS renvoyé — pattern Helm).
    if (invoice.status === 'PAID') {
      this.logger.log(`Facture ${invoice.number} déjà PAYEE — activation idempotente (${source}).`);
      return this.buildActivationSnapshot(invoice);
    }

    // ⚠️ CRITIQUE : montant vérifié côté serveur contre la facture.
    // Le montant Fedapay réel peut être plafonné en sandbox → on compare au
    // montant envoyé à Fedapay (metadata.amountFedapay) lorsqu'il est connu.
    const meta = (invoice.metadata as any) ?? {};
    const expectedAmount = Number(meta.amountFedapay ?? invoice.amount);
    const txAmount = Number(
      transaction?.amount ?? this.normalizeMetadata(transaction)?.amountFedapay,
    );
    if (
      Number.isFinite(txAmount) &&
      txAmount > 0 &&
      Number.isFinite(expectedAmount) &&
      Math.round(txAmount) !== Math.round(expectedAmount)
    ) {
      this.logger.error(
        `❌ Montant mismatch : transaction ${txAmount} XOF ≠ attendu ${expectedAmount} XOF (${invoice.number}). Activation refusée.`,
      );
      await this.prisma.federisInvoice
        .update({
          where: { id: invoice.id },
          data: {
            metadata: {
              ...meta,
              amountMismatch: {
                expected: expectedAmount,
                received: txAmount,
                at: new Date().toISOString(),
                transactionId: String(transaction?.id ?? ''),
              },
            },
          },
        })
        .catch(() => undefined);
      await this.logWebhookError(
        String(transaction?.reference ?? transaction?.id ?? invoice.number),
        'transaction.approved',
        transaction,
        `amount_mismatch: ${txAmount} != ${expectedAmount}`,
      );
      throw new BadRequestException(
        `Montant de la transaction Fedapay (${txAmount} XOF) différent du montant attendu (${expectedAmount} XOF).`,
      );
    }

    const planCode = ((meta.plan ?? 'ESSENTIEL') as FederisPlanCode) ?? 'ESSENTIEL';
    const now = new Date();

    // Abonnement par année scolaire : expiration le 31 août de l'année
    // scolaire en cours (même règle que l'année créée à l'inscription).
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const expiresAt = new Date(`${startYear + 1}-08-31T23:59:59Z`);

    const providerRef = transaction?.reference ?? transaction?.reference_id ?? null;
    const providerTxId = transaction?.id != null ? String(transaction.id) : null;

    // Sous-domaine AVANT la transaction Prisma : en cas d'échec d'unicité on
    // préfère ne pas marquer la facture payée (activation retentée après).
    const patronatRow = await this.prisma.patronat.findUnique({
      where: { id: invoice.patronatId },
      select: { id: true, tenantId: true, name: true, orgLevel: true, territoryName: true },
    });
    if (!patronatRow) {
      throw new NotFoundException(`Patronat introuvable pour la facture ${invoice.number}`);
    }
    const subdomain = await this.assignPatronatSubdomain(patronatRow);

    // ── Transaction : tout ou rien (facture + paiement + patronat + tenant) ──
    await this.prisma.$transaction(async (tx) => {
      await tx.federisInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          metadata: {
            ...meta,
            paidAt: now.toISOString(),
            provider: 'FEDAPAY',
            providerTransactionId: providerTxId,
            providerReference: providerRef,
            subdomain,
          },
        },
      });

      await tx.federisPayment.create({
        data: {
          invoiceId: invoice.id,
          tenantId: invoice.tenantId,
          amount: invoice.amount,
          method: 'FEDAPAY',
          transactionId: providerTxId,
          status: 'COMPLETED',
          metadata: {
            provider: 'fedapay',
            reference: providerRef,
            plan: planCode,
            subdomain,
            paidAt: now.toISOString(),
          },
        },
      });

      await tx.patronat.update({
        where: { id: invoice.patronatId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionPlan: planCode,
          subscriptionStartedAt: now,
          subscriptionExpiresAt: expiresAt,
        },
      });

      // Le tenant patronat suit le même cycle (mêmes valeurs que Helm :
      // subscriptionStatus ACTIVE + status active + sous-domaine dédié).
      await tx.tenant
        .update({
          where: { id: invoice.tenantId },
          data: { subscriptionStatus: 'ACTIVE', status: 'active', subdomain },
        })
        .catch(() => undefined);

      await tx.auditLog.create({
        data: {
          tenantId: invoice.tenantId,
          action: 'FEDERIS_SUBSCRIPTION_ACTIVATED',
          resource: 'FederisInvoice',
          resourceId: invoice.id,
          tableName: 'federis_invoices',
          recordId: invoice.id,
          newData: {
            invoiceNumber: invoice.number,
            plan: planCode,
            amount: invoice.amount,
            provider: 'FEDAPAY',
            transactionId: providerTxId,
            reference: providerRef,
            subdomain,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    });

    this.logger.log(
      `✅ Abonnement activé (${source}) : facture ${invoice.number} (${planCode}) — patronat ${invoice.patronatId} — sous-domaine ${subdomain} — expiration ${expiresAt.toISOString().slice(0, 10)}.`,
    );

    // ⭐ Email automatique avec identifiants + domaine (pattern Helm —
    //    envoyé uniquement à la PREMIÈRE activation, jamais en double).
    await this.sendSubscriptionActivatedEmail({
      invoiceNumber: invoice.number,
      amount: invoice.amount,
      planCode,
      patronat: patronatRow,
      tenantId: invoice.tenantId,
      subdomain,
      transactionRef: String(providerRef ?? providerTxId ?? invoice.number),
    }).catch((err: any) => {
      this.logger.error(`❌ ÉCHEC envoi email identifiants Federis : ${err?.message}`, err?.stack);
    });

    return {
      alreadyActivated: false,
      planCode,
      subdomain,
      siteUrl: this.buildPatronatSiteUrl(subdomain),
      loginUrl: this.buildPatronatLoginUrl(subdomain),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Instantané d'activation pour une facture déjà PAYEE (idempotence) :
   * garantit le sous-domaine (au cas où une activation antérieure aurait
   * échoué avant attribution) et renvoie les URLs.
   */
  private async buildActivationSnapshot(invoice: {
    id: string;
    number: string;
    patronatId: string;
    tenantId: string;
    metadata: any;
  }) {
    const meta = (invoice.metadata as any) ?? {};
    const planCode = ((meta.plan ?? 'ESSENTIEL') as FederisPlanCode) ?? 'ESSENTIEL';

    const patronatRow = await this.prisma.patronat.findUnique({
      where: { id: invoice.patronatId },
      select: { id: true, tenantId: true, name: true, orgLevel: true, territoryName: true },
    });
    const subdomain = patronatRow
      ? await this.assignPatronatSubdomain(patronatRow).catch(() => meta.subdomain ?? 'patronat')
      : (meta.subdomain ?? 'patronat');

    const patronatFull = patronatRow
      ? await this.prisma.patronat.findUnique({
          where: { id: invoice.patronatId },
          select: { subscriptionExpiresAt: true },
        })
      : null;

    return {
      alreadyActivated: true,
      planCode,
      subdomain,
      siteUrl: this.buildPatronatSiteUrl(subdomain),
      loginUrl: this.buildPatronatLoginUrl(subdomain),
      expiresAt: (
        patronatFull?.subscriptionExpiresAt ??
        new Date(`${new Date().getFullYear()}-08-31T23:59:59Z`)
      ).toISOString(),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. EMAIL IDENTIFIANTS + DOMAINE (pattern Helm sendOnboardingPaymentSuccessEmail)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Envoie au responsable du patronat l'email de bienvenue avec :
   *   - ses identifiants de connexion (email + mot de passe défini à
   *     l'inscription — jamais renvoyé en clair, il est hashé en base) ;
   *   - le nom de domaine dédié du patronat (patronat{département}.academiahelm.com) ;
   *   - l'URL de connexion directe sur ce domaine.
   */
  async sendSubscriptionActivatedEmail(params: {
    invoiceNumber: string;
    amount: number;
    planCode: FederisPlanCode;
    patronat: { id: string; tenantId: string; name: string };
    tenantId: string;
    subdomain: string;
    transactionRef: string;
  }): Promise<void> {
    const { planCode, patronat, tenantId, subdomain, transactionRef } = params;

    // Responsable : premier compte administrateur lié au patronat.
    const responsible = await this.prisma.patronatUser.findFirst({
      where: { patronatId: patronat.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });
    const to = (responsible?.user?.email ?? '').trim();
    if (!to) {
      this.logger.warn(
        `Aucun email de responsable trouvé pour le patronat ${patronat.id} — email identifiants non envoyé.`,
      );
      return;
    }

    const planName = planCode === 'INSTITUTION' ? 'Federis Institution' : 'Federis Essentiel';
    const siteUrl = this.buildPatronatSiteUrl(subdomain);
    const loginUrl = this.buildPatronatLoginUrl(subdomain);

    const tmpl = federisEmailTemplates.paymentSuccess({
      responsablePrenom: responsible.user.firstName || 'Responsable',
      patronatNom: patronat.name,
      plan: planName,
      transactionRef,
      montant: params.amount,
      email: to,
      subdomain,
      siteUrl,
      loginUrl,
      // Le mot de passe est hashé en base : on renvoie vers celui défini à
      // l'inscription (même choix que Helm — motDePasse: null).
      motDePasse: null,
    });

    const from =
      (this.configService.get<string>('EMAIL_FROM_NOREPLY') || '').trim() ||
      'noreply@academiahelm.com';

    await this.emailService.sendEmail({
      to,
      from,
      subject: tmpl.subject,
      html: tmpl.html,
    });

    this.logger.log(
      `📧 Email identifiants Federis envoyé à ${to} (domaine ${subdomain}, facture ${params.invoiceNumber}, tenant ${tenantId}).`,
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. VÉRIFICATION POST-PAIEMENT (pattern Helm verifyPaymentStatus)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * ⭐ Retrouve une facture depuis l'ID numérique Fedapay.
   *
   * FedaPay redirige après paiement vers /checkout/success?id=470323&status=approved
   * SANS préserver les query params d'origine (invoiceId). La page succès
   * utilise cet endpoint pour retrouver la facture (pattern Helm
   * findPaymentByTransactionId), puis appelle verifyInvoicePayment.
   */
  async findInvoiceByTransactionId(transactionId: string) {
    const invoice = await this.prisma.federisInvoice.findFirst({
      where: {
        OR: [
          { metadata: { path: ['providerTransactionId'], equals: transactionId } },
          { metadata: { path: ['transactionId'], equals: transactionId } },
        ],
      },
      select: {
        id: true,
        number: true,
        status: true,
        patronatId: true,
        tenantId: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!invoice) {
      this.logger.warn(`⚠️  Aucune facture Federis pour la transaction Fedapay ${transactionId}`);
      return { found: false, invoiceId: null };
    }
    this.logger.log(
      `✅ Facture ${invoice.number} trouvée pour la transaction Fedapay ${transactionId}`,
    );
    return {
      found: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      status: invoice.status,
    };
  }

  /**
   * Vérifie le statut RÉEL d'un paiement auprès de l'API Fedapay
   * (verifyTransactionStatus du module billing Helm) et, si la transaction
   * est approuvée, active l'abonnement + attribue le sous-domaine + envoie
   * l'email identifiants (idempotent — fallback si le webhook est perdu).
   *
   * ⚠️ Le frontend ne doit JAMAIS se fier au seul retour navigateur de
   *    Fedapay : c'est CETTE vérification serveur qui fait foi.
   */
  async verifyInvoicePayment(params: { invoiceId?: string; transactionId?: string }) {
    // 1. Résoudre la facture (id direct ou id de transaction Fedapay)
    let invoice: {
      id: string;
      number: string;
      amount: number;
      status: string;
      patronatId: string;
      tenantId: string;
      metadata: any;
    } | null = null;

    if (params.invoiceId) {
      invoice = await this.prisma.federisInvoice.findUnique({ where: { id: params.invoiceId } });
      if (!invoice) throw new NotFoundException(`Facture introuvable : ${params.invoiceId}`);
    } else if (params.transactionId) {
      const found = await this.prisma.federisInvoice.findFirst({
        where: {
          OR: [
            { metadata: { path: ['providerTransactionId'], equals: params.transactionId } },
            { metadata: { path: ['transactionId'], equals: params.transactionId } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      invoice = found;
      if (!invoice) {
        throw new NotFoundException(
          `Aucune facture pour la transaction Fedapay ${params.transactionId}`,
        );
      }
    } else {
      throw new BadRequestException('invoiceId ou transactionId requis');
    }

    // 2. Déjà payée → instantané idempotent (sous-domaine garanti)
    if (invoice.status === 'PAID') {
      const snapshot = await this.buildActivationSnapshot(invoice);
      return this.formatVerifyResult(invoice, snapshot.subdomain, snapshot, 'already_paid');
    }

    // 3. Interroger l'API Fedapay réelle
    const meta = (invoice.metadata as any) ?? {};
    const transactionId = meta.providerTransactionId ?? meta.transactionId;
    if (!transactionId) {
      throw new BadRequestException(
        'Transaction Fedapay introuvable pour cette facture (paiement non initialisé en ligne ?).',
      );
    }

    const verification = await this.fedapayService.verifyTransactionStatus(String(transactionId));
    const status = String(verification.status || '').toLowerCase();

    if (status === 'approved' || status === 'completed' || status === 'transfert') {
      // ⭐ Récupérer l'objet transaction complet pour la référence (pattern
      //    Helm : verifyTransactionStatus renvoie la référence).
      const activation = await this.activateSubscriptionAfterPayment(
        invoice,
        {
          id: transactionId,
          reference: verification.reference ?? null,
          amount: verification.amount,
        },
        'verify',
      );
      return this.formatVerifyResult(
        invoice,
        activation.subdomain,
        {
          ...activation,
          alreadyActivated: false,
        },
        'verified',
      );
    }

    // En attente / refusé / annulé : aucun changement d'état — le webhook
    // tranchera (PENDING n'est JAMAIS activé sur simple échec réseau).
    return this.formatVerifyResult(
      invoice,
      null,
      null,
      status === 'pending' || status === 'processing' ? 'pending' : status,
    );
  }

  /** Formate la réponse de vérification (mêmes champs que Helm verify). */
  private formatVerifyResult(
    invoice: { id: string; number: string; amount: number; status: string; metadata: any },
    subdomain: string | null,
    activation: {
      alreadyActivated: boolean;
      planCode: FederisPlanCode;
      subdomain: string;
      siteUrl: string;
      loginUrl: string;
      expiresAt: string;
    } | null,
    outcome: string,
  ) {
    const activated = outcome === 'verified' || outcome === 'already_paid';
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      amount: invoice.amount,
      status: activated ? 'SUCCESS' : outcome === 'pending' ? 'PENDING' : outcome.toUpperCase(),
      activated,
      // ⭐ Sous-domaine + URLs complètes (le frontend redirige l'utilisateur
      //    vers sa propre landing page / page de connexion).
      subdomain: activation?.subdomain ?? subdomain ?? null,
      siteUrl: activation?.siteUrl ?? (subdomain ? this.buildPatronatSiteUrl(subdomain) : null),
      loginUrl: activation?.loginUrl ?? (subdomain ? this.buildPatronatLoginUrl(subdomain) : null),
      plan: activation?.planCode ?? (invoice.metadata as any)?.plan ?? null,
      expiresAt: activation?.expiresAt ?? null,
      outcome,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 7. PAIEMENT REFUSÉ / ANNULÉ (pattern Helm — échec sans activation)
  // ══════════════════════════════════════════════════════════════════════

  private async handlePaymentDeclined(transaction: any, outcome: 'DECLINED' | 'CANCELED') {
    const meta = this.normalizeMetadata(transaction);
    if (meta.type && meta.type !== FEDERIS_TX_TYPE) {
      return { received: true, processed: false, reason: 'not_federis' };
    }

    const invoice = await this.findInvoiceForTransaction(transaction, meta);
    if (!invoice) {
      this.logger.warn(
        `Transaction ${outcome} sans facture Federis identifiable (${transaction?.id}) — ignorée.`,
      );
      return { received: true, processed: false, reason: 'invoice_not_found' };
    }
    if (invoice.status === 'PAID') {
      // Déjà payée (ex. tentative ultérieure annulée après réussite) : rien à faire
      return { received: true, processed: false, reason: 'already_paid' };
    }

    const now = new Date();
    await this.prisma.federisInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'UNPAID',
        metadata: {
          ...(invoice.metadata as any),
          lastPaymentAttempt: {
            outcome,
            at: now.toISOString(),
            transactionId: transaction?.id != null ? String(transaction.id) : null,
            reference: transaction?.reference ?? null,
          },
        },
      },
    });

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: invoice.tenantId,
          action: outcome === 'DECLINED' ? 'FEDERIS_PAYMENT_DECLINED' : 'FEDERIS_PAYMENT_CANCELED',
          resource: 'FederisInvoice',
          resourceId: invoice.id,
          tableName: 'federis_invoices',
          recordId: invoice.id,
          newData: { invoiceNumber: invoice.number, transactionId: transaction?.id ?? null },
        },
      })
      .catch(() => undefined);

    this.logger.warn(
      `Paiement ${outcome === 'DECLINED' ? 'refusé' : 'annulé'} pour la facture ${invoice.number} — l'abonnement reste en attente.`,
    );
    return { received: true, processed: true, invoiceNumber: invoice.number };
  }
}
