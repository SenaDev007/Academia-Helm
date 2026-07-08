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

    const enrollment = student.studentEnrollments?.[0];
    const classId = enrollment?.classId ?? null;
    const levelId = student.schoolLevelId;
    const enrollmentType = enrollment?.enrollmentType ?? 'NEW';
    const previousArrears = Number(enrollment?.previousArrears ?? 0);

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

    // ⚠️ RÈGLE MÉTIER : Nouvel élève vs ancien élève
    //   - enrollmentType === 'NEW' → frais d'INSCRIPTION (pas de REINSCRIPTION)
    //   - enrollmentType ∈ ['REPEAT', 'PROMOTION', 'TRANSFER'] → frais de REINSCRIPTION (pas d'INSCRIPTION)
    //   Un élève ne doit JAMAIS payer à la fois INSCRIPTION et REINSCRIPTION.
    const isNewStudent = enrollmentType === 'NEW';
    const feeStructuresRaw = Array.from(structuresByType.values());
    const feeStructures = feeStructuresRaw.filter((fs) => {
      if (isNewStudent) {
        // Nouvel élève : exclure REINSCRIPTION (il paie INSCRIPTION)
        return fs.feeType !== 'REINSCRIPTION';
      } else {
        // Ancien élève : exclure INSCRIPTION (il paie REINSCRIPTION)
        return fs.feeType !== 'INSCRIPTION';
      }
    });

    const totalDue = feeStructures.reduce((sum, fs) => {
      const override = fs.overrides[0];
      const amount = override ? Number(override.customAmount) : Number(fs.totalAmount);
      return sum + amount;
    }, 0);

    // ⚠️ previousArrears : arriérés antérieurs saisis manuellement à l'admission
    // (nouveaux clients qui ont des arriérés sur papier). Injectés dans le
    // StudentAccount pour être visibles dans le compte financier et inclus
    // dans le total dû et le solde.
    const totalDueWithArrears = totalDue + previousArrears;

    account = await this.prisma.studentAccount.create({
      data: {
        tenantId,
        studentId,
        academicYearId,
        totalDue: totalDueWithArrears,
        totalPaid: 0,
        balance: totalDueWithArrears,
        arrearsAmount: previousArrears,
        status: totalDueWithArrears > 0 ? STATUS_ACTIVE : STATUS_PAID,
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
   * Recalcule le compte élève : recrée les breakdowns à partir des FeeStructures
   * actuelles + FeeOverrides. Utilisé après création/modification d'une personnalisation.
   */
  async recalculate(studentId: string, tenantId: string, academicYearId: string) {
    let account = await this.prisma.studentAccount.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } },
      include: { breakdowns: true },
    });

    if (!account) {
      const result = await this.getOrCreate(tenantId, studentId, academicYearId);
      return result.account;
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { studentEnrollments: { where: { academicYearId }, include: { class: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const enrollment = student.studentEnrollments?.[0];
    const classId = enrollment?.classId ?? null;
    const levelId = student.schoolLevelId;
    const enrollmentType = enrollment?.enrollmentType ?? 'NEW';

    const allStructures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: { structureInstallments: true, overrides: { where: { studentId } } },
    });

    // Priorité Classe > Niveau > Global
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
          const existingIsClass = existing.classId;
          const existingIsLevel = existing.levelId && !existing.classId;
          if (isClassMatch) {
            structuresByType.set(fs.feeType, fs);
          } else if (isLevelMatch && !existingIsClass) {
            structuresByType.set(fs.feeType, fs);
          }
        }
      }
    });

    // ⚠️ RÈGLE MÉTIER : Nouvel élève vs ancien élève (même logique que getOrCreate)
    const isNewStudent = enrollmentType === 'NEW';
    const feeStructuresRaw = Array.from(structuresByType.values());
    const feeStructures = feeStructuresRaw.filter((fs) => {
      if (isNewStudent) {
        return fs.feeType !== 'REINSCRIPTION';
      } else {
        return fs.feeType !== 'INSCRIPTION';
      }
    });

    const totalDue = feeStructures.reduce((sum, fs) => {
      const override = fs.overrides[0];
      const amount = override ? Number(override.customAmount) : Number(fs.totalAmount);
      return sum + amount;
    }, 0);

    // Supprimer les anciens breakdowns (non payés)
    await this.prisma.accountBreakdown.deleteMany({
      where: { studentAccountId: account.id, paidAmount: 0 },
    });

    // Récupérer les breakdowns restants (ceux avec paiements)
    const existingBreakdowns = await this.prisma.accountBreakdown.findMany({
      where: { studentAccountId: account.id },
    });
    const existingFeeStructureIds = new Set(existingBreakdowns.map((b) => b.feeStructureId));

    // Créer les nouveaux breakdowns (seulement pour les frais pas déjà présents)
    const newBreakdowns = feeStructures.filter((fs) => !existingFeeStructureIds.has(fs.id));

    // Mettre à jour les breakdowns existants avec les overrides
    for (const b of existingBreakdowns) {
      const fs = feeStructures.find((f) => f.id === b.feeStructureId);
      if (fs) {
        const override = fs.overrides[0];
        const newAmount = override ? Number(override.customAmount) : Number(fs.totalAmount);
        if (Number(b.initialAmount) !== newAmount) {
          await this.prisma.accountBreakdown.update({
            where: { id: b.id },
            data: {
              initialAmount: newAmount,
              adjustedAmount: newAmount,
              remainingAmount: newAmount - Number(b.paidAmount),
            },
          });
        }
      }
    }

    // Créer les nouveaux breakdowns
    if (newBreakdowns.length > 0) {
      await this.prisma.accountBreakdown.createMany({
        data: newBreakdowns.map((fs) => {
          const override = fs.overrides[0];
          const initialAmount = override ? Number(override.customAmount) : Number(fs.totalAmount);
          return {
            studentAccountId: account.id,
            feeStructureId: fs.id,
            initialAmount,
            adjustedAmount: initialAmount,
            paidAmount: 0,
            remainingAmount: initialAmount,
          };
        }),
      });
    }

    // Recalculer totalDue et balance
    const allBreakdowns = await this.prisma.accountBreakdown.findMany({
      where: { studentAccountId: account.id },
    });
    const newTotalDue = allBreakdowns.reduce((sum, b) => sum + Number(b.initialAmount), 0);
    const totalPaid = allBreakdowns.reduce((sum, b) => sum + Number(b.paidAmount), 0);

    await this.allowBalanceUpdate();
    account = await this.prisma.studentAccount.update({
      where: { id: account.id },
      data: {
        totalDue: newTotalDue,
        totalPaid,
        balance: newTotalDue - totalPaid,
        updatedAt: new Date(),
      },
      include: { breakdowns: { include: { feeStructure: true } } },
    });

    return account;
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

    const accounts = await this.prisma.studentAccount.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            matricule: true,
            studentEnrollments: {
              where: { academicYearId: filters.academicYearId },
              select: { id: true, classId: true, class: { select: { id: true, name: true } } },
            },
          },
        },
        breakdowns: {
          include: {
            feeStructure: {
              select: { id: true, name: true, feeType: true, totalAmount: true, customFeeTypeLabel: true },
            },
          },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      take: 500,
    });

    // ─── Multi-année : récupérer les arriérés réels (FeeArrear) pour chaque élève ───
    // Les champs StudentAccount.arrearsAmount et carriedArrears ne sont pas toujours
    // synchronisés avec les FeeArrear (ex: arriérés créés manuellement via le module
    // Recouvrement). On agrège donc les FeeArrear ouverts (OPEN ou PARTIALLY_PAID)
    // pour afficher le vrai total d'arriérés dans la colonne "Arriérés".
    const studentIds = accounts.map((a) => a.studentId);
    const openArrears: any[] = studentIds.length > 0
      ? await this.prisma.feeArrear.findMany({
          where: {
            tenantId,
            studentId: { in: studentIds },
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
            balanceDue: { gt: 0 },
          },
          include: {
            academicYear: { select: { name: true, startDate: true } },
          },
          orderBy: [{ academicYear: { startDate: 'asc' } }],
        })
      : [];

    // Grouper par studentId
    const arrearsByStudent = new Map<string, { total: number; items: any[] }>();
    for (const arrear of openArrears) {
      const existing = arrearsByStudent.get(arrear.studentId) || { total: 0, items: [] };
      existing.total += Number(arrear.balanceDue ?? 0);
      existing.items.push({
        id: arrear.id,
        academicYearId: arrear.academicYearId,
        academicYearName: arrear.academicYear?.name || '—',
        totalDue: Number(arrear.totalDue ?? 0),
        totalPaid: Number(arrear.totalPaid ?? 0),
        balanceDue: Number(arrear.balanceDue ?? 0),
        status: arrear.status,
        notes: arrear.notes,
      });
      arrearsByStudent.set(arrear.studentId, existing);
    }

    // Attacher les infos d'arriérés à chaque compte.
    // ⚠️ IMPORTANT : Le `totalDue` et `balance` affichés doivent INCLURE les arriérés
    // (FIFO) pour refléter la vraie dette de l'élève envers l'établissement.
    // On conserve aussi `baseTotalDue` / `baseBalance` (sans arriérés) pour référence.
    return accounts.map((account) => {
      const arrearData = arrearsByStudent.get(account.studentId);
      const actualArrears = arrearData?.total ?? 0;
      const baseTotalDue = Number(account.totalDue ?? 0);
      const baseBalance = Number(account.balance ?? 0);
      return {
        ...account,
        // Montants "de base" (sans arriérés) — pour info / debug
        baseTotalDue,
        baseBalance,
        // actualArrears : total des FeeArrear ouverts (toutes années confondues)
        actualArrears,
        // feeArrears : détails des arriérés (pour le modal de détail)
        feeArrears: arrearData?.items ?? [],
        // ⚠️ Surcharge : totalDue et balance INCLUENT maintenant les arriérés
        // (compatibilité avec le FIFO — ce sont ces montants qui seront déduits
        // au fur et à mesure des paiements)
        totalDue: baseTotalDue + actualArrears,
        balance: baseBalance + actualArrears,
      };
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
        // Inclure les overrides de l'élève pour cette année (section Personnalisations)
        // via la relation inverse — FeeOverride.studentId pointe vers Student.id
      },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');

    // Charger les overrides séparément (FeeOverride n'a pas de relation directe avec StudentAccount)
    const overrides = await this.prisma.feeOverride.findMany({
      where: {
        studentId: account.studentId,
        feeStructure: { academicYearId: account.academicYearId, tenantId },
      },
      include: {
        feeStructure: { include: { class: true, level: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ─── Multi-année : récupérer les arriérés réels (FeeArrear) pour cet élève ───
    // Toutes années confondues, OPEN ou PARTIALLY_PAID — pour le détail multi-année.
    const openArrears = await this.prisma.feeArrear.findMany({
      where: {
        tenantId,
        studentId: account.studentId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
      },
      include: { academicYear: { select: { name: true, startDate: true } } },
      orderBy: [{ academicYear: { startDate: 'asc' } }],
    });

    const feeArrears = openArrears.map((a) => ({
      id: a.id,
      academicYearId: a.academicYearId,
      academicYearName: a.academicYear?.name || '—',
      totalDue: Number(a.totalDue ?? 0),
      totalPaid: Number(a.totalPaid ?? 0),
      balanceDue: Number(a.balanceDue ?? 0),
      status: a.status,
      notes: a.notes,
    }));
    const actualArrears = feeArrears.reduce((sum, a) => sum + a.balanceDue, 0);

    // ⚠️ Surcharge : totalDue et balance INCLUENT les arriérés (FIFO)
    const baseTotalDue = Number(account.totalDue ?? 0);
    const baseBalance = Number(account.balance ?? 0);

    return {
      ...account,
      overrides,
      feeArrears,
      actualArrears,
      baseTotalDue,
      baseBalance,
      totalDue: baseTotalDue + actualArrears,
      balance: baseBalance + actualArrears,
    };
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
