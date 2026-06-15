/**
 * ============================================================================
 * ACADEMIC AUDIT SERVICE - MODULE 3
 * ============================================================================
 * 
 * Suivi des modifications de notes, déverrouillages et corrections.
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AcademicAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogs(tenantId: string, filters: any) {
    return this.prisma.academicAuditLog.findMany({
      where: {
        tenantId,
        entityType: filters.entityType,
        academicYearId: filters.academicYearId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getCorrectionRequests(tenantId: string) {
    return this.prisma.gradeCorrectionRequest.findMany({
      where: { tenantId },
      include: {
        grade: {
          include: { student: true, evaluation: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async logAction(tenantId: string, data: any) {
    return this.prisma.academicAuditLog.create({
      data: {
        tenantId,
        ...data
      }
    });
  }
}
