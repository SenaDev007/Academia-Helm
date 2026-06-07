/**
 * ============================================================================
 * EVALUATIONS SERVICE - MODULE 3
 * ============================================================================
 * 
 * Gestion du cycle de vie des évaluations (devoirs, compositions, etc.)
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste les évaluations filtrées
   */
  async findAll(tenantId: string, academicYearId: string, filters: any) {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (filters.schoolLevelId) where.class = { schoolLevelId: filters.schoolLevelId };
    if (filters.classId) where.classId = filters.classId;
    if (filters.status) where.status = filters.status;
    if (filters.periodId) where.periodId = filters.periodId;

    return this.prisma.evaluation.findMany({
      where,
      include: {
        class: true,
        subject: true,
        evaluationType: true,
        period: true,
        _count: {
          select: { grades: true }
        }
      },
      orderBy: { evaluationDate: 'desc' },
    });
  }

  /**
   * Crée une nouvelle évaluation
   */
  async create(tenantId: string, academicYearId: string, data: any) {
    // Validation du type d'évaluation pour le barème par défaut
    const type = await this.prisma.evaluationType.findUnique({
      where: { id: data.evaluationTypeId },
    });

    if (!type) throw new NotFoundException('Evaluation type not found');

    return this.prisma.evaluation.create({
      data: {
        ...data,
        tenantId,
        academicYearId,
        maxScore: data.maxScore || type.defaultMaxScore || 20,
        coefficient: data.coefficient || type.defaultCoefficient || 1,
        status: 'PLANNED',
      },
    });
  }

  /**
   * Soumet une évaluation pour validation
   */
  async submitForValidation(id: string, tenantId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, tenantId },
      include: { grades: true }
    });

    if (!evaluation) throw new NotFoundException('Evaluation not found');
    
    // Vérifier que toutes les notes sont saisies
    const studentCount = await this.prisma.classStudent.count({
      where: { classId: evaluation.classId, academicYearId: evaluation.academicYearId }
    });

    if (evaluation.grades.length < studentCount) {
      throw new BadRequestException(`Saisie incomplète : ${evaluation.grades.length}/${studentCount} notes saisies.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mettre à jour l'évaluation
      const updatedEval = await tx.evaluation.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      });

      // 2. Créer le lot de validation
      await tx.gradeValidationBatch.create({
        data: {
          tenantId: evaluation.tenantId,
          academicYearId: evaluation.academicYearId,
          periodId: evaluation.periodId,
          evaluationId: evaluation.id,
          classId: evaluation.classId,
          subjectId: evaluation.subjectId,
          status: 'PENDING',
          submittedById: evaluation.createdBy || 'SYSTEM', // Idéalement l'ID du prof
          submittedAt: new Date(),
        },
      });

      return updatedEval;
    });
  }

  /**
   * Valide une évaluation (Admin/Directeur)
   */
  async validate(id: string, tenantId: string, validatedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const evaluation = await tx.evaluation.update({
        where: { id, tenantId },
        data: { 
          status: 'VALIDATED',
          validatedById: validatedBy,
          validatedAt: new Date(),
        },
      });

      // Verrouiller les notes associées
      await tx.grade.updateMany({
        where: { evaluationId: id },
        data: { status: 'VALIDATED' },
      });

      return evaluation;
    });
  }
}
