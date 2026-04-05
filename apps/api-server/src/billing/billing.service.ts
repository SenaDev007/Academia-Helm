import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type WebhookResolvedPayment =
  | { paymentType: 'onboarding'; paymentId: string }
  | { paymentType: 'subscription_renewal'; billingEventId: string };

/**
 * Résolution du contexte paiement à partir du corps webhook FedaPay (metadata souvent absent ou stringifié).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      const p = await this.prisma.onboardingPayment.findUnique({
        where: { reference: String(ref) },
      });
      if (p) {
        this.logger.log(`Onboarding: paymentId résolu via reference=${ref} → ${p.id}`);
        return { paymentType: 'onboarding', paymentId: p.id };
      }
    }

    return null;
  }
}
