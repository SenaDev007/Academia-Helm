/**
 * ============================================================================
 * ANNUAL TEACHER SUPPLIES PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des fournitures annuelles par enseignant
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAnnualTeacherSupplyDto } from './dto/create-annual-teacher-supply.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';

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
    // Vérifier l'unicité
    const existing = await this.prisma.annualTeacherSupply.findUnique({
      where: {
        tenantId_academicYearId_teacherId_materialId_classId: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          teacherId: data.teacherId,
          materialId: data.materialId,
          classId: data.classId || null,
        },
      },
    });

    if (existing) {
      // Mettre à jour la quantité
      return this.prisma.annualTeacherSupply.update({
        where: { id: existing.id },
        data: { quantity: data.quantity },
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
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        materialId: data.materialId,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
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
