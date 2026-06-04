/**
 * ============================================================================
 * MATERIAL MOVEMENTS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des mouvements de stock
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateMaterialMovementDto } from './dto/create-material-movement.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class MaterialMovementsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un mouvement de stock
   */
  async create(
    data: CreateMaterialMovementDto & {
      tenantId: string;
      academicYearId: string;
      performedById: string;
      schoolLevelId?: string;
      classId?: string;
    },
  ) {
    // Vérifier que le matériel existe
    const material = await this.prisma.pedagogicalMaterial.findFirst({
      where: {
        id: data.materialId,
        tenantId: data.tenantId,
      },
    });

    if (!material) {
      throw new NotFoundException(`Material with ID ${data.materialId} not found`);
    }

    // Validate performedById FK — verify User exists
    const performer = await this.prisma.user.findFirst({
      where: { id: data.performedById },
    });
    if (!performer) {
      throw new BadRequestException(`User with ID ${data.performedById} not found — cannot record movement`);
    }

    // Créer le mouvement
    const movement = await this.prisma.materialMovement.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        materialId: data.materialId,
        movementType: data.movementType as string, // Prisma attend string
        quantity: data.quantity,
        reference: data.reference,
        notes: data.notes,
        performedById: data.performedById,
      },
      include: {
        material: {
          select: { id: true, code: true, name: true },
        },
        performedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        academicYear: {
          select: { id: true, name: true, label: true },
        },
      },
    });

    // R3: Mettre à jour le stock via MaterialMovement (obligatoire)
    await this.updateStockAfterMovement({
      ...data,
      schoolLevelId: data.schoolLevelId,
      classId: data.classId,
    });

    return movement;
  }

  /**
   * Met à jour le stock après un mouvement
   * R3: Le stock ne se modifie jamais directement, tout passe par MaterialMovement
   * R4: Stock non négatif - validation stricte
   */
  private async updateStockAfterMovement(data: {
    tenantId: string;
    academicYearId: string;
    materialId: string;
    movementType: string;
    quantity: number;
    schoolLevelId?: string;
    classId?: string;
  }) {
    const material = await this.prisma.pedagogicalMaterial.findFirst({
      where: { id: data.materialId },
      include: { schoolLevel: true },
    });

    if (!material) {
      throw new NotFoundException(`Material ${data.materialId} not found`);
    }

    const schoolLevelId = data.schoolLevelId || material.schoolLevelId;

    // R3: Trouver ou créer le stock (jamais modifié directement)
    // Validate classId FK: only include if it references an existing Class row
    let validatedClassId: string | null = null;
    if (data.classId) {
      const classExists = await this.prisma.class.findFirst({
        where: { id: data.classId, tenantId: data.tenantId },
      });
      if (classExists) {
        validatedClassId = data.classId;
      } else {
        // If classId doesn't exist, don't fail — just omit it (stock without class)
        console.warn(`Class with ID ${data.classId} not found for tenant ${data.tenantId}, creating stock without classId`);
      }
    }
    
    // Use findFirst + create/update instead of upsert because the unique constraint
    // on material_stocks may not exist in the actual database
    let stock = await this.prisma.materialStock.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        materialId: data.materialId,
        schoolLevelId,
        classId: validatedClassId,
      },
    });

    if (!stock) {
      stock = await this.prisma.materialStock.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          materialId: data.materialId,
          schoolLevelId,
          ...(validatedClassId ? { classId: validatedClassId } : {}),
          quantityTotal: 0,
          quantityAvailable: 0,
        },
      });
    }

    // Calculer les nouvelles quantités
    let newTotal = stock.quantityTotal;
    let newAvailable = stock.quantityAvailable;

    switch (data.movementType) {
      case 'PURCHASE':
        // R5: Achat - incrément total et disponible
        newTotal += data.quantity;
        newAvailable += data.quantity;
        break;
      case 'ASSIGNMENT':
        // R6: Attribution - décrément disponible uniquement
        // R4: Validation stock non négatif
        if (newAvailable < data.quantity) {
          throw new BadRequestException(
            `Insufficient stock available. Available: ${newAvailable}, Requested: ${data.quantity}`,
          );
        }
        newAvailable -= data.quantity;
        break;
      case 'RETURN':
        // R7: Retour - incrément disponible
        newAvailable += data.quantity;
        // Ne pas dépasser le total
        if (newAvailable > newTotal) {
          newAvailable = newTotal;
        }
        break;
      case 'REPLACEMENT':
        // Remplacement - pas de changement de stock, juste traçabilité
        break;
      case 'DAMAGE':
      case 'DECOMMISSION':
        // R8: Détérioration/perte - décrément définitif
        // R4: Validation stock non négatif
        if (newTotal < data.quantity || newAvailable < data.quantity) {
          throw new BadRequestException(
            `Invalid stock operation. Cannot remove ${data.quantity} from stock (Total: ${newTotal}, Available: ${newAvailable})`,
          );
        }
        newTotal -= data.quantity;
        newAvailable -= data.quantity;
        break;
      default:
        throw new BadRequestException(`Unknown movement type: ${data.movementType}`);
    }

    // R4: Validation finale - stock jamais négatif
    if (newTotal < 0 || newAvailable < 0) {
      throw new BadRequestException(
        `Stock cannot be negative. Calculated: Total=${newTotal}, Available=${newAvailable}`,
      );
    }

    // R3: Mettre à jour le stock (seule modification autorisée via mouvement)
    await this.prisma.materialStock.update({
      where: { id: stock.id },
      data: {
        ...prismaUpdateDefaults(),
        quantityTotal: newTotal,
        quantityAvailable: newAvailable,
      },
    });
  }

  /**
   * Récupère tous les mouvements (avec pagination)
   */
  async findAll(
    tenantId: string,
    academicYearId: string,
    pagination: PaginationDto,
    filters?: {
      materialId?: string;
      movementType?: string;
      performedById?: string;
    },
  ): Promise<PaginatedResponse<any>> {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (filters?.materialId) {
      where.materialId = filters.materialId;
    }

    if (filters?.movementType) {
      where.movementType = filters.movementType;
    }

    if (filters?.performedById) {
      where.performedById = filters.performedById;
    }

    const [data, total] = await Promise.all([
      this.prisma.materialMovement.findMany({
        where,
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
          performedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          academicYear: {
            select: { id: true, name: true, label: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.materialMovement.count({ where }),
    ]);

    return createPaginatedResponse(data, total, pagination);
  }

  /**
   * Récupère un mouvement par ID
   */
  async findOne(id: string, tenantId: string) {
    const movement = await this.prisma.materialMovement.findFirst({
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
          },
        },
        performedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        academicYear: {
          select: { id: true, name: true, label: true },
        },
      },
    });

    if (!movement) {
      throw new NotFoundException(`Movement with ID ${id} not found`);
    }

    return movement;
  }
}
