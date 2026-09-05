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
import { AccessScope } from '../common/context/access-scope.service';
import { levelWhere, classTrackWhere } from '../common/context/scope-where';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

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
        ...prismaCreateDefaults(),
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
        ...prismaCreateDefaults(),
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
    filters?: {
      schoolLevelId?: string;
      classId?: string;
      subjectId?: string;
      teacherId?: string;
    },
    scope?: AccessScope | null,
  ) {
    const where: any = {
      tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    // ⭐ FIX 2026-09-06 (F1-pedagogy) : les filtres déclarés sont désormais APPLIQUÉS
    //    (avant : acceptés puis ignorés → tout le tenant était renvoyé).
    //    + périmètre IMPOSÉ par le scope serveur (niveau + piste de l'utilisateur).
    const scopeLvl = levelWhere(scope || undefined);
    if (scopeLvl) {
      where.schoolLevelId = scopeLvl.schoolLevelId;
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
    // Piste : via la classe de la fiche (language/track de la classe)
    const trackBlock = classTrackWhere(scope || undefined);
    if (trackBlock) {
      where.class = trackBlock as any;
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
        ...prismaUpdateDefaults(),
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
        ...prismaCreateDefaults(),
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
        ...prismaUpdateDefaults(),
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
          ...prismaUpdateDefaults(),
          status: 'VALIDATED',
          validatedAt: new Date(),
          validatedBy: validatorId,
        },
      }),
      this.prisma.lessonPlanValidation.create({
        data: {
          ...prismaCreateDefaults(),
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
        ...prismaUpdateDefaults(),
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
