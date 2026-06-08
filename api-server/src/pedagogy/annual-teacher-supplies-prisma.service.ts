/**
 * ============================================================================
 * ANNUAL TEACHER SUPPLIES PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des fournitures annuelles par enseignant
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAnnualTeacherSupplyDto } from './dto/create-annual-teacher-supply.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class AnnualTeacherSuppliesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une fourniture annuelle
   */
  async create(
    data: CreateAnnualTeacherSupplyDto & {
      tenantId: string;
      academicYearId: string;
    },
  ) {
    // Validate materialId FK — verify the material exists
    const material = await this.prisma.pedagogicalMaterial.findFirst({
      where: { id: data.materialId, tenantId: data.tenantId },
      include: { schoolLevel: true },
    });
    if (!material) {
      throw new NotFoundException(`Material with ID ${data.materialId} not found for tenant ${data.tenantId}`);
    }

    // Resolve schoolLevelId: explicit > material's schoolLevelId > error
    const schoolLevelId = data.schoolLevelId || material.schoolLevelId;
    if (!schoolLevelId) {
      throw new BadRequestException(
        `Cannot determine schoolLevelId: neither provided nor found on material ${data.materialId}`,
      );
    }

    // Validate schoolLevelId FK — verify the SchoolLevel exists
    const schoolLevel = await this.prisma.schoolLevel.findFirst({
      where: { id: schoolLevelId, tenantId: data.tenantId },
    });
    if (!schoolLevel) {
      throw new BadRequestException(
        `SchoolLevel with ID ${schoolLevelId} not found for tenant ${data.tenantId}`,
      );
    }

    // Validate classId FK: only include if it references an existing Class row
    let validatedClassId: string | null = null;
    if (data.classId) {
      const classExists = await this.prisma.class.findFirst({
        where: { id: data.classId, tenantId: data.tenantId },
      });
      if (classExists) {
        validatedClassId = data.classId;
      } else {
        console.warn(`Class with ID ${data.classId} not found for tenant ${data.tenantId}, creating supply without classId`);
      }
    }

    // Vérifier l'unicité — use findFirst instead of findUnique because the
    // @@unique constraint may not exist in the actual database
    const existing = await this.prisma.annualTeacherSupply.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        materialId: data.materialId,
        classId: validatedClassId,
      },
    });

    if (existing) {
      // Mettre à jour la quantité
      return this.prisma.annualTeacherSupply.update({
        where: { id: existing.id },
        data: { ...prismaUpdateDefaults(), quantity: data.quantity },
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              matricule: true,
            },
          },
          material: {
            select: { id: true, code: true, name: true },
          },
          schoolLevel: {
            select: { id: true, name: true, code: true },
          },
          class: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    }

    return this.prisma.annualTeacherSupply.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        materialId: data.materialId,
        schoolLevelId,
        ...(validatedClassId ? { classId: validatedClassId } : {}),
        quantity: data.quantity,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
          },
        },
        material: {
          select: { id: true, code: true, name: true },
        },
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        class: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * Récupère toutes les fournitures annuelles (avec pagination)
   */
  async findAll(
    tenantId: string,
    academicYearId: string,
    pagination: PaginationDto,
    filters?: {
      teacherId?: string;
      materialId?: string;
      schoolLevelId?: string;
      classId?: string;
    },
  ): Promise<PaginatedResponse<any>> {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (filters?.teacherId) {
      where.teacherId = filters.teacherId;
    }

    if (filters?.materialId) {
      where.materialId = filters.materialId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    const [data, total] = await Promise.all([
      this.prisma.annualTeacherSupply.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              matricule: true,
            },
          },
          material: {
            select: { id: true, code: true, name: true, category: true },
          },
          schoolLevel: {
            select: { id: true, name: true, code: true },
          },
          class: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: [
          { teacher: { lastName: 'asc' } },
          { material: { code: 'asc' } },
        ],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.annualTeacherSupply.count({ where }),
    ]);

    return createPaginatedResponse(data, total, pagination);
  }

  /**
   * Récupère les fournitures d'un enseignant pour une année
   */
  async findByTeacher(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
  ) {
    return this.prisma.annualTeacherSupply.findMany({
      where: {
        tenantId,
        academicYearId,
        teacherId,
      },
      include: {
        material: {
          select: { id: true, code: true, name: true, category: true },
        },
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        class: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { material: { code: 'asc' } },
    });
  }

  /**
   * Récupère une fourniture par ID
   */
  async findOne(id: string, tenantId: string) {
    const supply = await this.prisma.annualTeacherSupply.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            email: true,
          },
        },
        material: {
          include: {
            schoolLevel: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        class: {
          select: { id: true, name: true, code: true },
        },
        academicYear: {
          select: { id: true, name: true, label: true },
        },
      },
    });

    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }

    return supply;
  }
}
