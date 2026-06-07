/**
 * ============================================================================
 * DOCUMENTS PRISMA SERVICE - SOUS-MODULE DOCUMENTS ADMINISTRATIFS
 * ============================================================================
 * 
 * Service pour la gestion des documents administratifs (upload/génération)
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DocumentsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un document pour un élève
   */
  async createStudentDocument(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    studentId: string;
    documentType: string; // BIRTH_CERTIFICATE, ID_CARD, PHOTO, etc.
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    uploadedBy?: string;
  }) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId: data.tenantId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    return this.prisma.studentDocument.create({
      data,
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
   * Récupère tous les documents d'un élève
   */
  async getStudentDocuments(
    studentId: string,
    tenantId: string,
    filters?: {
      documentType?: string;
    }
  ) {
    const where: any = {
      studentId,
      tenantId,
    };

    if (filters?.documentType) {
      where.documentType = filters.documentType;
    }

    return this.prisma.studentDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Supprime un document
   */
  async deleteDocument(id: string, tenantId: string) {
    const document = await this.prisma.studentDocument.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    // TODO: Supprimer le fichier physique du système de fichiers
    // await fs.unlink(document.filePath);

    await this.prisma.studentDocument.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Génère un document administratif (certificat, attestation, etc.)
   */
  async generateDocument(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    studentId?: string;
    documentType: string;
    templateId?: string;
    metadata?: any;
    generatedBy?: string;
  }) {
    // TODO: Implémenter la génération de documents PDF
    // Utiliser un template et remplir avec les données de l'élève

    const fileName = `${data.documentType}_${Date.now()}.pdf`;
    const filePath = `/documents/generated/${fileName}`;

    return this.prisma.generatedDocument.create({
      data: {
        ...data,
        fileName,
        filePath,
        mimeType: 'application/pdf',
      },
      include: {
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Récupère les documents générés
   */
  async getGeneratedDocuments(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      studentId?: string;
      documentType?: string;
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

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters?.documentType) {
      where.documentType = filters.documentType;
    }

    return this.prisma.generatedDocument.findMany({
      where,
      include: {
        academicYear: true,
        schoolLevel: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

