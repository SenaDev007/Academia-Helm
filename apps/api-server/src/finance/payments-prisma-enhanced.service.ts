/**
 * ============================================================================
 * PAYMENTS PRISMA ENHANCED SERVICE - PAIEMENTS AVEC ALLOCATION AUTOMATIQUE
 * ============================================================================
 * 
 * Service étendu pour les paiements avec allocation automatique selon priorité
 * 
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentAllocationService } from './payment-allocation.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PaymentsPrismaEnhancedService {
  private readonly logger = new Logger(PaymentsPrismaEnhancedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly allocationService: PaymentAllocationService,
  ) {}

  /**
   * Enregistre un paiement avec allocation automatique selon les règles de priorité
   */
  async createPaymentWithAutoAllocation(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    studentId: string;
    amount: number | Prisma.Decimal;
    paymentMethod: string; // CASH | TRANSFER | MOBILE_MONEY | CHEQUE
    paymentDate: Date;
    reference?: string;
    notes?: string;
    createdBy?: string;
  }) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: {
        id: data.studentId,
        tenantId: data.tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    const paymentAmount = new Prisma.Decimal(data.amount.toString());

    // Générer un numéro de reçu unique
    const receiptNumber = await this.generateReceiptNumber(data.tenantId);

    // Créer le paiement
    const payment = await this.prisma.payment.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        studentId: data.studentId,
        amount: paymentAmount,
        paymentMethod: data.paymentMethod,
        paymentDate: data.paymentDate,
        reference: data.reference,
        receiptNumber,
        status: 'completed',
        notes: data.notes,
        createdBy: data.createdBy,
      },
      include: {
        student: true,
      },
    });

    // Allouer automatiquement le paiement selon les règles de priorité
    const allocationResult = await this.allocationService.allocatePayment(
      data.tenantId,
      data.studentId,
      data.academicYearId,
      payment.id,
      paymentAmount,
    );

    // Si il reste un montant non alloué, loguer un avertissement
    if (allocationResult.remainingAmount.gt(0)) {
      this.logger.warn(
        `Payment ${payment.id} has remaining unallocated amount: ${allocationResult.remainingAmount}`,
      );
    }

    // Créer le reçu
    await this.prisma.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber,
        issuedBy: data.createdBy,
      },
    });

    // Récupérer le paiement complet avec allocations
    const paymentWithAllocations = await this.prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        paymentAllocations: {
          include: {
            studentFee: {
              include: {
                feeDefinition: {
                  include: {
                    feeCategory: true,
                  },
                },
              },
            },
          },
          orderBy: { allocationOrder: 'asc' },
        },
        receipt: true,
        student: true,
      },
    });

    return paymentWithAllocations;
  }

  /**
   * Génère un numéro de reçu unique
   */
  private async generateReceiptNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;

    // Récupérer le dernier numéro de reçu de l'année
    const lastReceipt = await this.prisma.paymentReceipt.findFirst({
      where: {
        receiptNumber: {
          startsWith: prefix,
        },
        payment: {
          tenantId,
        },
      },
      orderBy: {
        receiptNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastReceipt) {
      const lastSequence = parseInt(lastReceipt.receiptNumber.split('-').pop() || '0', 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Vérifie si un paiement de scolarité est autorisé
   * (Wrapper autour de PaymentAllocationService)
   */
  async isTuitionPaymentAllowed(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ) {
    return this.allocationService.isTuitionPaymentAllowed(tenantId, studentId, academicYearId);
  }

  /**
   * Récupère les détails d'un paiement avec ses allocations
   */
  async getPaymentWithAllocations(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        paymentAllocations: {
          include: {
            studentFee: {
              include: {
                feeDefinition: {
                  include: {
                    feeCategory: true,
                  },
                },
              },
            },
          },
          orderBy: { allocationOrder: 'asc' },
        },
        receipt: true,
        student: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    return payment;
  }
}

