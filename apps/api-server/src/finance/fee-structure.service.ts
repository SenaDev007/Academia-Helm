/**
 * SOUS-MODULE 1 — Configuration des frais (FeeStructure, FeeStructureInstallment, FeeOverride)
 * Priorité : Classe > Niveau > Override. Aucune suppression (historisation). Année non clôturée. Audit.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FeeType } from '@prisma/client';

const FEE_TYPES: FeeType[] = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'ANNEX', 'EXCEPTIONAL'];

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
      totalAmount: number;
      isInstallment?: boolean;
      isMandatory?: boolean;
      installments?: { label: string; amount: number; dueDate: Date; orderIndex: number }[];
      createdById?: string;
    },
    userId?: string,
  ) {
    await this.ensureAcademicYearNotClosed(data.academicYearId, tenantId);
    const feeType = (typeof data.feeType === 'string' && FEE_TYPES.includes(data.feeType as FeeType)) ? data.feeType as FeeType : data.feeType;
    if (!FEE_TYPES.includes(feeType as FeeType)) {
      throw new BadRequestException(`feeType must be one of: ${FEE_TYPES.join(', ')}`);
    }
    if (data.classId && data.levelId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: data.classId, tenantId },
      });
      if (cls && cls.schoolLevelId !== data.levelId) {
        throw new BadRequestException('classId must belong to the given levelId');
      }
    }

    const structure = await this.prisma.feeStructure.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        levelId: data.levelId ?? null,
        classId: data.classId ?? null,
        name: data.name,
        feeType: feeType as FeeType,
        totalAmount: data.totalAmount,
        isInstallment: data.isInstallment ?? false,
        isMandatory: data.isMandatory ?? true,
        isActive: true,
        createdById: data.createdById ?? null,
        updatedAt: new Date(),
        structureInstallments: data.installments?.length
          ? {
              create: data.installments.map((i) => ({
                label: i.label,
                amount: i.amount,
                dueDate: i.dueDate,
                orderIndex: i.orderIndex,
              })),
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
    if (filters.levelId) where.levelId = filters.levelId;
    if (filters.classId) where.classId = filters.classId;
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
   * Historisation : aucune modification destructive. Ancienne version désactivée (isActive=false), nouvelle version créée.
   */
  async update(
    id: string,
    tenantId: string,
    data: Partial<{
      name: string;
      totalAmount: number;
      isInstallment: boolean;
      isMandatory: boolean;
      isActive: boolean;
      levelId: string | null;
      classId: string | null;
    }>,
    userId?: string,
  ) {
    const existing = await this.findOne(id, tenantId);
    await this.ensureAcademicYearNotClosed(existing.academicYearId, tenantId);
    await this.prisma.feeStructure.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });
    const created = await this.prisma.feeStructure.create({
      data: {
        tenantId,
        academicYearId: existing.academicYearId,
        levelId: existing.levelId,
        classId: existing.classId,
        name: data.name ?? existing.name,
        feeType: existing.feeType,
        totalAmount: data.totalAmount ?? Number(existing.totalAmount),
        isInstallment: data.isInstallment ?? existing.isInstallment,
        isMandatory: data.isMandatory ?? existing.isMandatory,
        isActive: true,
        createdById: userId ?? existing.createdById ?? null,
        updatedAt: new Date(),
        structureInstallments: existing.structureInstallments?.length
          ? { create: existing.structureInstallments.map((i) => ({ label: i.label, amount: i.amount, dueDate: i.dueDate, orderIndex: i.orderIndex })) }
          : undefined,
      },
      include: { structureInstallments: true, level: true, class: true },
    });
    await this.audit(tenantId, userId, 'FEE_STRUCTURE_UPDATE', 'FeeStructure', id, { previousId: id }, { newId: created.id, replacedBy: created.id });
    return created;
  }

  async addInstallment(
    feeStructureId: string,
    tenantId: string,
    data: { label: string; amount: number; dueDate: Date; orderIndex: number },
  ) {
    await this.findOne(feeStructureId, tenantId);
    return this.prisma.feeStructureInstallment.create({
      data: { feeStructureId, ...data },
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
    return override;
  }

  async getOverridesForStudent(tenantId: string, studentId: string, academicYearId?: string) {
    const where: any = { tenantId, studentId };
    if (academicYearId) {
      where.feeStructure = { academicYearId };
    }
    return this.prisma.feeOverride.findMany({
      where,
      include: { feeStructure: true },
    });
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
}
