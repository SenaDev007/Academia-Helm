/**
 * ============================================================================
 * GUARDIANS PRISMA SERVICE - SOUS-MODULE RESPONSABLES LÉGAUX
 * ============================================================================
 * 
 * Service pour la gestion des responsables légaux (guardians)
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GuardiansPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un responsable légal et l'associe à un élève
   */
  async createGuardianForStudent(data: {
    tenantId: string;
    studentId: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    relationship: string; // MOTHER, FATHER, GUARDIAN, etc.
    address?: string;
    isPrimary?: boolean;
  }) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId: data.tenantId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    // Si c'est le responsable principal, désactiver les autres
    if (data.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: {
          studentId: data.studentId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Créer ou trouver le guardian
    let guardian = await this.prisma.guardian.findFirst({
      where: {
        tenantId: data.tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
      },
    });

    if (!guardian) {
      guardian = await this.prisma.guardian.create({
        data: {
          tenantId: data.tenantId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          relationship: data.relationship,
          address: data.address,
        },
      });
    }

    // Créer la relation
    const studentGuardian = await this.prisma.studentGuardian.create({
      data: {
        tenantId: data.tenantId,
        studentId: data.studentId,
        guardianId: guardian.id,
        relationship: data.relationship,
        isPrimary: data.isPrimary || false,
      },
      include: {
        guardian: true,
        student: true,
      },
    });

    return studentGuardian;
  }

  /**
   * Récupère tous les responsables d'un élève
   */
  async getStudentGuardians(studentId: string, tenantId: string) {
    return this.prisma.studentGuardian.findMany({
      where: {
        studentId,
        tenantId,
      },
      include: {
        guardian: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Met à jour un responsable légal
   */
  async updateGuardian(
    guardianId: string,
    tenantId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      address?: string;
    }
  ) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: guardianId, tenantId },
    });

    if (!guardian) {
      throw new NotFoundException(`Guardian with ID ${guardianId} not found`);
    }

    return this.prisma.guardian.update({
      where: { id: guardianId },
      data,
      include: {
        studentGuardians: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  /**
   * Met à jour la relation élève-responsable
   */
  async updateStudentGuardian(
    studentGuardianId: string,
    tenantId: string,
    data: {
      relationship?: string;
      isPrimary?: boolean;
    }
  ) {
    const studentGuardian = await this.prisma.studentGuardian.findFirst({
      where: { id: studentGuardianId, tenantId },
    });

    if (!studentGuardian) {
      throw new NotFoundException(`StudentGuardian with ID ${studentGuardianId} not found`);
    }

    // Si on définit comme principal, désactiver les autres
    if (data.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: {
          studentId: studentGuardian.studentId,
          id: { not: studentGuardianId },
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.studentGuardian.update({
      where: { id: studentGuardianId },
      data,
      include: {
        guardian: true,
        student: true,
      },
    });
  }

  /**
   * Supprime la relation élève-responsable (pas de suppression du guardian)
   */
  async removeStudentGuardian(studentGuardianId: string, tenantId: string) {
    const studentGuardian = await this.prisma.studentGuardian.findFirst({
      where: { id: studentGuardianId, tenantId },
    });

    if (!studentGuardian) {
      throw new NotFoundException(`StudentGuardian with ID ${studentGuardianId} not found`);
    }

    await this.prisma.studentGuardian.delete({
      where: { id: studentGuardianId },
    });

    return { success: true };
  }
}

