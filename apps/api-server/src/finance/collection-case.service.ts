/**
 * ============================================================================
 * COLLECTION CASE SERVICE - RECOUVREMENT & DÉTECTION AUTOMATIQUE
 * ============================================================================
 * 
 * Service pour la gestion des dossiers de recouvrement par élève
 * Détection automatique des impayés et relances
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client';

@Injectable()
export class CollectionCaseService {
  private readonly logger = new Logger(CollectionCaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour un dossier de recouvrement pour un élève
   * Calcule automatiquement les montants dus et payés
   */
  async upsertCollectionCase(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ) {
    // Récupérer tous les frais de l'élève pour l'année
    const studentFees = await this.prisma.studentFee.findMany({
      where: {
        tenantId,
        studentId,
        academicYearId,
      },
      include: {
        paymentSummary: true,
        feeDefinition: {
          include: {
            feeCategory: true,
            installments: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    if (studentFees.length === 0) {
      // Pas de frais, pas de dossier de recouvrement
      return null;
    }

    // Calculer les totaux
    let totalDue = new Decimal(0);
    let totalPaid = new Decimal(0);

    for (const studentFee of studentFees) {
      totalDue = totalDue.plus(new Decimal(studentFee.totalAmount.toString()));
      const paid = studentFee.paymentSummary?.paidAmount || new Decimal(0);
      totalPaid = totalPaid.plus(paid);
    }

    const outstandingAmount = totalDue.minus(totalPaid);

    // Déterminer le statut
    let status = 'ON_TIME';
    if (outstandingAmount.gt(0)) {
      // Vérifier s'il y a des échéances dépassées
      const hasOverdue = await this.checkOverdueInstallments(studentFees);
      if (hasOverdue.critical) {
        status = 'BLOCKED';
      } else if (hasOverdue.late) {
        status = 'CRITICAL';
      } else {
        status = 'LATE';
      }
    }

    // Créer ou mettre à jour le dossier
    return this.prisma.collectionCase.upsert({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
      update: {
        totalDue,
        totalPaid,
        outstandingAmount,
        status,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        studentId,
        academicYearId,
        totalDue,
        totalPaid,
        outstandingAmount,
        status,
      },
    });
  }

  /**
   * Vérifie s'il y a des échéances dépassées
   */
  private async checkOverdueInstallments(studentFees: any[]): Promise<{
    late: boolean;
    critical: boolean;
  }> {
    const today = new Date();
    let hasLate = false;
    let hasCritical = false;

    for (const studentFee of studentFees) {
      const installments = studentFee.feeDefinition.installments || [];
      const paidAmount = studentFee.paymentSummary?.paidAmount || new Decimal(0);
      const totalAmount = new Decimal(studentFee.totalAmount.toString());

      if (paidAmount.lt(totalAmount)) {
        // Il reste des paiements à faire
        for (const installment of installments) {
          if (new Date(installment.dueDate) < today) {
            hasLate = true;
            // Si échéance dépassée de plus de 30 jours = critique
            const daysOverdue = Math.floor(
              (today.getTime() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24),
            );
            if (daysOverdue > 30) {
              hasCritical = true;
            }
          }
        }
      }
    }

    return { late: hasLate, critical: hasCritical };
  }

  /**
   * Récupère un dossier de recouvrement
   */
  async getCollectionCase(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ) {
    const collectionCase = await this.prisma.collectionCase.findFirst({
      where: {
        tenantId,
        studentId,
        academicYearId,
      },
      include: {
        student: {
          include: {
            identifier: true,
          },
        },
        actions: {
          orderBy: { performedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!collectionCase) {
      // Créer le dossier s'il n'existe pas
      return this.upsertCollectionCase(tenantId, studentId, academicYearId);
    }

    return collectionCase;
  }

  /**
   * Déclenche les relances automatiques selon les règles d'escalade
   */
  async triggerAutomaticReminders(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ) {
    const collectionCase = await this.getCollectionCase(
      tenantId,
      studentId,
      academicYearId,
    );

    if (!collectionCase || collectionCase.status === 'ON_TIME') {
      return { triggered: false, reason: 'No outstanding amount' };
    }

    // Déterminer le niveau d'escalade nécessaire
    const escalationLevel = this.calculateEscalationLevel(collectionCase);

    // Envoyer les relances selon le niveau
    const reminders = await this.sendReminders(collectionCase, escalationLevel);

    // Mettre à jour le niveau d'escalade
    await this.prisma.collectionCase.update({
      where: { id: collectionCase.id },
      data: {
        escalationLevel,
        lastActionAt: new Date(),
      },
    });

    return {
      triggered: true,
      escalationLevel,
      reminders,
    };
  }

  /**
   * Calcule le niveau d'escalade nécessaire
   */
  private calculateEscalationLevel(collectionCase: any): number {
    if (collectionCase.status === 'BLOCKED') {
      return 4;
    }
    if (collectionCase.status === 'CRITICAL') {
      return 3;
    }
    if (collectionCase.status === 'LATE') {
      return collectionCase.escalationLevel < 2 ? 2 : collectionCase.escalationLevel + 1;
    }
    return 1;
  }

  /**
   * Envoie les relances selon le niveau d'escalade
   */
  private async sendReminders(collectionCase: any, level: number) {
    const reminders = [];

    switch (level) {
      case 1:
        // Rappel simple - Notification interne
        reminders.push(
          await this.createReminderAction(
            collectionCase.id,
            'REMINDER',
            'INTERNAL',
            `Rappel: Solde impayé de ${collectionCase.outstandingAmount} FCFA`,
          ),
        );
        break;

      case 2:
        // Rappel ferme - SMS + WhatsApp
        reminders.push(
          await this.createReminderAction(
            collectionCase.id,
            'WARNING',
            'SMS',
            `Rappel ferme: Veuillez régler votre solde impayé de ${collectionCase.outstandingAmount} FCFA`,
          ),
        );
        reminders.push(
          await this.createReminderAction(
            collectionCase.id,
            'WARNING',
            'WHATSAPP',
            `Rappel ferme: Veuillez régler votre solde impayé de ${collectionCase.outstandingAmount} FCFA`,
          ),
        );
        break;

      case 3:
        // Notification direction
        reminders.push(
          await this.createReminderAction(
            collectionCase.id,
            'WARNING',
            'INTERNAL',
            `CRITIQUE: Notification direction pour solde impayé de ${collectionCase.outstandingAmount} FCFA`,
          ),
        );
        break;

      case 4:
        // Blocage administratif
        reminders.push(
          await this.createReminderAction(
            collectionCase.id,
            'BLOCK',
            'INTERNAL',
            `Blocage administratif activé pour solde impayé de ${collectionCase.outstandingAmount} FCFA`,
          ),
        );
        // Appliquer le blocage
        await this.applyAdministrativeBlock(collectionCase.id);
        break;
    }

    return reminders;
  }

  /**
   * Crée une action de relance
   */
  private async createReminderAction(
    collectionCaseId: string,
    actionType: string,
    channel: string,
    message: string,
  ) {
    return this.prisma.collectionAction.create({
      data: {
        collectionCaseId,
        actionType,
        channel,
        message,
        performedAt: new Date(),
      },
    });
  }

  /**
   * Applique un blocage administratif
   */
  private async applyAdministrativeBlock(collectionCaseId: string) {
    // Blocage pour 30 jours ou jusqu'à paiement
    const blockedUntil = new Date();
    blockedUntil.setDate(blockedUntil.getDate() + 30);

    await this.prisma.collectionCase.update({
      where: { id: collectionCaseId },
      data: {
        status: 'BLOCKED',
        blockedUntil,
      },
    });
  }

  /**
   * Récupère tous les dossiers de recouvrement avec filtres
   */
  async findAllCollectionCases(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      status?: string;
      minOutstanding?: number;
    },
  ) {
    const where: any = { tenantId };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.minOutstanding) {
      where.outstandingAmount = {
        gte: filters.minOutstanding,
      };
    }

    return this.prisma.collectionCase.findMany({
      where,
      include: {
        student: {
          include: {
            identifier: true,
          },
        },
        academicYear: true,
      },
      orderBy: {
        outstandingAmount: 'desc',
      },
    });
  }
}

