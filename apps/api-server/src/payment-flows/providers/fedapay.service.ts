/**
 * ============================================================================
 * FEDAPAY SERVICE - INTÉGRATION PSP FEDAPAY
 * ============================================================================
 * 
 * Fedapay est le PSP principal pour Academia Hub.
 * 
 * CONFIGURATION :
 * - Clés API dans les variables d'environnement
 * - Webhooks sécurisés avec signature
 * - Support paiements SAAS et TUITION
 * 
 * ============================================================================
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

interface InitiatePaymentParams {
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, any>;
  destinationAccount?: string; // Pour TUITION (compte école)
}

interface InitiatePaymentResult {
  paymentUrl: string;
  reference: string;
  transactionId: string;
}

@Injectable()
export class FedapayService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.FEDAPAY_API_KEY || '';
    this.apiSecret = process.env.FEDAPAY_API_SECRET || '';
    this.webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET || '';
    this.baseUrl = process.env.FEDAPAY_BASE_URL || 'https://api.fedapay.com';

    if (!this.apiKey || !this.apiSecret) {
      // Message moins alarmant - Fedapay est optionnel en développement
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  Fedapay credentials not configured. Payment flows will fail in production.');
      } else {
        console.log('ℹ️  Fedapay not configured (optional in development). Configure FEDAPAY_API_KEY and FEDAPAY_API_SECRET to enable payments.');
      }
    }
  }

  /**
   * Initie un paiement via Fedapay
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!this.apiKey || !this.apiSecret) {
      throw new BadRequestException('Fedapay n\'est pas configuré');
    }

    try {
      // Construire la requête selon le type de paiement
      const payload: any = {
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        metadata: params.metadata,
      };

      // Si destinationAccount est fourni, c'est un paiement TUITION vers l'école
      if (params.destinationAccount) {
        payload.destination = params.destinationAccount;
        payload.split = true; // Split payment : commission Academia Hub + montant école
      }

      // Appel API Fedapay
      const response = await fetch(`${this.baseUrl}/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new BadRequestException(`Fedapay error: ${error.message || 'Unknown error'}`);
      }

      const data = await response.json();

      return {
        paymentUrl: data.transaction?.payment_url || data.payment_url,
        reference: data.transaction?.id || data.id,
        transactionId: data.transaction?.id || data.id,
      };
    } catch (error) {
      console.error('Fedapay initiatePayment error:', error);
      throw new BadRequestException(`Erreur lors de l'initiation du paiement: ${error.message}`);
    }
  }

  /**
   * Vérifie la signature d'un webhook Fedapay
   */
  async verifyWebhookSignature(webhookData: any): Promise<boolean> {
    if (!this.webhookSecret) {
      console.warn('Fedapay webhook secret not configured. Webhook verification disabled.');
      return true; // En développement, permettre sans vérification
    }

    const signature = webhookData.signature || webhookData.headers?.['x-fedapay-signature'];
    if (!signature) {
      return false;
    }

    // Calculer le hash attendu
    const payload = JSON.stringify(webhookData);
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    // Comparer les signatures (timing-safe)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Récupère le statut d'une transaction
   */
  async getTransactionStatus(transactionId: string): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new BadRequestException('Fedapay n\'est pas configuré');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/transactions/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new BadRequestException(`Failed to fetch transaction status`);
      }

      const data = await response.json();
      return data.transaction?.status || data.status || 'UNKNOWN';
    } catch (error) {
      console.error('Fedapay getTransactionStatus error:', error);
      throw new BadRequestException(`Erreur lors de la récupération du statut: ${error.message}`);
    }
  }
}

