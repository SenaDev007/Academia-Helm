/**
 * ============================================================================
 * FEEXPAY SERVICE — Service de paiement FeexPay
 * ============================================================================
 *
 * Remplace FedaPay. FeexPay est un agrégateur de paiement basé au Bénin qui
 * supporte :
 *   - Mobile Money (MTN, Moov, Orange) — collection + payout
 *   - Carte bancaire (Visa, Mastercard) — collection
 *   - Transferts vers Mobile Money (payouts) — pour les salaires
 *
 * API endpoints (base: https://api.feexpay.me):
 *   - GET  /api/shop/{shopId}/get_shop — infos marchand
 *   - POST /api/transactions/requesttopay/integration — paiement Mobile Money
 *   - POST /api/transactions/card/inittransact/integration — paiement carte
 *   - GET  /api/transactions/getrequesttopay/integration/{ref} — statut transaction
 *   - POST /api/transactions/disbursement/integration — transfert (payout)
 *
 * Variables d'environnement :
 *   - FEEXPAY_API_KEY — token d'authentification
 *   - FEEXPAY_SHOP_ID — identifiant du marchand
 *   - FEEXPAY_API_URL — base URL (default: https://api.feexpay.me)
 *
 * 3 cas d'usage :
 *   1. Abonnements (école → Academia Helm) — createPaymentSession
 *   2. Frais de scolarité (parent → école) — createPaymentSession
 *   3. Salaires (école → staff) — createPayout
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface FeexPayPaymentRequest {
  amount: number; // En FCFA
  phoneNumber?: string; // Pour Mobile Money (format: 229XXXXXXXX)
  operator?: 'MTN' | 'MOOV' | 'ORANGE'; // Opérateur Mobile Money
  email: string;
  firstName?: string;
  lastName?: string;
  callbackUrl?: string;
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
  operator: 'MTN' | 'MOOV' | 'ORANGE';
  fullName: string;
  email?: string;
  reason?: string;
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

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('FEEXPAY_API_KEY') || '';
    this.shopId = this.configService.get<string>('FEEXPAY_SHOP_ID') || '';
    this.apiUrl = this.configService.get<string>('FEEXPAY_API_URL') || 'https://api.feexpay.me';

    if (this.apiKey && this.shopId) {
      this.logger.log('✅ FeexPay configured');
    } else {
      this.logger.warn('⚠️ FeexPay not configured — FEEXPAY_API_KEY or FEEXPAY_SHOP_ID missing');
    }
  }

  /**
   * Vérifie si FeexPay est configuré.
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.shopId);
  }

  /**
   * Récupère les infos du marchand (vérifie que le shop est valide).
   */
  async getShopInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/api/shop/${this.shopId}/get_shop`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (err: any) {
      this.logger.error(`getShopInfo failed: ${err.message}`);
      return null;
    }
  }

  // ─── PAIEMENT MOBILE MONEY ──────────────────────────────────────────────

  /**
   * Initie un paiement Mobile Money (MTN, Moov, Orange).
   *
   * Le client reçoit une notification sur son téléphone pour confirmer le paiement.
   * Pas de redirect — le statut est vérifié via webhook ou polling.
   */
  async createMobileMoneyPayment(data: FeexPayPaymentRequest): Promise<FeexPayPaymentResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('FeexPay non configuré');
    }

    try {
      const body = {
        phoneNumber: data.phoneNumber,
        amount: data.amount,
        reseau: data.operator,
        token: this.apiKey,
        shop: this.shopId,
        first_name: data.firstName || data.email.split('@')[0],
        email: data.email,
      };

      const response = await fetch(
        `${this.apiUrl}/api/transactions/requesttopay/integration`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(body as any).toString(),
        },
      );

      const result = await response.json() as any;

      if (result.status === 'FAILED') {
        return { success: false, message: 'Numéro de téléphone incorrect' };
      }

      this.logger.log(`FeexPay Mobile Money payment initiated: ref=${result.reference}, amount=${data.amount}`);

      return {
        success: true,
        reference: result.reference,
        status: 'PENDING',
      };
    } catch (err: any) {
      this.logger.error(`createMobileMoneyPayment failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  // ─── PAIEMENT CARTE BANCAIRE ────────────────────────────────────────────

  /**
   * Initie un paiement par carte bancaire.
   *
   * Retourne une URL vers laquelle rediriger le client pour saisir sa carte.
   * Après le paiement, FeexPay redirige vers le callbackUrl.
   */
  async createCardPayment(data: FeexPayPaymentRequest): Promise<FeexPayPaymentResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('FeexPay non configuré');
    }

    try {
      const body = {
        phone: data.phoneNumber || '',
        amount: data.amount,
        reseau: 'CARD',
        token: this.apiKey,
        shop: this.shopId,
        first_name: data.firstName || data.email.split('@')[0],
        last_name: data.lastName || '',
        email: data.email,
        country: data.metadata?.country || 'Bénin',
        address1: data.metadata?.address || 'Cotonou',
        district: data.metadata?.district || 'Littoral',
        currency: data.metadata?.currency || 'XOF',
      };

      const response = await fetch(
        `${this.apiUrl}/api/transactions/card/inittransact/integration`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(body as any).toString(),
        },
      );

      const result = await response.json() as any;

      if (result.status === 'FAILED') {
        return { success: false, message: 'Erreur lors de l\'initialisation du paiement' };
      }

      this.logger.log(`FeexPay Card payment initiated: ref=${result.transref}, amount=${data.amount}`);

      return {
        success: true,
        reference: result.transref,
        paymentUrl: result.url,
        status: 'PENDING',
      };
    } catch (err: any) {
      this.logger.error(`createCardPayment failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  // ─── VÉRIFIER LE STATUT ─────────────────────────────────────────────────

  /**
   * Vérifie le statut d'une transaction.
   *
   * Statuts possibles : PENDING, SUCCESSFUL, FAILED
   */
  async getTransactionStatus(reference: string): Promise<{
    status: string;
    amount?: number;
    clientNumber?: string;
  }> {
    try {
      const response = await fetch(
        `${this.apiUrl}/api/transactions/getrequesttopay/integration/${reference}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );

      const data = await response.json() as any;

      return {
        status: data.status || 'UNKNOWN',
        amount: data.amount,
        clientNumber: data.payer?.partyId,
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
   * Utilisé pour :
   *   - Paiement des salaires (école → staff)
   *   - Transferts vers des comptes externes
   *
   * L'argent est décaissé du compte marchand FeexPay vers le Mobile Money du destinataire.
   */
  async createPayout(data: FeexPayPayoutRequest): Promise<FeexPayPayoutResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('FeexPay non configuré');
    }

    try {
      const body = {
        phoneNumber: data.phoneNumber,
        amount: data.amount,
        reseau: data.operator,
        token: this.apiKey,
        shop: this.shopId,
        first_name: data.fullName,
        email: data.email || '',
        reason: data.reason || 'Transfert',
      };

      const response = await fetch(
        `${this.apiUrl}/api/transactions/disbursement/integration`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(body as any).toString(),
        },
      );

      const result = await response.json() as any;

      if (result.status === 'FAILED') {
        return { success: false, message: 'Transfert échoué — vérifiez le numéro' };
      }

      this.logger.log(`FeexPay payout initiated: ref=${result.reference}, amount=${data.amount}, to=${data.phoneNumber}`);

      return {
        success: true,
        reference: result.reference,
        status: 'PENDING',
      };
    } catch (err: any) {
      this.logger.error(`createPayout failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  // ─── WEBHOOK ─────────────────────────────────────────────────────────────

  /**
   * Traite un webhook FeexPay.
   *
   * FeexPay envoie un POST avec les données de la transaction quand le statut change.
   * Format du payload (approximatif) :
   *   {
   *     "reference": "REF_xxx",
   *     "status": "SUCCESSFUL" | "FAILED",
   *     "amount": 75000,
   *     "payer": { "partyId": "229xxxxxxxx" },
   *     "shop": "shopId"
   *   }
   */
  async handleWebhook(payload: any): Promise<{ processed: boolean; action?: string }> {
    try {
      const reference = payload.reference || payload.transref;
      const status = (payload.status || '').toUpperCase();
      const amount = payload.amount;

      this.logger.log(`FeexPay webhook: ref=${reference}, status=${status}, amount=${amount}`);

      if (!reference) {
        this.logger.warn('FeexPay webhook: no reference in payload');
        return { processed: false };
      }

      // Vérifier le statut réel via l'API (sécurité — ne pas faire confiance au webhook seul)
      const txStatus = await this.getTransactionStatus(reference);
      const finalStatus = txStatus.status.toUpperCase();

      if (finalStatus === 'SUCCESSFUL') {
        // Paiement réussi — traiter selon le type (onboarding, renouvellement, scolarité, salaire)
        // Le type est stocké dans les metadata ou dans la référence
        return await this.processSuccessfulPayment(reference, amount, payload);
      } else if (finalStatus === 'FAILED') {
        this.logger.warn(`FeexPay payment failed: ref=${reference}`);
        return { processed: true, action: 'PAYMENT_FAILED' };
      }

      return { processed: true, action: `STATUS_${finalStatus}` };
    } catch (err: any) {
      this.logger.error(`handleWebhook failed: ${err.message}`, err.stack);
      return { processed: false };
    }
  }

  /**
   * Traite un paiement réussi.
   * Détermine le type de paiement (onboarding, renouvellement, etc.) et
   * exécute l'action appropriée.
   */
  private async processSuccessfulPayment(
    reference: string,
    amount: number,
    payload: any,
  ): Promise<{ processed: boolean; action?: string }> {
    // Chercher le paiement dans la DB
    // Les références peuvent avoir un préfixe: ONBOARD-, RENEW-, SALARY-, SCHOOL-
    if (reference.startsWith('ONBOARD-') || reference.startsWith('onboard-')) {
      // Paiement onboarding — activer le tenant
      this.logger.log(`Processing onboarding payment: ref=${reference}`);
      // TODO: appeler OnboardingService pour activer le tenant
      return { processed: true, action: 'ONBOARDING_PAID' };
    }

    if (reference.startsWith('RENEW-') || reference.startsWith('renew-')) {
      // Renouvellement d'abonnement
      this.logger.log(`Processing renewal payment: ref=${reference}`);
      // TODO: appeler SubscriptionLifecycleService.renewSubscription
      return { processed: true, action: 'RENEWAL_PAID' };
    }

    if (reference.startsWith('REACT-') || reference.startsWith('react-')) {
      // Réactivation de compte bloqué
      this.logger.log(`Processing reactivation payment: ref=${reference}`);
      // TODO: appeler SubscriptionLifecycleService.reactivateSubscription
      return { processed: true, action: 'REACTIVATION_PAID' };
    }

    if (reference.startsWith('SALARY-') || reference.startsWith('salary-')) {
      // Paiement de salaire
      this.logger.log(`Processing salary payout: ref=${reference}`);
      return { processed: true, action: 'SALARY_PAID' };
    }

    if (reference.startsWith('SCHOOL-') || reference.startsWith('school-')) {
      // Frais de scolarité
      this.logger.log(`Processing school fee payment: ref=${reference}`);
      return { processed: true, action: 'SCHOOL_FEE_PAID' };
    }

    // Paiement générique — enregistrer dans billing_events
    this.logger.log(`Processing generic payment: ref=${reference}, amount=${amount}`);
    return { processed: true, action: 'GENERIC_PAID' };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  /**
   * Génère une référence unique pour un paiement.
   */
  generateReference(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * URL du webhook (à configurer dans le dashboard FeexPay).
   */
  getWebhookUrl(): string {
    const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com';
    return `${publicUrl}/api/billing/feexpay/webhook`;
  }
}
