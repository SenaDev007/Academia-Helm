/**
 * ============================================================================
 * EXAMS CONFIG SERVICE - MODULE 3
 * ============================================================================
 * 
 * Gestion de la configuration pédagogique : Types d'évaluations, barèmes
 * et règles de calcul institutionnelles.
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ExamsConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * TYPES D'ÉVALUATIONS
   */
  async getEvaluationTypes(tenantId: string) {
    return this.prisma.evaluationType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createEvaluationType(tenantId: string, data: any) {
    return this.prisma.evaluationType.create({
      data: { ...data, tenantId },
    });
  }

  /**
   * BARÈMES ET MENTIONS
   */
  async getGradeScales(tenantId: string) {
    return this.prisma.gradeScale.findMany({
      where: { tenantId },
      orderBy: { minGrade: 'desc' },
    });
  }

  async createGradeScale(tenantId: string, data: any) {
    return this.prisma.gradeScale.create({
      data: { ...data, tenantId },
    });
  }

  /**
   * RÈGLES DE CALCUL
   */
  async getCalculationRules(tenantId: string) {
    return this.prisma.examCalculationRule.findMany({
      where: { tenantId },
    });
  }

  async updateCalculationRule(tenantId: string, id: string, data: any) {
    return this.prisma.examCalculationRule.update({
      where: { id, tenantId },
      data,
    });
  }
}
