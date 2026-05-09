/**
 * ============================================================================
 * SUBJECTS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des matières
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubjectsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une matière
   */
  async createSubject(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    language?: string;
    name: string;
    code: string;
    coefficient?: number;
    weeklyHours?: number;
    description?: string;
  }) {
    // Vérifier l'unicité du code
    const existing = await this.prisma.subject.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        code: data.code,
      },
    });

    if (existing) {
      throw new BadRequestException(`Subject with code ${data.code} already exists`);
    }

    return this.prisma.subject.create({
      data: {
        ...data,
        coefficient: data.coefficient || 1.0,
      },
      include: {
        schoolLevel: true,
        academicYear: true,
        academicTrack: true,
      },
    });
  }

  /**
   * Récupère toutes les matières
   */
  async findAllSubjects(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      academicTrackId?: string;
      search?: string;
    }
  ) {
    await this.syncSubjectsFromSettings(tenantId, filters?.academicYearId);

    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.academicTrackId) {
      where.academicTrackId = filters.academicTrackId;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.subject.findMany({
      where,
      include: {
        schoolLevel: true,
        academicYear: true,
        academicTrack: true,
        programs: true,
      },
      orderBy: [
        { code: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Récupère une matière par ID
   */
  async findSubjectById(id: string, tenantId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId },
      include: {
        schoolLevel: true,
        academicYear: true,
        academicTrack: true,
        teachers: {
          // TeacherSubject a une relation teacher, mais elle est déjà accessible via la relation
          // Pas besoin d'include supplémentaire
        },
        classSubjects: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    return subject;
  }

  /**
   * Met à jour une matière
   */
  async updateSubject(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      code?: string;
      coefficient?: number;
      language?: string;
      weeklyHours?: number;
      description?: string;
    }
  ) {
    const subject = await this.findSubjectById(id, tenantId);

    // Vérifier l'unicité du code si modifié
    if (data.code && data.code !== subject.code) {
      const existing = await this.prisma.subject.findFirst({
        where: {
          tenantId,
          academicYearId: subject.academicYearId,
          schoolLevelId: subject.schoolLevelId,
          code: data.code,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Subject with code ${data.code} already exists`);
      }
    }

    return this.prisma.subject.update({
      where: { id },
      data,
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
  }

  /**
   * Supprime une matière (soft delete via archivage)
   */
  async deleteSubject(id: string, tenantId: string) {
    const subject = await this.findSubjectById(id, tenantId);

    // Vérifier qu'aucune classe n'utilise cette matière
    const classSubjects = await this.prisma.classSubject.count({
      where: {
        subjectId: id,
        tenantId,
      },
    });

    if (classSubjects > 0) {
      throw new BadRequestException(
        `Cannot delete subject: ${classSubjects} class(es) are using it`
      );
    }

    // Suppression physique (ou archivage selon les règles métier)
    await this.prisma.subject.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Synchronise le catalogue des matières pour une année donnée.
   * 1. Copie les matières de l'année précédente si l'année actuelle est vide.
   * 2. (Futur) Aligne sur le catalogue national si applicable.
   */
  async syncSubjectsFromSettings(tenantId: string, academicYearId?: string) {
    if (!academicYearId) return;

    // Vérifier si des matières existent déjà
    const count = await this.prisma.subject.count({
      where: { tenantId, academicYearId }
    });

    if (count > 0) return;

    // Tenter de trouver l'année précédente
    const currentYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId }
    });
    if (!currentYear) return;

    const previousYear = await this.prisma.academicYear.findFirst({
      where: { 
        tenantId, 
        startDate: { lt: currentYear.startDate } 
      },
      orderBy: { startDate: 'desc' }
    });

    if (!previousYear) return;

    // Copier les matières de l'année précédente
    const sourceSubjects = await this.prisma.subject.findMany({
      where: { tenantId, academicYearId: previousYear.id }
    });

    if (sourceSubjects.length === 0) return;

    await this.prisma.$transaction(
      sourceSubjects.map(s => {
        const { id, createdAt, updatedAt, ...data } = s;
        return this.prisma.subject.create({
          data: {
            ...data,
            academicYearId: academicYearId
          }
        });
      })
    );
  }
}

