/**
 * ============================================================================
 * FEDAPAY SERVICE — Intégration Fedapay Checkout + Webhook
 * ============================================================================
 *
 * Fedapay utilise un checkout côté client (JavaScript) avec la clé publique.
 * Le backend gère :
 *   - La vérification du statut d'une transaction
 *   - Le webhook de confirmation
 *
 * API Fedapay (https://docs-v1.fedapay.com) :
 *   GET /v1/transactions/{id} → vérifier le statut (avec secret key)
 *   Webhook → confirmation asynchrone
 *
 * Le checkout est initié côté frontend via :
 *   <script src="https://cdn.fedapay.com/checkout.js"></script>
 *   FedaPay.init('#btn', { public_key, transaction: { amount, description }, customer: { email } })
 *
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { TenantPaymentConfigService } from './tenant-payment-config.service';

const FEDAPAY_API_URL = 'https://api.fedapay.com/v1';

@Injectable()
export class FedapayService {
  private readonly logger = new Logger(FedapayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paymentConfigService: TenantPaymentConfigService,
  ) {}

  /**
   * Récupère la clé publique Fedapay pour le checkout côté frontend.
   */
  async getPublicKey(tenantId: string): Promise<{ publicKey: string | null; enabled: boolean }> {
    const config = await this.paymentConfigService.getFullConfig(tenantId);
    if (!config || config.provider !== 'fedapay' || !config.isActive) {
      return { publicKey: null, enabled: false };
    }
    return {
      publicKey: config.fedapayPublicKey || null,
      enabled: !!(config.fedapayPublicKey && config.fedapaySecretKey),
    };
  }

  /**
   * Vérifie le statut d'une transaction Fedapay.
   * GET /v1/transactions/{id} avec la secret key.
   */
  async verifyTransaction(tenantId: string, transactionRef: string): Promise<{
    status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'unknown';
    amount?: number;
    raw?: any;
  }> {
    const config = await this.paymentConfigService.getFullConfig(tenantId);
    if (!config?.fedapaySecretKey) {
      throw new BadRequestException('Configuration Fedapay manquante (secret key)');
    }

    try {
      const url = `${FEDAPAY_API_URL}/transactions/${encodeURIComponent(transactionRef)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.fedapaySecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json().catch(() => ({}));
      this.logger.log(`Fedapay verify: ref=${transactionRef} | status=${result.status} | HTTP ${response.status}`);

      // Fedapay v1 utilise les statuts : pending, approved, declined, cancelled
      const fedapayStatus = (result.status || '').toLowerCase();
      let status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'unknown' = 'unknown';
      if (fedapayStatus === 'approved' || fedapayStatus === 'success') {
        status = 'approved';
      } else if (fedapayStatus === 'declined' || fedapayStatus === 'failed') {
        status = 'declined';
      } else if (fedapayStatus === 'pending') {
        status = 'pending';
      } else if (fedapayStatus === 'cancelled' || fedapayStatus === 'canceled') {
        status = 'cancelled';
      }

      return {
        status,
        amount: result.amount ? Number(result.amount) : undefined,
        raw: result,
      };
    } catch (err: any) {
      this.logger.error(`Fedapay verify error: ${err.message}`);
      return { status: 'unknown', raw: { error: err.message } };
    }
  }

  /**
   * Webhook handler — appelé par Fedapay quand le paiement est confirmé.
   * Fedapay envoie un événement dans le body.
   */
  async handleWebhook(body: any, tenantId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Fedapay webhook reçu: tenant=${tenantId}`);
    this.logger.log(`Fedapay webhook body: ${JSON.stringify(body).substring(0, 500)}`);

    // Fedapay envoie un événement avec un type et des données
    const eventType = body?.event || body?.type || '';
    const transaction = body?.data?.object || body?.data || body?.transaction || {};

    if (eventType.includes('transaction') && eventType.includes('approved')) {
      // Paiement approuvé
      const ref = transaction.reference || transaction.id || body?.reference;
      const amount = Number(transaction.amount || 0);

      this.logger.log(`Fedapay webhook CONFIRMÉ: ref=${ref} | amount=${amount}`);

      // TODO: Créer la FinanceTransaction quand le webhook est confirmé
      // Nécessite de stocker les métadonnées (studentAccountId, academicYearId) lors de l'initiation

      return { success: true, message: 'Paiement confirmé via Fedapay' };
    }

    if (eventType.includes('transaction') && eventType.includes('declined')) {
      this.logger.log(`Fedapay webhook: paiement DECLINED ref=${transaction.reference}`);
      return { success: true, message: 'Paiement refusé' };
    }

    return { success: true, message: `Événement ${eventType} reçu` };
  }
}
