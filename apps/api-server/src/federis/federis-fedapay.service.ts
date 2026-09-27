/**
 * FederisFedapayService — Paiement Fedapay des abonnements patronat
 * ═══════════════════════════════════════════════════════════════════════════
 * Academia Federis (cahier des charges §12) — MÊME PATTER QUE ACADEMIA HELM
 * (billing/services/fedapay.service.ts + billing.controller.ts) :
 *
 *   1. Init paiement      POST /federis/patronat/checkout (protégé JWT)
 *      → transaction Fedapay créée via le SDK officiel avec metadata
 *        (type: federis_subscription + federisInvoiceId…) et webhook_url
 *        propre à Federis.
 *   2. Webhook            POST /federis/public/fedapay/webhook (public)
 *      → vérification de signature HMAC (FEDAPAY_WEBHOOK_SECRET, fail-closed
 *        en production), parsing du payload, routage par événement :
 *          transaction.approved / completed → activation de l'abonnement
 *          transaction.declined / failed    → facture marquée en échec
 *          transaction.canceled             → tentative annulée
 *
 * Sécurité & robustesse (identiques au module billing Helm) :
 *   - Signature obligatoire en production (jamais de mode permissif)
 *   - Montant vérifié contre la facture avant activation
 *   - Idempotence : facture déjà PAYEE → webhook ignoré proprement
 *   - Transaction Prisma : facture + paiement + patronat + tenant + audit
 *   - PaymentWebhookLog en cas d'erreur de traitement
 *   - Les transactions non-Federis (onboarding Helm…) reçues sur cette URL
 *     sont ignorées sans erreur (metadata.type ≠ federis_subscription)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { FedaPayService } from '../billing/services/fedapay.service';
import type { FederisPlanCode } from './federis-patronat.service';

/** Marker metadata des transactions d'abonnement Federis. */
export const FEDERIS_TX_TYPE = 'federis_subscription';

@Injectable()
export class FederisFedapayService {
  private readonly logger = new Logger(FederisFedapayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    /** Passerelle Fedapay partagée avec Academia Helm (SDK + signature). */
    private readonly fedapayService: FedaPayService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // 1. CRÉATION DE TRANSACTION (pattern Helm — createOnboardingPaymentSession)
  // ══════════════════════════════════════════════════════════════════════

  /** Clé secrète Fedapay configurée ? (sinon checkout en mode manuel) */
  isConfigured(): boolean {
    const key = (this.configService.get<string>('FEDAPAY_API_KEY') || '').trim();
    return key.length > 0;
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

  /** URL de retour navigateur après paiement (page checkout du portail). */
  private buildCheckoutReturnUrl(): string {
    return (
      this.configService.get<string>('FEDERIS_CHECKOUT_RETURN_URL') ||
      this.configService.get<string>('FEDERIS_APP_URL') ||
      'https://academiafederis.academiahelm.com/checkout/success'
    ).trim();
  }

  /**
   * Crée la transaction Fedapay d'une facture d'abonnement (SDK officiel,
   * même chemin que Helm). Les metadata relient la transaction à la facture
   * pour le traitement du webhook ; custom_metadata est dérivée côté SDK.
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
  }): Promise<{ paymentUrl: string | null; transactionId: string | null }> {
    const { invoice, patronat, plan } = params;
    const metadata = {
      type: FEDERIS_TX_TYPE,
      federisInvoiceId: invoice.id,
      invoiceNumber: invoice.number,
      patronatId: patronat.id,
      tenantId: patronat.tenantId,
      plan: plan.code,
      // ⭐ Le SDK recopie webhookUrl dans transactionData.webhook_url —
      //    chaque transaction Federis porte SON webhook (pattern Helm).
      webhookUrl: this.buildWebhookUrl(),
    };

    const tx = await this.fedapayService.createTransaction({
      amount: invoice.amount,
      description: `${plan.name} — ${patronat.name} (${invoice.number})`,
      callbackUrl: this.buildCheckoutReturnUrl(),
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
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. WEBHOOK (pattern Helm — assertValidFedaPayWebhookSignature + parse)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Point d'entrée du webhook : signature → parsing → routage.
   * ⚠️ CRITIQUE : le body BRUT (req.rawBody) est obligatoire pour que le
   * HMAC corresponde (même exigence que le module billing Helm).
   */
  async handleWebhook(payloadString: string, signatureHeader: string | undefined, payload: any) {
    await this.fedapayService.assertValidFedaPayWebhookSignature(payloadString, signatureHeader);

    const { event, transaction, transactionId, transactionReference } =
      this.fedapayService.parseFedaPayWebhookPayload(payload);

    this.logger.log(
      `📥 Webhook Fedapay Federis : ${event} — Transaction ${transactionId} — Référence ${transactionReference}`,
    );

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
  // 3. PAIEMENT APPROUVÉ → ACTIVATION (idempotente, pattern Helm)
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

    // Idempotence : déjà payée → rien à faire
    if (invoice.status === 'PAID') {
      this.logger.warn(`Facture ${invoice.number} déjà PAYEE — webhook ignoré (idempotent).`);
      return { received: true, processed: false, reason: 'already_paid' };
    }

    // ⚠️ CRITIQUE : montant vérifié côté serveur contre la facture
    const txAmount = Number(transaction?.amount ?? meta.amount);
    if (
      Number.isFinite(txAmount) &&
      txAmount > 0 &&
      Math.round(txAmount) !== Math.round(invoice.amount)
    ) {
      this.logger.error(
        `❌ Montant mismatch : transaction ${txAmount} XOF ≠ facture ${invoice.amount} XOF (${invoice.number}). Activation refusée.`,
      );
      await this.prisma.federisInvoice
        .update({
          where: { id: invoice.id },
          data: {
            metadata: {
              ...(invoice.metadata as any),
              amountMismatch: {
                expected: invoice.amount,
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
        `amount_mismatch: ${txAmount} != ${invoice.amount}`,
      );
      return { received: true, processed: false, reason: 'amount_mismatch' };
    }

    const planCode = ((invoice.metadata as any)?.plan ?? 'ESSENTIEL') as FederisPlanCode;
    const now = new Date();

    // Abonnement par année scolaire : expiration le 31 août de l'année
    // scolaire en cours (même règle que l'année créée à l'inscription).
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const expiresAt = new Date(`${startYear + 1}-08-31T23:59:59Z`);

    const providerRef = transaction?.reference ?? transaction?.reference_id ?? null;
    const providerTxId = transaction?.id != null ? String(transaction.id) : null;

    // ── Transaction : tout ou rien (facture + paiement + patronat + tenant) ──
    await this.prisma.$transaction(async (tx) => {
      await tx.federisInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          metadata: {
            ...(invoice.metadata as any),
            paidAt: now.toISOString(),
            provider: 'FEDAPAY',
            providerTransactionId: providerTxId,
            providerReference: providerRef,
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
      // subscriptionStatus ACTIVE + status active).
      await tx.tenant
        .update({
          where: { id: invoice.tenantId },
          data: { subscriptionStatus: 'ACTIVE', status: 'active' },
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
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    });

    this.logger.log(
      `✅ Abonnement activé : facture ${invoice.number} (${planCode}) — patronat ${invoice.patronatId} — expiration ${expiresAt.toISOString().slice(0, 10)}.`,
    );

    return {
      received: true,
      processed: true,
      invoiceNumber: invoice.number,
      plan: planCode,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. PAIEMENT REFUSÉ / ANNULÉ (pattern Helm — échec sans activation)
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
