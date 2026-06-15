/**
 * ============================================================================
 * MATERIAL STOCK GUARD - MODULE 2
 * ============================================================================
 * 
 * Valide la disponibilité du stock avant attribution
 * R4: Stock non négatif
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MaterialStockGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const body = request.body;
    const method = request.method;

    // Seulement pour les opérations d'attribution
    if (method !== 'POST' || !body?.materialId || !body?.quantity) {
      return true;
    }

    // Vérifier si c'est une attribution
    const isAssignment =
      request.url?.includes('teacher-material-assignments') ||
      body?.movementType === 'ASSIGNMENT';

    if (!isAssignment) {
      return true;
    }

    const { tenantId, academicYearId } = request.materialContext || {};
    const { materialId, quantity, schoolLevelId, classId } = body;

    if (!tenantId || !academicYearId) {
      throw new BadRequestException('Context validation required before stock check');
    }

    // Validate classId FK: only use if it references an existing Class row
    let validatedClassId: string | null = null;
    if (classId) {
      const classExists = await this.prisma.class.findFirst({
        where: { id: classId, tenantId },
      });
      if (classExists) {
        validatedClassId = classId;
      }
    }

    // R4: Vérifier le stock disponible
    let stock = await this.prisma.materialStock.findFirst({
      where: {
        tenantId,
        academicYearId,
        materialId,
        schoolLevelId: schoolLevelId || undefined,
        classId: validatedClassId,
      },
    });

    // Fallback: try without classId if not found
    if (!stock && validatedClassId) {
      stock = await this.prisma.materialStock.findFirst({
        where: {
          tenantId,
          academicYearId,
          materialId,
          schoolLevelId: schoolLevelId || undefined,
          classId: null,
        },
      });
    }

    if (!stock) {
      throw new ConflictException(
        `No stock available for material ${materialId} in the specified context`,
      );
    }

    if (stock.quantityAvailable < quantity) {
      throw new ConflictException(
        `Insufficient stock. Available: ${stock.quantityAvailable}, Requested: ${quantity}`,
      );
    }

    return true;
  }
}
