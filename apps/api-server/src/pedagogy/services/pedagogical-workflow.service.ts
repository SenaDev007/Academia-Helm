/**
 * ============================================================================
 * PEDAGOGICAL WORKFLOW SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour le workflow pédagogique enseignant ↔ direction
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PedagogicalAuditService } from './pedagogical-audit.service';


@Injectable()
export class PedagogicalWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PedagogicalAuditService,
  ) {}


  /**
   * Soumet un document pédagogique à la direction
   * Statut: DRAFT → SUBMITTED
   */
  async submitDocument(
    documentId: string,
    tenantId: string,
    teacherId: string,
  ) {
    const document = await this.prisma.pedagogicalDocument.findFirst({
      where: { id: documentId, tenantId, teacherId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot submit document with status ${document.status}. Must be DRAFT.`,
      );
    }

    // Créer une version avant soumission
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
        changes: 'Soumission à la direction',
        createdBy: teacherId,
      },
    });

    // Mettre à jour le statut
    const updated = await this.prisma.pedagogicalDocument.update({
      where: { id: documentId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // Log action
    await this.audit.log({
      tenantId,
      entityType: 'PEDAGOGICAL_DOCUMENT',
      entityId: documentId,
      action: 'SUBMIT',
      performedBy: teacherId,
      newData: { status: 'SUBMITTED' },
    });

    return updated;
  }

  /**
   * Valide un document pédagogique (Direction)
   * Statut: SUBMITTED → APPROVED
   */
  async approveDocument(
    documentId: string,
    tenantId: string,
    directorId: string,
    comments?: string,
    sectionComments?: any,
  ) {
    const document = await this.prisma.pedagogicalDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Cannot approve document with status ${document.status}. Must be SUBMITTED.`,
      );
    }

    // Créer une review
    await this.prisma.pedagogicalDocumentReview.create({
      data: {
        tenantId: document.tenantId,
        academicYearId: document.academicYearId,
        schoolLevelId: document.schoolLevelId,
        documentId,
        reviewerId: directorId,
        decision: 'APPROVED',
        comments,
        sectionComments,
      },
    });

    // Mettre à jour le statut
    const updated = await this.prisma.pedagogicalDocument.update({
      where: { id: documentId },
      data: {
        status: 'APPROVED',
        validatedAt: new Date(),
        validatedBy: directorId,
      },
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
      },
    });

    // Log action
    await this.audit.log({
      tenantId,
      entityType: 'PEDAGOGICAL_DOCUMENT',
      entityId: documentId,
      action: 'APPROVE',
      performedBy: directorId,
      newData: { status: 'APPROVED', comments },
    });

    return updated;
  }

  /**
   * Rejette un document pédagogique (Direction)
   * Statut: SUBMITTED → REJECTED
   * Motif obligatoire
   */
  async rejectDocument(
    documentId: string,
    tenantId: string,
    directorId: string,
    rejectionReason: string,
    comments?: string,
    sectionComments?: any,
  ) {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is mandatory');
    }

    const document = await this.prisma.pedagogicalDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Cannot reject document with status ${document.status}. Must be SUBMITTED.`,
      );
    }

    // Créer une review
    await this.prisma.pedagogicalDocumentReview.create({
      data: {
        tenantId: document.tenantId,
        academicYearId: document.academicYearId,
        schoolLevelId: document.schoolLevelId,
        documentId,
        reviewerId: directorId,
        decision: 'REJECTED',
        comments,
        sectionComments,
      },
    });

    // Mettre à jour le statut
    const updated = await this.prisma.pedagogicalDocument.update({
      where: { id: documentId },
      data: {
        status: 'REJECTED',
        validatedAt: new Date(),
        validatedBy: directorId,
        rejectionReason,
      },
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
      },
    });

    // Log action
    await this.audit.log({
      tenantId,
      entityType: 'PEDAGOGICAL_DOCUMENT',
      entityId: documentId,
      action: 'REJECT',
      performedBy: directorId,
      newData: { status: 'REJECTED', rejectionReason, comments },
    });

    return updated;
  }


  /**
   * Prend en compte un cahier de textes (Direction)
   * Statut: SUBMITTED → ACKNOWLEDGED
   * Pas de rejet pour les cahiers de textes
   */
  async acknowledgeDocument(
    documentId: string,
    tenantId: string,
    directorId: string,
    comments?: string,
  ) {
    const document = await this.prisma.pedagogicalDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    // Vérifier que c'est un cahier de textes
    if (document.documentType !== 'CAHIER_TEXTE') {
      throw new BadRequestException(
        'Acknowledgment is only for cahier de textes. Use approve/reject for other documents.',
      );
    }

    if (document.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Cannot acknowledge document with status ${document.status}. Must be SUBMITTED.`,
      );
    }

    // Mettre à jour le statut
    const updated = await this.prisma.pedagogicalDocument.update({
      where: { id: documentId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: directorId,
      },
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
      },
    });

    // Ajouter un commentaire si fourni
    if (comments) {
      await this.prisma.pedagogicalDocumentComment.create({
        data: {
          tenantId: document.tenantId,
          academicYearId: document.academicYearId,
          schoolLevelId: document.schoolLevelId,
          documentId,
          authorId: directorId,
          authorRole: 'DIRECTOR',
          comment: comments,
        },
      });
    }

    return updated;
  }

  /**
   * Ajoute un commentaire à un document
   * Enseignant ↔ Direction
   */
  async addComment(
    documentId: string,
    tenantId: string,
    authorId: string,
    authorRole: 'TEACHER' | 'DIRECTOR',
    comment: string,
    section?: string,
  ) {
    const document = await this.prisma.pedagogicalDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    // Vérifier les permissions
    if (authorRole === 'TEACHER' && document.teacherId !== authorId) {
      throw new ForbiddenException('You can only comment on your own documents');
    }

    return this.prisma.pedagogicalDocumentComment.create({
      data: {
        tenantId: document.tenantId,
        academicYearId: document.academicYearId,
        schoolLevelId: document.schoolLevelId,
        documentId,
        authorId,
        authorRole,
        comment,
        section,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Récupère les commentaires d'un document
   */
  async getComments(documentId: string, tenantId: string) {
    const document = await this.prisma.pedagogicalDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    return this.prisma.pedagogicalDocumentComment.findMany({
      where: { documentId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Récupère l'historique des versions d'un document
   */
  async getDocumentVersions(documentId: string, tenantId: string) {
    const document = await this.prisma.pedagogicalDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    return this.prisma.pedagogicalDocumentVersion.findMany({
      where: { documentId },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Récupère les reviews d'un document
   */
  async getDocumentReviews(documentId: string, tenantId: string) {
    const document = await this.prisma.pedagogicalDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    return this.prisma.pedagogicalDocumentReview.findMany({
      where: { documentId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
    });
  }
}

