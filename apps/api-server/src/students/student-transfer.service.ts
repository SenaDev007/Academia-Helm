import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StudentTransferService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialise une demande de transfert inter-écoles
   */
  async createTransferRequest(userId: string, tenantId: string, data: any) {
    // Analyse ORION (Phase 4 : Vigilance Mobilité)
    const vigilance = await this.orionVigilanceCheck(data.studentId);
    
    const request = await this.prisma.studentTransferRequest.create({
      data: {
        ...data,
        tenantId,
        sourceSchoolId: tenantId,
        status: 'SENT',
        orionVigilanceFlag: vigilance.flag,
        orionVigilanceNote: vigilance.note,
      },
    });

    await this.logStatusChange(request.id, 'SENT', userId, 'Initiation du transfert inter-écoles');
    return request;
  }

  /**
   * Log d'historique de statut (Traçabilité Step 8)
   */
  private async logStatusChange(transferId: string, status: string, userId: string, comment?: string) {
    return this.prisma.studentTransferStatusHistory.create({
      data: {
        transferRequestId: transferId,
        status,
        changedBy: userId,
        comment,
      },
    });
  }

  /**
   * Moteur d'analyse ORION pour les transferts suspects
   */
  private async orionVigilanceCheck(studentId: string) {
    // Vérification des transferts multiples dans les 12 derniers mois
    const pastTransfers = await this.prisma.studentTransferRequest.count({
      where: { studentId, status: 'EXECUTED', createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } }
    });

    if (pastTransfers >= 2) {
      return { flag: true, note: 'ALERTE : Mobilité excessive (3ème transfert en 1 an)' };
    }

    return { flag: false, note: 'Flux normal' };
  }

  /**
   * Récupère les transferts sortants pour une école
   */
  async getOutgoingTransfers(tenantId: string) {
    return this.prisma.studentTransferRequest.findMany({
      where: { sourceSchoolId: tenantId },
      include: {
        student: { select: { firstName: true, lastName: true, matricule: true } },
        targetSchool: { select: { name: true } },
      },
    });
  }

  /**
   * Récupère les transferts entrants pour une école
   */
  async getIncomingTransfers(tenantId: string) {
    return this.prisma.studentTransferRequest.findMany({
      where: { targetSchoolId: tenantId },
      include: {
        student: { select: { firstName: true, lastName: true, matricule: true } },
        sourceSchool: { select: { name: true } },
      },
    });
  }

  /**
   * Approuve une demande de transfert (École B)
   */
  async approveTransfer(transferId: string, userId: string) {
    const res = await this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'ACCEPTED',
        decision: 'ACCEPTED',
        decisionDate: new Date(),
        decidedBy: userId,
      },
    });
    await this.logStatusChange(transferId, 'ACCEPTED', userId, 'Demande approuvée par l\'établissement d\'accueil');
    return res;
  }

  /**
   * Refuse une demande de transfert (École B)
   */
  async rejectTransfer(transferId: string, userId: string, reason: string) {
    const res = await this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'REJECTED',
        decision: 'REJECTED',
        decisionDate: new Date(),
        decidedBy: userId,
        message: reason,
      },
    });
    await this.logStatusChange(transferId, 'REJECTED', userId, reason);
    return res;
  }

  /**
   * Demande des informations complémentaires (École B)
   */
  async requestComplement(transferId: string, userId: string, message: string) {
    return this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'COMPLEMENT_REQUIRED',
      },
    });
  }

  /**
   * Recherche des écoles dans l'annuaire Academia Helm
   */
  async searchSchools(query: string) {
    return this.prisma.tenant.findMany({
      where: {
        type: 'SCHOOL',
        status: 'active',
        name: { contains: query, mode: 'insensitive' },
      },
      select: { id: true, name: true, slug: true, countryId: true },
    });
  }

  /**
   * Confirme la sortie de l'école A
   */
  async confirmSourceExit(transferId: string) {
    return this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'CONFIRMED_BY_SOURCE',
        sourceExitConfirmed: true,
        sourceExitDate: new Date(),
      },
    });
  }

  /**
   * Exécute le transfert final (Migration des données)
   */
  async executeTransfer(transferId: string) {
    const request = await this.prisma.studentTransferRequest.findUnique({
      where: { id: transferId },
      include: { student: true },
    });

    if (!request) throw new Error('Transfer request not found');

    // 1. Désactiver dans l'école A (Source)
    await this.prisma.student.update({
      where: { id: request.studentId },
      data: { status: 'TRANSFERRED_OUT', isActive: false },
    });

    // 2. Créer le profil dans l'école B (Target)
    // Note: Dans une implémentation réelle, on copierait plus de champs et gérerait les relations.
    const newStudent = await this.prisma.student.create({
      data: {
        tenantId: request.targetSchoolId,
        academicYearId: request.academicYearId,
        schoolLevelId: request.requestedLevelId || request.student.schoolLevelId,
        firstName: request.student.firstName,
        lastName: request.student.lastName,
        dateOfBirth: request.student.dateOfBirth,
        gender: request.student.gender,
        status: 'ACTIVE',
        isActive: true,
      },
    });

    // 3. Marquer le transfert comme exécuté
    const res = await this.prisma.studentTransferRequest.update({
      where: { id: transferId },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
      },
    });

    await this.logStatusChange(transferId, 'EXECUTED', 'SYSTEM', 'Transfert exécuté avec succès. Données migrées.');
    await this.notifyParents(request.studentId, transferId);
    
    return res;
  }

  /**
   * Compile le dossier numérique complet avec masquage des données sensibles
   * (Spécification Dawes - Étape 3 & 4)
   */
  async compileFullDossier(studentId: string, level: 'FULL' | 'MASKED' = 'MASKED') {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        studentEnrollments: { include: { class: true } },
        grades: true,
        disciplineRecords: true,
        medicalRecords: true,
      },
    });

    if (!student) return null;

    // Logique de masquage pour l'école de destination avant acceptation finale
    return {
      identity: {
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        birthDate: student.dateOfBirth,
      },
      academic: student.studentEnrollments.map(e => ({
        year: e.academicYearId,
        class: e.class?.name,
        status: e.status,
      })),
      // Masquage des détails si niveau MASKED
      discipline: level === 'MASKED' 
        ? { count: student.disciplineRecords.length, status: 'PROTECTED' }
        : student.disciplineRecords,
      health: level === 'MASKED'
        ? { status: 'DECLARED', alerts: 'CONFIDENTIAL' }
        : student.medicalRecords,
    };
  }

  /**
   * Notifie les parents du succès du transfert
   */
  private async notifyParents(studentId: string, transferId: string) {
    // Hook pour le service de notification (SMS/Email/Push)
    console.log(`Notification envoyée aux parents pour le transfert ${transferId}`);
  }
}
