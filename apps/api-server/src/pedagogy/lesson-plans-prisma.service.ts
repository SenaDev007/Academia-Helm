/**
 * ============================================================================
 * LESSON PLANS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des fiches pédagogiques
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LessonPlansPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une fiche pédagogique
   */
  async createLessonPlan(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    classId?: string;
    subjectId?: string;
    date: Date;
    title: string;
    content: string;
    homework?: string;
    attachments?: string[];
    teacherId?: string;
  }) {
    return this.prisma.lessonPlan.create({
      data: {
        ...data,
        attachments: data.attachments || [],
      },
      include: {
        class: true,
        subject: true,
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Récupère toutes les fiches pédagogiques
   */
  async findAllLessonPlans(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      classId?: string;
      subjectId?: string;
      teacherId?: string;
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

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.subjectId) {
      where.subjectId = filters.subjectId;
    }

    if (filters?.teacherId) {
      where.teacherId = filters.teacherId;
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

    return this.prisma.lessonPlan.findMany({
      where,
      include: {
        class: true,
        subject: true,
        academicYear: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Récupère une fiche pédagogique par ID
   */
  async findLessonPlanById(id: string, tenantId: string) {
    const lessonPlan = await this.prisma.lessonPlan.findFirst({
      where: { id, tenantId },
      include: {
        class: true,
        subject: true,
        academicYear: true,
        schoolLevel: true,
        assignments: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!lessonPlan) {
      throw new NotFoundException(`LessonPlan with ID ${id} not found`);
    }

    return lessonPlan;
  }

  /**
   * Met à jour une fiche pédagogique
   */
  async updateLessonPlan(
    id: string,
    tenantId: string,
    data: {
      title?: string;
      content?: string;
      homework?: string;
      attachments?: string[];
      date?: Date;
    }
  ) {
    await this.findLessonPlanById(id, tenantId);

    return this.prisma.lessonPlan.update({
      where: { id },
      data,
      include: {
        class: true,
        subject: true,
      },
    });
  }

  /**
   * Publie une fiche pédagogique
   */
  async publishLessonPlan(id: string, tenantId: string) {
    const lessonPlan = await this.findLessonPlanById(id, tenantId);

    return this.prisma.lessonPlan.update({
      where: { id },
      data: {
        publishedAt: new Date(),
      },
    });
  }

  /**
   * Supprime une fiche pédagogique
   */
  async deleteLessonPlan(id: string, tenantId: string) {
    await this.findLessonPlanById(id, tenantId);

    await this.prisma.lessonPlan.delete({
      where: { id },
    });

    return { success: true };
  }
}

