/**
 * ============================================================================
 * HELM ENSEIGNANT — SERVICE ABONNEMENT & PAIEMENT (2 000 FCFA / mois)
 * ============================================================================
 *
 * ⭐ Pattern répliqué du portail Patronat (federis-fedapay.service.ts) :
 *    même widget de paiement FedaPay (redirect vers la page de paiement),
 *    même chaîne checkout → transaction FedaPay → webhook / verify →
 *    activation idempotente.
 *
 * Cycle de vie (spécification produit Helm Enseignant) :
 *   1. Inscription (compte créé) → redirection vers /prof/checkout ;
 *   2. Paiement 2 000 FCFA → compteur activé — le décompte de 30 jours
 *      court DÈS LA CRÉATION DU COMPTE (currentPeriodStart = tenant.createdAt) ;
 *   3. J-7 avant expiration → email de rappel (même système de notification
 *      que Academia Helm : emailService.sendCategorized) ;
 *   4. J-1 (24 h) → second rappel avec LIEN/BOUTON de paiement ;
 *   5. J0 → expiration silencieuse → GRÂCE DE 7 JOURS (compte actif) ;
 *   6. J+7 → compte INACTIF (SUSPENDED) → à la connexion, redirection vers
 *      la page de paiement ; paiement → +30 jours, compte réactivé.
 *
 * Le cycle quotidien (notifications, grâce, suspension) est assuré par
 * SubscriptionLifecycleService.runDailyCheck() (cron 6 h) qui traite déjà les
 * HelmSubscription — la branche « enseignant » y a été ajoutée.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { FedaPayService } from '../../billing/services/fedapay.service';
import { EmailService } from '../../communication/services/email.service';

/** Montant de l'abonnement mensuel Helm Enseignant (FCFA). */
export const TEACHER_MONTHLY_FEE = 2000;
/** Durée d'une période payée (jours). */
export const TEACHER_PERIOD_DAYS = 30;
/** Type de transaction FedaPay dédié (routage webhook). */
const TEACHER_TX_TYPE = 'TEACHER_SUBSCRIPTION';
/** Plafond sandbox FedaPay (XOF) — même garde-fou que le patronat. */
const FEDAPAY_SANDBOX_MAX = 20000;
/** Facture FedaPay « session » réutilisable (heures). */
const CHECKOUT_SESSION_HOURS = 12;

