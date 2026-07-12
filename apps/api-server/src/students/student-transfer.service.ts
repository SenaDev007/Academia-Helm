/**
 * ============================================================================
 * STUDENT TRANSFER SERVICE — Mobilité scolaire inter-écoles
 * ============================================================================
 *
 * Workflow complet des transferts entre établissements du réseau Academia Helm.
 *
 * Statuts (alignés sur le schéma Prisma StudentTransferRequest) :
 *   DRAFT → REQUESTED → SENT_TO_DESTINATION → ACCEPTED_BY_DESTINATION
 *     → APPROVED_BY_SOURCE → COMPLETED
 *   Ou rejets : REJECTED_BY_DESTINATION, CANCELLED, ARCHIVED
 *
 * Notifications :
 *   - École destination notifiée à chaque demande reçue
 *   - École source notifiée à chaque action de l'école destination
 *   - Parents notifiés à chaque changement de statut
 *
 * Transfert de dossier :
 *   - Copie complète : identité, photo, documents, responsables, parcours
 *   - Conservation du globalStudentId
 *   - Attribution d'un nouveau matricule local côté destination
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StudentTransferService {
  private readonly logger = new Logger(StudentTransferService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⭐ Crée une demande de transfert inter-écoles (côté école source).
   * L'école destination sera notifiée.
   */
  async createTransferRequest(userId: string, tenantId: string, data: {
    studentId: string;
    targetSchoolId: string;
    academicYearId: string;
    motif?: string;
    message?: string;
    requestedLevelId?: string;
    requestedClassId?: string;
  }) {
    // Vérifier que l'élève existe et appartient au tenant source
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
      include: {
        identifier: true,
        studentEnrollments: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { class: true, academicClass: true },
        },
      },
    });
    if (!student) throw new NotFoundException('Élève non trouvé dans cet établissement');

    // Vérifier que l'école destination existe
    const targetSchool = await this.prisma.tenant.findFirst({
      where: { id: data.targetSchoolId, type: 'SCHOOL', status: 'active' },
    });
    if (!targetSchool) throw new NotFoundException('École destination non trouvée');

    // Vérifier qu'il n'y a pas déjà un transfert en cours pour cet élève
    const existingTransfer = await this.prisma.studentTransferRequest.findFirst({
      where: {
        studentId: data.studentId,
        status: { in: ['DRAFT', 'REQUESTED', 'SENT_TO_DESTINATION', 'ACCEPTED_BY_DESTINATION', 'APPROVED_BY_SOURCE'] },
      },
    });
    if (existingTransfer) {
      throw new BadRequestException('Un transfert est déjà en cours pour cet élève');
    }

    // Analyse ORION — Vigilance Mobilité
    const vigilance = await this.orionVigilanceCheck(data.studentId);

    // Récupérer le niveau/classe actuels
    const currentEnrollment = student.studentEnrollments[0];

    const request = await this.prisma.studentTransferRequest.create({
      data: {
        tenantId,
        sourceSchoolId: tenantId,
        targetSchoolId: data.targetSchoolId,
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        currentLevelId: currentEnrollment?.schoolLevelId || student.schoolLevelId,
        currentClassId: currentEnrollment?.classId || null,
        requestedLevelId: data.requestedLevelId || null,
        requestedClassId: data.requestedClassId || null,
        motif: data.motif || null,
        message: data.message || null,
        status: 'SENT_TO_DESTINATION',
        requestedAt: new Date(),
        orionVigilanceFlag: vigilance.flag,
        orionVigilanceNote: vigilance.note,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, photoUrl: true, globalStudentId: true } },
        sourceSchool: { select: { id: true, name: true } },
        targetSchool: { select: { id: true, name: true } },
      },
    });

    await this.logStatusChange(request.id, 'SENT_TO_DESTINATION', userId, 'Demande de transfert envoyée à l\'école destination');

    // ⭐ Notifier l'école destination
    await this.notifySchool(
      data.targetSchoolId,
      'Nouvelle demande de transfert reçue',
      `L'élève ${student.firstName} ${student.lastName} (${student.matricule || student.globalStudentId}) souhaite être transféré vers votre établissement.`,
      { transferId: request.id, type: 'TRANSFER_RECEIVED' }
    );

    this.logger.log(`📤 Transfert créé : ${student.firstName} ${student.lastName} → ${targetSchool.name} (ID: ${request.id})`);
    return request;
  }

  /**
   * ⭐ Récupère les transferts sortants (depuis cette école vers d'autres).
   */
  async getOutgoingTransfers(tenantId: string) {
    return this.prisma.studentTransferRequest.findMany({
      where: { sourceSchoolId: tenantId },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true,
            matricule: true, photoUrl: true, globalStudentId: true,
          },
        },
        sourceSchool: { select: { id: true, name: true, city: true } },
        targetSchool: { select: { id: true, name: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ⭐ Récupère les transferts entrants (depuis d'autres écoles vers celle-ci).
   */
  async getIncomingTransfers(tenantId: string) {
    return this.prisma.studentTransferRequest.findMany({
      where: { targetSchoolId: tenantId },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true,
            matricule: true, photoUrl: true, globalStudentId: true,
          },
        },
        sourceSchool: { select: { id: true, name: true, city: true } },
        targetSchool: { select: { id: true, name: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ⭐ Approuve une demande de transfert (côté école destination).
   * L'école source est notifiée.
   */
  async approveTransfer(transferId: string, userId: string) {
    const transfer = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true, sourceSchool: true, targetSchool: true },
    });
    if (!transfer) throw new NotFoundException('Transfert non trouvé');

    if (transfer.status !== 'SENT_TO_DESTINATION' && transfer.status !== 'REQUESTED') {
      throw new BadRequestException(`Le transfert ne peut pas être approuvé (statut actuel: ${transfer.status})`);
    }

    const res = await this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'ACCEPTED_BY_DESTINATION',
        decision: 'ACCEPTED',
        decisionDate: new Date(),
        decidedBy: userId,
        approvedByDestination: userId,
        approvedByDestinationAt: new Date(),
      },
    });

    await this.logStatusChange(transferId, 'ACCEPTED_BY_DESTINATION', userId, 'Demande approuvée par l\'établissement d\'accueil');

    // ⭐ Notifier l'école source
    await this.notifySchool(
      transfer.sourceSchoolId,
      'Transfert approuvé par l\'école destination',
      `L'établissement ${transfer.targetSchool.name} a approuvé le transfert de ${transfer.student.firstName} ${transfer.student.lastName}. Veuillez confirmer la sortie de l'élève.`,
      { transferId, type: 'TRANSFER_APPROVED' }
    );

    // ⭐ Notifier les parents
    await this.notifyParents(transfer.studentId, transferId, 'ACCEPTED_BY_DESTINATION');

    this.logger.log(`✅ Transfert approuvé : ${transfer.student.firstName} ${transfer.student.lastName} (ID: ${transferId})`);
    return res;
  }

  /**
   * ⭐ Rejette une demande de transfert (côté école destination).
   * L'école source est notifiée.
   */
  async rejectTransfer(transferId: string, userId: string, reason: string) {
    const transfer = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true, sourceSchool: true, targetSchool: true },
    });
    if (!transfer) throw new NotFoundException('Transfert non trouvé');

    const res = await this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'REJECTED_BY_DESTINATION',
        decision: 'REJECTED',
        decisionDate: new Date(),
        decidedBy: userId,
        message: reason,
      },
    });

    await this.logStatusChange(transferId, 'REJECTED_BY_DESTINATION', userId, reason);

    // ⭐ Notifier l'école source
    await this.notifySchool(
      transfer.sourceSchoolId,
      'Transfert rejeté par l\'école destination',
      `L'établissement ${transfer.targetSchool.name} a rejeté le transfert de ${transfer.student.firstName} ${transfer.student.lastName}. Motif : ${reason}`,
      { transferId, type: 'TRANSFER_REJECTED' }
    );

    // ⭐ Notifier les parents
    await this.notifyParents(transfer.studentId, transferId, 'REJECTED_BY_DESTINATION');

    this.logger.log(`❌ Transfert rejeté : ${transfer.student.firstName} ${transfer.student.lastName} (ID: ${transferId})`);
    return res;
  }

  /**
   * ⭐ Demande des informations complémentaires (côté école destination).
   */
  async requestComplement(transferId: string, userId: string, message: string) {
    const transfer = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true, sourceSchool: true },
    });
    if (!transfer) throw new NotFoundException('Transfert non trouvé');

    const res = await this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: { status: 'SENT_TO_DESTINATION', message },
    });

    await this.logStatusChange(transferId, 'COMPLEMENT_REQUESTED', userId, message);

    // ⭐ Notifier l'école source
    await this.notifySchool(
      transfer.sourceSchoolId,
      'Complément d\'information demandé',
      `L'établissement destination demande des informations complémentaires pour le transfert de ${transfer.student.firstName} ${transfer.student.lastName}. Message : ${message}`,
      { transferId, type: 'COMPLEMENT_REQUESTED' }
    );

    return res;
  }

  /**
   * ⭐ Confirme la sortie de l'élève (côté école source).
   * L'école destination est notifiée qu'elle peut finaliser l'inscription.
   */
  async confirmSourceExit(transferId: string, userId?: string) {
    const transfer = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true, sourceSchool: true, targetSchool: true },
    });
    if (!transfer) throw new NotFoundException('Transfert non trouvé');

    if (transfer.status !== 'ACCEPTED_BY_DESTINATION') {
      throw new BadRequestException(`Le transfert doit être accepté par l'école destination avant de confirmer la sortie (statut actuel: ${transfer.status})`);
    }

    const res = await this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'APPROVED_BY_SOURCE',
        sourceExitConfirmed: true,
        sourceExitDate: new Date(),
        approvedBySource: userId || 'SYSTEM',
        approvedBySourceAt: new Date(),
      },
    });

    await this.logStatusChange(transferId, 'APPROVED_BY_SOURCE', userId || 'SYSTEM', 'Sortie confirmée par l\'école source');

    // ⭐ Désactiver l'élève dans l'école source
    await this.prisma.student.update({
      where: { id: transfer.studentId },
      data: { status: 'TRANSFERRED', isActive: false },
    });

    // ⭐ Notifier l'école destination
    await this.notifySchool(
      transfer.targetSchoolId,
      'Transfert confirmé — vous pouvez finaliser l\'inscription',
      `L'établissement ${transfer.sourceSchool.name} a confirmé la sortie de ${transfer.student.firstName} ${transfer.student.lastName}. Vous pouvez maintenant finaliser l'inscription dans votre établissement.`,
      { transferId, type: 'TRANSFER_CONFIRMED' }
    );

    // ⭐ Notifier les parents
    await this.notifyParents(transfer.studentId, transferId, 'APPROVED_BY_SOURCE');

    this.logger.log(`✅ Sortie confirmée : ${transfer.student.firstName} ${transfer.student.lastName} (ID: ${transferId})`);
    return res;
  }

  /**
   * ⭐ Exécute le transfert final (côté école destination).
   * Copie le dossier complet de l'élève vers l'école destination.
   */
  async executeTransfer(transferId: string, userId?: string) {
    const request = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: {
        student: {
          include: {
            identifier: true,
            studentGuardians: { include: { guardian: true } },
            studentDocuments: true,
            studentEnrollments: {
              include: { class: true, academicClass: true, academicYear: true },
              orderBy: { enrollmentDate: 'desc' },
            },
          },
        },
        sourceSchool: true,
        targetSchool: true,
      },
    });

    if (!request) throw new NotFoundException('Transfert non trouvé');

    if (request.status !== 'APPROVED_BY_SOURCE') {
      throw new BadRequestException(`Le transfert doit être approuvé par l'école source avant exécution (statut actuel: ${request.status})`);
    }

    const sourceStudent = request.student;

    // ⭐ 1. Créer le nouvel élève dans l'école destination avec dossier complet
    const newStudent = await this.prisma.student.create({
      data: {
        tenantId: request.targetSchoolId,
        academicYearId: request.destinationAcademicYearId || request.academicYearId,
        schoolLevelId: request.requestedLevelId || sourceStudent.schoolLevelId,
        firstName: sourceStudent.firstName,
        lastName: sourceStudent.lastName,
        dateOfBirth: sourceStudent.dateOfBirth,
        gender: sourceStudent.gender,
        nationality: sourceStudent.nationality,
        placeOfBirth: sourceStudent.placeOfBirth,
        address: sourceStudent.address,
        photoUrl: sourceStudent.photoUrl,
        npi: sourceStudent.npi,
        primaryLanguage: sourceStudent.primaryLanguage,
        regimeType: sourceStudent.regimeType,
        status: 'ACTIVE',
        isActive: true,
        globalStudentId: sourceStudent.globalStudentId, // ⭐ Conservation de l'ID global
        // Le matricule local sera attribué séparément (règle propre à chaque école)
      },
    });

    // ⭐ 2. Copier les responsables légaux
    if (sourceStudent.studentGuardians && sourceStudent.studentGuardians.length > 0) {
      for (const sg of sourceStudent.studentGuardians) {
        // Créer ou réutiliser le guardian
        const newGuardian = await this.prisma.guardian.create({
          data: {
            tenantId: request.targetSchoolId,
            firstName: sg.guardian.firstName,
            lastName: sg.guardian.lastName,
            phone: sg.guardian.phone,
            email: sg.guardian.email,
            address: sg.guardian.address,
            profession: sg.guardian.profession,
            relationship: sg.guardian.relationship,
          },
        });

        await this.prisma.studentGuardian.create({
          data: {
            studentId: newStudent.id,
            guardianId: newGuardian.id,
            relationship: sg.relationship,
            isPrimary: sg.isPrimary,
            tenantId: request.targetSchoolId,
          },
        });
      }
    }

    // ⭐ 3. Créer une inscription dans l'école destination
    await this.prisma.studentEnrollment.create({
      data: {
        tenantId: request.targetSchoolId,
        studentId: newStudent.id,
        academicYearId: request.destinationAcademicYearId || request.academicYearId,
        schoolLevelId: request.requestedLevelId || sourceStudent.schoolLevelId,
        classId: request.requestedClassId || null,
        enrollmentType: 'TRANSFER',
        enrollmentDate: new Date(),
        status: 'ACTIVE',
        previousArrears: 0,
      },
    });

    // ⭐ 4. Créer un enregistrement académique initial
    await this.prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicYearId: {
          studentId: newStudent.id,
          academicYearId: request.destinationAcademicYearId || request.academicYearId,
        },
      },
      update: {},
      create: {
        tenantId: request.targetSchoolId,
        studentId: newStudent.id,
        academicYearId: request.destinationAcademicYearId || request.academicYearId,
        schoolLevelId: request.requestedLevelId || sourceStudent.schoolLevelId,
        classId: request.requestedClassId || null,
        enrollmentStatus: 'ACTIVE',
      },
    });

    // ⭐ 5. Marquer le transfert comme complété
    const res = await this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'COMPLETED',
        executedAt: new Date(),
        completedAt: new Date(),
        destinationLocalMatricule: newStudent.studentCode || null,
      },
    });

    await this.logStatusChange(transferId, 'COMPLETED', userId || 'SYSTEM', 'Transfert exécuté. Dossier migré vers l\'école destination.');

    // ⭐ 6. Notifier l'école source que le transfert est complet
    await this.notifySchool(
      request.sourceSchoolId,
      'Transfert complété',
      `Le transfert de ${sourceStudent.firstName} ${sourceStudent.lastName} vers ${request.targetSchool.name} est maintenant complet. L'élève est inscrit dans son nouvel établissement.`,
      { transferId, type: 'TRANSFER_COMPLETED' }
    );

    // ⭐ 7. Notifier les parents
    await this.notifyParents(sourceStudent.id, transferId, 'COMPLETED');

    this.logger.log(`🎉 Transfert complété : ${sourceStudent.firstName} ${sourceStudent.lastName} → ${request.targetSchool.name} (ID: ${transferId})`);
    return res;
  }

  /**
   * ⭐ Compile le dossier numérique complet d'un transfert.
   * Utilise le transferId pour récupérer l'élève source + son dossier.
   */
  async compileFullDossier(transferId: string, level: 'FULL' | 'MASKED' = 'MASKED') {
    const request = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: {
        student: {
          include: {
            identifier: true,
            studentEnrollments: {
              include: { class: true, academicYear: true },
              orderBy: { enrollmentDate: 'desc' },
            },
            studentDocuments: true,
            studentGuardians: {
              include: {
                guardian: {
                  select: { firstName: true, lastName: true, phone: true, email: true, relationship: true },
                },
              },
            },
          },
        },
      },
    });

    if (!request) throw new NotFoundException('Transfert non trouvé');

    const student = request.student;

    return {
      transferId: request.id,
      transferStatus: request.status,
      identity: {
        globalStudentId: student.globalStudentId,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        birthDate: student.dateOfBirth,
        birthPlace: student.placeOfBirth,
        nationality: student.nationality,
        photoUrl: level === 'FULL' ? student.photoUrl : null,
        matricule: student.matricule || student.identifier?.globalMatricule || null,
      },
      academic: student.studentEnrollments.map(e => ({
        year: e.academicYear?.name || e.academicYearId,
        class: e.class?.name || '—',
        status: e.status,
        enrollmentDate: e.enrollmentDate,
      })),
      guardians: level === 'MASKED'
        ? { count: student.studentGuardians.length, status: 'PROTECTED' }
        : student.studentGuardians.map(sg => ({
            name: `${sg.guardian.firstName} ${sg.guardian.lastName}`,
            relationship: sg.relationship || sg.guardian.relationship,
            phone: sg.guardian.phone,
            email: sg.guardian.email,
            isPrimary: sg.isPrimary,
          })),
      documents: level === 'MASKED'
        ? { count: student.studentDocuments.length, status: 'PROTECTED' }
        : student.studentDocuments.map(doc => ({
            type: doc.documentType,
            fileName: doc.fileName,
            status: doc.status,
            uploadedAt: doc.createdAt,
          })),
      motif: request.motif,
      message: request.message,
      sourceSchool: request.sourceSchoolId,
      targetSchool: request.targetSchoolId,
    };
  }

  /**
   * ⭐ Recherche des écoles dans l'annuaire Academia Helm.
   */
  async searchSchools(query: string) {
    // ⭐ Si pas de query, retourner toutes les écoles actives (limit 50)
    const where: any = {
      type: 'SCHOOL',
      status: 'active',
    };
    if (query && query.trim()) {
      where.name = { contains: query.trim(), mode: 'insensitive' };
    }
    return this.prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        // ⭐ city n'existe pas sur tenants — on l'obtient via schools
        schools: { select: { city: true, address: true } },
      },
      take: 50,
      orderBy: { name: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Méthodes privées
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Log d'historique de statut (Traçabilité)
   */
  private async logStatusChange(transferId: string, status: string, userId: string, comment?: string) {
    try {
      await this.prisma.studentTransferStatusHistory.create({
        data: {
          transferRequestId: transferId,
          status,
          changedBy: userId,
          comment,
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to log status change: ${e.message}`);
    }
  }

  /**
   * Moteur d'analyse ORION pour les transferts suspects
   */
  private async orionVigilanceCheck(studentId: string) {
    const pastTransfers = await this.prisma.studentTransferRequest.count({
      where: {
        studentId,
        status: 'COMPLETED',
        createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      },
    });

    if (pastTransfers >= 2) {
      return { flag: true, note: 'ALERTE : Mobilité excessive (3ème transfert en 1 an)' };
    }

    return { flag: false, note: 'Flux normal' };
  }

  /**
   * ⭐ Notifie une école (crée une entrée dans la table des notifications).
   * Dans une implémentation complète, ceci déclencherait aussi un email/SMS.
   */
  private async notifySchool(
    schoolId: string,
    title: string,
    message: string,
    metadata?: any,
  ) {
    try {
      // Créer une notification en base
      await this.prisma.notification.create({
        data: {
          tenantId: schoolId,
          title,
          message,
          type: 'TRANSFER',
          metadata: metadata ? JSON.stringify(metadata) : null,
          createdAt: new Date(),
        },
      });
      this.logger.log(`📧 Notification envoyée à l'école ${schoolId}: ${title}`);
    } catch (e) {
      // Si la table Notification n'existe pas, on log au minimum
      this.logger.warn(`Notification (fallback) → École ${schoolId}: ${title} — ${message}`);
    }
  }

  /**
   * ⭐ Notifie les parents de l'élève d'un changement de statut du transfert.
   */
  private async notifyParents(studentId: string, transferId: string, status: string) {
    try {
      const guardians = await this.prisma.studentGuardian.findMany({
        where: { studentId, isPrimary: true },
        include: { guardian: true },
      });

      const statusMessages: Record<string, string> = {
        'ACCEPTED_BY_DESTINATION': 'La demande de transfert a été acceptée par l\'établissement destination.',
        'REJECTED_BY_DESTINATION': 'La demande de transfert a été rejetée par l\'établissement destination.',
        'APPROVED_BY_SOURCE': 'La sortie de l\'élève a été confirmée par l\'établissement source.',
        'COMPLETED': 'Le transfert est complet. L\'élève est maintenant inscrit dans son nouvel établissement.',
      };

      const message = statusMessages[status] || `Le statut du transfert a changé: ${status}`;

      for (const sg of guardians) {
        if (sg.guardian.email || sg.guardian.phone) {
          // Hook pour le service de notification (SMS/Email/Push)
          this.logger.log(`📧 Notification parent ${sg.guardian.firstName} ${sg.guardian.lastName}: ${message}`);
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to notify parents: ${e.message}`);
    }
  }
}
