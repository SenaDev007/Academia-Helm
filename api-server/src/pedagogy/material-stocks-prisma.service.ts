/**
 * ============================================================================
 * MATERIAL STOCKS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des stocks de matériel pédagogique
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';

@Injectable()
export class MaterialStocksPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère tous les stocks (avec pagination)
   */
  async findAll(
    tenantId: string,
    academicYearId: string,
    pagination: PaginationDto,
    filters?: {
      materialId?: string;
      schoolLevelId?: string;
      classId?: string;
    },
  ): Promise<PaginatedResponse<any>> {
    const where: any = {
      tenantId,
      academicYearId,
    };

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
      this.prisma.materialStock.findMany({
        where,
        include: {
          material: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
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
        orderBy: [
          { material: { code: 'asc' } },
          { schoolLevel: { order: 'asc' } },
        ],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.materialStock.count({ where }),
    ]);

    return createPaginatedResponse(data, total, pagination);
  }

  /**
   * Récupère un stock par ID
   */
  async findOne(id: string, tenantId: string) {
    const stock = await this.prisma.materialStock.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        material: {
          include: {
            schoolLevel: {
              select: { id: true, name: true, code: true },
            },
            subject: {
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

    if (!stock) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }

    return stock;
  }

  /**
   * Récupère le stock d'un matériel pour une année scolaire
   */
  async findByMaterial(
    tenantId: string,
    academicYearId: string,
    materialId: string,
    schoolLevelId?: string,
    classId?: string,
  ) {
    const where: any = {
      tenantId,
      academicYearId,
      materialId,
    };

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    if (classId) {
      where.classId = classId;
    }

    return this.prisma.materialStock.findMany({
      where,
      include: {
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        class: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }
}
