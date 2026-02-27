/**
 * ============================================================================
 * COUNCIL DECISIONS PRISMA SERVICE - MODULE 3
 * ============================================================================
 * 
 * Service pour les décisions de conseil de classe
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CouncilDecisionsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une décision de conseil de classe
   */
  async createDecision(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    councilId: string;
    studentId: string;
    quarterId?: string;
    decision: string; // ADMIS | REDOUBLE | AJOURNE | CONDITIONAL
    description: string;
    comments?: string;
    votesFor?: number;
    votesAgainst?: number;
    votesAbstain?: number;
  }) {
    // Vérifier que le conseil existe
    const council = await this.prisma.classCouncil.findFirst({
      where: {
        id: data.councilId,
        tenantId: data.tenantId,
      },
    });

    if (!council) {
      throw new NotFoundException(`Council with ID ${data.councilId} not found`);
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

    // Vérifier qu'une décision n'existe pas déjà pour cet élève et ce conseil
    const existing = await this.prisma.councilDecision.findFirst({
      where: {
        councilId: data.councilId,
        studentId: data.studentId,
        tenantId: data.tenantId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'A decision already exists for this student in this council'
      );
    }

    return this.prisma.councilDecision.create({
      data,
      include: {
        student: true,
        council: true,
        quarter: true,
      },
    });
  }

  /**
   * Récupère les décisions d'un conseil
   */
  async findDecisionsByCouncil(
    councilId: string,
    tenantId: string
  ) {
    return this.prisma.councilDecision.findMany({
      where: {
        councilId,
        tenantId,
      },
      include: {
        student: true,
        quarter: true,
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { student: { firstName: 'asc' } },
      ],
    });
  }

  /**
   * Récupère les décisions d'un élève
   */
  async findDecisionsByStudent(
    studentId: string,
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      quarterId?: string;
      decision?: string;
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

    if (filters?.quarterId) {
      where.quarterId = filters.quarterId;
    }

    if (filters?.decision) {
      where.decision = filters.decision;
    }

    return this.prisma.councilDecision.findMany({
      where,
      include: {
        council: {
          include: {
            class: true,
          },
        },
        quarter: true,
      },
      orderBy: {
        quarter: { number: 'desc' },
      },
    });
  }

  /**
   * Met à jour une décision
   */
  async updateDecision(
    id: string,
    tenantId: string,
    data: {
      decision?: string;
      description?: string;
      comments?: string;
      votesFor?: number;
      votesAgainst?: number;
      votesAbstain?: number;
    }
  ) {
    const decision = await this.prisma.councilDecision.findFirst({
      where: { id, tenantId },
    });

    if (!decision) {
      throw new NotFoundException(`Decision with ID ${id} not found`);
    }

    return this.prisma.councilDecision.update({
      where: { id },
      data,
      include: {
        student: true,
        council: true,
        quarter: true,
      },
    });
  }

  /**
   * Supprime une décision
   */
  async deleteDecision(id: string, tenantId: string) {
    const decision = await this.prisma.councilDecision.findFirst({
      where: { id, tenantId },
    });

    if (!decision) {
      throw new NotFoundException(`Decision with ID ${id} not found`);
    }

    await this.prisma.councilDecision.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Récupère les statistiques des décisions
   */
  async getDecisionStatistics(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      quarterId?: string;
      classId?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.quarterId) {
      where.quarterId = filters.quarterId;
    }

    if (filters?.classId) {
      where.council = {
        classId: filters.classId,
      };
    }

    const [total, byDecision] = await Promise.all([
      this.prisma.councilDecision.count({ where }),
      this.prisma.councilDecision.groupBy({
        by: ['decision'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      byDecision,
    };
  }
}

