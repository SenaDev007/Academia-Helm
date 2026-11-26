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

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';
import { SmsService } from '../communication/services/sms.service';
import { WhatsAppService } from '../communication/services/whatsapp.service';
import { ParentUserProvisioningService } from './services/parent-user-provisioning.service';

@Injectable()
export class StudentTransferService {
  private readonly logger = new Logger(StudentTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly whatsappService: WhatsAppService,
    private readonly parentProvisioningService: ParentUserProvisioningService,
  ) {}

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
  async approveTransfer(transferId: string, userId: string, tenantId?: string) {
    const transfer = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true, sourceSchool: true, targetSchool: true },
    });
    if (!transfer) throw new NotFoundException('Transfert non trouvé');

    // ⭐ P1.7 — Tenant scoping : seul le tenant destination peut approuver
    if (tenantId && transfer.targetSchoolId !== tenantId) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à approuver ce transfert (réservé à l\'établissement d\'accueil)');
    }

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
  async rejectTransfer(transferId: string, userId: string, reason: string, tenantId?: string) {
    const transfer = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true, sourceSchool: true, targetSchool: true },
    });
    if (!transfer) throw new NotFoundException('Transfert non trouvé');

    // ⭐ P1.7 — Tenant scoping : seul le tenant destination peut rejeter
    if (tenantId && transfer.targetSchoolId !== tenantId) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à rejeter ce transfert (réservé à l\'établissement d\'accueil)');
    }

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
  async requestComplement(transferId: string, userId: string, message: string, tenantId?: string) {
    const transfer = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true, sourceSchool: true },
    });
    if (!transfer) throw new NotFoundException('Transfert non trouvé');

    // ⭐ P1.7 — Tenant scoping : seul le tenant destination peut demander un complément
    if (tenantId && transfer.targetSchoolId !== tenantId) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à demander un complément pour ce transfert');
    }

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
  async confirmSourceExit(transferId: string, userId?: string, tenantId?: string) {
    const transfer = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true, sourceSchool: true, targetSchool: true },
    });
    if (!transfer) throw new NotFoundException('Transfert non trouvé');

    // ⭐ P1.7 — Tenant scoping : seul le tenant source peut confirmer la sortie
    if (tenantId && transfer.sourceSchoolId !== tenantId) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à confirmer la sortie (réservé à l\'établissement source)');
    }

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

    // ⭐ P1.6 — Fermer le StudentEnrollment source (passer à TRANSFERRED + exitDate + exitReason).
    //    Avant, seul le Student parent était marqué TRANSFERRED — l'enrollment restait ACTIVE,
    //    ce qui était incohérent avec students-lifecycle.service.ts:transfer() qui fait les deux.
    try {
      const sourceEnrollment = await this.prisma.studentEnrollment.findFirst({
        where: {
          studentId: transfer.studentId,
          tenantId: transfer.sourceSchoolId,
          academicYearId: transfer.academicYearId,
        },
        orderBy: { enrollmentDate: 'desc' },
      });
      if (sourceEnrollment) {
        await this.prisma.studentEnrollment.update({
          where: { id: sourceEnrollment.id },
          data: {
            status: 'TRANSFERRED',
            exitDate: new Date(),
            exitReason: 'Transfert inter-écoles',
          },
        });
      }
    } catch (e: any) {
      // Non-blocking — l'élève est déjà marqué TRANSFERRED au niveau Student
      console.warn(`[confirmSourceExit] Could not close source enrollment: ${e?.message}`);
    }

    // ⭐ P1.6 — Écrire un audit log (était manquant avant — la sortie inter-écoles
    //    n'avait aucune trace dans StudentAuditLog contrairement aux autres sorties)
    try {
      await this.prisma.studentAuditLog.create({
        data: {
          tenantId: transfer.sourceSchoolId,
          studentId: transfer.studentId,
          action: 'TRANSFER_EXIT',
          performedBy: userId || null,
          beforeData: { status: 'ACTIVE' } as any,
          afterData: {
            status: 'TRANSFERRED',
            transferId,
            targetSchoolId: transfer.targetSchoolId,
            exitDate: new Date(),
          } as any,
          createdAt: new Date(),
        },
      });
    } catch (e: any) {
      console.warn(`[confirmSourceExit] Could not write audit log: ${e?.message}`);
    }

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
  async executeTransfer(transferId: string, userId?: string, tenantId?: string) {
    const request = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: {
        student: {
          include: {
            studentGuardians: { include: { guardian: true } },
            studentDocuments: true,
            studentAcademicRecords: true,
          },
        },
        sourceSchool: true,
        targetSchool: true,
      },
    });
    if (!request) throw new NotFoundException('Transfert non trouvé');

    // ⭐ P1.7 — Tenant scoping : seul le tenant destination peut exécuter le transfert
    if (tenantId && request.targetSchoolId !== tenantId) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à exécuter ce transfert (réservé à l\'établissement d\'accueil)');
    }

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

        // ⭐ 2026-09-19 (demande promoteur) — COMPTE PARENT créé aussi côté
        //    école DESTINATION (le guardian y est nouveau). Non bloquant :
        //    si le parent a déjà un compte (email déjà pris globalement), le
        //    guardian est quand même copié et le transfert aboutit.
        try {
          await this.parentProvisioningService.ensureUserForGuardian(newGuardian.id);
        } catch (provisioningErr: any) {
          this.logger.warn(
            `Transfert : compte parent non provisionné pour le guardian ${newGuardian.id} côté destination (non bloquant): ${provisioningErr?.message || provisioningErr}`,
          );
        }
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
        // ⭐ Inclure les détails de l'école (logo, city, address)
        schools: {
          select: {
            city: true,
            address: true,
            logo: true,
          },
        },
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
   * ⭐ Notifie une école (notification en base + email professionnel).
   * L'email utilise un design HTML cohérent avec les modules RH et Finance.
   */
  private async notifySchool(
    schoolId: string,
    title: string,
    message: string,
    metadata?: any,
  ) {
    try {
      // 1. Créer une notification en base
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
      this.logger.log(`📧 Notification en base → École ${schoolId}: ${title}`);
    } catch (e) {
      this.logger.warn(`Notification (fallback) → École ${schoolId}: ${title} — ${message}`);
    }

    // 2. Envoyer un email professionnel à l'école destinataire
    try {
      // Récupérer l'email de l'école destinataire
      const school = await this.prisma.schools.findFirst({
        where: { tenantId: schoolId },
        select: { primaryEmail: true, name: true },
      });

      if (school?.primaryEmail) {
        const html = this.buildTransferEmailHtml(title, message, school.name);
        // ⭐ Tâche 181 — voie centralisée : SMTP de l'école (file + plafond)
        await this.emailService.sendCategorized({
          tenantId: schoolId,
          category: 'ADMINISTRATIF',
          subCategory: 'transfert_ecole',
          module: 'students',
          to: school.primaryEmail,
          recipientType: 'EXTERNE',
          subject: `Academia Helm — ${title}`,
          html,
          fromName: 'Academia Helm — Transferts',
        });
        this.logger.log(`📧 Email envoyé à ${school.primaryEmail}: ${title}`);
      } else {
        this.logger.warn(`Pas d'email trouvé pour l'école ${schoolId}`);
      }
    } catch (emailErr: any) {
      this.logger.warn(`Email non envoyé à l'école ${schoolId}: ${emailErr.message}`);
    }
  }

  /**
   * ⭐ Construit le HTML de l'email de notification de transfert.
   * Design professionnel cohérent avec les modules RH et Finance.
   */
  private buildTransferEmailHtml(title: string, message: string, schoolName: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0;letter-spacing:-0.5px;">Academia Helm</h1>
              <p style="color:#bfdbfe;font-size:12px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Mobilité Scolaire Inter-Écoles</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="color:#1e293b;font-size:18px;font-weight:700;margin:0 0 16px;">${title}</h2>
              <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">Bonjour,</p>
              <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">${message}</p>
              <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="color:#64748b;font-size:12px;margin:0;">Établissement concerné : <strong style="color:#1e293b;">${schoolName}</strong></p>
              </div>
              <p style="color:#475569;font-size:14px;line-height:1.6;margin:16px 0 0;">Connectez-vous à votre espace Academia Helm pour traiter cette demande.</p>
            </td>
          </tr>
          <!-- Button -->
          <tr>
            <td style="padding:0 40px 24px;">
              <a href="https://academiahelm.com/login" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">Accéder à l'espace</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:11px;margin:0;text-align:center;">Cet e-mail a été envoyé via Academia Helm. Vous pouvez répondre directement : votre réponse parviendra à l'école.</p>
              <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;text-align:center;">© 2026 Academia Helm — YEHI OR Tech</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * ⭐ Notifie les parents de l'élève d'un changement de statut du transfert.
   */
  /**
   * ⭐ Notifie les parents de l'élève d'un changement de statut du transfert.
   * Envoie 3 notifications en parallèle : Email + WhatsApp + SMS.
   * Chaque canal est indépendant — si l'un échoue, les autres sont quand même envoyés.
   */
  private async notifyParents(studentId: string, transferId: string, status: string) {
    try {
      const guardians = await this.prisma.studentGuardian.findMany({
        where: { studentId, isPrimary: true },
        include: { guardian: true },
      });

      // Récupérer le nom de l'élève pour personnaliser le message
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { firstName: true, lastName: true, tenantId: true },
      });
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'l\'élève';

      const statusMessages: Record<string, string> = {
        'ACCEPTED_BY_DESTINATION': `La demande de transfert de ${studentName} a été acceptée par l'établissement destination.`,
        'REJECTED_BY_DESTINATION': `La demande de transfert de ${studentName} a été rejetée par l'établissement destination.`,
        'APPROVED_BY_SOURCE': `La sortie de ${studentName} a été confirmée par l'établissement source.`,
        'COMPLETED': `Le transfert de ${studentName} est complet. L'élève est maintenant inscrit dans son nouvel établissement.`,
      };

      const fullMessage = statusMessages[status] || `Le statut du transfert de ${studentName} a changé.`;

      for (const sg of guardians) {
        const guardian = sg.guardian;
        const guardianName = `${guardian.firstName} ${guardian.lastName}`;
        const phone = guardian.phone;
        const email = guardian.email;

        // ⭐ Lancer les 3 notifications en parallèle (non bloquantes)
        const notifications: Promise<void>[] = [];

        // 1. EMAIL
        if (email) {
          notifications.push(
            this.sendParentEmail(email, guardianName, studentName, fullMessage, student?.tenantId).catch(e =>
              this.logger.warn(`Email parent ${email} échoué: ${e.message}`)
            )
          );
        }

        // 2. WHATSAPP
        if (phone) {
          notifications.push(
            this.sendWhatsAppNotification(phone, fullMessage).catch(e =>
              this.logger.warn(`WhatsApp parent ${phone} échoué: ${e.message}`)
            )
          );
        }

        // 3. SMS
        if (phone) {
          notifications.push(
            this.sendSmsNotification(phone, fullMessage).catch(e =>
              this.logger.warn(`SMS parent ${phone} échoué: ${e.message}`)
            )
          );
        }

        // Attendre que toutes les notifications soient tentées (non bloquant)
        await Promise.allSettled(notifications);
        this.logger.log(`📧 Notifications parent ${guardianName}: email=${!!email}, whatsapp=${!!phone}, sms=${!!phone}`);
      }
    } catch (e: any) {
      this.logger.warn(`Failed to notify parents: ${e.message}`);
    }
  }

  /**
   * ⭐ Envoie un email professionnel au parent.
   */
  private async sendParentEmail(email: string, guardianName: string, studentName: string, message: string, tenantId?: string): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;min-height:100vh;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0;">Academia Helm</h1>
          <p style="color:#bfdbfe;font-size:12px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Notification Transfert Scolaire</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h2 style="color:#1e293b;font-size:18px;font-weight:700;margin:0 0 16px;">Bonjour ${guardianName},</h2>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">${message}</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="color:#64748b;font-size:12px;margin:0;">Élève concerné : <strong style="color:#1e293b;">${studentName}</strong></p>
          </div>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:16px 0 0;">Pour toute question, contactez l'administration de l'établissement.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:11px;margin:0;text-align:center;">Cet email a été envoyé automatiquement par Academia Helm.</p>
          <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;text-align:center;">© 2026 Academia Helm — YEHI OR Tech</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // ⭐ Tâche 181 — voie centralisée : SMTP de l'école (file + plafond).
    // Sans tenantId (cas théorique), l'EmailLog reste tracé côté plateforme.
    if (tenantId) {
      await this.emailService.sendCategorized({
        tenantId,
        category: 'ADMINISTRATIF',
        subCategory: 'transfert_parent',
        module: 'students',
        to: email,
        toName: guardianName,
        recipientType: 'PARENT',
        subject: `Academia Helm — Mise à jour du transfert de ${studentName}`,
        html,
        fromName: 'Academia Helm — Transferts',
      });
    } else {
      await this.emailService.sendEmail({
        to: email,
        subject: `Academia Helm — Mise à jour du transfert de ${studentName}`,
        html,
        fromName: 'Academia Helm — Transferts',
      });
    }
    this.logger.log(`📧 Email parent envoyé à ${email}`);
  }

  /**
   * ⭐ Envoie une notification WhatsApp au parent.
   * Utilise le WhatsAppService du module Communication (même pattern que Finance).
   */
  private async sendWhatsAppNotification(phone: string, message: string): Promise<void> {
    const cleanPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');
    await this.whatsappService.sendWhatsApp({
      to: cleanPhone,
      message,
    });
    this.logger.log(`📱 WhatsApp envoyé à ${cleanPhone}`);
  }

  /**
   * ⭐ Envoie un SMS au parent.
   * Utilise le SmsService du module Auth (même pattern que Finance).
   */
  private async sendSmsNotification(phone: string, message: string): Promise<void> {
    const cleanPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');
    // Tronquer le message pour le SMS (160 caractères max)
    const smsMessage = message.substring(0, 155);
    await this.smsService.sendSms({
      to: cleanPhone,
      message: smsMessage,
    });
    this.logger.log(`📱 SMS envoyé à ${cleanPhone}`);
  }
}
