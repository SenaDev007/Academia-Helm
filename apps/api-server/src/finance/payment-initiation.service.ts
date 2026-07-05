/**
 * ============================================================================
 * PAYMENT INITIATION SERVICE
 * ============================================================================
 *
 * Stocke les métadonnées des initiations de paiement en ligne (FeexPay/Fedapay)
 * pour que les webhooks puissent créer les FinanceTransactions après confirmation.
 *
 * Flux :
 *   1. initiatePayment() crée un PaymentInitiation avec statut PENDING
 *   2. Le webhook reçoit la confirmation → findByReference()
 *   3. Si confirmé : markConfirmed() + création FinanceTransaction
 *   4. Si échec : markFailed()
 *
 * Sans cette table, le webhook ne sait pas à quel élève/année rattacher le
 * paiement car FeexPay/Fedapay ne transmettent pas ces métadonnées.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreatePaymentInitiationParams {
  tenantId: string;
  reference: string;
  provider: 'feexpay' | 'fedapay';
  studentAccountId: string;
  academicYearId: string;
  studentName: string;
  amount: number;
  phone?: string;
  operator?: string;
  rawResponse?: any;
}

@Injectable()
export class PaymentInitiationService {
  private readonly logger = new Logger(PaymentInitiationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une initiation de paiement (statut PENDING).
   * Appelé par FeexPayService.initiatePayment() ou par un endpoint dédié Fedapay.
   */
  async create(params: CreatePaymentInitiationParams) {
    try {
      const initiation = await this.prisma.paymentInitiation.create({
        data: {
          tenantId: params.tenantId,
          reference: params.reference,
          provider: params.provider,
          studentAccountId: params.studentAccountId,
          academicYearId: params.academicYearId,
          studentName: params.studentName,
          amount: params.amount,
          phone: params.phone || null,
          operator: params.operator || null,
          status: 'PENDING',
          rawResponse: params.rawResponse || undefined,
        },
      });
      this.logger.log(`PaymentInitiation créée: ref=${params.reference} | provider=${params.provider} | amount=${params.amount}`);
      return initiation;
    } catch (err: any) {
      // Si la référence existe déjà (duplicate), on retourne l'existante
      if (err.code === 'P2002') {
        this.logger.warn(`PaymentInitiation déjà existante pour ref=${params.reference}, retour de l'existante`);
        return this.prisma.paymentInitiation.findUnique({
          where: { reference: params.reference },
        });
      }
      throw err;
    }
  }

  /**
   * Récupère une initiation par sa référence.
   */
  async findByReference(reference: string) {
    return this.prisma.paymentInitiation.findUnique({
      where: { reference },
    });
  }

  /**
   * Marque une initiation comme confirmée et lie la FinanceTransaction créée.
   */
  async markConfirmed(reference: string, transactionId: string) {
    return this.prisma.paymentInitiation.update({
      where: { reference },
      data: {
        status: 'CONFIRMED',
        transactionId,
        confirmedAt: new Date(),
      },
    });
  }

  /**
   * Marque une initiation comme échouée.
   */
  async markFailed(reference: string, errorMessage: string) {
    return this.prisma.paymentInitiation.update({
      where: { reference },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
  }

  /**
   * Marque une initiation comme expirée (paiement non confirmé dans les 24h).
   */
  async markExpired(reference: string) {
    return this.prisma.paymentInitiation.update({
      where: { reference },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  /**
   * Récupère les métadonnées d'une initiation pour créer la FinanceTransaction.
   * Lance une exception si l'initiation n'existe pas ou est déjà confirmée.
   */
  async getForTransactionCreation(reference: string) {
    const initiation = await this.findByReference(reference);
    if (!initiation) {
      throw new NotFoundException(`PaymentInitiation introuvable pour référence ${reference}`);
    }
    if (initiation.status === 'CONFIRMED') {
      this.logger.log(`PaymentInitiation ${reference} déjà confirmée (transaction ${initiation.transactionId})`);
      return null; // Déjà traitée
    }
    return initiation;
  }
}
