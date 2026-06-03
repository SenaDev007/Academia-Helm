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
  async createLessonPlan(
    tenantId: string,
    data: {
      academicYearId: string;
      schoolLevelId: string;
      academicTrackId?: string;
      classId: string;
      subjectId: string;
      teacherId?: string;
      title: string;
      objectives?: string;
      content: string;
      methodology?: string;
      materials?: string;
      evaluation?: string;
    },
  ) {
    const lessonPlan = await this.prisma.lessonPlan.create({
      data: {
        ...data,
        tenantId,
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
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        lessonPlanId: lessonPlan.id,
        versionNumber: 1,
        content: lessonPlan.content,
        changes: 'Initial creation',
        createdBy: data.teacherId,
      },
    });

    return lessonPlan;
  }

  /**
   * Récupère toutes les fiches pédagogiques avec filtres avancés
   */
  async findAllLessonPlans(
    tenantId: string,
    academicYearId?: string,
  ) {
    const where: any = {
      tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

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
    },
  ) {
    const current = await this.findLessonPlanById(id, tenantId);

    const newVersionNumber = current.version + 1;

    const updated = await this.prisma.lessonPlan.update({
      where: { id },
      data: {
        title: data.title,
        objectives: data.objectives,
        content: data.content,
        methodology: data.methodology,
        materials: data.materials,
        evaluation: data.evaluation,
        version: newVersionNumber,
        status: 'DRAFT',
      },
    });

    // Create new version entry
    await this.prisma.lessonPlanVersion.create({
      data: {
        tenantId,
        academicYearId: current.academicYearId,
        schoolLevelId: current.schoolLevelId,
        lessonPlanId: id,
        versionNumber: newVersionNumber,
        content: updated.content,
        changes: data.changeReason || `Update to version ${newVersionNumber}`,
        createdBy: current.teacherId,
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
   * Valide une fiche pédagogique
   */
  async validateLessonPlan(id: string, tenantId: string, validatorId: string) {
    const lessonPlan = await this.findLessonPlanById(id, tenantId);

    const [updatedPlan, validation] = await this.prisma.$transaction([
      this.prisma.lessonPlan.update({
        where: { id },
        data: {
          status: 'VALIDATED',
          validatedAt: new Date(),
          validatedBy: validatorId,
        },
      }),
      this.prisma.lessonPlanValidation.create({
        data: {
          tenantId,
          academicYearId: lessonPlan.academicYearId,
          schoolLevelId: lessonPlan.schoolLevelId,
          lessonPlanId: id,
          validatorId,
          status: 'VALIDATED',
          validatedAt: new Date(),
        },
      }),
    ]);

    return { updatedPlan, validation };
  }

  /**
   * Publie une fiche pédagogique
   */
  async publishLessonPlan(id: string, tenantId: string) {
    await this.findLessonPlanById(id, tenantId);

    return this.prisma.lessonPlan.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
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
