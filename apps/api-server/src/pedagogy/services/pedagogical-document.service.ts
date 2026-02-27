/**
 * ============================================================================
 * PEDAGOGICAL DOCUMENT SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service CRUD pour les documents pédagogiques
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PedagogicalDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un document pédagogique (Enseignant)
   */
  async createDocument(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    teacherId: string,
    data: {
      classId?: string;
      subjectId?: string;
      documentType: 'FICHE_PEDAGOGIQUE' | 'CAHIER_JOURNAL' | 'CAHIER_TEXTE' | 'SEMAINIER';
      title: string;
      description?: string;
      content: string;
      period?: string;
      weekStartDate?: Date;
      weekEndDate?: Date;
    },
  ) {
    // Vérifier que l'enseignant appartient au tenant et niveau
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id: teacherId,
        tenantId,
        schoolLevelId,
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
    }

    return this.prisma.pedagogicalDocument.create({
      data: {
        tenantId,
        academicYearId,
        schoolLevelId,
        teacherId,
        classId: data.classId,
        subjectId: data.subjectId,
        documentType: data.documentType,
        title: data.title,
        description: data.description,
        content: data.content,
        period: data.period,
        weekStartDate: data.weekStartDate,
        weekEndDate: data.weekEndDate,
        status: 'DRAFT',
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Récupère tous les documents d'un enseignant
   */
  async findTeacherDocuments(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    teacherId: string,
    filters?: {
      documentType?: string;
      status?: string;
      classId?: string;
      subjectId?: string;
    },
  ) {
    const where: any = {
      tenantId,
      academicYearId,
      schoolLevelId,
      teacherId,
    };

    if (filters?.documentType) {
      where.documentType = filters.documentType;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.classId) {
      where.classId = filters.classId;
    }
    if (filters?.subjectId) {
      where.subjectId = filters.subjectId;
    }

    return this.prisma.pedagogicalDocument.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            comments: true,
            reviews: true,
            versions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère un document par ID
   */
  async findDocumentById(documentId: string, tenantId: string, teacherId?: string) {
    const where: any = { id: documentId, tenantId };
    
    // Si teacherId fourni, vérifier que c'est son document
    if (teacherId) {
      where.teacherId = teacherId;
    }

    const document = await this.prisma.pedagogicalDocument.findFirst({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        acknowledger: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            comments: true,
            reviews: true,
            versions: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    return document;
  }

  /**
   * Met à jour un document (seulement si DRAFT)
   */
  async updateDocument(
    documentId: string,
    tenantId: string,
    teacherId: string,
    data: {
      title?: string;
      description?: string;
      content?: string;
      period?: string;
      weekStartDate?: Date;
      weekEndDate?: Date;
    },
  ) {
    const document = await this.findDocumentById(documentId, tenantId, teacherId);

    if (document.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot update document with status ${document.status}. Only DRAFT documents can be updated.`,
      );
    }

    // Créer une version avant modification si le contenu change
    if (data.content && data.content !== document.content) {
      const versionCount = await this.prisma.pedagogicalDocumentVersion.count({
        where: { documentId },
      });

      await this.prisma.pedagogicalDocumentVersion.create({
        data: {
          tenantId: document.tenantId,
          academicYearId: document.academicYearId,
          schoolLevelId: document.schoolLevelId,
          documentId,
          versionNumber: versionCount + 1,
          content: document.content,
          changes: 'Modification avant soumission',
          createdBy: teacherId,
        },
      });
    }

    return this.prisma.pedagogicalDocument.update({
      where: { id: documentId },
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        period: data.period,
        weekStartDate: data.weekStartDate,
        weekEndDate: data.weekEndDate,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Supprime un document (seulement si DRAFT)
   */
  async deleteDocument(documentId: string, tenantId: string, teacherId: string) {
    const document = await this.findDocumentById(documentId, tenantId, teacherId);

    if (document.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot delete document with status ${document.status}. Only DRAFT documents can be deleted.`,
      );
    }

    return this.prisma.pedagogicalDocument.delete({
      where: { id: documentId },
    });
  }

  /**
   * Récupère les documents soumis à la direction (Espace Direction)
   */
  async findSubmittedDocuments(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
    filters?: {
      documentType?: string;
      status?: string;
      teacherId?: string;
      classId?: string;
    },
  ) {
    const where: any = {
      tenantId,
      academicYearId,
      status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED', 'ACKNOWLEDGED'] },
    };

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }
    if (filters?.documentType) {
      where.documentType = filters.documentType;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.teacherId) {
      where.teacherId = filters.teacherId;
    }
    if (filters?.classId) {
      where.classId = filters.classId;
    }

    return this.prisma.pedagogicalDocument.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        acknowledger: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            comments: true,
            reviews: true,
            versions: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Récupère les statistiques des documents
   */
  async getDocumentStats(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
    teacherId?: string,
  ) {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }
    if (teacherId) {
      where.teacherId = teacherId;
    }

    const documents = await this.prisma.pedagogicalDocument.findMany({
      where,
      select: {
        documentType: true,
        status: true,
        submittedAt: true,
      },
    });

    const stats = {
      total: documents.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      submitted: documents.filter((d) => d.status === 'SUBMITTED').length,
      approved: documents.filter((d) => d.status === 'APPROVED').length,
      rejected: documents.filter((d) => d.status === 'REJECTED').length,
      acknowledged: documents.filter((d) => d.status === 'ACKNOWLEDGED').length,
      pendingValidation: documents.filter((d) => d.status === 'SUBMITTED').length,
    };

    documents.forEach((doc) => {
      stats.byType[doc.documentType] = (stats.byType[doc.documentType] || 0) + 1;
      stats.byStatus[doc.status] = (stats.byStatus[doc.status] || 0) + 1;
    });

    return stats;
  }
}

