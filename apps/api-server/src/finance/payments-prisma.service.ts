/**
 * ============================================================================
 * PAYMENTS PRISMA SERVICE - MODULE 4
 * ============================================================================
 * 
 * Service pour la gestion des paiements, reçus et résumés
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AccessScope } from '../common/context/access-scope.service';
import { levelWhere, paymentTrackWhere, assertLevelInScope } from '../common/context/scope-where';
import { AppSequenceService } from '../common/services/app-sequence.service';

@Injectable()
export class PaymentsPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSequences: AppSequenceService,
  ) {}

  /**
   * ⭐ Piste d'un élève : UUID de l'AcademicTrack de sa classe courante
   *    (ClassStudent le plus récent → Class.language). null si indéterminée.
   */
  async resolveStudentTrackId(tenantId: string, studentId: string): Promise<string | null> {
    const cs = await this.prisma.classStudent.findFirst({
      where: { studentId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: { class: { select: { language: true, academicTrackId: true } } },
    });
    const cls = cs?.class;
    if (!cls) return null;
    if (cls.academicTrackId) return cls.academicTrackId;
    if (cls.language === 'FR' || cls.language === 'EN') {
      const track = await this.prisma.academicTrack.findFirst({
        where: { tenantId, code: cls.language },
        select: { id: true },
      });
      return track?.id ?? null;
    }
    return null;
  }

  /**
   * Enregistre un paiement
   */
  async createPayment(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    studentId: string;
    studentFeeId?: string;
    amount: number;
    paymentMethod: string; // CASH | TRANSFER | MOBILE_MONEY | CHEQUE
    paymentDate: Date;
    reference?: string;
    notes?: string;
    createdBy?: string;
    academicTrackId?: string | null;
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

    // Si studentFeeId est fourni, vérifier qu'il existe
    if (data.studentFeeId) {
      const studentFee = await this.prisma.studentFee.findFirst({
        where: {
          id: data.studentFeeId,
          tenantId: data.tenantId,
          studentId: data.studentId,
        },
      });

      if (!studentFee) {
        throw new NotFoundException(`Student fee with ID ${data.studentFeeId} not found`);
      }
    }

    // Générer un numéro de reçu unique
    const receiptNumber = await this.generateReceiptNumber(data.tenantId);

    const payment = await this.prisma.payment.create({
      data: {
        ...data,
        receiptNumber,
        status: 'completed',
        transactionType: 'PAYMENT',
      },
      include: {
        student: true,
        studentFee: {
          include: {
            feeDefinition: true,
          },
        },
      },
    });

    // Mettre à jour le résumé de paiement si studentFeeId est fourni
    if (data.studentFeeId) {
      await this.updatePaymentSummary(data.studentFeeId, data.amount);
    }

    // Créer le reçu
    await this.prisma.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber,
        issuedBy: data.createdBy,
      },
    });

    return payment;
  }

  /**
   * Récupère tous les paiements
   */
  async findAllPayments(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      studentId?: string;
      paymentMethod?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      /** ⭐ BRIEF PERF 3.4 — pagination côté serveur (optionnelle, rétro-compatible) */
      page?: number;
      limit?: number;
    },
    scope?: AccessScope | null,
  ) {
    // Mode "année stricte" : warning si pas d'academicYearId
    if (!filters?.academicYearId) {
      console.warn('PAYMENTS_FINDALL_WITHOUT_ACADEMIC_YEAR', {
        tenantId,
        message: 'findAllPayments appelé sans academicYearId — mode non-strict',
      });
    }

    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    // ⭐ Filtre Rôles × Pistes × Niveaux — le niveau est IMPOSÉ par le scope
    //    serveur (le filtre client ne peut qu'affiner DANS le périmètre).
    //    La sentinelle 'ALL' ne bypass plus pour les comptes restreints.
    const scopeLvl = levelWhere(scope || undefined);
    if (scopeLvl) {
      where.schoolLevelId = scopeLvl.schoolLevelId;
    }
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    // ⭐ Piste : paiements de SA piste uniquement (null = indéterminé, exonéré)
    const scopeTrack = paymentTrackWhere(scope || undefined);
    if (scopeTrack) {
      where.AND = [...(where.AND || []), scopeTrack];
    }

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.startDate || filters?.endDate) {
      where.paymentDate = {};
      if (filters.startDate) {
        where.paymentDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.paymentDate.lte = filters.endDate;
      }
    }

    if (filters?.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { receiptNumber: { contains: filters.search, mode: 'insensitive' } },
        {
          student: {
            firstName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          student: {
            lastName: { contains: filters.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const include = {
      student: true,
      studentFee: {
        include: {
          feeDefinition: true,
        },
      },
      receipt: true,
    };
    const orderBy = { paymentDate: 'desc' as const };

    // ⭐ BRIEF PERF 3.4 — Pagination côté serveur : si page/limit fournis →
    // réponse paginée { data, total, page, limit, totalPages } + count()
    // parallélisé. Sinon → array complet (rétro-compatibilité consumers).
    if (filters?.page && filters?.limit) {
      const page = Math.max(1, filters.page);
      const limit = Math.min(200, Math.max(1, filters.limit));
      const [data, total] = await Promise.all([
        this.prisma.payment.findMany({
          where,
          include,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.payment.count({ where }),
      ]);
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    return this.prisma.payment.findMany({
      where,
      include,
      orderBy,
    });
  }

  /**
   * Récupère un paiement par ID
   * ⭐ Anti-IDOR : le paiement doit appartenir au périmètre niveau de l'utilisateur.
   */
  async findPaymentById(id: string, tenantId: string, scope?: AccessScope | null) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        student: true,
        studentFee: {
          include: {
            feeDefinition: true,
          },
        },
        receipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // ⭐ Filtre Rôles × Pistes × Niveaux — anti-IDOR
    assertLevelInScope(scope || undefined, payment, 'ce paiement');

    return payment;
  }

  /**
   * Met à jour le résumé de paiement
   *
   * ⭐ BRIEF PERF 3.3 — Incrémentations SQL atomiques (UPDATE ... SET
   * paidAmount = paidAmount + montant) au lieu du pattern
   * lecture-modification-écriture (find → compute en JS → update).
   * Deux paiements simultanés sur le même frais ne peuvent plus s'écraser
   * mutuellement leurs montants. Le statut est recalculé depuis la ligne
   * RÉELLEMENT mise à jour (retournée par l'UPDATE), pas depuis une valeur
   * lue avant l'écriture.
   */
  private async updatePaymentSummary(studentFeeId: string, amount: number) {
    const studentFee = await this.prisma.studentFee.findFirst({
      where: { id: studentFeeId },
      include: {
        paymentSummary: true,
      },
    });

    if (!studentFee || !studentFee.paymentSummary) {
      return;
    }

    // ⭐ UPDATE atomique : increment du payé + decrement du solde (gère aussi
    // les montants négatifs des annulations REVERSAL)
    const updated = await this.prisma.paymentSummary.update({
      where: { id: studentFee.paymentSummary.id },
      data: {
        paidAmount: { increment: amount },
        balance: { decrement: amount },
        lastPaymentDate: new Date(),
      },
    });

    const newPaidAmount = Number(updated.paidAmount);
    const balance = Number(updated.balance);

    // Mettre à jour le statut du frais élève depuis les valeurs réelles
    let status: 'NOT_STARTED' | 'PARTIAL' | 'PAID' = 'NOT_STARTED';
    if (balance <= 0) {
      status = 'PAID';
    } else if (newPaidAmount > 0) {
      status = 'PARTIAL';
    }

    await this.prisma.studentFee.update({
      where: { id: studentFeeId },
      data: { status },
    });
  }

  /**
   * Génère un numéro de reçu unique
   *
   * ⭐ BRIEF PERF 3.3 — séquence atomique via app_sequences (upsert ON
   * CONFLICT current = current + 1). Avant : findFirst(orderBy desc) + parse
   * + 1 = read-modify-write → deux paiements simultanés produisaient le même
   * numéro. Initialisation au max existant à la première utilisation.
   */
  private async generateReceiptNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;

    const sequence = await this.appSequences.next(tenantId, `PAYRECEIPT:${year}`, {
      initFrom: async () => {
        const lastReceipt = await this.prisma.paymentReceipt.findFirst({
          where: {
            receiptNumber: {
              startsWith: prefix,
            },
          },
          orderBy: {
            receiptNumber: 'desc',
          },
          select: { receiptNumber: true },
        });
        if (!lastReceipt?.receiptNumber) return 0;
        const lastSequence = parseInt(lastReceipt.receiptNumber.split('-')[2] || '0');
        return isNaN(lastSequence) ? 0 : lastSequence;
      },
    });

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Annulation par écriture inverse (REVERSAL). Jamais de suppression.
   * Crée un paiement inverse (montant négatif, transactionType REVERSAL) et met à jour le résumé.
   */
  async reversePayment(
    paymentId: string,
    tenantId: string,
    params: { reversalReason: string; createdBy?: string },
    scope?: AccessScope | null,
  ) {
    const original = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: { student: true, studentFee: true },
    });

    if (!original) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // ⭐ Filtre Rôles × Pistes × Niveaux — annulation restreinte au périmètre
    assertLevelInScope(scope || undefined, original, 'ce paiement');

    if (original.transactionType === 'REVERSAL') {
      throw new BadRequestException('Cannot reverse a reversal payment');
    }

    const existingReversal = await this.prisma.payment.findFirst({
      where: { reversedFromId: original.id, tenantId },
    });
    if (existingReversal) {
      throw new BadRequestException('This payment has already been reversed');
    }

    const reversalAmount = -Number(original.amount);
    const receiptNumber = await this.generateReceiptNumber(tenantId);

    const reversal = await this.prisma.payment.create({
      data: {
        tenantId: original.tenantId,
        academicYearId: original.academicYearId,
        studentId: original.studentId,
        schoolLevelId: original.schoolLevelId,
        feeConfigurationId: original.feeConfigurationId,
        studentFeeId: original.studentFeeId,
        amount: reversalAmount,
        paymentMethod: original.paymentMethod,
        paymentDate: new Date(),
        receiptNumber: `ANNUL-${receiptNumber}`,
        reference: `Annulation de ${original.receiptNumber}`,
        status: 'completed',
        transactionType: 'REVERSAL',
        reversedFromId: original.id,
        reversalReason: params.reversalReason,
        createdBy: params.createdBy,
        // ⭐ Conserve la piste dénormalisée du paiement original
        academicTrackId: original.academicTrackId,
      },
      include: {
        student: true,
        reversedFrom: true,
      },
    });

    if (original.studentFeeId) {
      await this.updatePaymentSummary(original.studentFeeId, reversalAmount);
    }

    return reversal;
  }

  /**
   * Récupère le résumé de paiement d'un élève
   */
  async getStudentPaymentSummary(
    studentId: string,
    academicYearId: string,
    tenantId: string
  ) {
    const summaries = await this.prisma.paymentSummary.findMany({
      where: {
        studentId,
        academicYearId,
        tenantId,
      },
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
    });

    const totalExpected = summaries.reduce(
      (sum, s) => sum + Number(s.expectedAmount),
      0
    );
    const totalPaid = summaries.reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const totalBalance = summaries.reduce((sum, s) => sum + Number(s.balance), 0);

    return {
      summaries,
      totals: {
        expected: totalExpected,
        paid: totalPaid,
        balance: totalBalance,
      },
    };
  }
}

