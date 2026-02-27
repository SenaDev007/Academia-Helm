/**
 * ============================================================================
 * PEDAGOGICAL MATERIALS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion du matériel pédagogique
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePedagogicalMaterialDto } from './dto/create-pedagogical-material.dto';
import { UpdatePedagogicalMaterialDto } from './dto/update-pedagogical-material.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';

@Injectable()
export class PedagogicalMaterialsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un matériel pédagogique
   */
  async create(data: CreatePedagogicalMaterialDto & { tenantId: string }) {
    // Vérifier l'unicité du code
    const existing = await this.prisma.pedagogicalMaterial.findFirst({
      where: {
        tenantId: data.tenantId,
        code: data.code,
      },
    });

    if (existing) {
      throw new BadRequestException(`Material with code ${data.code} already exists`);
    }

    return this.prisma.pedagogicalMaterial.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
      include: {
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        subject: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * Récupère tous les matériels pédagogiques (avec pagination)
   */
  async findAll(
    tenantId: string,
    pagination: PaginationDto,
    filters?: {
      schoolLevelId?: string;
      subjectId?: string;
      category?: string;
      isActive?: boolean;
      search?: string;
    },
  ): Promise<PaginatedResponse<any>> {
    const where: any = {
      tenantId,
    };

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.subjectId) {
      where.subjectId = filters.subjectId;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.pedagogicalMaterial.findMany({
        where,
        include: {
          schoolLevel: {
            select: { id: true, name: true, code: true },
          },
          subject: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.pedagogicalMaterial.count({ where }),
    ]);

    return createPaginatedResponse(data, total, pagination);
  }

  /**
   * Récupère un matériel pédagogique par ID
   */
  async findOne(id: string, tenantId: string) {
    const material = await this.prisma.pedagogicalMaterial.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        subject: {
          select: { id: true, name: true, code: true },
        },
        stocks: {
          include: {
            academicYear: {
              select: { id: true, name: true, label: true },
            },
            class: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundException(`Material with ID ${id} not found`);
    }

    return material;
  }

  /**
   * Met à jour un matériel pédagogique
   */
  async update(id: string, tenantId: string, data: UpdatePedagogicalMaterialDto) {
    await this.findOne(id, tenantId);

    // Vérifier l'unicité du code si modifié
    if (data.code) {
      const existing = await this.prisma.pedagogicalMaterial.findFirst({
        where: {
          tenantId,
          code: data.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Material with code ${data.code} already exists`);
      }
    }

    return this.prisma.pedagogicalMaterial.update({
      where: { id },
      data,
      include: {
        schoolLevel: {
          select: { id: true, name: true, code: true },
        },
        subject: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * Supprime un matériel pédagogique (soft delete)
   */
  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.pedagogicalMaterial.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
