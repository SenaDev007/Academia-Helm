/**
 * ============================================================================
 * FEEXPAY SERVICE — Intégration API FeexPay v2 pour paiements en ligne
 * ============================================================================
 *
 * API FeexPay v2 (https://docs.feexpay.me) :
 *   POST /api/transactions/public/requesttopay/{operator} → initier un paiement
 *   GET  /api/transactions/public/single/status/{reference} → vérifier le statut
 *
 * Opérateurs supportés (Bénin) :
 *   - mtn        → MTN Mobile Money
 *   - moov       → Moov Money
 *   - celtiis_bj → Celtiis Cash
 *
 * Paramètres obligatoires : phoneNumber (2290166000000), amount, shop
 * Headers : Authorization: Bearer <api-key>
 *
 * Statuts : PENDING, SUCCESSFUL, FAILED
 *
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { TenantPaymentConfigService } from './tenant-payment-config.service';

const FEEXPAY_API_URL = 'https://api-v2.feexpay.me';

export type FeexPayOperator = 'mtn' | 'moov' | 'celtiis_bj';

export interface FeexPayInitiateParams {
  tenantId: string;
  studentAccountId: string;
  studentName: string;
  amount: number;
  phone: string; // Numéro du parent (ex: 0195722234 ou 2290195722234)
  operator: FeexPayOperator; // MTN, Moov, ou Celtiis
  academicYearId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class FeexPayService {
  private readonly logger = new Logger(FeexPayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paymentConfigService: TenantPaymentConfigService,
  ) {}

  /**
   * Initie un paiement FeexPay (request to pay).
   * Appelle l'API FeexPay v2 avec l'endpoint spécifique à l'opérateur.
   */
  async initiatePayment(params: FeexPayInitiateParams): Promise<{
    success: boolean;
    reference?: string;
    status?: string;
    message?: string;
  }> {
    // 1. Vérifier que les paiements en ligne sont activés
    const enabled = await this.paymentConfigService.isOnlinePaymentEnabled(params.tenantId);
    if (!enabled) {
      throw new BadRequestException('Les paiements en ligne ne sont pas activés pour cette école');
    }

    // 2. Récupérer la config complète (avec clés)
    // Note : on ne vérifie plus config.provider === 'feexpay' — l'école peut
    // configurer BOTH FeexPay et Fedapay. On vérifie juste que les clés
    // FeexPay sont présentes.
    const config = await this.paymentConfigService.getFullConfig(params.tenantId);
    if (!config) {
      throw new BadRequestException('Aucune configuration de paiement trouvée. Configurez vos clés API dans Paramètres → Paiements.');
    }

    if (!config.feexpayApiKey || !config.feexpayShopId) {
      throw new BadRequestException('Clés FeexPay manquantes (API Key + Shop ID requis). Configurez-les dans Paramètres → Paiements.');
    }

    // 3. Normaliser le numéro de téléphone pour FeexPay
    // FeexPay attend : 2290166000000 (13 chiffres, préfixe 229 + 01 + 8 digits)
    const phoneNumber = this.normalizePhoneForFeexPay(params.phone);

    // 4. Construire l'URL selon l'opérateur
    const operatorEndpoint = this.getOperatorEndpoint(params.operator);
    const url = `${FEEXPAY_API_URL}/api/transactions/public/requesttopay/${operatorEndpoint}`;

    // 5. Corps de la requête
    const body: any = {
      phoneNumber: Number(phoneNumber),
      amount: params.amount,
      shop: config.feexpayShopId,
      description: `Scolarite ${params.studentName}`.replace(/[^\w\s]/g, ''), // Sans caractères spéciaux
    };
    if (params.firstName) body.first_name = params.firstName;
    if (params.lastName) body.last_name = params.lastName;
    // callback_info pour retrouver la transaction après webhook
    body.callback_info = JSON.stringify({
      tenantId: params.tenantId,
      studentAccountId: params.studentAccountId,
      academicYearId: params.academicYearId,
      studentName: params.studentName,
      amount: params.amount,
    });

    this.logger.log(
      `FeexPay initiate: operator=${params.operator} | phone=${phoneNumber} | amount=${params.amount} | shop=${config.feexpayShopId}`,
    );

    // 6. Appeler l'API FeexPay
    try {
      const response = await fetch(url, {
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

      if (response.ok && result.reference) {
        // Succès — le paiement est initié, le parent reçoit un push sur son téléphone
        return {
          success: true,
          reference: result.reference,
          status: result.status || 'PENDING',
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
   * GET /api/transactions/public/single/status/{reference}
   */
  async verifyPayment(tenantId: string, reference: string): Promise<{
    status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'UNKNOWN';
    amount?: number;
    phoneNumber?: string;
    reason?: string;
    date?: string;
    raw?: any;
  }> {
    const config = await this.paymentConfigService.getFullConfig(tenantId);
    if (!config?.feexpayApiKey) {
      throw new BadRequestException('Configuration FeexPay manquante');
    }

    try {
      const url = `${FEEXPAY_API_URL}/api/transactions/public/single/status/${encodeURIComponent(reference)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.feexpayApiKey}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      this.logger.log(`FeexPay verify: ref=${reference} | status=${result.status} | HTTP ${response.status}`);

      const feexpayStatus = (result.status || '').toUpperCase();
      let status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'UNKNOWN' = 'UNKNOWN';
      if (feexpayStatus === 'SUCCESSFUL' || feexpayStatus === 'SUCCESS') {
        status = 'SUCCESSFUL';
      } else if (feexpayStatus === 'FAILED' || feexpayStatus === 'FAIL') {
        status = 'FAILED';
      } else if (feexpayStatus === 'PENDING' || feexpayStatus.includes('PENDING')) {
        status = 'PENDING';
      }

      return {
        status,
        amount: result.amount ? Number(result.amount) : undefined,
        phoneNumber: result.phoneNumber?.toString(),
        reason: result.reason,
        date: result.date,
        raw: result,
      };
    } catch (err: any) {
      this.logger.error(`FeexPay verify error: ${err.message}`);
      return { status: 'UNKNOWN', reason: err.message };
    }
  }

  /**
   * Webhook handler — appelé par FeexPay quand le paiement est confirmé.
   * FeexPay ajoute un paramètre `ref` à la callback_url.
   */
  async handleWebhook(body: any, query: any, tenantId: string): Promise<{ success: boolean; message: string }> {
    // FeexPay peut envoyer la référence dans le body ou en query param
    const reference = body?.reference || body?.ref || query?.ref || query?.reference;
    const status = (body?.status || '').toUpperCase();

    this.logger.log(`FeexPay webhook reçu: ref=${reference} | status=${status} | tenant=${tenantId}`);
    this.logger.log(`FeexPay webhook body: ${JSON.stringify(body).substring(0, 500)}`);

    if (!reference) {
      return { success: false, message: 'Référence manquante dans le webhook' };
    }

    // Si le statut n'est pas SUCCESSFUL, on log et on retourne
    if (status !== 'SUCCESSFUL' && status !== 'SUCCESS') {
      this.logger.log(`FeexPay webhook: paiement ${reference} statut=${status} (non confirmé)`);
      return { success: true, message: `Statut ${status} — paiement non confirmé` };
    }

    // Paiement confirmé !
    // Récupérer les métadonnées depuis callback_info si disponible
    let callbackInfo: any = null;
    try {
      if (body?.callback_info) {
        callbackInfo = typeof body.callback_info === 'string'
          ? JSON.parse(body.callback_info)
          : body.callback_info;
      }
    } catch { /* ignore */ }

    if (callbackInfo?.studentAccountId && callbackInfo?.academicYearId) {
      // Créer la FinanceTransaction pour mettre à jour le compte élève
      try {
        const { FinanceTransactionService } = await import('./finance-transaction.service');
        // Note : on ne peut pas instancier directement, il faut passer par le module
        // Pour l'instant, on log — la transaction sera créée par un job de vérification
        this.logger.log(
          `FeexPay webhook CONFIRMÉ: ref=${reference} | amount=${body.amount} | student=${callbackInfo.studentAccountId}`,
        );
      } catch (err: any) {
        this.logger.error(`FeexPay webhook: erreur création transaction: ${err.message}`);
      }
    }

    return { success: true, message: 'Webhook traité — paiement confirmé' };
  }

  /**
   * Détecte l'opérateur Mobile Money à partir du numéro de téléphone.
   * Bénin :
   *   - MTN : commence par 0154, 0155, 0156, 0157, 0158, 0159, 0161, 0162, 0163, 0164, 0166, 0167, 0196, 0197
   *   - Moov : commence par 0151, 0152, 0153, 0160, 0165, 0168, 0169, 0190, 0191, 0192, 0193, 0194, 0195, 0198, 0199
   *   - Celtiis : commence par 0140, 0141, 0142, 0143, 0144
   */
  static detectOperator(phone: string): FeexPayOperator | null {
    let cleaned = phone.replace(/[\s\-().]/g, '').trim();
    // Extraire les 4 premiers chiffres significatifs (après 229 ou 0)
    let prefix = '';
    if (cleaned.startsWith('22901') && cleaned.length >= 7) {
      prefix = cleaned.substring(4, 7); // ex: 550, 660, 400
    } else if (cleaned.startsWith('01') && cleaned.length >= 5) {
      prefix = cleaned.substring(2, 5); // ex: 550, 660, 400
    } else if (cleaned.startsWith('+22901') && cleaned.length >= 8) {
      prefix = cleaned.substring(6, 9);
    } else {
      return null;
    }

    // MTN : 54-59, 61-64, 66-67, 96-97
    const mtnPrefixes = ['54', '55', '56', '57', '58', '59', '61', '62', '63', '64', '66', '67', '96', '97'];
    // Moov : 51-53, 60, 65, 68-69, 90-95, 98-99
    const moovPrefixes = ['51', '52', '53', '60', '65', '68', '69', '90', '91', '92', '93', '94', '95', '98', '99'];
    // Celtiis : 40-44
    const celtiisPrefixes = ['40', '41', '42', '43', '44'];

    const twoDigitPrefix = prefix.substring(0, 2);

    if (mtnPrefixes.includes(twoDigitPrefix)) return 'mtn';
    if (moovPrefixes.includes(twoDigitPrefix)) return 'moov';
    if (celtiisPrefixes.includes(twoDigitPrefix)) return 'celtiis_bj';
    return null;
  }

  /**
   * Retourne l'endpoint FeexPay pour un opérateur donné.
   */
  private getOperatorEndpoint(operator: FeexPayOperator): string {
    switch (operator) {
      case 'mtn': return 'mtn';
      case 'moov': return 'moov';
      case 'celtiis_bj': return 'celtiis_bj';
      default: return 'mtn';
    }
  }

  /**
   * Normalise un numéro de téléphone pour FeexPay.
   * FeexPay attend : 2290166000000 (nombre, 13 chiffres)
   * Formats acceptés en entrée : 0195722234, +2290195722234, 2290195722234
   */
  private normalizePhoneForFeexPay(phone: string): string {
    let cleaned = phone.replace(/[\s\-().]/g, '').trim();

    // 0195722234 → 2290195722234
    if (/^01\d{8}$/.test(cleaned)) {
      return '229' + cleaned;
    }
    // +2290195722234 → 2290195722234
    if (cleaned.startsWith('+229')) {
      return cleaned.substring(1);
    }
    // 2290195722234 → tel quel
    if (cleaned.startsWith('229')) {
      return cleaned;
    }
    // 95722234 (8 digits) → 2290195722234 (ajouter 01)
    if (/^\d{8}$/.test(cleaned)) {
      return '22901' + cleaned;
    }
    // +... → retirer le +
    if (cleaned.startsWith('+')) {
      return cleaned.substring(1);
    }
    return cleaned;
  }
}
