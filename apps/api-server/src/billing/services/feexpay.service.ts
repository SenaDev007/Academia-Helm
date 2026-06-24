/**
 * ============================================================================
 * FEEXPAY SERVICE v2 — Service de paiement FeexPay
 * ============================================================================
 *
 * Implémentation conforme à la documentation officielle v2 :
 *   https://docs.feexpay.me/?section=api-rest-integrations&version=v2
 *
 * Base URL v2 : https://api-v2.feexpay.me
 *
 * Authentification : header `Authorization: Bearer <FEEXPAY_API_KEY>`
 *
 * Endpoints utilisés :
 *   - POST /api/transactions/public/requesttopay/{operator}  — Mobile Money
 *       operators (Bénin) : mtn, moov, celtiis_bj, coris
 *       Body : { shop, amount, phoneNumber, return_url? }
 *       Response : { reference, status, message }
 *
 *   - POST /api/public/card  — Paiement carte bancaire
 *       Body : { shop, amount, currency, first_name, last_name, email, phoneNumber, return_url? }
 *       Response : { reference, status, message, paymentUrl? }
 *
 *   - GET  /api/transactions/public/single/status/{reference}  — Statut Payin
 *       Response : { reference, status, amount, ... }
 *
 *   - POST /api/payouts/public/{operator}  — Payout (Mobile Money)
 *       operators (Bénin) : mtn, moov, celtiis_bj
 *       Body : { amount, phoneNumber, shop, motif }
 *       Response : { reference, status, message }
 *
 *   - GET  /api/payouts/status/public/{reference}  — Statut Payout
 *
 *   - GET  /api/balance/public/getByShop/{shop_public_id}  — Solde marchand
 *
 * Webhook (POST entrant depuis FeexPay) :
 *   {
 *     "reference": "1e636dff-6b81-499e-bf8b-64b4a07a02a8",
 *     "order_id": "1e636dff-6b81-499e-bf8b-64b4a07a02a8",
 *     "status": "SUCCESSFUL" | "FAILED",
 *     "amount": 250,
 *     "callback_info": "",
 *     "last_name": "",
 *     "first_name": "",
 *     "email": "lougbegnona@gmail.com",
 *     "type": "Paiement",
 *     "phoneNumber": "2290190877433",
 *     "date": "2026-05-25T10:06:26.662Z",
 *     "reseau": "MTN CI",
 *     "ref_link": "",
 *     "description": "test de 10",
 *     "reason": "PAYER_NOT_FOUND",
 *     "ref_operator": ""
 *   }
 *
 * Variables d'environnement :
 *   - FEEXPAY_API_KEY    — token d'authentification (Bearer)
 *   - FEEXPAY_SHOP_ID    — shop_public_id (15 caractères, ex: nGLq7rMBFBVbpuc)
 *   - FEEXPAY_API_URL    — base URL (défaut: https://api-v2.feexpay.me)
 *
 * 3 cas d'usage :
 *   1. Abonnements (école → Academia Helm) — createMobileMoneyPayment / createCardPayment
 *   2. Frais de scolarité (parent → école) — createMobileMoneyPayment / createCardPayment
 *   3. Salaires (école → staff) — createPayout
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Opérateurs Mobile Money supportés (collection + payout). */
export type FeexPayOperator =
  | 'MTN'
  | 'MOOV'
  | 'CELTIIS'
  | 'CORIS'
  | 'ORANGE'
  | 'WAVE';

/** Mapping opérateur → segment URL FeexPay (pour le Bénin : mtn, moov, celtiis_bj, coris). */
const OPERATOR_PATH: Record<FeexPayOperator, string> = {
  MTN: 'mtn',
  MOOV: 'moov',
  CELTIIS: 'celtiis_bj',
  CORIS: 'coris',
  ORANGE: 'orange_sn',
  WAVE: 'wave_sn',
};

export interface FeexPayPaymentRequest {
  amount: number; // En FCFA
  phoneNumber?: string; // Pour Mobile Money (format: 229XXXXXXXX, sans +)
  operator?: FeexPayOperator; // Défaut: MTN
  email: string;
  firstName?: string;
  lastName?: string;
  callbackUrl?: string; // URL de retour après paiement (return_url dans l'API)
  description?: string;
  metadata?: Record<string, any>;
}

export interface FeexPayPaymentResult {
  success: boolean;
  reference?: string;
  paymentUrl?: string; // Pour les paiements carte (redirect)
  status?: string;
  message?: string;
}

export interface FeexPayPayoutRequest {
  amount: number; // En FCFA
  phoneNumber: string; // Numéro du destinataire (format: 229XXXXXXXX)
  operator: FeexPayOperator;
  motif?: string; // Raison du transfert
}

export interface FeexPayPayoutResult {
  success: boolean;
  reference?: string;
  status?: string;
  message?: string;
}

