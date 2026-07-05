/**
 * SOUS-MODULE 1 — Configuration des frais (FeeStructure, FeeStructureInstallment, FeeOverride)
 * Priorité : Classe > Niveau > Override. Aucune suppression (historisation). Année non clôturée. Audit.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FeeType } from '@prisma/client';

const FEE_TYPES: FeeType[] = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'];

@Injectable()
export class FeeStructureService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureAcademicYearNotClosed(academicYearId: string, tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });
    if (year?.isClosed) {
      throw new BadRequestException('Impossible de modifier la configuration des frais : année scolaire clôturée.');
    }
  }

  private async audit(tenantId: string, userId: string | undefined, action: string, resource: string, resourceId: string, oldData?: object, newData?: object) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId ?? undefined,
          action,
          resource,
          resourceId,
          tableName: 'fee_structures',
          recordId: resourceId,
          oldData: oldData ?? undefined,
          newData: newData ?? undefined,
        },
      });
    } catch {
      // best-effort
    }
  }

  async create(
    tenantId: string,
    data: {
      academicYearId: string;
      levelId?: string;
      classId?: string;
      name: string;
      feeType: FeeType | string;
      customFeeTypeLabel?: string;
      totalAmount: number;
      isInstallment?: boolean;
      isMandatory?: boolean;
      installments?: {
        label: string;
        amount: number;
        dueDate?: Date;
        dueDateType?: 'FIXED' | 'AT_ENROLLMENT' | 'DAYS_AFTER_ENROLLMENT';
        daysOffset?: number;
        orderIndex: number;
      }[];
      createdById?: string;
    },
    userId?: string,
  ) {
    await this.ensureAcademicYearNotClosed(data.academicYearId, tenantId);
    const feeType = (typeof data.feeType === 'string' && FEE_TYPES.includes(data.feeType as FeeType)) ? data.feeType as FeeType : data.feeType;
    if (!FEE_TYPES.includes(feeType as FeeType)) {
      throw new BadRequestException(`feeType must be one of: ${FEE_TYPES.join(', ')}`);
    }

    // Résoudre levelId : le frontend peut envoyer un UUID de education_levels
    // au lieu de school_levels. On essaie les deux tables.
    let resolvedLevelId = data.levelId ?? null;
    if (resolvedLevelId) {
      // Vérifier si c'est un UUID de school_levels
      const schoolLevel = await this.prisma.schoolLevel.findFirst({
        where: { id: resolvedLevelId, tenantId },
        select: { id: true },
      });
      if (!schoolLevel) {
        // Ce n'est pas dans school_levels → essayer education_levels
        const eduLevel = await this.prisma.educationLevel.findFirst({
          where: { id: resolvedLevelId, tenantId },
          select: { id: true, name: true },
        });
        if (eduLevel) {
          // Résoudre par nom (MATERNELLE/PRIMAIRE/SECONDAIRE)
          const matchingSchoolLevel = await this.prisma.schoolLevel.findFirst({
            where: { tenantId, name: eduLevel.name },
            select: { id: true },
          });
          if (matchingSchoolLevel) {
            resolvedLevelId = matchingSchoolLevel.id;
          } else {
            // Si aucun school_level ne correspond, créer ou utiliser le code
            resolvedLevelId = null;
          }
        }
      }
    }

    if (data.classId && resolvedLevelId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: data.classId, tenantId },
      });
      if (cls && cls.schoolLevelId !== resolvedLevelId) {
        throw new BadRequestException('classId must belong to the given levelId');
      }
    }

    const structure = await this.prisma.feeStructure.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        levelId: resolvedLevelId,
        classId: data.classId ?? null,
        name: data.name,
        feeType: feeType as FeeType,
        customFeeTypeLabel: data.customFeeTypeLabel ?? null,
        totalAmount: data.totalAmount,
        isInstallment: data.isInstallment ?? false,
        isMandatory: data.isMandatory ?? true,
        isActive: true,
        createdById: data.createdById ?? null,
        updatedAt: new Date(),
        structureInstallments: data.installments?.length
          ? {
              create: data.installments.map((i) => {
                const dueDateType = i.dueDateType ?? 'FIXED';
                // Pour AT_ENROLLMENT et DAYS_AFTER_ENROLLMENT, dueDate est NULL
                // (résolue dynamiquement au runtime)
                const resolvedDueDate =
                  dueDateType === 'FIXED'
                    ? i.dueDate ?? new Date()
                    : null;
                // Pour DAYS_AFTER_ENROLLMENT, daysOffset doit être défini
                const resolvedDaysOffset =
                  dueDateType === 'DAYS_AFTER_ENROLLMENT'
                    ? i.daysOffset ?? 0
                    : null;
                return {
                  label: i.label,
                  amount: i.amount,
                  dueDate: resolvedDueDate,
                  dueDateType,
                  daysOffset: resolvedDaysOffset,
                  orderIndex: i.orderIndex,
                };
              }),
            }
          : undefined,
      },
      include: { structureInstallments: true, level: true, class: true },
    });
    await this.audit(tenantId, userId, 'FEE_STRUCTURE_CREATE', 'FeeStructure', structure.id, undefined, { id: structure.id, name: structure.name, feeType: structure.feeType });
    return structure;
  }

  async findAll(
    tenantId: string,
    filters: {
      academicYearId: string;
      levelId?: string;
      classId?: string;
      feeType?: string;
      isActive?: boolean;
    },
  ) {
    const where: any = { tenantId, academicYearId: filters.academicYearId };

    // Si levelId est fourni (sans classId), on inclut :
    //  - les structures de niveau (levelId = filters.levelId)
    //  - les structures de classe appartenant à ce niveau (class.schoolLevelId = filters.levelId)
    if (filters.levelId && !filters.classId) {
      where.OR = [
        { levelId: filters.levelId },
        { class: { schoolLevelId: filters.levelId } },
      ];
    } else {
      if (filters.levelId) where.levelId = filters.levelId;
      if (filters.classId) where.classId = filters.classId;
    }
    if (filters.feeType) where.feeType = filters.feeType;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.feeStructure.findMany({
      where,
      include: { structureInstallments: { orderBy: { orderIndex: 'asc' } }, level: true, class: true },
      orderBy: [{ feeType: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string) {
    const s = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId },
      include: {
        structureInstallments: { orderBy: { orderIndex: 'asc' } },
        overrides: true,
        level: true,
        class: true,
      },
    });
    if (!s) throw new NotFoundException(`FeeStructure ${id} not found`);
    return s;
  }

  /**
   * Modification directe (pas d'historisation — l'utilisateur veut que la donnée soit modifiée en place).
   */
  async update(
    id: string,
    tenantId: string,
    data: Partial<{
      name: string;
      feeType: string;
      customFeeTypeLabel: string | null;
      totalAmount: number;
      isInstallment: boolean;
      isMandatory: boolean;
      isActive: boolean;
      levelId: string | null;
      classId: string | null;
      installments: {
        label: string;
        amount: number;
        dueDate?: Date;
        dueDateType?: 'FIXED' | 'AT_ENROLLMENT' | 'DAYS_AFTER_ENROLLMENT';
        daysOffset?: number;
        orderIndex: number;
      }[];
    }>,
    userId?: string,
  ) {
    const existing = await this.findOne(id, tenantId);
    await this.ensureAcademicYearNotClosed(existing.academicYearId, tenantId);

    // Résoudre levelId si fourni (même logique que create)
    let resolvedLevelId = data.levelId !== undefined ? data.levelId : existing.levelId;
    if (resolvedLevelId) {
      const schoolLevel = await this.prisma.schoolLevel.findFirst({
        where: { id: resolvedLevelId, tenantId },
        select: { id: true },
      });
      if (!schoolLevel) {
        const eduLevel = await this.prisma.educationLevel.findFirst({
          where: { id: resolvedLevelId, tenantId },
          select: { id: true, name: true },
        });
        if (eduLevel) {
          const matchingSchoolLevel = await this.prisma.schoolLevel.findFirst({
            where: { tenantId, name: eduLevel.name },
            select: { id: true },
          });
          if (matchingSchoolLevel) {
            resolvedLevelId = matchingSchoolLevel.id;
          } else {
            resolvedLevelId = null;
          }
        }
      }
    }

    // Mise à jour directe (pas d'historisation)
    const updated = await this.prisma.feeStructure.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.feeType !== undefined && { feeType: data.feeType as FeeType }),
        ...(data.customFeeTypeLabel !== undefined && { customFeeTypeLabel: data.customFeeTypeLabel || null }),
        ...(data.totalAmount !== undefined && { totalAmount: Number(data.totalAmount) }),
        ...(data.isInstallment !== undefined && { isInstallment: data.isInstallment }),
        ...(data.isMandatory !== undefined && { isMandatory: data.isMandatory }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.levelId !== undefined && { levelId: resolvedLevelId }),
        ...(data.classId !== undefined && { classId: data.classId || null }),
        updatedAt: new Date(),
      },
      include: { structureInstallments: true, level: true, class: true },
    });

    // Si les installments sont fournis, on remplace la collection existante
    if (data.installments !== undefined) {
      // Supprimer les anciens installments
      await this.prisma.feeStructureInstallment.deleteMany({
        where: { feeStructureId: id },
      });
      // Créer les nouveaux
      if (data.installments.length > 0) {
        await this.prisma.feeStructureInstallment.createMany({
          data: data.installments.map((i) => {
            const dueDateType = i.dueDateType ?? 'FIXED';
            const resolvedDueDate =
              dueDateType === 'FIXED' ? i.dueDate ?? new Date() : null;
            const resolvedDaysOffset =
              dueDateType === 'DAYS_AFTER_ENROLLMENT' ? i.daysOffset ?? 0 : null;
            return {
              feeStructureId: id,
              label: i.label,
              amount: i.amount,
              dueDate: resolvedDueDate,
              dueDateType,
              daysOffset: resolvedDaysOffset,
              orderIndex: i.orderIndex,
            };
          }),
        });
      }
    }

    // Recharger avec les installments à jour
    const reloaded = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId },
      include: {
        structureInstallments: { orderBy: { orderIndex: 'asc' } },
        level: true,
        class: true,
      },
    });

    await this.audit(tenantId, userId, 'FEE_STRUCTURE_UPDATE', 'FeeStructure', id, { name: existing.name }, { name: updated.name });
    return reloaded ?? updated;
  }

  async addInstallment(
    feeStructureId: string,
    tenantId: string,
    data: {
      label: string;
      amount: number;
      dueDate?: Date;
      dueDateType?: 'FIXED' | 'AT_ENROLLMENT' | 'DAYS_AFTER_ENROLLMENT';
      daysOffset?: number;
      orderIndex: number;
    },
  ) {
    await this.findOne(feeStructureId, tenantId);
    const dueDateType = data.dueDateType ?? 'FIXED';
    return this.prisma.feeStructureInstallment.create({
      data: {
        feeStructureId,
        label: data.label,
        amount: data.amount,
        dueDate: dueDateType === 'FIXED' ? (data.dueDate ?? new Date()) : null,
        dueDateType,
        daysOffset: dueDateType === 'DAYS_AFTER_ENROLLMENT' ? (data.daysOffset ?? 0) : null,
        orderIndex: data.orderIndex,
      },
    });
  }

  async createOverride(
    tenantId: string,
    data: {
      feeStructureId: string;
      studentId: string;
      customAmount: number;
      reason: string;
      createdById?: string;
    },
    userId?: string,
  ) {
    const fs = await this.findOne(data.feeStructureId, tenantId);
    await this.ensureAcademicYearNotClosed(fs.academicYearId, tenantId);
    const override = await this.prisma.feeOverride.create({
      data: {
        feeStructureId: data.feeStructureId,
        studentId: data.studentId,
        customAmount: data.customAmount,
        reason: data.reason,
        createdById: data.createdById ?? userId ?? null,
      },
      include: { student: true, feeStructure: true },
    });
    await this.audit(tenantId, userId, 'FEE_OVERRIDE_CREATE', 'FeeOverride', override.id, undefined, { feeStructureId: data.feeStructureId, studentId: data.studentId, customAmount: data.customAmount, reason: data.reason });

    // Recalculer le compte élève pour appliquer la personnalisation
    await this.recalculateStudentAccount(tenantId, data.studentId, override.feeStructure.academicYearId);

    return override;
  }

  async getOverridesForStudent(tenantId: string, studentId: string, academicYearId?: string) {
    // FeeOverride n'a pas de tenantId directement — on filtre via feeStructure.tenantId
    const where: any = { studentId, feeStructure: { tenantId } };
    if (academicYearId) {
      where.feeStructure.academicYearId = academicYearId;
    }
    return this.prisma.feeOverride.findMany({
      where,
      include: {
        feeStructure: { include: { class: true, level: true } },
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère tous les overrides d'un tenant, avec filtres optionnels.
   * Utilisé par l'onglet "Personnalisations" du module Finance.
   */
  async getAllOverrides(
    tenantId: string,
    filters: {
      academicYearId?: string;
      studentId?: string;
      feeStructureId?: string;
      classId?: string;
    } = {},
  ) {
    const where: any = { feeStructure: { tenantId } };
    if (filters.academicYearId) where.feeStructure.academicYearId = filters.academicYearId;
    if (filters.feeStructureId) where.feeStructureId = filters.feeStructureId;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.classId) where.feeStructure.classId = filters.classId;

    return this.prisma.feeOverride.findMany({
      where,
      include: {
        feeStructure: { include: { class: true, level: true } },
        student: {
          select: {
            id: true, firstName: true, lastName: true, matricule: true, studentCode: true,
            studentEnrollments: { where: { academicYearId: filters.academicYearId }, include: { class: true }, take: 1 },
          },
        },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Supprime un override existant.
   * Vérifie que l'override appartient bien au tenant via feeStructure.tenantId.
   */
  async deleteOverride(id: string, tenantId: string) {
    const override = await this.prisma.feeOverride.findFirst({
      where: { id, feeStructure: { tenantId } },
      include: { feeStructure: true, student: { select: { firstName: true, lastName: true } } },
    });
    if (!override) {
      throw new NotFoundException(`FeeOverride ${id} not found`);
    }
    await this.audit(tenantId, undefined, 'FEE_OVERRIDE_DELETE', 'FeeOverride', id, { customAmount: override.customAmount, reason: override.reason }, undefined);
    await this.prisma.feeOverride.delete({ where: { id } });

    // Recalculer le compte élève pour retirer la personnalisation
    await this.recalculateStudentAccount(tenantId, override.studentId, override.feeStructure.academicYearId);

    return { id, deleted: true };
  }

  /**
   * Modifie un override existant (montant personnalisé + motif).
   * Vérifie que l'override appartient bien au tenant via feeStructure.tenantId.
   */
  async updateOverride(
    id: string,
    tenantId: string,
    data: { customAmount?: number; reason?: string },
  ) {
    const override = await this.prisma.feeOverride.findFirst({
      where: { id, feeStructure: { tenantId } },
    });
    if (!override) {
      throw new NotFoundException(`FeeOverride ${id} not found`);
    }
    const updated = await this.prisma.feeOverride.update({
      where: { id },
      data: {
        ...(data.customAmount !== undefined && { customAmount: Number(data.customAmount) }),
        ...(data.reason !== undefined && { reason: data.reason }),
      },
      include: {
        feeStructure: { include: { class: true, level: true } },
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true } },
      },
    });
    await this.audit(tenantId, undefined, 'FEE_OVERRIDE_UPDATE', 'FeeOverride', id, { customAmount: override.customAmount, reason: override.reason }, { customAmount: updated.customAmount, reason: updated.reason });

    // Recalculer le compte élève pour appliquer la modification
    await this.recalculateStudentAccount(tenantId, updated.student.id, updated.feeStructure.academicYearId);

    return updated;
  }

  /**
   * Recalcule le compte élève après création/modification/suppression d'un override.
   * Met à jour les breakdowns + totalDue + balance.
   */
  private async recalculateStudentAccount(tenantId: string, studentId: string, academicYearId: string) {
    try {
      const account = await this.prisma.studentAccount.findUnique({
        where: { studentId_academicYearId: { studentId, academicYearId } },
        include: { breakdowns: true },
      });
      if (!account) return; // Pas de compte → rien à recalculer

      const student = await this.prisma.student.findFirst({
        where: { id: studentId, tenantId },
        include: { studentEnrollments: { where: { academicYearId }, include: { class: true } } },
      });
      if (!student) return;

      const classId = student.studentEnrollments?.[0]?.classId ?? null;
      const levelId = student.schoolLevelId;

      const allStructures = await this.prisma.feeStructure.findMany({
        where: { tenantId, academicYearId, isActive: true },
        include: { overrides: { where: { studentId } } },
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
            if (isClassMatch || (isLevelMatch && !existingIsClass)) {
              structuresByType.set(fs.feeType, fs);
            }
          }
        }
      });

      const feeStructures = Array.from(structuresByType.values());

      // Mettre à jour les breakdowns existants
      for (const b of account.breakdowns) {
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

      // Créer les nouveaux breakdowns manquants
      const existingFeeStructureIds = new Set(account.breakdowns.map((b) => b.feeStructureId));
      const newBreakdowns = feeStructures.filter((fs) => !existingFeeStructureIds.has(fs.id));
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

      // Recalculer totalDue + balance — utiliser $transaction pour que
      // SET LOCAL app.allow_balance_update persiste pendant l'UPDATE
      // (sinon prevent_balance_update_trigger bloque la mise à jour)
      const allBreakdowns = await this.prisma.accountBreakdown.findMany({
        where: { studentAccountId: account.id },
      });
      const newTotalDue = allBreakdowns.reduce((sum, b) => sum + Number(b.initialAmount), 0);
      const totalPaid = allBreakdowns.reduce((sum, b) => sum + Number(b.paidAmount), 0);

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
        await tx.studentAccount.update({
          where: { id: account.id },
          data: {
            totalDue: newTotalDue,
            totalPaid,
            balance: newTotalDue - totalPaid,
            updatedAt: new Date(),
          },
        });
      });

      console.log(`[FeeStructure] Compte élève recalculé: student=${studentId}, totalDue=${newTotalDue}, balance=${newTotalDue - totalPaid}`);
    } catch (err: any) {
      console.warn(`[FeeStructure] recalculateStudentAccount failed (non-blocking): ${err.message}`);
    }
  }

  /**
   * Recalcule dynamiquement TOUS les comptes élèves du tenant en appliquant
   * les FeeOverrides existants. Pour chaque compte :
   *   - Met à jour les breakdowns avec le customAmount si un override existe
   *   - Recalcule totalDue = SUM(breakdowns.initialAmount)
   *   - Recalcule totalPaid = SUM(breakdowns.paidAmount)
   *   - Recalcule balance = totalDue - totalPaid
   *   - Recalcule status (PAID/PARTIAL/ACTIVE)
   *
   * Utilise $transaction avec SET LOCAL app.allow_balance_update pour
   * bypasser prevent_balance_update_trigger.
   */
  async recalculateAllAccounts(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    const accounts = await this.prisma.studentAccount.findMany({
      where,
      include: { breakdowns: { include: { feeStructure: { include: { overrides: true } } } } },
    });

    let updatedAccounts = 0;
    let updatedBreakdowns = 0;

    for (const account of accounts) {
      let newTotalDue = 0;
      let newTotalPaid = 0;

      // 1. Mettre à jour chaque breakdown
      for (const bd of account.breakdowns) {
        const fs = bd.feeStructure;
        const override = fs?.overrides?.find((o: any) => o.studentId === account.studentId);
        const originalAmount = Number(fs?.totalAmount ?? 0);
        const newInitialAmount = override ? Number(override.customAmount) : originalAmount;
        const paidAmount = Number(bd.paidAmount);
        const newRemainingAmount = Math.max(0, newInitialAmount - paidAmount);

        if (Number(bd.initialAmount) !== newInitialAmount) {
          await this.prisma.accountBreakdown.update({
            where: { id: bd.id },
            data: {
              initialAmount: newInitialAmount,
              adjustedAmount: newInitialAmount,
              remainingAmount: newRemainingAmount,
            },
          });
          updatedBreakdowns++;
        }

        newTotalDue += newInitialAmount;
        newTotalPaid += paidAmount;
      }

      // 2. Recalculer le compte avec $transaction + SET LOCAL
      const newBalance = newTotalDue - newTotalPaid;
      let newStatus = 'ACTIVE';
      if (newBalance <= 0) newStatus = 'PAID';
      else if (newTotalPaid > 0) newStatus = 'PARTIAL';

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
        await tx.studentAccount.update({
          where: { id: account.id },
          data: {
            totalDue: newTotalDue,
            totalPaid: newTotalPaid,
            balance: newBalance,
            status: newStatus as any,
            updatedAt: new Date(),
          },
        });
      });

      updatedAccounts++;
    }

    console.log(`[FeeStructure] Recalcul global: ${updatedAccounts} comptes, ${updatedBreakdowns} breakdowns mis à jour (tenant=${tenantId})`);

    return {
      success: true,
      accountsRecalculated: updatedAccounts,
      breakdownsUpdated: updatedBreakdowns,
    };
  }

  /** Copie les FeeStructures d'une année vers une nouvelle année (sans overrides). */
  async copyToNewYear(
    tenantId: string,
    data: { fromAcademicYearId: string; toAcademicYearId: string; createdById?: string },
    userId?: string,
  ) {
    await this.ensureAcademicYearNotClosed(data.toAcademicYearId, tenantId);
    const structures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId: data.fromAcademicYearId, isActive: true },
      include: { structureInstallments: { orderBy: { orderIndex: 'asc' } } },
    });
    const created = [];
    for (const s of structures) {
      const copy = await this.prisma.feeStructure.create({
        data: {
          tenantId,
          academicYearId: data.toAcademicYearId,
          levelId: s.levelId,
          classId: s.classId,
          name: s.name,
          feeType: s.feeType,
          totalAmount: s.totalAmount,
          isInstallment: s.isInstallment,
          isMandatory: s.isMandatory,
          isActive: true,
          createdById: data.createdById ?? null,
          updatedAt: new Date(),
          structureInstallments: {
            create: s.structureInstallments.map((i) => ({
              label: i.label,
              amount: i.amount,
              dueDate: i.dueDate,
              dueDateType: i.dueDateType ?? 'FIXED',
              daysOffset: i.daysOffset ?? null,
              orderIndex: i.orderIndex,
            })),
          },
        },
        include: { structureInstallments: true },
      });
      created.push(copy);
    }
    await this.audit(tenantId, userId, 'FEE_STRUCTURE_COPY_YEAR', 'FeeStructure', data.toAcademicYearId, { from: data.fromAcademicYearId }, { to: data.toAcademicYearId, count: created.length });
    return { copied: created.length, structures: created };
  }

  /**
   * Supprime un frais (désactive au lieu de supprimer physiquement).
   * Désactive aussi le trigger SQL temporairement pour permettre la suppression
   * si l'admin le souhaite vraiment.
   */
  async delete(id: string, tenantId: string) {
    const existing = await this.findOne(id, tenantId);

    // Vérifier qu'aucun compte élève n'utilise ce frais
    const breakdowns = await this.prisma.accountBreakdown.count({
      where: { feeStructureId: id },
    });
    if (breakdowns > 0) {
      // Désactiver au lieu de supprimer
      await this.prisma.feeStructure.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });
      await this.audit(tenantId, undefined, 'FEE_STRUCTURE_DEACTIVATE', 'FeeStructure', id, { isActive: true }, { isActive: false });
      return { id, isActive: false, message: 'Frais désactivé (utilisé par des comptes élèves)' };
    }

    // Suppression physique (désactiver le trigger temporairement)
    await this.prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS no_delete_fee ON "fee_structures"');
    try {
      // Supprimer d'abord les installments liés
      await this.prisma.feeStructureInstallment.deleteMany({
        where: { feeStructureId: id },
      });
      // Supprimer les overrides liés
      await this.prisma.feeOverride.deleteMany({
        where: { feeStructureId: id },
      });
      // Supprimer le frais
      await this.prisma.feeStructure.delete({
        where: { id },
      });
      await this.audit(tenantId, undefined, 'FEE_STRUCTURE_DELETE', 'FeeStructure', id, { name: existing.name }, undefined);
    } finally {
      // Recréer le trigger
      await this.prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION prevent_fee_delete()
        RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'Deletion forbidden'; END; $$ LANGUAGE plpgsql
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER no_delete_fee BEFORE DELETE ON "fee_structures"
        FOR EACH ROW EXECUTE FUNCTION prevent_fee_delete()
      `);
    }

    return { id, deleted: true };
  }
}
