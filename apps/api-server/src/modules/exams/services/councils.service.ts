/**
 * ============================================================================
 * COUNCILS SERVICE - MODULE 3
 * ============================================================================
 * 
 * Gestion des Conseils de Classe et des décisions pédagogiques.
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CouncilsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCouncils(tenantId: string, academicYearId: string, periodId: string) {
    return this.prisma.classCouncil.findMany({
      where: { tenantId, academicYearId, periodId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async createCouncil(tenantId: string, data: any) {
    return this.prisma.classCouncil.create({
      data: { ...data, tenantId },
    });
  }

  async getCouncilDetails(councilId: string) {
    return this.prisma.classCouncil.findUnique({
      where: { id: councilId },
      include: {
        decisions: {
          include: { student: true }
        }
      }
    });
  }

  async saveDecision(tenantId: string, councilId: string, studentId: string, data: any) {
    return this.prisma.studentCouncilDecision.upsert({
      where: {
        tenantId_councilId_studentId: {
          tenantId, councilId, studentId
        }
      },
      update: {
        decision: data.decision,
        appreciation: data.appreciation,
        recommendation: data.recommendation,
        sanctions: data.sanctions,
        decidedById: data.userId,
        decidedAt: new Date(),
      },
      create: {
        tenantId, councilId, studentId,
        decision: data.decision,
        appreciation: data.appreciation,
        recommendation: data.recommendation,
        sanctions: data.sanctions,
        decidedById: data.userId,
      }
    });
  }

  async closeCouncil(councilId: string) {
    return this.prisma.classCouncil.update({
      where: { id: councilId },
      data: { status: 'COMPLETED' }
    });
  }
}
