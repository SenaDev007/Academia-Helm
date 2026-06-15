/**
 * ============================================================================
 * GRADES SERVICE - MODULE 3
 * ============================================================================
 * 
 * Gestion de la saisie des notes et des barèmes.
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les notes pour une évaluation donnée
   */
  async findByEvaluation(evaluationId: string, tenantId: string) {
    return this.prisma.grade.findMany({
      where: { evaluationId, tenantId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { student: { lastName: 'asc' } },
    });
  }

  /**
   * Sauvegarde massive de notes (Bulk Save)
   */
  async bulkSave(tenantId: string, academicYearId: string, evaluationId: string, grades: any[]) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
    });

    if (!evaluation) throw new NotFoundException('Evaluation not found');

    // On utilise une transaction pour tout mettre à jour d'un coup
    return this.prisma.$transaction(
      grades.map((g) => 
        this.prisma.grade.upsert({
          where: {
            tenantId_evaluationId_studentId: {
              tenantId,
              evaluationId,
              studentId: g.studentId,
            }
          },
          update: {
            score: g.score,
            qualitativeCode: g.qualitativeCode,
            isAbsent: g.isAbsent || false,
            comment: g.comment,
            updatedAt: new Date(),
          },
          create: {
            tenantId,
            academicYearId,
            evaluationId,
            studentId: g.studentId,
            classId: evaluation.classId,
            subjectId: evaluation.subjectId,
            periodId: evaluation.periodId,
            score: g.score,
            qualitativeCode: g.qualitativeCode,
            isAbsent: g.isAbsent || false,
            comment: g.comment,
            status: 'DRAFT',
          }
        })
      )
    );
  }

  /**
   * Récupère la liste des élèves pour initialiser une grille de saisie
   */
  async getGradingSheet(evaluationId: string, tenantId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
      include: { class: { include: { classStudents: { include: { student: true } } } } }
    });

    if (!evaluation) throw new NotFoundException('Evaluation not found');

    const existingGrades = await this.findByEvaluation(evaluationId, tenantId);
    
    // Combiner les notes existantes et les élèves sans note
    const students = evaluation.class.classStudents.map(cs => cs.student);
    
    return students.map(student => {
      const grade = existingGrades.find(g => g.studentId === student.id);
      return {
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName}`,
        score: grade?.score ?? null,
        qualitativeCode: grade?.qualitativeCode ?? null,
        isAbsent: grade?.isAbsent ?? false,
        comment: grade?.comment ?? '',
        status: grade?.status ?? 'NEW',
      };
    });
  }
}
