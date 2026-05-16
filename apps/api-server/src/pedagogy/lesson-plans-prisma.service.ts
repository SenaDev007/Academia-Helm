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
   * Crée une fiche pédagogique (Initial version)
   */
  async createLessonPlan(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    title: string;
    objectives?: string;
    content: string;
    methodology?: string;
    materials?: string;
    evaluation?: string;
  }) {
    const lessonPlan = await this.prisma.lessonPlan.create({
      data: {
        ...data,
        status: 'DRAFT',
        version: 1,
      },
      include: {
        class: true,
        subject: true,
        academicYear: true,
        schoolLevel: true,
        teacher: true,
      },
    });

    // Create initial version
    await this.prisma.lessonPlanVersion.create({
      data: {
        lessonPlanId: lessonPlan.id,
        versionNumber: 1,
        content: lessonPlan.content,
        objectives: lessonPlan.objectives,
        methodology: lessonPlan.methodology,
        materials: lessonPlan.materials,
        evaluation: lessonPlan.evaluation,
        changeReason: 'Initial creation',
      },
    });

    return lessonPlan;
  }

  /**
   * Récupère toutes les fiches pédagogiques avec filtres avancés
   */
  async findAllLessonPlans(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      classId?: string;
      subjectId?: string;
      teacherId?: string;
      status?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') where.schoolLevelId = filters.schoolLevelId;
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.status) where.status = filters.status;

    return this.prisma.lessonPlan.findMany({
      where,
      include: {
        class: true,
        subject: true,
        teacher: true,
        academicYear: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Récupère une fiche pédagogique complète avec versions et validations
   */
  async findLessonPlanById(id: string, tenantId: string) {
    const lessonPlan = await this.prisma.lessonPlan.findFirst({
      where: { id, tenantId },
      include: {
        class: true,
        subject: true,
        teacher: true,
        academicYear: true,
        schoolLevel: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        validations: {
          include: {
            validator: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lessonPlan) {
      throw new NotFoundException(`LessonPlan with ID ${id} not found`);
    }

    return lessonPlan;
  }

  /**
   * Met à jour une fiche pédagogique et crée une nouvelle version
   */
  async updateLessonPlan(
    id: string,
    tenantId: string,
    data: {
      title?: string;
      objectives?: string;
      content?: string;
      methodology?: string;
      materials?: string;
      evaluation?: string;
      changeReason?: string;
    }
  ) {
    const current = await this.findLessonPlanById(id, tenantId);

    const newVersionNumber = current.version + 1;

    const updated = await this.prisma.lessonPlan.update({
      where: { id },
      data: {
        ...data,
        version: newVersionNumber,
        status: 'DRAFT', // Reverts to draft on update if it was approved?
      },
    });

    // Create new version entry
    await this.prisma.lessonPlanVersion.create({
      data: {
        lessonPlanId: id,
        versionNumber: newVersionNumber,
        content: updated.content,
        objectives: updated.objectives,
        methodology: updated.methodology,
        materials: updated.materials,
        evaluation: updated.evaluation,
        changeReason: data.changeReason || `Update to version ${newVersionNumber}`,
      },
    });

    return updated;
  }

  /**
   * Soumet une fiche pour validation
   */
  async submitLessonPlan(id: string, tenantId: string) {
    await this.findLessonPlanById(id, tenantId);

    return this.prisma.lessonPlan.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }

  /**
   * Valide ou rejette une fiche pédagogique
   */
  async validateLessonPlan(
    id: string,
    tenantId: string,
    data: {
      status: 'APPROVED' | 'REJECTED';
      comment?: string;
      validatorId: string;
    }
  ) {
    await this.findLessonPlanById(id, tenantId);

    const [updatedPlan, validation] = await this.prisma.$transaction([
      this.prisma.lessonPlan.update({
        where: { id },
        data: {
          status: data.status,
          approvedAt: data.status === 'APPROVED' ? new Date() : null,
          approvedById: data.status === 'APPROVED' ? data.validatorId : null,
        },
      }),
      this.prisma.lessonPlanValidation.create({
        data: {
          lessonPlanId: id,
          status: data.status,
          comment: data.comment,
          validatedBy: data.validatorId,
        },
      }),
    ]);

    return { updatedPlan, validation };
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

