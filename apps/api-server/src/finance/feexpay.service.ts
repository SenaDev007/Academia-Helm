/**
 * ============================================================================
 * FEEXPAY SERVICE — Intégration API FeexPay pour paiements en ligne
 * ============================================================================
 *
 * Permet aux écoles d'accepter les paiements Mobile Money (MTN, Moov, Celtiis)
 * via FeexPay. Chaque école utilise son PROPRE compte FeexPay.
 *
 * API FeexPay (https://docs.feexpay.me) :
 *   POST /api/v1/payments/initiate  → initier un paiement
 *   GET  /api/v1/payments/{id}/status → vérifier le statut
 *   Webhook callback → confirmation asynchrone
 *
 * Flux :
 *   1. Parent/secrétaire clique "Payer en ligne"
 *   2. Backend appelle FeexPay avec les clés de l'école
 *   3. FeexPay envoie un push USSD/SMS au parent
 *   4. Parent confirme sur son téléphone
 *   5. FeexPay notifie le webhook → backend crée la FinanceTransaction
 *
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { TenantPaymentConfigService } from './tenant-payment-config.service';
import { FinanceTransactionService } from './finance-transaction.service';

const FEEXPAY_API_URL = 'https://api.feexpay.me/api/v1';

export interface FeexPayInitiateParams {
  tenantId: string;
  studentAccountId: string;
  studentName: string;
  amount: number;
  phone: string; // Numéro du parent (ex: 0195722234)
  academicYearId: string;
  callbackUrl?: string;
}

@Injectable()
export class FeexPayService {
  private readonly logger = new Logger(FeexPayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paymentConfigService: TenantPaymentConfigService,
    private readonly transactionService: FinanceTransactionService,
  ) {}

  /**
   * Initie un paiement FeexPay.
   * Appelle l'API FeexPay avec les clés de l'école (tenant).
   * Retourne l'URL de paiement / reference FeexPay.
   */
  async initiatePayment(params: FeexPayInitiateParams): Promise<{
    success: boolean;
    reference?: string;
    paymentUrl?: string;
    message?: string;
  }> {
    // 1. Vérifier que les paiements en ligne sont activés
    const enabled = await this.paymentConfigService.isOnlinePaymentEnabled(params.tenantId);
    if (!enabled) {
      throw new BadRequestException('Les paiements en ligne ne sont pas activés pour cette école');
    }

    // 2. Récupérer la config complète (avec clés)
    const config = await this.paymentConfigService.getFullConfig(params.tenantId);
    if (!config || config.provider !== 'feexpay') {
      throw new BadRequestException('Le fournisseur de paiement n\'est pas FeexPay');
    }

    // 3. Normaliser le numéro de téléphone (format international sans +)
    const phone = this.normalizePhoneForFeexPay(params.phone);

    // 4. Générer une référence unique
    const reference = `AH-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 5. URL de callback (webhook)
    const apiUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
    const callbackUrl = `${apiUrl}/api/finance/payments/feexpay/webhook`;

    this.logger.log(
      `FeexPay initiate: tenant=${params.tenantId} | amount=${params.amount} | phone=${phone} | ref=${reference}`,
    );

    // 6. Appeler l'API FeexPay
    try {
      const body: any = {
        id: config.feexpayShopId,
        amount: params.amount,
        phone,
        reference,
        callback_url: callbackUrl,
        description: `Paiement scolarité - ${params.studentName}`,
      };

      const response = await fetch(`${FEEXPAY_API_URL}/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.feexpayApiKey}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { raw: responseText };
      }

      this.logger.log(
        `FeexPay response: HTTP ${response.status} | body: ${JSON.stringify(result).substring(0, 500)}`,
      );

      if (response.ok && (result.status === 'success' || result.reference || result.id)) {
        // Succès — le paiement est initié, le parent reçoit un push sur son téléphone
        return {
          success: true,
          reference: result.reference || reference,
          paymentUrl: result.payment_url || result.url || null,
          message: result.message || 'Paiement initié. Le parent va recevoir une notification sur son téléphone.',
        };
      }

      // Erreur
      const errorMsg = result.message || result.error || `HTTP ${response.status}`;
      this.logger.error(`FeexPay initiate failed: ${errorMsg}`);
      return {
        success: false,
        message: errorMsg,
      };
    } catch (err: any) {
      this.logger.error(`FeexPay initiate error: ${err.message}`);
      return {
        success: false,
        message: `Erreur de connexion à FeexPay: ${err.message}`,
      };
    }
  }

  /**
   * Vérifie le statut d'un paiement FeexPay.
   */
  async verifyPayment(tenantId: string, reference: string): Promise<{
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    amount?: number;
    message?: string;
  }> {
    const config = await this.paymentConfigService.getFullConfig(tenantId);
    if (!config?.feexpayApiKey) {
      throw new BadRequestException('Configuration FeexPay manquante');
    }

    try {
      const response = await fetch(`${FEEXPAY_API_URL}/payments/${encodeURIComponent(reference)}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.feexpayApiKey}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      this.logger.log(`FeexPay verify: ref=${reference} | status=${result.status} | HTTP ${response.status}`);

      // Mapper le statut FeexPay à notre format
      const feexpayStatus = (result.status || '').toLowerCase();
      let status: 'pending' | 'success' | 'failed' | 'cancelled' = 'pending';
      if (feexpayStatus === 'success' || feexpayStatus === 'completed' || feexpayStatus === 'paid') {
        status = 'success';
      } else if (feexpayStatus === 'failed' || feexpayStatus === 'error') {
        status = 'failed';
      } else if (feexpayStatus === 'cancelled' || feexpayStatus === 'canceled') {
        status = 'cancelled';
      }

      return {
        status,
        amount: result.amount ? Number(result.amount) : undefined,
        message: result.message,
      };
    } catch (err: any) {
      this.logger.error(`FeexPay verify error: ${err.message}`);
      return { status: 'pending', message: err.message };
    }
  }

  /**
   * Webhook handler — appelé par FeexPay quand le paiement est confirmé.
   * Crée la FinanceTransaction pour mettre à jour le compte élève.
   */
  async handleWebhook(body: any, tenantId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`FeexPay webhook reçu: ${JSON.stringify(body).substring(0, 500)}`);

    const reference = body.reference || body.ref || body.id;
    const status = (body.status || '').toLowerCase();
    const amount = Number(body.amount || 0);

    if (!reference) {
      return { success: false, message: 'Référence manquante dans le webhook' };
    }

    // Vérifier le statut
    if (status !== 'success' && status !== 'completed' && status !== 'paid') {
      this.logger.log(`FeexPay webhook: paiement ${reference} statut=${status} (non confirmé)`);
      return { success: true, message: `Statut ${status} — paiement non confirmé` };
    }

    // Récupérer les métadonnées du paiement (stockées lors de l'initiation)
    // Pour l'instant, on cherche par référence dans les transactions existantes
    // ou on stocke les métadonnées dans une table séparée

    // TODO: Récupérer studentAccountId + academicYearId depuis les métadonnées
    // Pour l'instant, on log et on retourne succès
    this.logger.log(`FeexPay webhook confirmé: ref=${reference} | amount=${amount} | tenant=${tenantId}`);

    return { success: true, message: 'Webhook traité' };
  }

  /**
   * Normalise un numéro de téléphone pour FeexPay.
   * FeexPay attend un numéro au format international (ex: 2290195722234).
   */
  private normalizePhoneForFeexPay(phone: string): string {
    let cleaned = phone.replace(/[\s\-().]/g, '').trim();
    // 0195722234 → 2290195722234
    if (/^01\d{8}$/.test(cleaned)) {
      return '229' + cleaned;
    }
    // 95722234 → 22995722234
    if (/^\d{8}$/.test(cleaned) && !cleaned.startsWith('00')) {
      return '229' + cleaned;
    }
    // +229... → 229...
    if (cleaned.startsWith('+')) {
      return cleaned.substring(1);
    }
    // 00... → ...
    if (cleaned.startsWith('00')) {
      return cleaned.substring(2);
    }
    return cleaned;
  }
}
