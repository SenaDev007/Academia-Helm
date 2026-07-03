/**
 * SOUS-MODULE 2 — Comptes élèves (StudentAccount, AccountBreakdown)
 * Création automatique à admission, calcul totalDue/totalPaid/balance, statut dynamique, injection arriérés N→N+1.
 *
 * SÉCURITÉ SQL :
 * - Les champs balance/totalDue/totalPaid/arrearsAmount sont protégés par le trigger
 *   `prevent_balance_update` qui exige `app.allow_balance_update = 'true'` en session.
 * - Le champ `isBlocked` est protégé par `prevent_manual_block_update` qui exige
 *   `app.allow_block_update = 'true'`.
 * - Ce service configure ces flags via `prisma.$executeRaw` avant chaque update légitime.
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const STATUS_ACTIVE = 'ACTIVE';
const STATUS_PARTIAL = 'PARTIAL';
const STATUS_PAID = 'PAID';
const STATUS_OVERDUE = 'OVERDUE';
const STATUS_BLOCKED = 'BLOCKED';
const STATUS_CLOSED = 'CLOSED';

@Injectable()
export class StudentAccountService {
  private readonly logger = new Logger(StudentAccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active le flag SQL `app.allow_balance_update` pour la transaction courante.
   * À appeler AVANT toute mise à jour légitime de totalDue/totalPaid/balance/arrearsAmount.
   */
  private async allowBalanceUpdate(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
  }

  /**
   * Active le flag SQL `app.allow_block_update` pour la transaction courante.
   * À appeler AVANT toute mise à jour légitime de isBlocked.
   */
  private async allowBlockUpdate(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`SET LOCAL app.allow_block_update = 'true'`);
  }

  /**
   * Résout la date d'échéance réelle d'une tranche en fonction de son mode.
   *
   * - FIXED                 : retourne installment.dueDate
   * - AT_ENROLLMENT         : retourne enrollmentDate (date d'inscription de l'élève)
   * - DAYS_AFTER_ENROLLMENT : retourne enrollmentDate + daysOffset jours
   *
   * Si enrollmentDate est null/undefined (élève sans inscription), on fallback sur
   * installment.dueDate (ou maintenant si pas de dueDate non plus).
   */
  private resolveDueDate(
    installment: any,
    enrollmentDate: Date | null | undefined,
  ): Date | null {
    const dueDateType = installment.dueDateType ?? 'FIXED';

    if (dueDateType === 'AT_ENROLLMENT') {
      if (enrollmentDate) return new Date(enrollmentDate);
      // Fallback : maintenant si pas d'inscription
      return installment.dueDate ? new Date(installment.dueDate) : new Date();
    }

    if (dueDateType === 'DAYS_AFTER_ENROLLMENT') {
      const base = enrollmentDate ? new Date(enrollmentDate) : new Date();
      const offset = installment.daysOffset ?? 0;
      const result = new Date(base);
      result.setDate(result.getDate() + offset);
      return result;
    }

    // FIXED
    return installment.dueDate ? new Date(installment.dueDate) : null;
  }

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
    // RÈGLE MÉTIER : Priorité d'application (Classe > Niveau > Global)
    // Pour chaque type de frais (feeType), on ne garde que la structure la plus spécifique.
    const structuresByType = new Map<string, any>();

    allStructures.forEach((fs) => {
      const isClassMatch = fs.classId && fs.classId === classId;
      const isLevelMatch = fs.levelId === levelId && !fs.classId;
      const isGlobalMatch = !fs.levelId && !fs.classId;

      if (isClassMatch || isLevelMatch || isGlobalMatch) {
        const existing = structuresByType.get(fs.feeType);
        if (!existing) {
          structuresByType.set(fs.feeType, fs);
        } else {
          // Remplacement si plus spécifique
          const existingIsClass = existing.classId;
          const existingIsLevel = existing.levelId && !existing.classId;
          
          if (isClassMatch) {
            structuresByType.set(fs.feeType, fs); // La classe gagne toujours
          } else if (isLevelMatch && !existingIsClass) {
            structuresByType.set(fs.feeType, fs); // Le niveau gagne contre le global
          }
        }
      }
    });

    const feeStructures = Array.from(structuresByType.values()).filter((fs) => fs.isMandatory);

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
      include: {
        breakdowns: {
          include: { feeStructure: { include: { structureInstallments: true } } },
        },
      },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');

    // Charger la date d'inscription de l'élève pour résoudre les échéances
    // AT_ENROLLMENT et DAYS_AFTER_ENROLLMENT
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId: account.studentId, academicYearId: account.academicYearId },
      select: { enrollmentDate: true },
      orderBy: { enrollmentDate: 'desc' },
    });
    const enrollmentDate = enrollment?.enrollmentDate ?? null;

    const balance = Number(account.balance);
    let status = account.status;
    let isBlocked = account.isBlocked;

    // RÈGLE MÉTIER : Vérification du seuil de blocage automatique
    const settings = await this.prisma.financialSettings.findUnique({ where: { tenantId } });
    if (settings && balance > Number(settings.blockingThreshold) && !isBlocked) {
      isBlocked = true;
      // Note: Le trigger 'trg_audit_account_blocking' créera automatiquement le log d'audit
    }

    if (isBlocked) status = STATUS_BLOCKED;
    else if (balance <= 0) status = STATUS_PAID;
    else {
      const now = new Date();
      const hasOverdue = account.breakdowns?.some((b) => {
        const rem = Number(b.remainingAmount);
        if (rem <= 0) return false;
        const fs = b.feeStructure;
        const installments = fs?.structureInstallments ?? [];
        // Résoudre les échéances en tenant compte du mode (FIXED / AT_ENROLLMENT / DAYS_AFTER_ENROLLMENT)
        const nextDue = installments
          .filter((i) => Number(b.paidAmount) < Number(fs?.totalAmount ?? 0))
          .map((i) => ({ installment: i, resolvedDue: this.resolveDueDate(i, enrollmentDate) }))
          .filter((x) => x.resolvedDue !== null)
          .sort((a, b) => a.resolvedDue!.getTime() - b.resolvedDue!.getTime())[0];
        return nextDue && nextDue.resolvedDue! < now;
      });
      status = hasOverdue ? STATUS_OVERDUE : STATUS_PARTIAL;
    }

    // Active le flag SQL pour autoriser la mise à jour de isBlocked (si changement)
    if (isBlocked !== account.isBlocked) {
      await this.allowBlockUpdate();
    }
    await this.prisma.studentAccount.update({
      where: { id: accountId },
      data: { status, isBlocked, updatedAt: new Date() },
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

    // Active le flag SQL pour autoriser la mise à jour des champs balance
    await this.allowBalanceUpdate();
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
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
        breakdowns: { include: { feeStructure: { select: { id: true, label: true, amount: true } } } },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      take: 500,
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

    // Active le flag SQL pour autoriser la mise à jour de isBlocked
    await this.allowBlockUpdate();
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
