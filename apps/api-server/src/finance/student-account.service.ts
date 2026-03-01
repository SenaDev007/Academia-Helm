/**
 * SOUS-MODULE 2 — Comptes élèves (StudentAccount, AccountBreakdown)
 * Création automatique à admission, calcul totalDue/totalPaid/balance, statut dynamique, injection arriérés N→N+1.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const STATUS_ACTIVE = 'ACTIVE';
const STATUS_PARTIAL = 'PARTIAL';
const STATUS_PAID = 'PAID';
const STATUS_OVERDUE = 'OVERDUE';
const STATUS_BLOCKED = 'BLOCKED';
const STATUS_CLOSED = 'CLOSED';

@Injectable()
export class StudentAccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou récupère le compte élève pour une année.
   * Construit les AccountBreakdown à partir des FeeStructure applicables (priorité Classe > Niveau > Override).
   */
  async getOrCreate(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<{ account: any; created: boolean }> {
    let account = await this.prisma.studentAccount.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } },
      include: { breakdowns: { include: { feeStructure: true } } },
    });
    if (account) return { account, created: false };

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { studentEnrollments: { where: { academicYearId }, include: { class: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const classId = student.studentEnrollments?.[0]?.classId ?? null;
    const levelId = student.schoolLevelId;

    const allStructures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: { structureInstallments: true, overrides: { where: { studentId } } },
    });
    const applicableStructures = allStructures.filter(
      (fs) =>
        (fs.classId && fs.classId === classId) ||
        (fs.levelId === levelId && !fs.classId) ||
        (!fs.levelId && !fs.classId),
    );
    // Règle 3 : isMandatory = true → injecté automatiquement ; isMandatory = false → visible mais activable facultativement
    const feeStructures = applicableStructures.filter((fs) => fs.isMandatory);

    const totalDue = feeStructures.reduce((sum, fs) => {
      const override = fs.overrides[0];
      const amount = override ? Number(override.customAmount) : Number(fs.totalAmount);
      return sum + amount;
    }, 0);

    account = await this.prisma.studentAccount.create({
      data: {
        tenantId,
        studentId,
        academicYearId,
        totalDue,
        totalPaid: 0,
        balance: totalDue,
        arrearsAmount: 0,
        status: totalDue > 0 ? STATUS_ACTIVE : STATUS_PAID,
        isBlocked: false,
        updatedAt: new Date(),
        breakdowns: {
          create: feeStructures.map((fs) => {
            const override = fs.overrides[0];
            const initialAmount = override ? Number(override.customAmount) : Number(fs.totalAmount);
            return {
              feeStructureId: fs.id,
              initialAmount,
              adjustedAmount: initialAmount,
              paidAmount: 0,
              remainingAmount: initialAmount,
            };
          }),
        },
      },
      include: { breakdowns: { include: { feeStructure: true } } },
    });

    return { account, created: true };
  }

  /**
   * Met à jour le statut du compte à partir du solde et des échéances.
   */
  async updateStatus(accountId: string, tenantId: string): Promise<string> {
    const account = await this.prisma.studentAccount.findFirst({
      where: { id: accountId, tenantId },
      include: { breakdowns: { include: { feeStructure: { include: { structureInstallments: true } } } } },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');

    const balance = Number(account.balance);
    let status = account.status;
    if (account.isBlocked) status = STATUS_BLOCKED;
    else if (balance <= 0) status = STATUS_PAID;
    else {
      const now = new Date();
      const hasOverdue = account.breakdowns?.some((b) => {
        const rem = Number(b.remainingAmount);
        if (rem <= 0) return false;
        const fs = b.feeStructure;
        const installments = fs?.structureInstallments ?? [];
        const nextDue = installments
          .filter((i) => Number(b.paidAmount) < Number(fs?.totalAmount ?? 0))
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
        return nextDue && new Date(nextDue.dueDate) < now;
      });
      status = hasOverdue ? STATUS_OVERDUE : STATUS_PARTIAL;
    }

    await this.prisma.studentAccount.update({
      where: { id: accountId },
      data: { status, updatedAt: new Date() },
    });
    return status;
  }

  /**
   * Injecte les arriérés de l'année N dans le compte N+1 (arrearsAmount + breakdown).
   */
  async injectArrearsFromPreviousYear(
    tenantId: string,
    studentId: string,
    fromAcademicYearId: string,
    toAcademicYearId: string,
    arrearsAmount: number,
  ) {
    if (arrearsAmount <= 0) return null;

    const { account } = await this.getOrCreate(tenantId, studentId, toAcademicYearId);

    const newTotalDue = Number(account.totalDue) + arrearsAmount;
    const newBalance = Number(account.balance) + arrearsAmount;

    await this.prisma.studentAccount.update({
      where: { id: account.id },
      data: {
        arrearsAmount: Number(account.arrearsAmount) + arrearsAmount,
        totalDue: newTotalDue,
        balance: newBalance,
        updatedAt: new Date(),
      },
    });

    return this.prisma.studentAccount.findUnique({
      where: { id: account.id },
      include: { breakdowns: true },
    });
  }

  async findAll(
    tenantId: string,
    filters: {
      academicYearId: string;
      classId?: string;
      status?: string;
      isBlocked?: boolean;
    },
  ) {
    const where: any = { tenantId, academicYearId: filters.academicYearId };
    if (filters.status) where.status = filters.status;
    if (filters.isBlocked !== undefined) where.isBlocked = filters.isBlocked;
    if (filters.classId) {
      where.student = {
        studentEnrollments: {
          some: { academicYearId: filters.academicYearId, classId: filters.classId },
        },
      };
    }

    return this.prisma.studentAccount.findMany({
      where,
      include: {
        student: true,
        breakdowns: { include: { feeStructure: true } },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
  }

  async findOne(id: string, tenantId: string) {
    const account = await this.prisma.studentAccount.findFirst({
      where: { id, tenantId },
      include: {
        student: true,
        academicYear: true,
        breakdowns: { include: { feeStructure: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
        recoveryReminders: { orderBy: { sentAt: 'desc' }, take: 20 },
      },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');
    return account;
  }

  /**
   * Levée de blocage (directeur uniquement côté RBAC). Motif obligatoire, audit recommandé.
   */
  async unblock(accountId: string, tenantId: string, reason: string, userId?: string) {
    const account = await this.prisma.studentAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');
    if (!account.isBlocked) return account;

    return this.prisma.studentAccount.update({
      where: { id: accountId },
      data: {
        isBlocked: false,
        status: Number(account.balance) > 0 ? STATUS_PARTIAL : STATUS_PAID,
        updatedAt: new Date(),
      },
      include: { student: true, breakdowns: true },
    });
  }
}
