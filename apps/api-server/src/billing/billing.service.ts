import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { FedaPayService } from './services/fedapay.service';

export type WebhookResolvedPayment =
  | { paymentType: 'onboarding'; paymentId: string }
  | { paymentType: 'subscription_renewal'; billingEventId: string };

function tryParseObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return typeof p === 'object' && p !== null && !Array.isArray(p)
        ? (p as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return null;
}

/**
 * Résolution webhook FedaPay + point d’entrée handlePaymentSuccess pour le controller.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(
      forwardRef(() => {
        // Chargement différé : évite ReferenceError (FedaPayService before initialization)
        // causé par billing.service ↔ fedapay.service (imports circulaires au chargement du module).
        return require('./services/fedapay.service').FedaPayService;
      }),
    )
    private readonly fedapayService: FedaPayService,
  ) {}

  normalizeFedaPayTransactionMetadata(transaction: unknown): Record<string, unknown> {
    const merge = (obj: unknown): Record<string, unknown> => {
      if (obj == null) return {};
      if (typeof obj === 'string') {
        try {
          const p = JSON.parse(obj) as unknown;
          return typeof p === 'object' && p !== null && !Array.isArray(p)
            ? (p as Record<string, unknown>)
            : {};
        } catch {
          return {};
        }
      }
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        return { ...(obj as Record<string, unknown>) };
      }
      return {};
    };

    const t = transaction as Record<string, unknown> | null | undefined;
    if (!t) return {};
    const base = merge(t.metadata);
    const custom = merge(t.custom_metadata);
    return { ...base, ...custom };
  }

  /**
   * draftId : custom_metadata, metadata, metadata.paid_customer (selon payloads FedaPay).
   */
  extractDraftIdFromTransaction(transactionData: unknown): string | null {
    if (transactionData == null || typeof transactionData !== 'object') {
      return null;
    }
    const t = transactionData as Record<string, unknown>;

    const fromNorm = this.normalizeFedaPayTransactionMetadata(transactionData).draftId;
    if (typeof fromNorm === 'string' && fromNorm.trim().length > 0) {
      return fromNorm.trim();
    }

    const meta = tryParseObject(t.metadata);
    if (meta) {
      const d = meta.draftId;
      if (typeof d === 'string' && d.trim().length > 0) {
        return d.trim();
      }
      const paid = meta.paid_customer;
      if (paid && typeof paid === 'object' && !Array.isArray(paid)) {
        const pd = (paid as Record<string, unknown>).draftId;
        if (typeof pd === 'string' && pd.trim().length > 0) {
          return pd.trim();
        }
      }
    }

    const cm = tryParseObject(t.custom_metadata);
    if (cm) {
      const d = cm.draftId;
      if (typeof d === 'string' && d.trim().length > 0) {
        return d.trim();
      }
    }

    return null;
  }

  /** Fusionne draftId dans metadata + custom_metadata pour la résolution interne. */
  mergeDraftIdIntoTransactionEntity(
    transactionData: Record<string, unknown>,
    draftId: string,
  ): Record<string, unknown> {
    const meta = tryParseObject(transactionData.metadata) ?? {};
    const cm = tryParseObject(transactionData.custom_metadata) ?? {};
    return {
      ...transactionData,
      metadata: { ...meta, draftId },
      custom_metadata: { ...cm, draftId },
    };
  }

  async resolveWebhookPayment(transaction: unknown): Promise<WebhookResolvedPayment | null> {
    const meta = this.normalizeFedaPayTransactionMetadata(transaction);
    const t = transaction as Record<string, unknown> | undefined;
    const paymentTypeRaw =
      (meta.type as string) || (meta.paymentType as string) || 'onboarding';

    if (paymentTypeRaw === 'subscription_renewal') {
      const fromMeta = meta.billingEventId;
      if (typeof fromMeta === 'string' && fromMeta.length > 0) {
        return { paymentType: 'subscription_renewal', billingEventId: fromMeta };
      }
      const ref = t?.reference ?? t?.reference_id;
      if (ref != null && String(ref).length > 0) {
        const ev = await this.prisma.billingEvent.findFirst({
          where: { reference: String(ref) },
        });
        if (ev) {
          this.logger.log(
            `Renewal: billingEventId résolu via reference=${ref} → ${ev.id}`,
          );
          return { paymentType: 'subscription_renewal', billingEventId: ev.id };
        }
      }
      return null;
    }

    const paymentIdMeta = meta.paymentId;
    if (typeof paymentIdMeta === 'string' && paymentIdMeta.length > 0) {
      const p = await this.prisma.onboardingPayment.findUnique({
        where: { id: paymentIdMeta },
      });
      if (p) {
        return { paymentType: 'onboarding', paymentId: p.id };
      }
      this.logger.warn(
        `metadata.paymentId=${paymentIdMeta} présent mais aucun OnboardingPayment correspondant`,
      );
    }

    const draftId = meta.draftId;
    if (typeof draftId === 'string' && draftId.length > 0) {
      const pending = await this.prisma.onboardingPayment.findFirst({
        where: {
          draftId,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (pending) {
        this.logger.log(
          `Onboarding: paymentId résolu via draftId=${draftId} (PENDING/PROCESSING) → ${pending.id}`,
        );
        return { paymentType: 'onboarding', paymentId: pending.id };
      }
      const latest = await this.prisma.onboardingPayment.findFirst({
        where: { draftId },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        this.logger.log(
          `Onboarding: paymentId résolu via draftId=${draftId} (dernier paiement) → ${latest.id}`,
        );
        return { paymentType: 'onboarding', paymentId: latest.id };
      }
    }

    const ref = t?.reference ?? t?.reference_id;
    if (ref != null && String(ref).length > 0) {
      const refStr = String(ref);
      const p = await this.prisma.onboardingPayment.findUnique({
        where: { reference: refStr },
      });
      if (p) {
        this.logger.log(`Onboarding: paymentId résolu via reference=${ref} → ${p.id}`);
        return { paymentType: 'onboarding', paymentId: p.id };
      }
      const ev = await this.prisma.billingEvent.findFirst({
        where: { reference: refStr },
      });
      if (ev) {
        this.logger.log(
          `Renewal: billingEventId résolu via reference seule (metadata type absent) → ${ev.id}`,
        );
        return { paymentType: 'subscription_renewal', billingEventId: ev.id };
      }
    }

    return null;
  }

  /**
   * Point d’entrée webhook transaction.approved : logs, draftId multi-sources, vérif draft,
   * puis traitement FedaPay (tenant via OnboardingService, idempotence, etc.).
   */
  async handlePaymentSuccess(transactionData: any) {
    this.logger.log('=== PAYMENT SUCCESS ===');
    try {
      const json = JSON.stringify(transactionData, null, 2);
      const max = 14_000;
      this.logger.log(
        `Full entity (${json.length} chars): ${json.length > max ? `${json.slice(0, max)}…[tronqué]` : json}`,
      );
    } catch (e: unknown) {
      this.logger.warn(
        `Impossible de sérialiser transactionData: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const draftId = this.extractDraftIdFromTransaction(transactionData);
    this.logger.log(`draftId extrait (toutes sources): ${draftId ?? '(aucun)'}`);

    const norm = this.normalizeFedaPayTransactionMetadata(transactionData);
    const isRenewal = norm.type === 'subscription_renewal';

    let entity: Record<string, unknown> =
      transactionData && typeof transactionData === 'object'
        ? { ...transactionData }
        : {};

    if (draftId) {
      entity = this.mergeDraftIdIntoTransactionEntity(entity, draftId);
      const draft = await this.prisma.onboardingDraft.findUnique({
        where: { id: draftId },
      });
      if (!draft) {
        this.logger.error('❌ Draft introuvable en BDD', {
          draftId,
          transactionId: transactionData?.id,
          reference: transactionData?.reference,
          metadata: transactionData?.metadata,
          custom_metadata: transactionData?.custom_metadata,
        });
        throw new BadRequestException(`Draft introuvable: ${draftId}`);
      }
      this.logger.log(`✅ Draft trouvé: ${draft.id}`);
    } else if (!isRenewal) {
      this.logger.warn(
        '⚠️ draftId absent du webhook onboarding — tentative de résolution par reference / paymentId uniquement',
        {
          id: transactionData?.id,
          reference: transactionData?.reference,
          metadata: transactionData?.metadata,
          custom_metadata: transactionData?.custom_metadata,
        },
      );
    }

    const resolvedPreview = await this.resolveWebhookPayment(entity);
    if (!resolvedPreview && !isRenewal) {
      this.logger.error('❌ Impossible de résoudre le paiement onboarding', {
        draftId,
        id: transactionData?.id,
        reference: transactionData?.reference,
        metadata: transactionData?.metadata,
        custom_metadata: transactionData?.custom_metadata,
      });
      throw new BadRequestException(
        `draftId / paymentId / reference insuffisants — transaction ${transactionData?.id ?? '?'}`,
      );
    }
    if (!resolvedPreview && isRenewal) {
      this.logger.error('❌ Renouvellement : billingEvent introuvable', {
        id: transactionData?.id,
        reference: transactionData?.reference,
      });
      throw new BadRequestException(
        `Renouvellement non résolu — transaction ${transactionData?.id ?? '?'}`,
      );
    }

    return this.fedapayService.processApprovedWebhookEntity(entity);
  }

  async handlePaymentFailed(transactionData: any) {
    this.logger.log('=== PAYMENT FAILED / DECLINED ===');
    this.logger.log(`reference=${transactionData?.reference} id=${transactionData?.id}`);
    await this.fedapayService.processFailedWebhookEntity(transactionData);
  }

  async handlePaymentCanceled(transactionData: any) {
    this.logger.log('=== PAYMENT CANCELED ===');
    this.logger.log(`reference=${transactionData?.reference} id=${transactionData?.id}`);
    await this.fedapayService.processCanceledWebhookEntity(transactionData);
  }
}
