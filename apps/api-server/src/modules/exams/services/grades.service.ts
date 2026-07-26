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
      grades.map((g) => {
        // ⭐ Stocker cm/cp dans le champ comment au format JSON si présents
        // (le modèle Grade n'a pas de champs cm/cp dédiés)
        let commentToStore = g.comment || '';
        if (g.cm !== undefined || g.cp !== undefined) {
          const metadata = { cm: g.cm ?? null, cp: g.cp ?? null, comment: g.comment || '' };
          commentToStore = JSON.stringify(metadata);
        }

        return this.prisma.grade.upsert({
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
            comment: commentToStore,
            status: g.status || 'DRAFT',
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
            comment: commentToStore,
            status: g.status || 'DRAFT',
          }
        });
      })
    );
  }

  /**
   * Récupère la liste des élèves pour initialiser une grille de saisie.
   *
   * ⭐ Les élèves peuvent venir de 2 sources :
   *   1. ClassStudent (relation directe classe → élève)
   *   2. StudentEnrollment (élève inscrit dans l'année avec classId optionnel)
   *
   * On fusionne les 2 sources (déduplication par studentId) pour maximiser
   * les chances d'afficher tous les élèves de la classe.
   */
  async getGradingSheet(evaluationId: string, tenantId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
      include: {
        class: {
          include: {
            classStudents: { include: { student: true } },
          },
        },
      },
    });

    if (!evaluation) throw new NotFoundException('Evaluation not found');

    // Source 1 : ClassStudent (relation directe)
    const studentsFromClassStudents = evaluation.class?.classStudents?.map(cs => cs.student) || [];

    // Source 2 : StudentEnrollment (élèves inscrits dans cette classe pour cette année)
    let studentsFromEnrollment: any[] = [];
    try {
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          classId: evaluation.classId,
          tenantId,
          academicYearId: evaluation.academicYearId,
          status: { in: ['ACTIVE', 'ENROLLED', 'CONFIRMED', 'PENDING'] },
        },
        include: { student: true },
      });
      studentsFromEnrollment = enrollments
        .map(e => e.student)
        .filter(s => s != null);
    } catch (err) {
      console.warn('[getGradingSheet] StudentEnrollment fetch failed:', err);
    }

    // Fusionner + dédupliquer par studentId
    const studentMap = new Map<string, any>();
    [...studentsFromClassStudents, ...studentsFromEnrollment].forEach(student => {
      if (student && !studentMap.has(student.id)) {
        studentMap.set(student.id, student);
      }
    });
    const students = Array.from(studentMap.values());

    const existingGrades = await this.findByEvaluation(evaluationId, tenantId);

    return students.map(student => {
      const grade = existingGrades.find(g => g.studentId === student.id);

      // ⭐ Parser cm/cp depuis le champ comment (stocké en JSON)
      let cm: number | null = null;
      let cp: number | null = null;
      let comment = grade?.comment ?? '';
      if (comment && comment.startsWith('{') && comment.includes('"cm"')) {
        try {
          const parsed = JSON.parse(comment);
          cm = parsed.cm ?? null;
          cp = parsed.cp ?? null;
          comment = parsed.comment ?? '';
        } catch {
          // Si le JSON est invalide, garder le comment tel quel
        }
      }

      return {
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName}`.trim(),
        matricule: student.matricule ?? null,
        gender: student.gender ?? null,
        score: grade?.score ?? null,
        cm,
        cp,
        qualitativeCode: grade?.qualitativeCode ?? null,
        isAbsent: grade?.isAbsent ?? false,
        comment,
        status: grade?.status ?? 'NEW',
      };
    });
  }
}
