/**
 * ============================================================================
 * TRANSFERS PRISMA SERVICE - SOUS-MODULE TRANSFERTS
 * ============================================================================
 * 
 * Service pour la gestion des transferts (changements de classe)
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TransfersPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une demande de transfert
   */
  async createTransferRequest(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId?: string;
    studentId: string;
    fromClassId: string;
    toClassId: string;
    reason?: string;
    requestedBy?: string;
  }) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId: data.tenantId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    // Vérifier que les classes existent
    const [fromClass, toClass] = await Promise.all([
      this.prisma.class.findFirst({
        where: { id: data.fromClassId, tenantId: data.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: data.toClassId, tenantId: data.tenantId },
      }),
    ]);

    if (!fromClass) {
      throw new NotFoundException(`Class with ID ${data.fromClassId} not found`);
    }

    if (!toClass) {
      throw new NotFoundException(`Class with ID ${data.toClassId} not found`);
    }

    if (fromClass.id === toClass.id) {
      throw new BadRequestException('Cannot transfer to the same class');
    }

    // Vérifier que l'élève est bien dans la classe source
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        classId: data.fromClassId,
        academicYearId: data.academicYearId,
        status: { in: ['ACTIVE', 'VALIDATED'] },
      },
    });

    if (!enrollment) {
      throw new BadRequestException('Student is not enrolled in the source class');
    }

    // Créer la demande de transfert
    return this.prisma.transferRequest.create({
      data: {
        ...data,
        status: 'PENDING',
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
      },
    });
  }

  /**
   * Approuve une demande de transfert
   */
  async approveTransfer(
    transferId: string,
    tenantId: string,
    approvedBy: string
  ) {
    const transfer = await this.prisma.transferRequest.findFirst({
      where: { id: transferId, tenantId },
      include: {
        student: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`TransferRequest with ID ${transferId} not found`);
    }

    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(`Transfer is already ${transfer.status}`);
    }

    // Mettre à jour l'inscription actuelle
    await this.prisma.studentEnrollment.updateMany({
      where: {
        studentId: transfer.studentId,
        classId: transfer.fromClassId,
        academicYearId: transfer.academicYearId,
        status: { in: ['ACTIVE', 'VALIDATED'] },
      },
      data: {
        status: 'TRANSFERRED',
        exitDate: new Date(),
        exitReason: `Transfert vers ${transfer.toClassId}`,
      },
    });

    // Créer la nouvelle inscription
    await this.prisma.studentEnrollment.create({
      data: {
        tenantId: transfer.tenantId,
        academicYearId: transfer.academicYearId,
        schoolLevelId: transfer.schoolLevelId || transfer.student.schoolLevelId,
        studentId: transfer.studentId,
        classId: transfer.toClassId,
        enrollmentType: 'TRANSFER',
        enrollmentDate: new Date(),
        status: 'VALIDATED',
      },
    });

    // Créer l'enregistrement de transfert
    await this.prisma.classTransfer.create({
      data: {
        tenantId: transfer.tenantId,
        academicYearId: transfer.academicYearId,
        schoolLevelId: transfer.schoolLevelId || transfer.student.schoolLevelId,
        studentId: transfer.studentId,
        fromClassId: transfer.fromClassId,
        toClassId: transfer.toClassId,
        transferDate: new Date(),
        reason: transfer.reason,
        approvedBy,
      },
    });

    // Mettre à jour la demande
    return this.prisma.transferRequest.update({
      where: { id: transferId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
      include: {
        student: true,
      },
    });
  }

  /**
   * Rejette une demande de transfert
   */
  async rejectTransfer(
    transferId: string,
    tenantId: string,
    reason?: string
  ) {
    const transfer = await this.prisma.transferRequest.findFirst({
      where: { id: transferId, tenantId },
    });

    if (!transfer) {
      throw new NotFoundException(`TransferRequest with ID ${transferId} not found`);
    }

    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(`Transfer is already ${transfer.status}`);
    }

    return this.prisma.transferRequest.update({
      where: { id: transferId },
      data: {
        status: 'REJECTED',
        reason: reason, // TransferRequest a 'reason' pas 'exitReason'
      },
    });
  }

  /**
   * Récupère les transferts d'un élève
   */
  async getStudentTransfers(studentId: string, tenantId: string) {
    return this.prisma.transferRequest.findMany({
      where: {
        studentId,
        tenantId,
      },
      include: {
        academicYear: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère tous les transferts (filtres)
   */
  async getAllTransfers(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      status?: string;
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

    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.transferRequest.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        academicYear: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

