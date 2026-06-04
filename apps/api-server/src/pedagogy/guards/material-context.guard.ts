/**
 * ============================================================================
 * MATERIAL CONTEXT GUARD - MODULE 2
 * ============================================================================
 * 
 * Valide le contexte obligatoire pour toutes les opérations matériel :
 * - tenant_id
 * - academic_year_id
 * - user_id
 * - role
 * - academic_year active
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MaterialContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body;
    const query = request.query;

    // R1: Vérifier tenant_id
    // Also check request.tenantId which is set by TenantGuard from X-Tenant-ID header
    const tenantId = body?.tenantId || query?.tenantId || request?.tenantId || user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenant_id is required');
    }

    // R1: Vérifier academic_year_id (obligatoire pour écriture)
    const academicYearId = body?.academicYearId || query?.academicYearId;
    if (request.method !== 'GET' && !academicYearId) {
      throw new BadRequestException('academic_year_id is required for write operations');
    }

    // R1: Vérifier user_id
    if (!user?.id) {
      throw new ForbiddenException('User ID is required');
    }

    // R1: Vérifier role
    if (!user?.role) {
      throw new ForbiddenException('User role is required');
    }

    // R1: Vérifier que l'année scolaire est active (pour écriture)
    if (academicYearId && request.method !== 'GET') {
      const academicYear = await this.prisma.academicYear.findFirst({
        where: {
          id: academicYearId,
          tenantId,
        },
      });

      if (!academicYear) {
        throw new BadRequestException(`Academic year ${academicYearId} not found`);
      }

      // Super Admin peut écrire même si année inactive
      if (!academicYear.isActive && user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException(
          'Cannot write to inactive academic year. Only Super Admin can modify archived years.',
        );
      }
    }

    // Ajouter le contexte validé à la requête
    request.materialContext = {
      tenantId,
      academicYearId,
      userId: user.id,
      userRole: user.role,
    };

    return true;
  }
}
