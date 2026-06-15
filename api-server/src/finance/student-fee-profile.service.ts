/**
 * ============================================================================
 * STUDENT FEE PROFILE SERVICE - AFFECTATION RÉGIMES AUX ÉLÈVES
 * ============================================================================
 * 
 * Service pour affecter un régime tarifaire à un élève pour une année scolaire
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class StudentFeeProfileService {
  private readonly logger = new Logger(StudentFeeProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour le profil tarifaire d'un élève
   */
  async upsertProfile(
    studentId: string,
    academicYearId: string,
    data: {
      feeRegimeId: string;
      justification?: string;
      validatedBy?: string;
    },
  ) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException(`Élève ${studentId} non trouvé`);
    }

    // Vérifier que le régime existe
    const regime = await this.prisma.feeRegime.findUnique({
      where: { id: data.feeRegimeId },
    });

    if (!regime) {
      throw new NotFoundException(`Régime tarifaire ${data.feeRegimeId} non trouvé`);
    }

    // Vérifier que le régime correspond au niveau de l'élève
    if (regime.schoolLevelId !== student.schoolLevelId) {
      throw new BadRequestException(
        'Le régime tarifaire ne correspond pas au niveau scolaire de l\'élève',
      );
    }

    // Vérifier que l'année scolaire correspond
    if (regime.academicYearId !== academicYearId) {
      throw new BadRequestException(
        'Le régime tarifaire ne correspond pas à l\'année scolaire',
      );
    }

    // Si réduction, justification obligatoire
    if (regime.code === 'REDUCTION' && !data.justification) {
      throw new BadRequestException(
        'Une justification est obligatoire pour les réductions',
      );
    }

    // Créer ou mettre à jour le profil
    const profile = await this.prisma.studentFeeProfile.upsert({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
      create: {
        studentId,
        academicYearId,
        feeRegimeId: data.feeRegimeId,
        justification: data.justification,
        validatedBy: data.validatedBy,
        validatedAt: data.validatedBy ? new Date() : null,
      },
      update: {
        feeRegimeId: data.feeRegimeId,
        justification: data.justification,
        validatedBy: data.validatedBy,
        validatedAt: data.validatedBy ? new Date() : null,
      },
      include: {
        feeRegime: {
          include: {
            rules: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Profil tarifaire ${profile.id} créé/mis à jour pour élève ${studentId}`,
    );

    return profile;
  }

  /**
   * Récupère le profil tarifaire d'un élève pour une année
   */
  async getProfile(studentId: string, academicYearId: string) {
    const profile = await this.prisma.studentFeeProfile.findUnique({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
      include: {
        feeRegime: {
          include: {
            rules: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!profile) {
      // Retourner le régime par défaut si aucun profil
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: { schoolLevel: true },
      });

      if (!student) {
        throw new NotFoundException(`Élève ${studentId} non trouvé`);
      }

      const defaultRegime = await this.prisma.feeRegime.findFirst({
        where: {
          tenantId: student.tenantId,
          academicYearId,
          schoolLevelId: student.schoolLevelId,
          isDefault: true,
        },
        include: {
          rules: true,
        },
      });

      return {
        id: null,
        studentId,
        academicYearId,
        feeRegime: defaultRegime || null,
        feeRegimeId: defaultRegime?.id || null,
        justification: null,
        validatedBy: null,
        validatedAt: null,
        isDefault: true,
      };
    }

    return profile;
  }

  /**
   * Valide un profil tarifaire (par directeur/admin)
   */
  async validateProfile(
    studentId: string,
    academicYearId: string,
    validatedBy: string,
  ) {
    const profile = await this.prisma.studentFeeProfile.findUnique({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profil tarifaire non trouvé');
    }

    return this.prisma.studentFeeProfile.update({
      where: { id: profile.id },
      data: {
        validatedBy,
        validatedAt: new Date(),
      },
      include: {
        feeRegime: {
          include: {
            rules: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Récupère tous les profils d'un élève (historique)
   */
  async getStudentProfiles(studentId: string) {
    return this.prisma.studentFeeProfile.findMany({
      where: { studentId },
      include: {
        feeRegime: {
          include: {
            rules: true,
          },
        },
        academicYear: true,
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        academicYear: {
          startDate: 'desc',
        },
      },
    });
  }
}

