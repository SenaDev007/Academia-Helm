/**
 * ============================================================================
 * EVALUATIONS PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion des évaluations et formations du personnel
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class EvaluationsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // STAFF EVALUATIONS
  // ============================================================================

  /**
   * Crée une évaluation
   */
  async createEvaluation(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId?: string;
    staffId: string;
    evaluatorId?: string;
    score?: number;
    comments?: string;
  }) {
    return this.prisma.staffEvaluation.create({
      data: {
        ...prismaCreateDefaults(),
        ...data,
        score: data.score !== undefined && data.score !== null ? new Prisma.Decimal(data.score) : undefined,
      },
      include: {
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Récupère toutes les évaluations
   */
  async findAllEvaluations(tenantId: string, filters?: {
    academicYearId?: string;
    staffId?: string;
    evaluatorId?: string;
  }) {
    const where: any = { tenantId };
    
    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }
    if (filters?.staffId) {
      where.staffId = filters.staffId;
    }
    if (filters?.evaluatorId) {
      where.evaluatorId = filters.evaluatorId;
    }

    return this.prisma.staffEvaluation.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère une évaluation par ID
   */
  async findEvaluationById(id: string, tenantId: string) {
    const evaluation = await this.prisma.staffEvaluation.findFirst({
      where: { id, tenantId },
      include: {
        staff: true,
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException(`Evaluation with ID ${id} not found`);
    }

    return evaluation;
  }

  /**
   * Met à jour une évaluation
   */
  async updateEvaluation(id: string, tenantId: string, data: any) {
    const evaluation = await this.findEvaluationById(id, tenantId);

    const updateData: any = { ...data };
    if (updateData.score !== undefined && updateData.score !== null) {
      updateData.score = new Prisma.Decimal(updateData.score);
    }

    return this.prisma.staffEvaluation.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...updateData,
      },
    });
  }

  /**
   * Récupère les statistiques d'évaluation
   */
  async getEvaluationStatistics(tenantId: string, academicYearId: string) {
    const evaluations = await this.prisma.staffEvaluation.findMany({
      where: {
        tenantId,
        academicYearId,
        score: { not: null },
      },
    });

    if (evaluations.length === 0) {
      return {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }

    const scores = evaluations
      .map(e => Number(e.score))
      .filter(s => !isNaN(s));

    const total = scores.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const average = total > 0 ? sum / total : 0;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    return {
      total,
      average,
      min,
      max,
    };
  }

  // ============================================================================
  // STAFF TRAININGS
  // ============================================================================

  /**
   * Enregistre une formation
   */
  async createTraining(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    title: string;
    provider?: string;
    dateCompleted: Date;
    description?: string;
    certificatePath?: string;
  }) {
    return this.prisma.staffTraining.create({
      data: {
        ...prismaCreateDefaults(),
        ...data,
      },
    });
  }

  /**
   * Récupère toutes les formations d'un membre du personnel
   */
  async findStaffTrainings(staffId: string, tenantId: string) {
    return this.prisma.staffTraining.findMany({
      where: {
        staffId,
        tenantId,
      },
      orderBy: { dateCompleted: 'desc' },
    });
  }

  /**
   * Récupère une formation par ID
   */
  async findTrainingById(id: string, tenantId: string) {
    const training = await this.prisma.staffTraining.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!training) {
      throw new NotFoundException(`Training with ID ${id} not found`);
    }

    return training;
  }

  /**
   * Met à jour une formation
   */
  async updateTraining(id: string, tenantId: string, data: any) {
    const training = await this.findTrainingById(id, tenantId);

    return this.prisma.staffTraining.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...data,
      },
    });
  }

  /**
   * Supprime une formation
   */
  async deleteTraining(id: string, tenantId: string) {
    const training = await this.findTrainingById(id, tenantId);

    return this.prisma.staffTraining.delete({
      where: { id },
    });
  }
}

