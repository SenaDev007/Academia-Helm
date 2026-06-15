/**
 * ============================================================================
 * EXAM SCORES PRISMA SERVICE - MODULE 3
 * ============================================================================
 * 
 * Service pour la saisie et validation des notes
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ExamScoresPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour une note d'examen
   */
  async createOrUpdateScore(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    examId: string;
    studentId: string;
    subjectId: string;
    score: number;
    maxScore?: number;
    coefficient?: number;
    remarks?: string;
    recordedBy?: string;
  }) {
    // Vérifier que l'examen existe
    const exam = await this.prisma.exam.findFirst({
      where: {
        id: data.examId,
        tenantId: data.tenantId,
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${data.examId} not found`);
    }

    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: {
        id: data.studentId,
        tenantId: data.tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    // Vérifier que le score ne dépasse pas le maxScore
    const maxScore = data.maxScore || exam.maxScore;
    if (data.score > maxScore) {
      throw new BadRequestException(
        `Score ${data.score} exceeds maximum score ${maxScore}`
      );
    }

    // Vérifier l'unicité
    const existing = await this.prisma.examScore.findFirst({
      where: {
        examId: data.examId,
        studentId: data.studentId,
        subjectId: data.subjectId,
        tenantId: data.tenantId,
      },
    });

    if (existing) {
      // Mise à jour
      return this.prisma.examScore.update({
        where: { id: existing.id },
        data: {
          score: data.score,
          maxScore: data.maxScore || exam.maxScore,
          coefficient: data.coefficient || exam.coefficient,
          remarks: data.remarks,
          isValidated: false, // Réinitialiser la validation si modification
          validatedBy: null,
          validatedAt: null,
        },
        include: {
          exam: true,
          student: true,
          subject: true,
        },
      });
    }

    // Création
    return this.prisma.examScore.create({
      data: {
        ...data,
        maxScore: data.maxScore || exam.maxScore,
        coefficient: data.coefficient || exam.coefficient,
        isValidated: false,
      },
      include: {
        exam: true,
        student: true,
        subject: true,
      },
    });
  }

  /**
   * Récupère toutes les notes d'un examen
   */
  async findScoresByExam(
    examId: string,
    tenantId: string,
    filters?: {
      isValidated?: boolean;
      search?: string;
    }
  ) {
    const where: any = {
      examId,
      tenantId,
    };

    if (filters?.isValidated !== undefined) {
      where.isValidated = filters.isValidated;
    }

    if (filters?.search) {
      where.OR = [
        {
          student: {
            firstName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          student: {
            lastName: { contains: filters.search, mode: 'insensitive' },
          },
        },
      ];
    }

    return this.prisma.examScore.findMany({
      where,
      include: {
        student: true,
        subject: true,
        validator: true,
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { student: { firstName: 'asc' } },
      ],
    });
  }

  /**
   * Valide une note (ou plusieurs notes)
   */
  async validateScores(
    scoreIds: string[],
    tenantId: string,
    validatedBy: string
  ) {
    // Vérifier que toutes les notes existent et appartiennent au tenant
    const scores = await this.prisma.examScore.findMany({
      where: {
        id: { in: scoreIds },
        tenantId,
      },
    });

    if (scores.length !== scoreIds.length) {
      throw new NotFoundException('Some scores not found');
    }

    // Valider toutes les notes
    return this.prisma.examScore.updateMany({
      where: {
        id: { in: scoreIds },
        tenantId,
      },
      data: {
        isValidated: true,
        validatedBy,
        validatedAt: new Date(),
      },
    });
  }

  /**
   * Récupère les notes d'un élève
   */
  async findScoresByStudent(
    studentId: string,
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      subjectId?: string;
      quarterId?: string;
      isValidated?: boolean;
    }
  ) {
    const where: any = {
      studentId,
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.subjectId) {
      where.subjectId = filters.subjectId;
    }

    if (filters?.isValidated !== undefined) {
      where.isValidated = filters.isValidated;
    }

    // Si quarterId est fourni, filtrer par exam.quarterId
    if (filters?.quarterId) {
      where.exam = {
        quarterId: filters.quarterId,
      };
    }

    return this.prisma.examScore.findMany({
      where,
      include: {
        exam: {
          include: {
            quarter: true,
            subject: true,
          },
        },
        subject: true,
        validator: true,
      },
      orderBy: [
        { exam: { examDate: 'desc' } },
      ],
    });
  }

  /**
   * Supprime une note (avant validation uniquement)
   */
  async deleteScore(id: string, tenantId: string) {
    const score = await this.prisma.examScore.findFirst({
      where: { id, tenantId },
    });

    if (!score) {
      throw new NotFoundException(`Score with ID ${id} not found`);
    }

    if (score.isValidated) {
      throw new BadRequestException('Cannot delete validated score');
    }

    await this.prisma.examScore.delete({
      where: { id },
    });

    return { success: true };
  }
}