@Injectable()
export class TeacherSubscriptionService {
  private readonly logger = new Logger(TeacherSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fedapayService: FedaPayService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // 1. INITIATION DU PAIEMENT (pattern patronat initCheckout)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Crée (ou réutilise) la facture + la transaction FedaPay de l'abonnement
   * mensuel. Redirige vers le MÊME widget de paiement que le patronat.
   *
   * @param userId  utilisateur enseignant connecté (JWT)
   * @param options.returnBaseUrl origine publique du portail enseignant
   *        (ex : https://enseignant.academiahelm.com ou https://academiahelm.com)
   *        — validée contre le domaine racine du frontend.
   */
  async initCheckout(
    userId: string,
    options: { returnBaseUrl?: string } = {},
  ): Promise<{
    success: boolean;
    invoice: { id: string; number: string; amount: number };
    amountXOF: number;
    provider: string;
    paymentUrl: string | null;
    message: string;
    alreadyActive?: boolean;
  }> {
    const { tenant, user, subscription } = await this.resolveTeacherContext(userId);

    // Téléphone de l'enseignant (vit sur le profil Teacher, pas sur User).
    const teacherProfile = await this.prisma.teacher.findFirst({
      where: { tenantId: tenant.id },
      select: { phone: true },
    });

    // Déjà actif et non expiré ? On renvoie l'état (renouvellement anticipé
    // possible depuis la page — le paiement étendra la période).
    const now = new Date();
    const active =
      subscription &&
      ['ACTIVE', 'TRIALING'].includes(String(subscription.status)) &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > now;

    // ── 1. Facture impayée existante ? (réutilisée pour une nouvelle
    //    transaction — pattern patronat : l'URL de paiement FedaPay n'est pas
    //    persistée, chaque initiation crée une transaction fraîche sur la
    //    MÊME facture ; les transactions non réglées expirenent seules) ──
    const existing = await this.prisma.helmInvoice.findFirst({
      where: {
        tenantId: tenant.id,
        status: 'PENDING',
        type: 'TEACHER_SUBSCRIPTION',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Session récente : si sa transaction vient d'être APPROUVÉE (webhook pas
    //    encore traité), on active par la voie verify AVANT de re-payer.
    if (existing?.fedapayTxId && Date.now() - existing.createdAt.getTime() < CHECKOUT_SESSION_HOURS * 3600 * 1000) {
      try {
        const check = await this.fedapayService.verifyTransactionStatus(existing.fedapayTxId);
        const checkStatus = String(check?.status || '').toLowerCase();
        if (['approved', 'completed', 'transfert', 'transferred'].includes(checkStatus)) {
          await this.activateSubscriptionAfterPayment(
            existing,
            { id: existing.fedapayTxId, reference: check?.reference ?? null, amount: check?.amount },
            'verify',
          );
          return {
            success: true,
            invoice: { id: existing.id, number: existing.invoiceNumber ?? '', amount: existing.amount },
            amountXOF: existing.amount,
            provider: 'FEDAPAY',
            paymentUrl: null,
            message:
              'Votre paiement a été confirmé — votre abonnement est déjà actif. Rechargez la page pour voir votre compteur.',
            alreadyActive: true,
          };
        }
      } catch {
        /* vérification best-effort : on continue avec une nouvelle transaction */
      }
    }

    const appBase = this.resolveReturnBase(options.returnBaseUrl);

    // ── 2. Facture (numéro globalement unique : ENS-YY-MM-NNNNN) ──
    let invoice = existing;
    if (!invoice) {
      invoice = await this.createTeacherInvoice(tenant.id, user.email, `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    }

    // ── 3. Transaction FedaPay (montant réel en live, plafonné en sandbox) ──
    const amountReal = invoice.amount;
    const amountFedapay = this.fedapayService.isLiveModeResolved()
      ? amountReal
      : Math.min(amountReal, FEDAPAY_SANDBOX_MAX);

    const metadata = {
      type: TEACHER_TX_TYPE,
      teacherInvoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      tenantId: tenant.id,
      userId: user.id,
      amountReal,
      amountFedapay,
      webhookUrl: this.buildWebhookUrl(),
    };

    // FedaPay REMPLACE les query params à la redirection : ?id={txId}&status=approved
    const callbackUrl = `${appBase}/prof/checkout/success?invoiceId=${encodeURIComponent(invoice.id)}`;
    const cancelUrl = `${appBase}/prof/checkout`;

    try {
      const tx = await this.fedapayService.createTransaction({
        amount: amountFedapay,
        description: `Helm Enseignant — Abonnement mensuel (${invoice.invoiceNumber})`,
        callbackUrl,
        cancelUrl,
        currency: 'XOF',
        metadata,
        ...(user.email
          ? {
              customer: {
                email: user.email,
                firstname: (user.firstName || 'Enseignant').slice(0, 60),
                ...(user.lastName ? { lastname: user.lastName.slice(0, 60) } : {}),
                ...(teacherProfile?.phone ? { phone_number: teacherProfile.phone } : {}),
                countryName: 'Bénin',
              },
            }
          : {}),
      });

      // Trace la transaction sur la facture (fedapayTxId — colonne réelle
      // de HelmInvoice ; l'URL de paiement n'est PAS persistée : chaque
      // initiation crée une transaction fraîche, l'ancienne expire seule).
      await this.prisma.helmInvoice.update({
        where: { id: invoice.id },
        data: {
          fedapayTxId: tx.transactionId != null ? String(tx.transactionId) : null,
        },
      });

      this.logger.log(
        `✅ Transaction FedaPay enseignant créée : ${tx.transactionId} (${amountFedapay} XOF, facture ${invoice.invoiceNumber})`,
      );

      return {
        success: true,
        invoice: { id: invoice.id, number: invoice.invoiceNumber ?? '', amount: invoice.amount },
        amountXOF: amountReal,
        provider: 'FEDAPAY',
        paymentUrl: tx.paymentUrl ?? null,
        message: 'Paiement Fedapay initialisé.',
        ...(active ? { alreadyActive: true } : {}),
      };
    } catch (error: any) {
      // FedaPay non configuré / injoignable : la facture existe, le paiement
      // sera finalisé dès que la passerelle sera disponible (pattern patronat).
      this.logger.error(`❌ Initiation FedaPay enseignant échouée : ${error?.message}`);
      return {
        success: false,
        invoice: { id: invoice.id, number: invoice.invoiceNumber ?? '', amount: invoice.amount },
        amountXOF: amountReal,
        provider: 'FEDAPAY',
        paymentUrl: null,
        message:
          'La passerelle de paiement est momentanément indisponible. Votre facture est enregistrée — réessayez dans quelques instants.',
      };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. ÉTAT DE L'ABONNEMENT (page checkout + paramètres)
  // ══════════════════════════════════════════════════════════════════════

  /** Statut complet du compteur d'abonnement de l'enseignant connecté. */
  async getStatus(userId: string) {
    const { tenant, subscription } = await this.resolveTeacherContext(userId);
    const now = new Date();

    const base = {
      plan: 'Helm Enseignant',
      monthlyFee: TEACHER_MONTHLY_FEE,
      billingCycle: 'MONTHLY' as const,
      tenantCreatedAt: tenant.createdAt,
    };

    if (!subscription) {
      return {
        ...base,
        status: 'TRIAL',
        activated: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        daysRemaining: null,
        gracePeriodEnd: null,
        message:
          'Votre compteur n’est pas encore activé. Effectuez le paiement de votre abonnement mensuel pour l’activer.',
      };
    }

    const periodEnd = subscription.currentPeriodEnd;
    const daysRemaining = periodEnd
      ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      ...base,
      status: String(subscription.status),
      activated: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'].includes(String(subscription.status)),
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: periodEnd,
      daysRemaining,
      gracePeriodEnd: subscription.gracePeriodEnd ?? null,
      suspendedAt: subscription.suspendedAt ?? null,
      lastPaymentDate: subscription.lastPaymentDate ?? null,
      message: null,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. WEBHOOK FEDAPAY (pattern patronat : signature + routage)
  // ══════════════════════════════════════════════════════════════════════

  async handleWebhook(payloadString: string, signatureHeader: string | undefined, payload: any) {
    await this.fedapayService.assertValidFedaPayWebhookSignature(payloadString, signatureHeader);
    const { event, transaction } = this.fedapayService.parseFedaPayWebhookPayload(payload);

    this.logger.log(`📥 Webhook FedaPay enseignant : ${event} — Transaction ${transaction?.id}`);

    switch (event) {
      case 'transaction.approved':
      case 'transaction.completed':
        return this.handlePaymentApproved(transaction);
      case 'transaction.declined':
      case 'transaction.failed':
      case 'transaction.canceled':
        this.logger.warn(`Paiement enseignant ${event} — transaction ${transaction?.id}`);
        return { received: true, processed: false, reason: event };
      default:
        return { received: true, processed: false };
    }
  }

  private async handlePaymentApproved(transaction: any) {
    const meta = this.normalizeMetadata(transaction);

    // Transactions d'autres modules éventuellement reçues ici : ignorées.
    if (meta.type && meta.type !== TEACHER_TX_TYPE) {
      return { received: true, processed: false, reason: 'not_teacher_subscription' };
    }

    const invoice = await this.findInvoiceForTransaction(transaction, meta);
    if (!invoice) {
      this.logger.error(
        `❌ Facture enseignant introuvable pour la transaction ${transaction?.id}`,
      );
      return { received: true, processed: false, reason: 'invoice_not_found' };
    }

    try {
      const activation = await this.activateSubscriptionAfterPayment(invoice, transaction, 'webhook');
      return {
        received: true,
        processed: !activation.alreadyActivated,
        invoiceNumber: invoice.invoiceNumber,
        currentPeriodEnd: activation.currentPeriodEnd,
        alreadyActivated: activation.alreadyActivated,
      };
    } catch (activationErr: any) {
      if (activationErr instanceof BadRequestException) {
        this.logger.error(
          `❌ Activation enseignant refusée (${invoice.invoiceNumber}) : ${activationErr.message}`,
        );
        return { received: true, processed: false, reason: 'activation_rejected' };
      }
      throw activationErr;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. VÉRIFICATION POST-PAIEMENT (fallback si le webhook est perdu)
  // ══════════════════════════════════════════════════════════════════════

  /** Retrouve une facture enseignant depuis l'ID de transaction FedaPay. */
  async findInvoiceByTransactionId(transactionId: string) {
    const invoice = await this.prisma.helmInvoice.findFirst({
      where: {
        type: 'TEACHER_SUBSCRIPTION',
        fedapayTxId: transactionId,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, invoiceNumber: true, status: true, amount: true },
    });
    if (!invoice) return { found: false, invoiceId: null };
    return {
      found: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.amount,
    };
  }

  /** Vérifie le statut RÉEL auprès de FedaPay puis active (idempotent). */
  async verifyInvoicePayment(params: { invoiceId?: string; transactionId?: string }) {
    let invoice: any = null;

    if (params.invoiceId) {
      invoice = await this.prisma.helmInvoice.findUnique({ where: { id: params.invoiceId } });
      if (!invoice) throw new NotFoundException(`Facture introuvable : ${params.invoiceId}`);
    } else if (params.transactionId) {
      const found = await this.findInvoiceByTransactionId(params.transactionId);
      if (!found.found) {
        throw new NotFoundException(
          `Aucune facture pour la transaction Fedapay ${params.transactionId}`,
        );
      }
      invoice = await this.prisma.helmInvoice.findUnique({ where: { id: found.invoiceId } });
    } else {
      throw new BadRequestException('invoiceId ou transactionId requis');
    }

    if (invoice.status === 'PAID') {
      const snapshot = await this.buildStatusSnapshot(invoice);
      return {
        outcome: 'already_paid',
        invoiceNumber: invoice.invoiceNumber ?? null,
        amount: invoice.amount,
        message: 'Paiement déjà confirmé — abonnement actif.',
        ...snapshot,
      };
    }

    const transactionId = invoice.fedapayTxId;
    if (!transactionId) {
      return {
        outcome: 'pending',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        message: 'Transaction FedaPay introuvable pour cette facture.',
      };
    }

    // Une erreur FedaPay ne doit JAMAIS activer un paiement non confirmé.
    let verification: { status: string; amount: number; reference?: string | null };
    try {
      verification = await this.fedapayService.verifyTransactionStatus(String(transactionId));
    } catch (err: any) {
      return {
        outcome: 'pending',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        message: `Vérification FedaPay en attente : ${err?.message || 'erreur inconnue'}`,
      };
    }

    const status = String(verification.status || '').toLowerCase();
    if (['approved', 'completed', 'transfert', 'transferred'].includes(status)) {
      const activation = await this.activateSubscriptionAfterPayment(
        invoice,
        {
          id: transactionId,
          reference: verification.reference ?? null,
          amount: verification.amount,
        },
        'verify',
      );
      return {
        outcome: 'verified',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currentPeriodEnd: activation.currentPeriodEnd,
        daysRemaining: activation.daysRemaining,
        message: 'Abonnement activé.',
      };
    }

    return {
      outcome: status === 'pending' || status === 'processing' ? 'pending' : status,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      message: `Statut FedaPay : ${status}`,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. ACTIVATION IDEMPOTENTE (cœur — pattern patronat activateSubscriptionAfterPayment)
  // ══════════════════════════════════════════════════════════════════════

  async activateSubscriptionAfterPayment(
    invoice: {
      id: string;
      invoiceNumber: string | null;
      amount: number;
      status: string;
      tenantId: string;
    },
    transaction: any,
    source: 'webhook' | 'verify',
  ): Promise<{
    alreadyActivated: boolean;
    currentPeriodEnd: string;
    daysRemaining: number;
  }> {
    if (invoice.status === 'PAID') {
      const snapshot = await this.buildStatusSnapshot(invoice);
      return {
        alreadyActivated: true,
        currentPeriodEnd: snapshot.currentPeriodEnd ?? new Date().toISOString(),
        daysRemaining: snapshot.daysRemaining ?? 0,
      };
    }

    // ⚠️ Montant vérifié côté serveur (honnêteté sur l'argent) — contre la
    //    facture (2 000 XOF ; pas de plafonnement sandbox à ce montant).
    const expectedAmount = Number(invoice.amount);
    const txAmount = Number(transaction?.amount);
    if (
      Number.isFinite(txAmount) &&
      txAmount > 0 &&
      Number.isFinite(expectedAmount) &&
      Math.round(txAmount) !== Math.round(expectedAmount)
    ) {
      this.logger.error(
        `❌ Montant mismatch enseignant : transaction ${txAmount} XOF ≠ attendu ${expectedAmount} XOF (${invoice.invoiceNumber})`,
      );
      throw new BadRequestException(
        `Montant de la transaction FedaPay (${txAmount} XOF) différent du montant attendu (${expectedAmount} XOF).`,
      );
    }

    const now = new Date();
    const providerTxId = transaction?.id != null ? String(transaction.id) : null;
    const providerRef = transaction?.reference ?? transaction?.reference_id ?? null;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: invoice.tenantId } });
    if (!tenant || (tenant as any).type !== 'TEACHER') {
      throw new ForbiddenException('Cette facture ne correspond pas à un espace enseignant.');
    }

    const existing = await this.prisma.helmSubscription.findUnique({
      where: { tenantId: tenant.id },
    });

    // ── Calcul de la période ──
    // 1er paiement : le décompte part de la CRÉATION DU COMPTE (spécification).
    // Renouvellement anticipé : +30 j depuis la fin courante (aucun jour perdu).
    // Réactivation (suspendu/expiré) : +30 j à partir de maintenant.
    let periodStart: Date;
    let periodEnd: Date;
    if (!existing || !existing.currentPeriodEnd) {
      periodStart = tenant.createdAt;
      periodEnd = new Date(
        tenant.createdAt.getTime() + TEACHER_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      );
    } else if (
      ['SUSPENDED', 'BLOCKED', 'GRACE_PERIOD'].includes(String(existing.status)) ||
      existing.currentPeriodEnd <= now
    ) {
      periodStart = now;
      periodEnd = new Date(now.getTime() + TEACHER_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    } else {
      periodStart = existing.currentPeriodEnd;
      periodEnd = new Date(
        existing.currentPeriodEnd.getTime() + TEACHER_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      );
    }

    const daysRemaining = Math.max(
      0,
      Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // ── Transaction Prisma : facture + abonnement + tenant (tout ou rien) ──
    //    (colonnes réelles de HelmInvoice — pas de champ metadata sur ce modèle)
    await this.prisma.$transaction(async (tx) => {
      await tx.helmInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: now,
          paymentReference: providerRef != null ? String(providerRef) : null,
          paymentMethod: 'FEDAPAY',
          ...(providerTxId ? { fedapayTxId: providerTxId } : {}),
        },
      });

      if (existing) {
        await tx.helmSubscription.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            monthlyAmount: TEACHER_MONTHLY_FEE,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            // ⚆ Réinitialisation complète du cycle de vie (rappels, grâce, suspension)
            trialEnd: null,
            expiredAt: null,
            gracePeriodEnd: null,
            suspendedAt: null,
            blockedAt: null,
            notified7DaysBefore: null,
            notified3DaysBefore: null,
            notified1DayBefore: null,
            notifiedBlockWarning: null,
            lastPaymentDate: now,
            lastPaymentAmount: invoice.amount,
          },
        });
      } else {
        await tx.helmSubscription.create({
          data: {
            tenantId: tenant.id,
            plan: 'SEED',
            billingCycle: 'MONTHLY',
            status: 'ACTIVE',
            monthlyAmount: TEACHER_MONTHLY_FEE,
            annualAmount: TEACHER_MONTHLY_FEE * 12,
            setupFee: 0,
            startDate: tenant.createdAt,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            lastPaymentDate: now,
            lastPaymentAmount: invoice.amount,
          },
        });
      }

      await tx.tenant.update({
        where: { id: tenant.id },
        data: { subscriptionStatus: 'ACTIVE', status: 'active' },
      });

      await tx.auditLog
        .create({
          data: {
            tenantId: tenant.id,
            action: 'TEACHER_SUBSCRIPTION_ACTIVATED',
            resource: 'HelmInvoice',
            resourceId: invoice.id,
            tableName: 'helm_invoices',
            recordId: invoice.id,
            newData: {
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              periodStart: periodStart.toISOString(),
              periodEnd: periodEnd.toISOString(),
              source,
              providerTransactionId: providerTxId,
            },
          },
        })
        .catch(() => undefined);
    });

    this.logger.log(
      `✅ Abonnement enseignant ACTIVÉ (${invoice.invoiceNumber}) — période ${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)} (${source})`,
    );

    // Email de confirmation (best-effort, non bloquant)
    this.sendActivationEmail(tenant.id, invoice, periodEnd, source).catch((err) =>
      this.logger.warn(`Email activation enseignant non envoyé : ${err?.message}`),
    );

    return {
      alreadyActivated: false,
      currentPeriodEnd: periodEnd.toISOString(),
      daysRemaining,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. EMAILS (même système de notification que Academia Helm)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Rappel d'expiration (J-7 puis J-1/24 h) — appelé par le cron quotidien
   * (SubscriptionLifecycleService, branche enseignant).
   * Le rappel J-1 embarque le LIEN/BOUTON de paiement (spécification).
   */
  async sendExpirationReminder(params: {
    tenantId: string;
    teacherEmail: string;
    teacherName: string;
    daysLeft: number;
    currentPeriodEnd: Date;
    subscriptionId: string;
  }): Promise<void> {
    const checkoutUrl = this.buildCheckoutUrl();
    const isFinal24h = params.daysLeft <= 1;

    const subject = isFinal24h
      ? `⏰ Dernier rappel — votre abonnement Helm Enseignant expire dans 24 heures`
      : `Votre abonnement Helm Enseignant expire dans ${params.daysLeft} jours`;

    const expiryDate = params.currentPeriodEnd.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const intro = isFinal24h
      ? `<p>Bonjour ${params.teacherName},</p><p>Votre abonnement <strong>Helm Enseignant</strong> expire <strong>demain (${expiryDate})</strong>. Renouvelez-le dès maintenant pour poursuivre sans interruption la préparation de vos classes (cahier journal, fiches, évaluations, bulletins).</p>`
      : `<p>Bonjour ${params.teacherName},</p><p>Votre abonnement <strong>Helm Enseignant</strong> expire dans <strong>${params.daysLeft} jours</strong> (le ${expiryDate}). Préparez-vous à renouveler votre mensualité afin de conserver un accès continu à votre espace pédagogique.</p>`;

    const button = `<div style="text-align:center;margin:28px 0;">
<a href="${checkoutUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:12px;font-size:16px;">Renouveler mon abonnement — 2 000 FCFA / mois</a>
</div>
<p style="text-align:center;font-size:13px;color:#64748b;">Ou copiez ce lien : ${checkoutUrl}</p>`;

    const after = isFinal24h
      ? `<p style="color:#64748b;font-size:13px;">Après l'expiration, votre espace reste accessible <strong>7 jours supplémentaires</strong> (période de grâce). Passé ce délai, le compte devient inactif — vous pourrez le réactiver à tout moment par un simple paiement, vos données étant intégralement conservées.</p>`
      : `<p style="color:#64748b;font-size:13px;">Un second rappel vous sera envoyé 24 heures avant l'expiration, avec un lien de paiement direct.</p>`;

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
${intro}
<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:16px;margin:20px 0;">
<p style="margin:0;"><strong>Formule :</strong> Helm Enseignant — Mensuel</p>
<p style="margin:4px 0 0;"><strong>Mensualité :</strong> 2 000 FCFA (30 jours)</p>
<p style="margin:4px 0 0;"><strong>Expiration :</strong> ${expiryDate}</p>
</div>
${button}
${after}
<p>Cordialement,<br/>L'équipe Academia Helm</p>
</div>`;

    try {
      await this.emailService.sendCategorized({
        tenantId: params.tenantId,
        category: 'FINANCE',
        subCategory: 'rappel_expiration_abonnement_enseignant',
        module: 'teacher-portal',
        to: params.teacherEmail,
        subject,
        html,
        text: subject,
        recipientType: 'TEACHER',
        triggeredBy: 'AUTOMATION',
        relatedEntityType: 'HelmSubscription',
        relatedEntityId: params.subscriptionId,
      });
      this.logger.log(`Email rappel J-${params.daysLeft} enseignant envoyé à ${params.teacherEmail}`);
    } catch (err: any) {
      this.logger.error(`Email rappel enseignant échoué : ${err?.message}`);
    }
  }

  /** Email de confirmation après activation (premier paiement ou renouvellement). */
  private async sendActivationEmail(
    tenantId: string,
    invoice: { invoiceNumber: string | null; amount: number },
    periodEnd: Date,
    source: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!user?.email) return;

    const expiryDate = periodEnd.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const subject = '✅ Abonnement Helm Enseignant activé';
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
<p>Bonjour ${user.firstName || 'cher enseignant'},</p>
<p>Votre paiement de <strong>${invoice.amount.toLocaleString('fr-FR')} FCFA</strong> a bien été reçu. Votre <strong>compteur d'abonnement est activé</strong> — le décompte de vos 30 jours est en cours.</p>
<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:16px;margin:20px 0;">
<p style="margin:0;"><strong>Formule :</strong> Helm Enseignant — Mensuel (2 000 FCFA / mois)</p>
<p style="margin:4px 0 0;"><strong>Facture :</strong> ${invoice.invoiceNumber ?? '—'}</p>
<p style="margin:4px 0 0;"><strong>Valide jusqu'au :</strong> ${expiryDate}</p>
</div>
<p>Vous pouvez consulter l'état de votre compteur à tout moment dans vos <strong>Paramètres → Abonnement</strong>. Un rappel vous sera envoyé par email 7 jours puis 24 heures avant l'expiration.</p>
<p>Bonne préparation de vos classes !<br/>L'équipe Academia Helm</p>
</div>`;

    await this.emailService.sendCategorized({
      tenantId,
      category: 'FINANCE',
      subCategory: 'activation_abonnement_enseignant',
      module: 'teacher-portal',
      to: user.email,
      subject,
      html,
      text: subject,
      recipientType: 'TEACHER',
      triggeredBy: 'AUTOMATION',
      relatedEntityType: 'HelmInvoice',
      relatedEntityId: invoice.invoiceNumber ?? undefined,
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVÉ — helpers
  // ══════════════════════════════════════════════════════════════════════

  /** Résout le contexte enseignant (user + tenant TEACHER + abonnement). */
  private async resolveTeacherContext(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.tenantId) {
      throw new ForbiddenException('Session enseignant invalide.');
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant || (tenant as any).type !== 'TEACHER') {
      throw new ForbiddenException('Ce portail est réservé aux enseignants autonomes.');
    }
    const subscription = await this.prisma.helmSubscription.findUnique({
      where: { tenantId: tenant.id },
    });
    return { user, tenant, subscription };
  }

  /** Crée la facture enseignant (numéro ENS-YY-MM-NNNNN globalement unique). */
  private async createTeacherInvoice(tenantId: string, customerEmail: string, customerName: string) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');

    let invoiceNumber = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `ENS-${yy}-${mm}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
      const clash = await this.prisma.helmInvoice.findUnique({
        where: { invoiceNumber: candidate },
        select: { id: true },
      });
      if (!clash) {
        invoiceNumber = candidate;
        break;
      }
    }
    if (!invoiceNumber) {
      invoiceNumber = `ENS-${yy}-${mm}-${Date.now().toString().slice(-5)}`;
    }

    return this.prisma.helmInvoice.create({
      data: {
        tenantId,
        amount: TEACHER_MONTHLY_FEE,
        currency: 'XOF',
        invoiceNumber,
        customerEmail,
        customerName: customerName || 'Enseignant',
        description: 'Abonnement mensuel Helm Enseignant (30 jours)',
        type: 'TEACHER_SUBSCRIPTION',
        status: 'PENDING',
        period: 'MONTHLY',
      },
    });
  }

  /** Normalise metadata + custom_metadata d'une transaction FedaPay. */
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

  /** Résout la facture visée par une transaction webhook. */
  private async findInvoiceForTransaction(transaction: any, meta: Record<string, any>) {
    // 1. Identifiant direct (metadata de la transaction créée au checkout)
    const invoiceId =
      typeof meta.teacherInvoiceId === 'string' ? meta.teacherInvoiceId : null;
    if (invoiceId) {
      const byId = await this.prisma.helmInvoice.findUnique({ where: { id: invoiceId } });
      if (byId && byId.type === 'TEACHER_SUBSCRIPTION') return byId;
    }
    // 2. ID de transaction stocké sur la facture au moment du checkout
    //    (fedapayTxId — colonne réelle de HelmInvoice).
    const txId = transaction?.id != null ? String(transaction.id) : null;
    if (txId) {
      const byTx = await this.prisma.helmInvoice.findFirst({
        where: {
          type: 'TEACHER_SUBSCRIPTION',
          fedapayTxId: txId,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (byTx) return byTx;
    }
    return null;
  }

  /** Instantané d'une facture déjà payée (idempotence). */
  private async buildStatusSnapshot(invoice: { id: string; tenantId: string; status: string }) {
    const subscription = await this.prisma.helmSubscription.findUnique({
      where: { tenantId: invoice.tenantId },
    });
    const now = new Date();
    return {
      invoiceId: invoice.id,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      daysRemaining: subscription?.currentPeriodEnd
        ? Math.max(
            0,
            Math.ceil(
              (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            ),
          )
        : null,
    };
  }

  /**
   * Base publique du webhook (même chaîne que Helm/patronat) :
   * FEDAPAY_WEBHOOK_BASE_URL → PUBLIC_API_URL → API_URL.
   */
  buildWebhookUrl(): string {
    const base = (
      this.configService.get<string>('FEDAPAY_WEBHOOK_BASE_URL') ||
      this.configService.get<string>('PUBLIC_API_URL') ||
      this.configService.get<string>('API_URL') ||
      ''
    )
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api$/, '');
    return `${base}/api/teacher-portal/public/webhook`;
  }

  /** URL publique de la page de paiement enseignant (emails + callback). */
  buildCheckoutUrl(): string {
    return `${this.teacherAppBaseUrl()}/prof/checkout`;
  }

  /** Base publique du portail enseignant (sous-domaine officiel ou domaine principal). */
  private teacherAppBaseUrl(): string {
    const explicit = this.configService.get<string>('TEACHER_APP_URL');
    if (explicit) return explicit.trim().replace(/\/+$/, '');
    const frontend = (this.configService.get<string>('FRONTEND_URL') || 'https://academiahelm.com')
      .trim()
      .replace(/\/+$/, '');
    return frontend;
  }

  /**
   * Valide l'origine de retour fournie par le front (enseignant.academiahelm.com,
   * academiahelm.com, ou localhost en dev) — anti open-redirect.
   */
  private resolveReturnBase(returnBaseUrl?: string): string {
    const fallback = this.teacherAppBaseUrl();
    if (!returnBaseUrl) return fallback;
    try {
      const u = new URL(returnBaseUrl);
      if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
        return fallback;
      }
      const root = this.frontendRootDomain();
      if (u.hostname === root || u.hostname.endsWith(`.${root}`)) {
        return u.origin;
      }
      if (['localhost', '127.0.0.1'].includes(u.hostname)) {
        return u.origin;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  private frontendRootDomain(): string {
    const frontend = (this.configService.get<string>('FRONTEND_URL') || 'https://academiahelm.com')
      .trim()
      .replace(/\/+$/, '');
    try {
      const u = new URL(frontend);
      let host = u.hostname;
      if (host.startsWith('www.')) host = host.slice(4);
      const parts = host.split('.');
      if (parts.length > 2) return parts.slice(-2).join('.');
      return host;
    } catch {
      return 'academiahelm.com';
    }
  }
}
