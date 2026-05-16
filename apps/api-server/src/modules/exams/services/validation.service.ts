/**
 * ============================================================================
 * VALIDATION SERVICE - MODULE 3
 * ============================================================================
 * 
 * Gère les workflows de validation des notes (Soumission -> Revue -> Validation).
 * Implémente le verrouillage des données pour garantir l'intégrité académique.
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les lots de validation en attente
   */
  async getPendingBatches(tenantId: string, academicYearId: string, schoolLevelId: string) {
    return this.prisma.gradeValidationBatch.findMany({
      where: {
        tenantId,
        academicYearId,
        status: 'PENDING',
        evaluation: {
            class: { schoolLevelId }
        }
      },
      include: {
        evaluation: {
          include: {
            class: true,
            subject: true,
            evaluationType: true,
          }
        },
        period: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Approuve un lot de validation
   */
  async approveBatch(batchId: string, tenantId: string, reviewedBy: string, comment?: string) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.gradeValidationBatch.findFirst({
        where: { id: batchId, tenantId },
        include: { evaluation: true }
      });

      if (!batch) throw new NotFoundException('Validation batch not found');
      if (batch.status !== 'PENDING') throw new BadRequestException('Batch is already processed');

      // 1. Mettre à jour le statut du lot
      const updatedBatch = await tx.gradeValidationBatch.update({
        where: { id: batchId },
        data: {
          status: 'APPROVED',
          reviewedById: reviewedBy,
          reviewedAt: new Date(),
          reviewComment: comment,
        },
      });

      // 2. Mettre à jour l'évaluation
      await tx.evaluation.update({
        where: { id: batch.evaluationId },
        data: { 
          status: 'VALIDATED',
          validatedById: reviewedBy,
          validatedAt: new Date(),
        },
      });

      // 3. Verrouiller toutes les notes associées
      await tx.grade.updateMany({
        where: { evaluationId: batch.evaluationId, tenantId },
        data: { status: 'VALIDATED' },
      });

      // 4. Créer un verrou (GradeLock) pour empêcher toute modification ultérieure
      await tx.gradeLock.create({
        data: {
          tenantId,
          academicYearId: batch.academicYearId,
          periodId: batch.periodId,
          classId: batch.classId,
          subjectId: batch.subjectId,
          lockType: 'PERIOD_FINAL', // Ou EVALUATION_FINAL
          lockedById: reviewedBy,
          reason: `Validation du lot ${batchId} - ${batch.evaluation.title}`,
        },
      });

      return updatedBatch;
    });
  }

  /**
   * Rejette un lot de validation (renvoie à l'enseignant pour correction)
   */
  async rejectBatch(batchId: string, tenantId: string, reviewedBy: string, comment: string) {
    if (!comment) throw new BadRequestException('Un commentaire de rejet est obligatoire');

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.gradeValidationBatch.findFirst({
        where: { id: batchId, tenantId },
      });

      if (!batch) throw new NotFoundException('Validation batch not found');

      // 1. Mettre à jour le statut du lot
      const updatedBatch = await tx.gradeValidationBatch.update({
        where: { id: batchId },
        data: {
          status: 'REJECTED',
          reviewedById: reviewedBy,
          reviewedAt: new Date(),
          reviewComment: comment,
        },
      });

      // 2. Déverrouiller l'évaluation pour permettre la correction
      await tx.evaluation.update({
        where: { id: batch.evaluationId },
        data: { status: 'OPEN_FOR_GRADING' },
      });

      // 3. Remettre les notes en statut DRAFT
      await tx.grade.updateMany({
        where: { evaluationId: batch.evaluationId, tenantId },
        data: { status: 'DRAFT' },
      });

      return updatedBatch;
    });
  }

  /**
   * Vérifie si un contexte est verrouillé
   */
  async isLocked(tenantId: string, academicYearId: string, classId: string, periodId: string) {
    const lock = await this.prisma.gradeLock.findFirst({
      where: {
        tenantId,
        academicYearId,
        classId,
        periodId,
      },
    });

    return !!lock;
  }
}
