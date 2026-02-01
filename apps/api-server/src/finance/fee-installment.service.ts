/**
 * ============================================================================
 * FEE INSTALLMENT SERVICE - GESTION DES TRANCHES DE PAIEMENT
 * ============================================================================
 * 
 * Service pour gérer les tranches de paiement pour les frais de scolarité
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client';

@Injectable()
export class FeeInstallmentService {
  private readonly logger = new Logger(FeeInstallmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée des tranches pour une définition de frais
   */
  async createInstallments(
    feeDefinitionId: string,
    installments: Array<{
      label: string;
      amount: number | Decimal;
      dueDate: Date;
      orderIndex: number;
      isMandatory?: boolean;
      description?: string;
    }>,
  ) {
    // Vérifier que la définition de frais existe
    const feeDefinition = await this.prisma.feeDefinition.findUnique({
      where: { id: feeDefinitionId },
      include: {
        installments: true,
      },
    });

    if (!feeDefinition) {
      throw new NotFoundException(`FeeDefinition with ID ${feeDefinitionId} not found`);
    }

    // Supprimer les anciennes tranches si elles existent
    if (feeDefinition.installments.length > 0) {
      await this.prisma.feeInstallment.deleteMany({
        where: { feeDefinitionId },
      });
    }

    // Vérifier que la somme des tranches correspond au montant total
    const totalInstallments = installments.reduce(
      (sum, inst) => sum.plus(new Decimal(inst.amount.toString())),
      new Decimal(0),
    );

    if (!totalInstallments.equals(new Decimal(feeDefinition.amount.toString()))) {
      throw new BadRequestException(
        `La somme des tranches (${totalInstallments}) doit correspondre au montant total (${feeDefinition.amount})`,
      );
    }

    // Créer les tranches
    const createdInstallments = [];
    for (const installment of installments) {
      const created = await this.prisma.feeInstallment.create({
        data: {
          feeDefinitionId,
          installmentLabel: installment.label,
          amount: installment.amount,
          dueDate: installment.dueDate,
          orderIndex: installment.orderIndex,
          isMandatory: installment.isMandatory !== undefined ? installment.isMandatory : true,
          description: installment.description,
        },
      });
      createdInstallments.push(created);
    }

    this.logger.log(`Created ${createdInstallments.length} installments for fee definition ${feeDefinitionId}`);

    return createdInstallments;
  }

  /**
   * Récupère les tranches d'une définition de frais
   */
  async getInstallments(feeDefinitionId: string) {
    const feeDefinition = await this.prisma.feeDefinition.findUnique({
      where: { id: feeDefinitionId },
      include: {
        installments: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!feeDefinition) {
      throw new NotFoundException(`FeeDefinition with ID ${feeDefinitionId} not found`);
    }

    return feeDefinition.installments;
  }

  /**
   * Met à jour une tranche
   */
  async updateInstallment(
    installmentId: string,
    data: {
      label?: string;
      amount?: number | Decimal;
      dueDate?: Date;
      orderIndex?: number;
      isMandatory?: boolean;
      description?: string;
    },
  ) {
    const installment = await this.prisma.feeInstallment.findUnique({
      where: { id: installmentId },
      include: {
        feeDefinition: true,
      },
    });

    if (!installment) {
      throw new NotFoundException(`FeeInstallment with ID ${installmentId} not found`);
    }

    return this.prisma.feeInstallment.update({
      where: { id: installmentId },
      data,
    });
  }

  /**
   * Supprime une tranche
   */
  async deleteInstallment(installmentId: string) {
    const installment = await this.prisma.feeInstallment.findUnique({
      where: { id: installmentId },
    });

    if (!installment) {
      throw new NotFoundException(`FeeInstallment with ID ${installmentId} not found`);
    }

    return this.prisma.feeInstallment.delete({
      where: { id: installmentId },
    });
  }

  /**
   * Génère automatiquement des tranches pour une définition de frais
   * Divise le montant total en n tranches égales
   */
  async generateAutoInstallments(
    feeDefinitionId: string,
    numberOfInstallments: number,
    firstDueDate: Date,
    intervalDays: number = 30,
  ) {
    const feeDefinition = await this.prisma.feeDefinition.findUnique({
      where: { id: feeDefinitionId },
    });

    if (!feeDefinition) {
      throw new NotFoundException(`FeeDefinition with ID ${feeDefinitionId} not found`);
    }

    const totalAmount = new Decimal(feeDefinition.amount.toString());
    const amountPerInstallment = totalAmount.dividedBy(numberOfInstallments);

    const installments = [];
    for (let i = 0; i < numberOfInstallments; i++) {
      const dueDate = new Date(firstDueDate);
      dueDate.setDate(dueDate.getDate() + i * intervalDays);

      installments.push({
        label: `Tranche ${i + 1}`,
        amount: amountPerInstallment,
        dueDate,
        orderIndex: i + 1,
        isMandatory: true,
      });
    }

    return this.createInstallments(feeDefinitionId, installments);
  }
}