@Injectable()
export class FeexPayService {
  private readonly logger = new Logger(FeexPayService.name);
  private readonly apiKey: string;
  private readonly shopId: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('FEEXPAY_API_KEY') || '';
    this.shopId = this.configService.get<string>('FEEXPAY_SHOP_ID') || '';
    // Base URL v2 par défaut (v1 = https://api.feexpay.me)
    this.apiUrl = this.configService.get<string>('FEEXPAY_API_URL') || 'https://api-v2.feexpay.me';

    if (this.apiKey && this.shopId) {
      this.logger.log(`✅ FeexPay v2 configured (shop=${this.shopId}, apiUrl=${this.apiUrl})`);
    } else {
      this.logger.warn('⚠️ FeexPay not configured — FEEXPAY_API_KEY or FEEXPAY_SHOP_ID missing');
    }
  }

  /** Vérifie si FeexPay est configuré. */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.shopId);
  }

  /** Headers d'authentification pour les appels API v2. */
  private authHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /** Construit l'URL d'un endpoint. */
  private url(path: string): string {
    return `${this.apiUrl}${path}`;
  }

  /**
   * Récupère le solde du marchand (par shop_public_id).
   * Endpoint : GET /api/balance/public/getByShop/{shop_public_id}
   */
  async getShopBalance(): Promise<any> {
    if (!this.isConfigured()) {
      throw new BadRequestException('FeexPay non configuré');
    }
    try {
      const response = await fetch(
        this.url(`/api/balance/public/getByShop/${this.shopId}`),
        { method: 'GET', headers: this.authHeaders() },
      );
      return await response.json() as any;
    } catch (err: any) {
      this.logger.error(`getShopBalance failed: ${err.message}`);
      return null;
    }
  }

  // ─── PAIEMENT MOBILE MONEY ──────────────────────────────────────────────

  /**
   * Initie un paiement Mobile Money.
   *
   * Endpoint v2 : POST /api/transactions/public/requesttopay/{operator}
   * Body : { shop, amount, phoneNumber, return_url? }
   * Response : { reference, status, message }
   *
   * Le client reçoit une notification sur son téléphone pour confirmer le paiement.
   * Le statut final est envoyé via webhook (status=SUCCESSFUL|FAILED).
   */
  async createMobileMoneyPayment(data: FeexPayPaymentRequest, customShopId?: string): Promise<FeexPayPaymentResult> {
    const shopId = customShopId || this.shopId;
    if (!this.apiKey || !shopId) {
      throw new BadRequestException('FeexPay non configuré');
    }

    const operator = data.operator || 'MTN';
    const operatorPath = OPERATOR_PATH[operator];
    if (!operatorPath) {
      throw new BadRequestException(`Opérateur non supporté: ${operator}`);
    }

    if (!data.phoneNumber) {
      throw new BadRequestException('Numéro de téléphone requis pour Mobile Money');
    }

    try {
      const body: Record<string, any> = {
        shop: shopId,
        amount: data.amount,
        phoneNumber: this.normalizePhone(data.phoneNumber),
      };
      if (data.firstName) body.first_name = data.firstName;
      if (data.lastName) body.last_name = data.lastName;
      if (data.description) body.description = data.description;
      if (data.metadata?.callback_info) body.callback_info = data.metadata.callback_info;
      if (data.callbackUrl) body.return_url = data.callbackUrl;

      const response = await fetch(
        this.url(`/api/transactions/public/requesttopay/${operatorPath}`),
        {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify(body),
        },
      );

      const result = await response.json() as any;

      // Gestion des erreurs API
      if (!response.ok || result.status === 'FAILED') {
        const msg = result.message || result.error || `HTTP ${response.status}`;
        this.logger.warn(`FeexPay MO payment failed: ${msg}`, result);
        return { success: false, message: msg };
      }

      this.logger.log(
        `FeexPay MO payment initiated: ref=${result.reference}, amount=${data.amount}, operator=${operator}`,
      );

      return {
        success: true,
        reference: result.reference,
        status: result.status || 'PENDING',
        message: result.message,
      };
    } catch (err: any) {
      this.logger.error(`createMobileMoneyPayment failed: ${err.message}`, err.stack);
      return { success: false, message: err.message };
    }
  }

  // ─── PAIEMENT CARTE BANCAIRE ────────────────────────────────────────────

  /**
   * Initie un paiement par carte bancaire.
   *
   * Endpoint v2 : POST /api/public/card
   * Body : { shop, amount, currency, first_name, last_name, email, phoneNumber, return_url? }
   * Response : { reference, status, message, paymentUrl? }
   *
   * Retourne une URL vers laquelle rediriger le client pour saisir sa carte.
   */
  async createCardPayment(data: FeexPayPaymentRequest): Promise<FeexPayPaymentResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('FeexPay non configuré');
    }

    try {
      const body: Record<string, any> = {
        shop: this.shopId,
        amount: data.amount,
        currency: data.metadata?.currency || 'XOF',
        first_name: data.firstName || data.email.split('@')[0] || 'Client',
        last_name: data.lastName || 'Academia',
        email: data.email,
        phoneNumber: data.phoneNumber ? this.normalizePhone(data.phoneNumber) : '22900000000',
      };
      if (data.callbackUrl) {
        body.return_url = data.callbackUrl;
      }

      const response = await fetch(
        this.url('/api/public/card'),
        {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify(body),
        },
      );

      const result = await response.json() as any;

      if (!response.ok || result.status === 'FAILED') {
        // Cas particulier : endpoint carte non disponible en v2 (404)
        if (response.status === 404) {
          this.logger.warn('FeexPay card endpoint /api/public/card returned 404 — paiement carte non disponible en v2. Utilisez Mobile Money à la place.');
          return {
            success: false,
            message: 'Paiement par carte non disponible actuellement. Veuillez utiliser Mobile Money (MTN, Moov, CelTiis, Coris).',
          };
        }
        const msg = result.message || result.error || `HTTP ${response.status}`;
        this.logger.warn(`FeexPay card payment failed: ${msg}`, result);
        return { success: false, message: msg };
      }

      this.logger.log(
        `FeexPay card payment initiated: ref=${result.reference}, amount=${data.amount}`,
      );

      return {
        success: true,
        reference: result.reference,
        paymentUrl: result.paymentUrl || result.payment_url || result.urlPay,
        status: result.status || 'PENDING',
        message: result.message,
      };
    } catch (err: any) {
      this.logger.error(`createCardPayment failed: ${err.message}`, err.stack);
      return { success: false, message: err.message };
    }
  }

  // ─── VÉRIFIER LE STATUT (PAYIN) ────────────────────────────────────────

  /**
   * Vérifie le statut d'une transaction Payin (collection).
   *
   * Endpoint v2 : GET /api/transactions/public/single/status/{reference}
   * Statuts possibles : PENDING, SUCCESSFUL, FAILED
   */
  async getTransactionStatus(reference: string): Promise<{
    status: string;
    amount?: number;
    clientNumber?: string;
    raw?: any;
  }> {
    if (!this.isConfigured()) {
      return { status: 'UNKNOWN' };
    }
    try {
      const response = await fetch(
        this.url(`/api/transactions/public/single/status/${reference}`),
        { method: 'GET', headers: this.authHeaders() },
      );
      const data = await response.json() as any;
      // La réponse peut être { reference, status, amount, ... } ou
      // { data: { reference, status, ... } } selon le format
      const inner = data.data || data;
      return {
        status: (inner.status || 'UNKNOWN').toUpperCase(),
        amount: inner.amount,
        clientNumber: inner.phoneNumber || inner.payer?.partyId,
        raw: inner,
      };
    } catch (err: any) {
      this.logger.error(`getTransactionStatus failed for ${reference}: ${err.message}`);
      return { status: 'UNKNOWN' };
    }
  }

  // ─── PAYOUT (TRANSFERT VERS MOBILE MONEY) ──────────────────────────────

  /**
   * Initie un transfert (payout) vers un numéro Mobile Money.
   *
   * Endpoint v2 : POST /api/payouts/public/{operator}
   * Body : { amount, phoneNumber, shop, motif }
   *
   * Utilisé pour :
   *   - Paiement des salaires (école → staff)
   *   - Transferts vers des comptes externes
   */
  async createPayout(data: FeexPayPayoutRequest, customShopId?: string): Promise<FeexPayPayoutResult> {
    const shopId = customShopId || this.shopId;
    if (!this.apiKey || !shopId) {
      throw new BadRequestException('FeexPay non configuré');
    }

    try {
      // ─── V2 Payout endpoints ──
      // MTN/MOOV: POST /api/payouts/public/transfer/global (with network field)
      // CELTIIS:  POST /api/payouts/public/celtiis_bj (with network='CELTIIS BJ')
      let payoutUrl: string;
      const body: Record<string, any> = {
        amount: data.amount,
        phoneNumber: this.normalizePhone(data.phoneNumber),
        shop: shopId,
        motif: data.motif || 'Transfert Academia Helm',
      };

      if (data.operator === 'CELTIIS') {
        // CELTIIS Bénin — endpoint dédié
        payoutUrl = this.url('/api/payouts/public/celtiis_bj');
        body.network = 'CELTIIS BJ';
      } else {
        // MTN ou MOOV — endpoint global avec champ network
        payoutUrl = this.url('/api/payouts/public/transfer/global');
        body.network = data.operator; // 'MTN' ou 'MOOV'
      }

      const response = await fetch(payoutUrl, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(body),
      });

      const result = await response.json() as any;

      if (!response.ok || result.status === 'FAILED') {
        const msg = result.message || result.error || `HTTP ${response.status}`;
        this.logger.warn(`FeexPay payout failed: ${msg}`, result);
        return { success: false, message: msg };
      }

      this.logger.log(
        `FeexPay payout initiated: ref=${result.reference}, amount=${data.amount}, to=${data.phoneNumber}`,
      );

      return {
        success: true,
        reference: result.reference,
        status: result.status || 'PENDING',
        message: result.message,
      };
    } catch (err: any) {
      this.logger.error(`createPayout failed: ${err.message}`, err.stack);
      return { success: false, message: err.message };
    }
  }

  /**
   * Vérifie le statut d'un payout.
   *
   * Endpoint v2 : GET /api/payouts/status/public/{reference}
   */
  async getPayoutStatus(reference: string): Promise<{
    status: string;
    amount?: number;
    raw?: any;
  }> {
    if (!this.isConfigured()) {
      return { status: 'UNKNOWN' };
    }
    try {
      const response = await fetch(
        this.url(`/api/payouts/status/public/${reference}`),
        { method: 'GET', headers: this.authHeaders() },
      );
      const data = await response.json() as any;
      const inner = data.data || data;
      return {
        status: (inner.status || 'UNKNOWN').toUpperCase(),
        amount: inner.amount,
        raw: inner,
      };
    } catch (err: any) {
      this.logger.error(`getPayoutStatus failed for ${reference}: ${err.message}`);
      return { status: 'UNKNOWN' };
    }
  }

  // ─── WEBHOOK ─────────────────────────────────────────────────────────────

  /**
   * Traite un webhook FeexPay entrant.
   *
   * Payload (v2) :
   *   {
   *     "reference": "1e636dff-6b81-499e-bf8b-64b4a07a02a8",
   *     "order_id": "1e636dff-6b81-499e-bf8b-64b4a07a02a8",
   *     "status": "SUCCESSFUL" | "FAILED",
   *     "amount": 250,
   *     "callback_info": "",
   *     "last_name": "",
   *     "first_name": "",
   *     "email": "lougbegnona@gmail.com",
   *     "type": "Paiement",
   *     "phoneNumber": "2290190877433",
   *     "date": "2026-05-25T10:06:26.662Z",
   *     "reseau": "MTN CI",
   *     "ref_link": "",
   *     "description": "test de 10",
   *     "reason": "PAYER_NOT_FOUND",
   *     "ref_operator": ""
   *   }
   *
   * Pour sécurité, on re-vérifie le statut via l'API (ne pas faire confiance au webhook seul).
   */
  async handleWebhook(payload: any): Promise<{ processed: boolean; action?: string }> {
    try {
      const reference = payload.reference || payload.order_id || payload.transref;
      const status = (payload.status || '').toUpperCase();
      const amount = payload.amount;

      this.logger.log(`FeexPay webhook: ref=${reference}, status=${status}, amount=${amount}, reseau=${payload.reseau}`);

      if (!reference) {
        this.logger.warn('FeexPay webhook: no reference in payload');
        return { processed: false };
      }

      // Si le webhook indique SUCCESSFUL, on re-vérifie via l'API (sécurité)
      if (status === 'SUCCESSFUL') {
        const txStatus = await this.getTransactionStatus(reference);
        const finalStatus = (txStatus.status || '').toUpperCase();
        if (finalStatus === 'SUCCESSFUL') {
          return { processed: true, action: 'PAYMENT_SUCCESSFUL' };
        }
        this.logger.warn(`Webhook said SUCCESSFUL but API says ${finalStatus} for ref=${reference}`);
        return { processed: true, action: `API_STATUS_${finalStatus}` };
      }

      if (status === 'FAILED') {
        this.logger.warn(`FeexPay payment failed: ref=${reference}, reason=${payload.reason}`);
        return { processed: true, action: 'PAYMENT_FAILED' };
      }

      return { processed: true, action: `STATUS_${status}` };
    } catch (err: any) {
      this.logger.error(`handleWebhook failed: ${err.message}`, err.stack);
      return { processed: false };
    }
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  /**
   * Normalise un numéro de téléphone au format international sans "+".
   * Ex: "229 01 67 00 00 00" → "2290167000000"
   *     "+2290167000000" → "2290167000000"
   */
  private normalizePhone(phone: string): string {
    let p = phone.replace(/[\s\-()]/g, '');
    if (p.startsWith('+')) p = p.substring(1);
    return p;
  }

  /**
   * URL du webhook (à configurer dans le dashboard FeexPay → https://app-v2.feexpay.me/webhook).
   */
  getWebhookUrl(): string {
    const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
    return `${publicUrl}/api/billing/feexpay/webhook`;
  }
}
