/**
 * ============================================================================
 * PAYMENT ALLOCATION SERVICE - ALLOCATION AUTOMATIQUE AVEC PRIORITÉ
 * ============================================================================
 * 
 * Service pour l'allocation automatique des paiements selon les règles métier :
 * - Priorité 1 : Frais d'inscription/réinscription (obligatoire avant scolarité)
 * - Priorité 2 : Frais de scolarité (par ordre de tranches)
 * 
 * RÈGLE ABSOLUE : Aucun paiement de scolarité si inscription/réinscription non soldés
 * 
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { StudentArrearService } from './student-arrear.service';
import { Decimal } from '@prisma/client';

@Injectable()
export class PaymentAllocationService {
  private readonly logger = new Logger(PaymentAllocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly arrearService: StudentArrearService,
  ) {}

  /**
   * Alloue automatiquement un paiement selon les règles de priorité
   * 
   * Priorité :
   * 1. Arriérés inter-années (priorité absolue)
   * 2. Frais d'inscription/réinscription (si non soldés)
   * 3. Frais de scolarité (par ordre de tranches)
   */
  async allocatePayment(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    paymentId: string,
    paymentAmount: Decimal,
  ): Promise<{
    allocations: Array<{
      targetType: string;
      targetId: string;
      studentFeeId?: string;
      studentArrearId?: string;
      allocatedAmount: Decimal;
      allocationOrder: number;
    }>;
    remainingAmount: Decimal;
  }> {
    this.logger.log(`Allocating payment ${paymentId} for student ${studentId}`);

    let remainingAmount = new Decimal(paymentAmount.toString());
    const allocations: Array<{
      targetType: string;
      targetId: string;
      studentFeeId?: string;
      studentArrearId?: string;
      allocatedAmount: Decimal;
      allocationOrder: number;
    }> = [];

    // ÉTAPE 1 : PRIORITÉ ABSOLUE - Arriérés inter-années
    const arrears = await this.arrearService.getStudentArrears(studentId, academicYearId);
    
    if (arrears.length > 0 && remainingAmount.gt(0)) {
      this.logger.log(`Found ${arrears.length} arrears, allocating priority`);

      for (const arrear of arrears) {
        if (remainingAmount.lte(0)) break;

        const amountToAllocate = Decimal.min(remainingAmount, arrear.balanceDue);

        if (amountToAllocate.gt(0)) {
          allocations.push({
            targetType: 'ARREAR',
            targetId: arrear.id,
            studentArrearId: arrear.id,
            allocatedAmount: amountToAllocate,
            allocationOrder: allocations.length + 1,
          });

          remainingAmount = remainingAmount.minus(amountToAllocate);

          // Mettre à jour l'arriéré
          await this.arrearService.updateArrearAfterPayment(arrear.id, amountToAllocate);
        }
      }
    }

    // ÉTAPE 2 : Frais d'inscription/réinscription (si arriérés soldés ou pas d'arriérés)
    // Récupérer tous les frais de l'élève pour l'année scolaire
    const studentFees = await this.prisma.studentFee.findMany({
      where: {
        tenantId,
        studentId,
        academicYearId,
      },
      include: {
        feeDefinition: {
          include: {
            feeCategory: true,
            installments: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        paymentSummary: true,
      },
      orderBy: {
        feeDefinition: {
          feeCategory: {
            code: 'asc', // INSCRIPTION, REINSCRIPTION, SCOLARITE
          },
        },
      },
    });

    // ÉTAPE 2 : Frais d'inscription/réinscription (seulement si pas d'arriérés ou arriérés soldés)
    if (remainingAmount.gt(0)) {
      // Identifier les frais d'inscription/réinscription
      const registrationFees = studentFees.filter(sf => {
        const categoryCode = sf.feeDefinition.feeCategory.code?.toUpperCase();
        return categoryCode === 'INSCRIPTION' || categoryCode === 'REINSCRIPTION';
      });

      // Vérifier si les frais d'inscription/réinscription sont soldés
      const unpaidRegistrationFees = registrationFees.filter(sf => {
        const paidAmount = sf.paymentSummary?.paidAmount || new Decimal(0);
        const balance = new Decimal(sf.totalAmount.toString()).minus(paidAmount);
        return balance.gt(0);
      });

      // Si frais d'inscription/réinscription non soldés, allouer prioritairement
      if (unpaidRegistrationFees.length > 0 && remainingAmount.gt(0)) {
        this.logger.log(`Found ${unpaidRegistrationFees.length} unpaid registration fees, allocating priority`);

        for (const studentFee of unpaidRegistrationFees) {
          if (remainingAmount.lte(0)) break;

          const paidAmount = studentFee.paymentSummary?.paidAmount || new Decimal(0);
          const balance = new Decimal(studentFee.totalAmount.toString()).minus(paidAmount);
          const amountToAllocate = Decimal.min(remainingAmount, balance);

          if (amountToAllocate.gt(0)) {
            allocations.push({
              targetType: 'STUDENT_FEE',
              targetId: studentFee.id,
              studentFeeId: studentFee.id,
              allocatedAmount: amountToAllocate,
              allocationOrder: allocations.length + 1,
            });

            remainingAmount = remainingAmount.minus(amountToAllocate);
          }
        }
      }

      // ÉTAPE 3 : Frais de scolarité (seulement si inscription/réinscription soldés)
      if (unpaidRegistrationFees.length === 0 && remainingAmount.gt(0)) {
      const tuitionFees = studentFees.filter(sf => {
        const categoryCode = sf.feeDefinition.feeCategory.code?.toUpperCase();
        return categoryCode === 'SCOLARITE' || categoryCode === 'TUITION';
      });

      // Trier par ordre de tranches (orderIndex des installments)
      const tuitionFeesWithInstallments = tuitionFees.map(sf => {
        const installments = sf.feeDefinition.installments || [];
        const firstUnpaidInstallment = installments.find((inst, idx) => {
          // Calculer combien a été payé pour cette tranche
          // Simplification : on considère que les paiements sont alloués par ordre
          // Dans une implémentation complète, on devrait tracker par tranche
          return true; // Pour simplifier, on alloue au premier impayé
        });

        return {
          studentFee: sf,
          orderIndex: firstUnpaidInstallment?.orderIndex || 999,
        };
      }).sort((a, b) => a.orderIndex - b.orderIndex);

      for (const { studentFee } of tuitionFeesWithInstallments) {
        if (remainingAmount.lte(0)) break;

        const paidAmount = studentFee.paymentSummary?.paidAmount || new Decimal(0);
        const balance = new Decimal(studentFee.totalAmount.toString()).minus(paidAmount);
        const amountToAllocate = Decimal.min(remainingAmount, balance);

        if (amountToAllocate.gt(0)) {
          allocations.push({
            targetType: 'STUDENT_FEE',
            targetId: studentFee.id,
            studentFeeId: studentFee.id,
            allocatedAmount: amountToAllocate,
            allocationOrder: allocations.length + 1,
          });

          remainingAmount = remainingAmount.minus(amountToAllocate);
        }
      }
      }
    }

    // Enregistrer les allocations
    await this.saveAllocations(paymentId, allocations);

    return {
      allocations,
      remainingAmount,
    };
  }

  /**
   * Enregistre les allocations dans la base de données
   */
  private async saveAllocations(
    paymentId: string,
    allocations: Array<{
      targetType: string;
      targetId: string;
      studentFeeId?: string;
      studentArrearId?: string;
      allocatedAmount: Decimal;
      allocationOrder: number;
    }>,
  ): Promise<void> {
    for (const allocation of allocations) {
      await this.prisma.paymentAllocation.create({
        data: {
          paymentId,
          targetType: allocation.targetType,
          targetId: allocation.targetId,
          studentFeeId: allocation.studentFeeId,
          studentArrearId: allocation.studentArrearId,
          allocatedAmount: allocation.allocatedAmount,
          allocationOrder: allocation.allocationOrder,
        },
      });

      // Mettre à jour le résumé de paiement si c'est un StudentFee
      if (allocation.studentFeeId) {
        await this.updatePaymentSummary(allocation.studentFeeId, allocation.allocatedAmount);
      }
      // Note: Les arriérés sont mis à jour dans updateArrearAfterPayment
    }
  }

  /**
   * Met à jour le résumé de paiement d'un frais
   */
  private async updatePaymentSummary(
    studentFeeId: string,
    allocatedAmount: Decimal,
  ): Promise<void> {
    const studentFee = await this.prisma.studentFee.findUnique({
      where: { id: studentFeeId },
      include: {
        paymentSummary: true,
      },
    });

    if (!studentFee) {
      throw new NotFoundException(`StudentFee with ID ${studentFeeId} not found`);
    }

    const currentPaidAmount = studentFee.paymentSummary?.paidAmount || new Decimal(0);
    const newPaidAmount = currentPaidAmount.plus(allocatedAmount);
    const balance = new Decimal(studentFee.totalAmount.toString()).minus(newPaidAmount);

    // Mettre à jour ou créer le résumé
    await this.prisma.paymentSummary.upsert({
      where: { studentFeeId },
      update: {
        paidAmount: newPaidAmount,
        balance,
        lastPaymentDate: new Date(),
      },
      create: {
        tenantId: studentFee.tenantId,
        studentId: studentFee.studentId,
        academicYearId: studentFee.academicYearId,
        studentFeeId,
        expectedAmount: studentFee.totalAmount,
        paidAmount: newPaidAmount,
        balance,
        lastPaymentDate: new Date(),
      },
    });

    // Mettre à jour le statut du StudentFee
    let status = 'PARTIAL';
    if (balance.lte(0)) {
      status = 'PAID';
    } else if (newPaidAmount.gt(0)) {
      status = 'PARTIAL';
    } else {
      status = 'NOT_STARTED';
    }

    await this.prisma.studentFee.update({
      where: { id: studentFeeId },
      data: { status },
    });
  }

  /**
   * Vérifie si un paiement de scolarité est autorisé
   * Retourne false si des frais d'inscription/réinscription sont impayés
   */
  async isTuitionPaymentAllowed(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const registrationFees = await this.prisma.studentFee.findMany({
      where: {
        tenantId,
        studentId,
        academicYearId,
        feeDefinition: {
          feeCategory: {
            code: {
              in: ['INSCRIPTION', 'REINSCRIPTION'],
            },
          },
        },
      },
      include: {
        paymentSummary: true,
      },
    });

    for (const fee of registrationFees) {
      const paidAmount = fee.paymentSummary?.paidAmount || new Decimal(0);
      const balance = new Decimal(fee.totalAmount.toString()).minus(paidAmount);

      if (balance.gt(0)) {
        return {
          allowed: false,
          reason: `Les frais d'inscription/réinscription doivent être soldés avant de payer la scolarité`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Récupère l'historique des allocations pour un paiement
   */
  async getPaymentAllocations(paymentId: string) {
    return this.prisma.paymentAllocation.findMany({
      where: { paymentId },
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
    });
  }

  /**
   * Récupère toutes les allocations pour un frais élève
   */
  async getStudentFeeAllocations(studentFeeId: string) {
    return this.prisma.paymentAllocation.findMany({
      where: { studentFeeId },
      include: {
        payment: {
          include: {
            student: true,
          },
        },
      },
      orderBy: { allocationOrder: 'asc' },
    });
  }
}

