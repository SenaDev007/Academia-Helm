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

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ExamsConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * TYPES D'ÉVALUATIONS
   */
  async getEvaluationTypes(tenantId: string, schoolLevelId?: string) {
    return this.prisma.evaluationType.findMany({
      where: {
        tenantId,
        ...(schoolLevelId ? { schoolLevelId } : {}),
      },
      orderBy: [{ schoolLevelId: 'asc' }, { name: 'asc' }],
    });
  }

  async createEvaluationType(tenantId: string, data: any) {
    // Vérifier l'unicité (tenantId, code, schoolLevelId)
    if (data.code) {
      const existing = await this.prisma.evaluationType.findFirst({
        where: {
          tenantId,
          code: data.code,
          schoolLevelId: data.schoolLevelId || null,
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Un type d'évaluation avec le code "${data.code}" existe déjà pour ce niveau.`
        );
      }
    }

    return this.prisma.evaluationType.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code || null,
        schoolLevelId: data.schoolLevelId || null,
        isSystem: false, // Les types créés via l'UI ne sont jamais "system"
        defaultMaxScore: data.defaultMaxScore ?? 20,
        defaultCoefficient: data.defaultCoefficient ?? 1,
      },
    });
  }

  async updateEvaluationType(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.evaluationType.findFirst({
      where: { id, tenantId },
    });

    if (!existing) throw new NotFoundException('Type d\'évaluation non trouvé');

    // Les types système ne peuvent pas être modifiés (sauf par un script d'admin)
    if (existing.isSystem) {
      throw new BadRequestException('Les types système ne peuvent pas être modifiés via l\'interface.');
    }

    // Champs autorisés à la mise à jour
    const allowedFields = ['name', 'code', 'defaultMaxScore', 'defaultCoefficient'];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    return this.prisma.evaluationType.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteEvaluationType(tenantId: string, id: string) {
    const existing = await this.prisma.evaluationType.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { evaluations: true } } },
    });

    if (!existing) throw new NotFoundException('Type d\'évaluation non trouvé');

    if (existing.isSystem) {
      throw new BadRequestException('Les types système ne peuvent pas être supprimés.');
    }

    if (existing._count.evaluations > 0) {
      throw new BadRequestException(
        `Impossible de supprimer ce type : ${existing._count.evaluations} évaluation(s) l'utilisent encore.`
      );
    }

    await this.prisma.evaluationType.delete({ where: { id } });
    return { id, deleted: true };
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
