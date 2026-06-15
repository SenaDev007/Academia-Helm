/**
 * ============================================================================
 * PEDAGOGY PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour les habilitations et affectations pédagogiques
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class PedagogyPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une habilitation enseignant/matière
   */
  async createTeacherSubject(data: {
    tenantId: string;
    teacherId: string;
    subjectId: string;
    academicYearId: string;
  }) {
    // Vérifier que l'enseignant existe
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: data.teacherId, tenantId: data.tenantId },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${data.teacherId} not found`);
    }

    // Vérifier que la matière existe
    const subject = await this.prisma.subject.findFirst({
      where: { id: data.subjectId, tenantId: data.tenantId },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${data.subjectId} not found`);
    }

    // Vérifier l'unicité
    const existing = await this.prisma.teacherSubject.findFirst({
      where: {
        teacherId: data.teacherId,
        subjectId: data.subjectId,
        academicYearId: data.academicYearId,
      },
    });

    if (existing) {
      throw new BadRequestException('Teacher subject assignment already exists');
    }

    return this.prisma.teacherSubject.create({
      data: {
        ...prismaCreateDefaults(),
        ...data,
      },
      include: {
        teacher: true,
        subject: true,
        academicYear: true,
      },
    });
  }

  /**
   * Création en masse d'affectations classe/matière
   */
  async createBulkClassSubjects(
    tenantId: string,
    academicYearId: string,
    data: {
      classIds: string[];
      subjectIds: string[];
      weeklyHours?: number;
      coefficient?: number;
      useSeriesCoefficients?: boolean;
    }
  ) {
    const results = [];

    for (const classId of data.classIds) {
      // Récupérer les détails de la classe (pour la série)
      const academicClass = await this.prisma.academicClass.findFirst({
        where: { id: classId, tenantId },
        include: { 
          series: { 
            include: { 
              seriesSubjects: true 
            } 
          } 
        }
      });

      for (const subjectId of data.subjectIds) {
        let coeff = data.coefficient ?? 1.0;
        let hours = data.weeklyHours ?? 0;

        // Si la classe a une série et qu'on demande d'utiliser les coefficients de série
        if (data.useSeriesCoefficients && academicClass?.series) {
          const seriesSub = academicClass.series.seriesSubjects.find(ss => ss.subjectId === subjectId);
          if (seriesSub) {
            coeff = seriesSub.coefficient;
            hours = seriesSub.weeklyHours;
          }
        }

        // Check if assignment already exists
        const existing = await this.prisma.classSubject.findFirst({
          where: { tenantId, academicYearId, academicClassId: classId, subjectId }
        });

        if (existing) {
          // Update existing
          const updated = await this.prisma.classSubject.update({
            where: { id: existing.id },
            data: {
              ...prismaUpdateDefaults(),
              weeklyHours: hours,
              coefficient: coeff,
            },
          });
          results.push(updated);
        } else {
          // Create new
          const created = await this.prisma.classSubject.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId,
              academicYearId,
              academicClassId: classId,
              subjectId,
              weeklyHours: hours,
              coefficient: coeff,
            },
          });
          results.push(created);
        }
      }
    }

    return results;
  }


  /**
   * Crée une affectation enseignant/classe/matière
   */
  async createTeacherClassAssignment(data: {
    tenantId: string;
    teacherId: string;
    classSubjectId: string;
    academicYearId: string;
  }) {
    // Vérifier que l'enseignant existe
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: data.teacherId, tenantId: data.tenantId },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${data.teacherId} not found`);
    }

    // Vérifier que l'affectation classe/matière existe
    const classSubject = await this.prisma.classSubject.findFirst({
      where: { id: data.classSubjectId, tenantId: data.tenantId },
    });

    if (!classSubject) {
      throw new NotFoundException(`ClassSubject with ID ${data.classSubjectId} not found`);
    }

    // Vérifier l'unicité
    const existing = await this.prisma.teacherClassAssignment.findFirst({
      where: {
        teacherId: data.teacherId,
        classSubjectId: data.classSubjectId,
        academicYearId: data.academicYearId,
      },
    });

    if (existing) {
      throw new BadRequestException('Teacher class assignment already exists');
    }

    return this.prisma.teacherClassAssignment.create({
      data: {
        ...prismaCreateDefaults(),
        ...data,
      },
      include: {
        teacher: true,
        classSubject: {
          include: {
            class: true,
            subject: true,
          },
        },
        academicYear: true,
      },
    });
  }

  /**
   * Récupère les habilitations d'un enseignant
   */
  async getTeacherSubjects(teacherId: string, tenantId: string, academicYearId?: string) {
    const where: any = {
      teacherId,
      tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    return this.prisma.teacherSubject.findMany({
      where,
      include: {
        subject: true,
        academicYear: true,
      },
    });
  }

  /**
   * Récupère les affectations d'une classe
   */
  async getClassSubjects(classId: string, tenantId: string, academicYearId?: string) {
    const where: any = {
      classId,
      tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    return this.prisma.classSubject.findMany({
      where,
      include: {
        subject: true,
        academicYear: true,
        assignments: {
          include: {
            teacher: true,
          },
        },
      },
    });
  }

  /**
   * Supprime une habilitation
   */
  async removeTeacherSubject(id: string, tenantId: string) {
    const teacherSubject = await this.prisma.teacherSubject.findFirst({
      where: { id, tenantId },
    });

    if (!teacherSubject) {
      throw new NotFoundException(`TeacherSubject with ID ${id} not found`);
    }

    await this.prisma.teacherSubject.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Supprime une affectation classe/matière
   */
  async removeClassSubject(id: string, tenantId: string) {
    const classSubject = await this.prisma.classSubject.findFirst({
      where: { id, tenantId },
    });

    if (!classSubject) {
      throw new NotFoundException(`ClassSubject with ID ${id} not found`);
    }

    await this.prisma.classSubject.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Supprime une affectation enseignant/classe/matière
   */
  async removeTeacherClassAssignment(id: string, tenantId: string) {
    const assignment = await this.prisma.teacherClassAssignment.findFirst({
      where: { id, tenantId },
    });

    if (!assignment) {
      throw new NotFoundException(`TeacherClassAssignment with ID ${id} not found`);
    }

    await this.prisma.teacherClassAssignment.delete({
      where: { id },
    });

    return { success: true };
  }
}

