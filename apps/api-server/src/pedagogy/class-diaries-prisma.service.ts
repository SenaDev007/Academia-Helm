/**
 * ============================================================================
 * CLASS DIARIES PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des cahiers de textes
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ClassDiariesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une entrée de cahier de textes
   */
  async createClassDiary(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    classSubjectId: string;
    date: Date;
    homework?: string;
    notes?: string;
  }) {
    // Vérifier que l'affectation classe/matière existe
    const classSubject = await this.prisma.classSubject.findFirst({
      where: { id: data.classSubjectId, tenantId: data.tenantId },
    });

    if (!classSubject) {
      throw new NotFoundException(`ClassSubject with ID ${data.classSubjectId} not found`);
    }

    // Vérifier l'unicité (un seul cahier par classe/matière/date)
    const existing = await this.prisma.classDiary.findFirst({
      where: {
        classSubjectId: data.classSubjectId,
        date: data.date,
      },
    });

    if (existing) {
      throw new BadRequestException('Class diary already exists for this class/subject/date');
    }

    return this.prisma.classDiary.create({
      data,
      include: {
        classSubject: {
          include: {
            class: true,
            subject: true,
          },
        },
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Récupère toutes les entrées de cahiers de textes
   */
  async findAllClassDiaries(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      classSubjectId?: string;
      classId?: string;
      subjectId?: string;
      startDate?: Date;
      endDate?: Date;
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

    if (filters?.classSubjectId) {
      where.classSubjectId = filters.classSubjectId;
    }

    if (filters?.classId || filters?.subjectId) {
      where.classSubject = {};
      if (filters.classId) {
        where.classSubject.classId = filters.classId;
      }
      if (filters.subjectId) {
        where.classSubject.subjectId = filters.subjectId;
      }
    }

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    return this.prisma.classDiary.findMany({
      where,
      include: {
        classSubject: {
          include: {
            class: true,
            subject: true,
          },
        },
        academicYear: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Récupère une entrée de cahier de textes par ID
   */
  async findClassDiaryById(id: string, tenantId: string) {
    const classDiary = await this.prisma.classDiary.findFirst({
      where: { id, tenantId },
      include: {
        classSubject: {
          include: {
            class: true,
            subject: true,
          },
        },
        academicYear: true,
        schoolLevel: true,
      },
    });

    if (!classDiary) {
      throw new NotFoundException(`ClassDiary with ID ${id} not found`);
    }

    return classDiary;
  }

  /**
   * Met à jour une entrée de cahier de textes
   */
  async updateClassDiary(
    id: string,
    tenantId: string,
    data: {
      homework?: string;
      notes?: string;
      date?: Date;
    }
  ) {
    await this.findClassDiaryById(id, tenantId);

    return this.prisma.classDiary.update({
      where: { id },
      data,
      include: {
        classSubject: {
          include: {
            class: true,
            subject: true,
          },
        },
      },
    });
  }

  /**
   * Supprime une entrée de cahier de textes
   */
  async deleteClassDiary(id: string, tenantId: string) {
    await this.findClassDiaryById(id, tenantId);

    await this.prisma.classDiary.delete({
      where: { id },
    });

    return { success: true };
  }
}

