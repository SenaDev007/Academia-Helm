/**
 * ============================================================================
 * FEES PRISMA SERVICE - MODULE 4
 * ============================================================================
 * 
 * Service pour la gestion des frais (catégories, définitions, frais élèves)
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FeesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // FEE CATEGORIES
  // ============================================================================

  /**
   * Crée une catégorie de frais
   */
  async createFeeCategory(data: {
    tenantId: string;
    name: string;
    description?: string;
    code?: string;
  }) {
    // Vérifier l'unicité du code si fourni
    if (data.code) {
      const existing = await this.prisma.feeCategory.findFirst({
        where: {
          tenantId: data.tenantId,
          code: data.code,
        },
      });

      if (existing) {
        throw new BadRequestException(`Fee category with code ${data.code} already exists`);
      }
    }

    return this.prisma.feeCategory.create({
      data,
    });
  }

  /**
   * Récupère toutes les catégories de frais
   */
  async findAllFeeCategories(tenantId: string) {
    return this.prisma.feeCategory.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Récupère une catégorie par ID
   */
  async findFeeCategoryById(id: string, tenantId: string) {
    const category = await this.prisma.feeCategory.findFirst({
      where: { id, tenantId },
      include: {
        feeDefinitions: {
          include: {
            academicYear: true,
            schoolLevel: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Fee category with ID ${id} not found`);
    }

    return category;
  }

  // ============================================================================
  // FEE DEFINITIONS
  // ============================================================================

  /**
   * Crée une définition de frais
   */
  async createFeeDefinition(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId?: string;
    feeCategoryId: string;
    label: string;
    amount: number;
    isMandatory?: boolean;
    dueDate?: Date;
    description?: string;
    createdBy?: string;
  }) {
    // Vérifier que la catégorie existe
    const category = await this.prisma.feeCategory.findFirst({
      where: {
        id: data.feeCategoryId,
        tenantId: data.tenantId,
      },
    });

    if (!category) {
      throw new NotFoundException(`Fee category with ID ${data.feeCategoryId} not found`);
    }

    return this.prisma.feeDefinition.create({
      data: {
        ...data,
        isMandatory: data.isMandatory ?? true,
      },
      include: {
        feeCategory: true,
        academicYear: true,
        schoolLevel: true,
        class: true,
      },
    });
  }

  /**
   * Récupère toutes les définitions de frais
   */
  async findAllFeeDefinitions(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      classId?: string;
      feeCategoryId?: string;
      search?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    // Niveau scolaire : filtrer sauf en mode 'ALL'
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.feeCategoryId) {
      where.feeCategoryId = filters.feeCategoryId;
    }

    if (filters?.search) {
      where.OR = [
        { label: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.feeDefinition.findMany({
      where,
      include: {
        feeCategory: true,
        academicYear: true,
        schoolLevel: true,
        class: true,
      },
      orderBy: [
        { schoolLevel: { code: 'asc' } },
        { label: 'asc' },
      ],
    });
  }

  /**
   * Récupère une définition par ID
   */
  async findFeeDefinitionById(id: string, tenantId: string) {
    const definition = await this.prisma.feeDefinition.findFirst({
      where: { id, tenantId },
      include: {
        feeCategory: true,
        academicYear: true,
        schoolLevel: true,
        class: true,
        studentFees: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!definition) {
      throw new NotFoundException(`Fee definition with ID ${id} not found`);
    }

    return definition;
  }

  /**
   * Met à jour une définition de frais
   */
  async updateFeeDefinition(
    id: string,
    tenantId: string,
    data: {
      label?: string;
      amount?: number;
      isMandatory?: boolean;
      dueDate?: Date;
      description?: string;
    }
  ) {
    const definition = await this.findFeeDefinitionById(id, tenantId);

    return this.prisma.feeDefinition.update({
      where: { id },
      data,
      include: {
        feeCategory: true,
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Supprime une définition de frais (vérification des frais élèves associés)
   */
  async deleteFeeDefinition(id: string, tenantId: string) {
    const definition = await this.findFeeDefinitionById(id, tenantId);

    // Vérifier qu'aucun frais élève n'est associé
    const studentFeesCount = await this.prisma.studentFee.count({
      where: {
        feeDefinitionId: id,
        tenantId,
      },
    });

    if (studentFeesCount > 0) {
      throw new BadRequestException(
        `Cannot delete fee definition: ${studentFeesCount} student fee(s) are associated with it`
      );
    }

    await this.prisma.feeDefinition.delete({
      where: { id },
    });

    return { success: true };
  }

  // ============================================================================
  // STUDENT FEES
  // ============================================================================

  /**
   * Crée un frais pour un élève
   */
  async createStudentFee(data: {
    tenantId: string;
    studentId: string;
    feeDefinitionId: string;
    academicYearId: string;
    totalAmount: number;
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

    // Vérifier que la définition existe
    const definition = await this.findFeeDefinitionById(data.feeDefinitionId, data.tenantId);

    // Vérifier l'unicité
    const existing = await this.prisma.studentFee.findFirst({
      where: {
        studentId: data.studentId,
        feeDefinitionId: data.feeDefinitionId,
        academicYearId: data.academicYearId,
        tenantId: data.tenantId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'A student fee already exists for this student, fee definition, and academic year'
      );
    }

    const studentFee = await this.prisma.studentFee.create({
      data: {
        ...data,
        status: 'NOT_STARTED',
      },
      include: {
        student: true,
        feeDefinition: true,
        academicYear: true,
      },
    });

    // Créer le résumé de paiement
    await this.prisma.paymentSummary.create({
      data: {
        tenantId: data.tenantId,
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        studentFeeId: studentFee.id,
        expectedAmount: data.totalAmount,
        paidAmount: 0,
        balance: data.totalAmount,
      },
    });

    return studentFee;
  }

  /**
   * Récupère les frais d'un élève
   */
  async findStudentFees(
    tenantId: string,
    filters?: {
      studentId?: string;
      academicYearId?: string;
      schoolLevelId?: string;
      status?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.student = {
        schoolLevelId: filters.schoolLevelId,
      };
    }

    return this.prisma.studentFee.findMany({
      where,
      include: {
        student: true,
        feeDefinition: {
          include: {
            feeCategory: true,
            schoolLevel: true,
          },
        },
        academicYear: true,
        paymentSummary: true,
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Met à jour le statut d'un frais élève
   */
  async updateStudentFeeStatus(
    id: string,
    tenantId: string,
    status: 'NOT_STARTED' | 'PARTIAL' | 'PAID'
  ) {
    const studentFee = await this.prisma.studentFee.findFirst({
      where: { id, tenantId },
    });

    if (!studentFee) {
      throw new NotFoundException(`Student fee with ID ${id} not found`);
    }

    return this.prisma.studentFee.update({
      where: { id },
      data: { status },
      include: {
        student: true,
        feeDefinition: true,
        paymentSummary: true,
      },
    });
  }
}

