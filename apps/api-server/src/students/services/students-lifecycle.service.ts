/**
 * Module 1 — Cycle de vie élève : pré-inscription, admission, réinscription, transfert, changement de classe.
 * Matricule : <CODE_TENANT>-<ANNEE>-<AUTO_INCREMENT>
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MatriculeService } from './matricule.service';
import { PublicVerificationService } from './public-verification.service';
import { StudentAccountService } from '../../finance/student-account.service';
import { StudentCountVerifierService } from '../../billing/services/student-count-verifier.service';

const ENROLLMENT_STATUS = {
  PRE_REGISTERED: 'PRE_REGISTERED',
  ADMITTED: 'ADMITTED',
  RE_ENROLLED: 'RE_ENROLLED',
  TRANSFERRED: 'TRANSFERRED',
  WITHDRAWN: 'WITHDRAWN',
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  VALIDATED: 'VALIDATED',
} as const;

@Injectable()
export class StudentsLifecycleService {
  private readonly logger = new Logger(StudentsLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matriculeService: MatriculeService,
    private readonly publicVerificationService: PublicVerificationService,
    private readonly studentAccountService: StudentAccountService,
    private readonly studentCountVerifier: StudentCountVerifierService,
  ) {}

  /**
   * Vérifie si le tenant peut inscrire un nouvel élève.
   * À appeler AVANT toute création d'élève.
   * Lance une ForbiddenException si l'ajout est bloqué (plan dépassé + grâce expirée).
   */
  private async assertCanEnroll(tenantId: string): Promise<void> {
    const check = await this.studentCountVerifier.canEnrollNewStudent(tenantId);
    if (!check.allowed) {
      const planLabel = check.currentPlan || 'plan actuel';
      const recommendedLabel = check.recommendedPlan || 'plan supérieur';
      const currentCount = check.currentCount ?? 0;
      const planLimit = check.planLimit ?? 0;
      throw new ForbiddenException({
        code: 'STUDENT_ENROLLMENT_BLOCKED',
        message: `L'ajout de nouveaux élèves est suspendu. Votre établissement a ${currentCount} élèves inscrits, ce qui dépasse la limite de votre ${planLabel} (${planLimit} élèves max). Veuillez mettre à niveau vers le plan ${recommendedLabel} pour reprendre les inscriptions.`,
        details: {
          currentCount,
          planLimit,
          currentPlan: check.currentPlan,
          recommendedPlan: check.recommendedPlan,
          graceEndsAt: check.graceEndsAt,
        },
      });
    }
  }

  private async logAudit(
    tenantId: string,
    studentId: string,
    action: string,
    userId?: string,
    beforeData?: any,
    afterData?: any,
  ): Promise<void> {
    try {
      await this.prisma.studentAuditLog.create({
        data: {
          tenantId,
          studentId,
          userId,
          action,
          // On stocke les snapshots en JSON minimal pour l'historique
          beforeData: beforeData ?? null,
          afterData: afterData ?? null,
        },
      });
    } catch {
      // Journalisation best-effort : ne pas bloquer le flux mÃ©tier si l'audit Ã©choue
    }
  }

  /** Journalisation institutionnelle (Sous-module A/C/F) */
  private async logHistory(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    classId: string | null | undefined,
    action: string,
    comment?: string,
    performedBy?: string,
  ) {
    try {
      await this.prisma.studentAuditLog.create({
        data: {
          tenantId,
          studentId,
          userId: performedBy ?? null,
          action,
          beforeData: null,
          afterData: {
            academicYearId,
            classId: classId ?? null,
            comment,
          },
        },
      });
    } catch (e) {
      this.logger.error(`Erreur logHistory: ${(e as Error).message}`);
    }
  }

  /** DÃ©clenchement de l'analyse ORION (Module 8) */
  private async triggerOrion(tenantId: string, studentId: string, academicYearId?: string) {
    // Dans une implÃ©mentation rÃ©elle, cela pourrait Ãªtre un message RabbitMQ / BullMQ
    // Ici, on fait un appel direct ou on laisse ORION recalculer lors de la prochaine lecture
    this.logger.log(`[ORION] Analyse dÃ©clenchÃ©e pour l'Ã©lÃ¨ve ${studentId} (tenant: ${tenantId})`);
  }

  /** Pré-inscription : dossier incomplet autorisé, statut PRE_REGISTERED */
  async preRegister(
    tenantId: string,
    data: {
      academicYearId: string;
      schoolLevelId: string;
      firstName: string;
      lastName: string;
      dateOfBirth?: Date;
      gender?: string;
      nationality?: string;
      placeOfBirth?: string;
      regimeType?: string;
      classId?: string;
      photoUrl?: string;
      npi?: string;
    },
    userId?: string,
  ) {
    // Vérifier que le tenant peut inscrire un nouvel élève (plan d'abonnement)
    await this.assertCanEnroll(tenantId);

    const enrollmentDate = new Date();
    const student = await this.prisma.student.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        currentAcademicYearId: data.academicYearId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        nationality: data.nationality,
        placeOfBirth: data.placeOfBirth,
        regimeType: data.regimeType,
        photoUrl: data.photoUrl,
        npi: data.npi,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    const enrollment = await this.prisma.studentEnrollment.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        studentId: student.id,
        classId: data.classId ?? null,
        enrollmentType: 'NEW',
        enrollmentDate,
        status: ENROLLMENT_STATUS.PRE_REGISTERED,
        previousArrears: 0,
      },
    });

    // Historique des photos d'identité (original / HD / thumbnail)
    if (data.photoUrl) {
      await this.prisma.studentPhoto.create({
        data: {
          tenantId,
          studentId: student.id,
          originalUrl: data.photoUrl,
          hdUrl: data.photoUrl,
          thumbnailUrl: data.photoUrl,
        },
      });
    }

    await this.logAudit(tenantId, student.id, 'PRE_REGISTER', userId, null, {
      studentId: student.id,
      enrollmentId: enrollment.id,
      academicYearId: data.academicYearId,
      schoolLevelId: data.schoolLevelId,
      classId: data.classId ?? null,
    });

    // Vérifier le nombre d'élèves vs plan d'abonnement (notification si dépassement)
    // Best-effort : ne pas bloquer l'inscription
    this.studentCountVerifier.verifyAfterEnrollment(tenantId).catch((e) => {
      this.logger.warn(`verifyAfterEnrollment failed after preRegister: ${e?.message}`);
    });

    return this.prisma.student.findUnique({
      where: { id: student.id },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true } },
        schoolLevel: true,
      },
    });
  }

  /** Admission : documents validés, classe assignée, matricule institutionnel généré (backend, immuable) */
  async admit(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId?: string | null;  // ← optionnel : si null, on génère quand même le matricule
    validateDocuments?: boolean;
  }, userId?: string) {
    // Note : pas de assertCanEnroll ici car l'élève a déjà été pré-inscrit
    // (donc déjà compté dans le nombre d'élèves). L'admission ne fait que
    // valider son dossier et générer son matricule.
    //
    // ⚠️ Depuis le fix du 2026-07-01, classId est optionnel. Si l'élève n'a pas
    // encore de classe (ex: admission convertie sans classe disponible), on
    // génère quand même le matricule + le dossier académique. L'affectation
    // à une classe se fera plus tard via l'onglet Affectations (changeClass).

    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
      include: { studentEnrollments: true },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    const enrollment = student.studentEnrollments.find(
      (e) => e.academicYearId === data.academicYearId && e.status === ENROLLMENT_STATUS.PRE_REGISTERED,
    );
    if (!enrollment) throw new BadRequestException('Aucune pré-inscription trouvée pour cette année');

    const schoolCode = await this.matriculeService.getSchoolCode(tenantId);
    const enrollmentYear = await this.matriculeService.getEnrollmentYearFromAcademicYear(data.academicYearId);

    let matriculeAssigned: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const matricule = await this.matriculeService.generateInTransaction(
        tx,
        tenantId,
        schoolCode,
        enrollmentYear,
      );
      matriculeAssigned = matricule;
      await tx.student.update({
        where: { id: data.studentId },
        data: {
          matricule,
          enrollmentYear,
          studentCode: matricule,
          currentAcademicYearId: data.academicYearId,
        },
      });
      await tx.studentEnrollment.update({
        where: { id: enrollment.id },
        data: {
          // Si classId est null/undefined, on garde l'enrollment sans classe
          // (l'élève sera affecté plus tard via changeClass). Sinon on assigne.
          ...(data.classId && { classId: data.classId }),
          status: ENROLLMENT_STATUS.ADMITTED,
        },
      });

      // CrÃ©ation du dossier acadÃ©mique initial (Sous-module C)
      // classId est optionnel — le dossier peut exister sans classe assignée
      await tx.studentAcademicRecord.upsert({
        where: {
          studentId_academicYearId: {
            studentId: data.studentId,
            academicYearId: data.academicYearId,
          },
        },
        update: {
          ...(data.classId && { classId: data.classId }),
          schoolLevelId: data.schoolLevelId,
          enrollmentStatus: 'ADMITTED',
        },
        create: {
          tenantId,
          studentId: data.studentId,
          academicYearId: data.academicYearId,
          ...(data.classId && { classId: data.classId }),
          schoolLevelId: data.schoolLevelId,
          enrollmentStatus: 'ADMITTED',
        },
      });
    });

    const updatedEnrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: enrollment.id },
    });

    // Journalisation institutionnelle (Sous-module A)
    await this.logHistory(
      tenantId,
      data.studentId,
      data.academicYearId,
      data.classId,
      'ADMITTED',
      'Admission formelle et gÃ©nÃ©ration matricule',
      userId,
    );

    await this.logAudit(tenantId, data.studentId, 'ADMIT', userId, {
      enrollmentId: enrollment.id,
      previousStatus: enrollment.status,
      previousClassId: enrollment.classId,
    }, {
      ...(updatedEnrollment ? {
        enrollmentId: updatedEnrollment.id,
        status: updatedEnrollment.status,
        classId: updatedEnrollment.classId,
        academicYearId: updatedEnrollment.academicYearId,
      } : {}),
      matricule: matriculeAssigned ?? undefined,
    });

    // Token de vÃ©rification publique pour QR (spec : token gÃ©nÃ©rÃ© lors admission)
    try {
      await this.publicVerificationService.generateVerificationToken(
        tenantId,
        data.studentId,
        data.academicYearId,
      );
    } catch (e) {
      this.logger.warn(`Token de vÃ©rification non crÃ©Ã© Ã  l'admission pour ${data.studentId}: ${(e as Error).message}`);
    }

    // Comptes Ã©lÃ¨ves : crÃ©ation automatique StudentAccount + AccountBreakdown Ã  l'admission
    try {
      await this.studentAccountService.getOrCreate(tenantId, data.studentId, data.academicYearId);
    } catch (e) {
      this.logger.warn(`Compte Ã©lÃ¨ve non crÃ©Ã© Ã  l'admission pour ${data.studentId}: ${(e as Error).message}`);
    }

    // Alimentation ORION en temps rÃ©el (Sous-module F)
    await this.triggerOrion(tenantId, data.studentId, data.academicYearId);

    // Vérifier le nombre d'élèves vs plan d'abonnement (best-effort, asynchrone)
    this.studentCountVerifier.verifyAfterEnrollment(tenantId).catch((e) => {
      this.logger.warn(`verifyAfterEnrollment failed after admit: ${e?.message}`);
    });

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true } },
        schoolLevel: true,
      },
    });
  }

  /** Réinscription : nouvel enrollment, historique conservé, vérification arriérés */
  async reEnroll(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId: string;
    previousArrears?: number;
  }, userId?: string) {
    // Vérifier que le tenant peut inscrire un nouvel élève (plan d'abonnement)
    // La réinscription met à jour currentAcademicYearId, ce qui peut faire
    // grandir le nombre d'élèves comptés pour l'année active.
    await this.assertCanEnroll(tenantId);

    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    const arrears = data.previousArrears ?? 0;
    const newEnrollment = await this.prisma.studentEnrollment.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        studentId: data.studentId,
        classId: data.classId,
        enrollmentType: 'REPEAT',
        enrollmentDate: new Date(),
        status: ENROLLMENT_STATUS.RE_ENROLLED,
        previousArrears: arrears,
      },
    });
    await this.prisma.student.update({
      where: { id: data.studentId },
      data: { currentAcademicYearId: data.academicYearId },
    });

    await this.logAudit(tenantId, data.studentId, 'RE_ENROLL', userId, null, {
      enrollmentId: newEnrollment.id,
      academicYearId: newEnrollment.academicYearId,
      classId: newEnrollment.classId,
      previousArrears: newEnrollment.previousArrears,
    });

    // Comptes élèves : création automatique StudentAccount à la réinscription
    try {
      await this.studentAccountService.getOrCreate(tenantId, data.studentId, data.academicYearId);
    } catch (e) {
      this.logger.warn(`Compte élève non créé à la réinscription pour ${data.studentId}: ${(e as Error).message}`);
    }

    // Vérifier le nombre d'élèves vs plan d'abonnement (best-effort, asynchrone)
    this.studentCountVerifier.verifyAfterEnrollment(tenantId).catch((e) => {
      this.logger.warn(`verifyAfterEnrollment failed after reEnroll: ${e?.message}`);
    });

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }

  /**
   * Promotion annuelle d'un élève (nouvelle année académique, classe potentiellement supérieure).
   * Différent d'un simple changement de classe (même année).
   */
  async promoteStudent(
    tenantId: string,
    data: {
      studentId: string;
      fromAcademicYearId: string;
      toAcademicYearId: string;
      schoolLevelId: string;
      toClassId?: string | null;
      previousArrears?: number;
    },
    userId?: string,
  ) {
    // Vérifier que le tenant peut inscrire un nouvel élève (plan d'abonnement)
    // La promotion met à jour currentAcademicYearId vers la nouvelle année active,
    // ce qui peut faire grandir le nombre d'élèves comptés pour cette année.
    await this.assertCanEnroll(tenantId);

    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');

    const currentEnrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        tenantId,
        studentId: data.studentId,
        academicYearId: data.fromAcademicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
    });

    if (!currentEnrollment) {
      throw new BadRequestException('Aucune inscription trouvée pour l’année source');
    }

    const arrears = data.previousArrears ?? currentEnrollment.previousArrears ?? 0;

    const newEnrollment = await this.prisma.studentEnrollment.create({
      data: {
        tenantId,
        academicYearId: data.toAcademicYearId,
        schoolLevelId: data.schoolLevelId,
        studentId: data.studentId,
        classId: data.toClassId ?? currentEnrollment.classId,
        enrollmentType: 'PROMOTION',
        enrollmentDate: new Date(),
        status: ENROLLMENT_STATUS.ACTIVE,
        previousArrears: arrears,
      },
    });

    await this.prisma.student.update({
      where: { id: data.studentId },
      data: { currentAcademicYearId: data.toAcademicYearId },
    });

    // Mise Ã  jour du dossier acadÃ©mique consolidÃ© (Sous-module C)
    await this.prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicYearId: {
          studentId: data.studentId,
          academicYearId: data.fromAcademicYearId,
        },
      },
      update: {
        decision: 'PROMOTED',
        isLocked: true, // On verrouille l'annÃ©e passÃ©e
      },
      create: {
        tenantId,
        studentId: data.studentId,
        academicYearId: data.fromAcademicYearId,
        schoolLevelId: currentEnrollment.schoolLevelId,
        decision: 'PROMOTED',
        isLocked: true,
      },
    });

    // Journalisation institutionnelle (Sous-module A)
    await this.logHistory(
      tenantId,
      data.studentId,
      data.toAcademicYearId,
      newEnrollment.classId || '',
      'PROMOTED',
      `Promotion depuis l'annÃ©e ${data.fromAcademicYearId}`,
      userId,
    );

    await this.logAudit(tenantId, data.studentId, 'PROMOTE', userId, {
      fromAcademicYearId: data.fromAcademicYearId,
      fromClassId: currentEnrollment.classId,
    }, {
      toAcademicYearId: data.toAcademicYearId,
      toClassId: newEnrollment.classId,
      enrollmentId: newEnrollment.id,
      previousArrears: newEnrollment.previousArrears,
    });

    // Comptes Ã©lÃ¨ves : crÃ©ation automatique pour l'annÃ©e cible (promotion)
    try {
      await this.studentAccountService.getOrCreate(tenantId, data.studentId, data.toAcademicYearId);
    } catch (e) {
      this.logger.warn(`Compte Ã©lÃ¨ve non crÃ©Ã© Ã  la promotion pour ${data.studentId}: ${(e as Error).message}`);
    }

    // Alimentation ORION en temps rÃ©el
    await this.triggerOrion(tenantId, data.studentId, data.toAcademicYearId);

    // Vérifier le nombre d'élèves vs plan d'abonnement (best-effort, asynchrone)
    this.studentCountVerifier.verifyAfterEnrollment(tenantId).catch((e) => {
      this.logger.warn(`verifyAfterEnrollment failed after promoteStudent: ${e?.message}`);
    });

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }

  /**
   * Redoublement : nouvel enrollment dans l’année N+1 mais même classe/niveau.
   */
  async repeatStudent(
    tenantId: string,
    data: {
      studentId: string;
      fromAcademicYearId: string;
      toAcademicYearId: string;
      schoolLevelId: string;
      classId: string;
      previousArrears?: number;
    },
    userId?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');

    const arrears = data.previousArrears ?? 0;

    const newEnrollment = await this.prisma.studentEnrollment.create({
      data: {
        tenantId,
        academicYearId: data.toAcademicYearId,
        schoolLevelId: data.schoolLevelId,
        studentId: data.studentId,
        classId: data.classId,
        enrollmentType: 'REPEAT',
        enrollmentDate: new Date(),
        status: ENROLLMENT_STATUS.RE_ENROLLED,
        previousArrears: arrears,
      },
    });

    await this.prisma.student.update({
      where: { id: data.studentId },
      data: { currentAcademicYearId: data.toAcademicYearId },
    });

    // Mise Ã  jour du dossier acadÃ©mique consolidÃ© (Sous-module C)
    await this.prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicYearId: {
          studentId: data.studentId,
          academicYearId: data.fromAcademicYearId,
        },
      },
      update: {
        decision: 'REPEATED',
        isLocked: true,
      },
      create: {
        tenantId,
        studentId: data.studentId,
        academicYearId: data.fromAcademicYearId,
        schoolLevelId: data.schoolLevelId,
        decision: 'REPEATED',
        isLocked: true,
      },
    });

    // Journalisation institutionnelle (Sous-module A)
    await this.logHistory(
      tenantId,
      data.studentId,
      data.toAcademicYearId,
      newEnrollment.classId || '',
      'REPEATED',
      `Redoublement depuis l'annÃ©e ${data.fromAcademicYearId}`,
      userId,
    );

    await this.logAudit(tenantId, data.studentId, 'REPEAT', userId, null, {
      enrollmentId: newEnrollment.id,
      academicYearId: newEnrollment.academicYearId,
      classId: newEnrollment.classId,
      previousArrears: newEnrollment.previousArrears,
    });

    // Comptes Ã©lÃ¨ves : crÃ©ation automatique pour l'annÃ©e cible (redoublement)
    try {
      await this.studentAccountService.getOrCreate(tenantId, data.studentId, data.toAcademicYearId);
    } catch (e) {
      this.logger.warn(`Compte Ã©lÃ¨ve non crÃ©Ã© au redoublement pour ${data.studentId}: ${(e as Error).message}`);
    }

    // Alimentation ORION
    await this.triggerOrion(tenantId, data.studentId, data.toAcademicYearId);

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }


  /** Changement de classe (même année) — vérifié par trigger si notes existent */
  async changeClass(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    newClassId: string;
  }, userId?: string) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        tenantId,
        academicYearId: data.academicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
    if (!enrollment) throw new NotFoundException('Inscription non trouvée');
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: { classId: data.newClassId },
    });

    await this.logAudit(tenantId, data.studentId, 'CHANGE_CLASS', userId, {
      enrollmentId: enrollment.id,
      previousClassId: enrollment.classId,
    }, {
      enrollmentId: updatedEnrollment.id,
      classId: updatedEnrollment.classId,
      academicYearId: updatedEnrollment.academicYearId,
    });

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }

  /** Transfert : statut TRANSFERRED, export PDF côté appelant */
  async transfer(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    exitReason?: string;
  }, userId?: string) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        tenantId,
        academicYearId: data.academicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
    if (!enrollment) throw new NotFoundException('Inscription non trouvée');
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: ENROLLMENT_STATUS.TRANSFERRED,
        exitDate: new Date(),
        exitReason: data.exitReason ?? 'Transfert',
      },
    });
    await this.prisma.student.update({
      where: { id: data.studentId },
      data: { status: 'TRANSFERRED' },
    });
    await this.publicVerificationService.deactivateTokensForStudent(data.studentId).catch(() => {});

    // Journalisation institutionnelle du transfert (Sous-module C/A)
    await this.prisma.studentAuditLog.create({
      data: {
        tenantId,
        studentId: data.studentId,
        userId: userId ?? null,
        action: 'TRANSFER_HISTORY',
        beforeData: null,
        afterData: {
          reason: data.exitReason || 'Transfert',
          status: 'COMPLETED',
        },
      },
    });

    await this.logHistory(
      tenantId,
      data.studentId,
      data.academicYearId,
      enrollment.classId || '',
      'TRANSFERRED',
      `Transfert sortant : ${data.exitReason || 'non spécifié'}`,
      userId,
    );

    await this.logAudit(tenantId, data.studentId, 'TRANSFER', userId, {
      enrollmentId: enrollment.id,
      previousStatus: enrollment.status,
    }, {
      enrollmentId: updatedEnrollment.id,
      status: updatedEnrollment.status,
      exitDate: updatedEnrollment.exitDate,
      exitReason: updatedEnrollment.exitReason,
    });

    // Alimentation ORION
    await this.triggerOrion(tenantId, data.studentId, data.academicYearId);

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
      },
    });
  }

  /**
   * Opérations batch : promotion et mise à jour de statut.
   */
  async batchPromote(
    tenantId: string,
    data: {
      studentIds: string[];
      fromAcademicYearId: string;
      toAcademicYearId: string;
      schoolLevelId: string;
      toClassId?: string | null;
    },
    userId?: string,
  ) {
    const results: Array<{ studentId: string; success: boolean; error?: string }> = [];
    for (const studentId of data.studentIds) {
      try {
        await this.promoteStudent(
          tenantId,
          {
            studentId,
            fromAcademicYearId: data.fromAcademicYearId,
            toAcademicYearId: data.toAcademicYearId,
            schoolLevelId: data.schoolLevelId,
            toClassId: data.toClassId ?? null,
          },
          userId,
        );
        results.push({ studentId, success: true });
      } catch (e) {
        results.push({ studentId, success: false, error: (e as Error).message });
      }
    }
    return { results };
  }

  async batchUpdateStatus(
    tenantId: string,
    data: {
      studentIds: string[];
      status: string;
    },
    userId?: string,
  ) {
    const now = new Date();

    // 1. Mettre à jour le statut de l'élève (student.status)
    await this.prisma.student.updateMany({
      where: {
        tenantId,
        id: { in: data.studentIds },
      },
      data: {
        status: data.status,
        updatedAt: now,
      },
    });

    // 2. ⚠️ Mettre aussi à jour le statut de l'enrollment (studentEnrollment.status)
    //    Le frontend affiche enr.status, pas student.status. Sans cette mise à jour,
    //    l'élève reste "Pré-inscrit" visuellement même après validation.
    //    On mappe ACTIVE → ACTIVE pour l'enrollment (PRE_REGISTERED → ACTIVE).
    await this.prisma.studentEnrollment.updateMany({
      where: {
        tenantId,
        studentId: { in: data.studentIds },
        // Ne mettre à jour que les enrollments qui ne sont pas déjà dans le statut cible
        // et qui ne sont pas WITHDRAWN/TRANSFERRED
        status: { notIn: ['WITHDRAWN', 'TRANSFERRED', data.status] },
      },
      data: {
        status: data.status,
        updatedAt: now,
      },
    });

    for (const studentId of data.studentIds) {
      await this.logAudit(
        tenantId,
        studentId,
        'UPDATE_STATUS',
        userId,
        { previousStatus: undefined },
        { status: data.status },
      );
    }

    return {
      updated: data.studentIds.length,
      status: data.status,
    };
  }

  /** Liste des élèves d'une classe */
  async getStudentsByClass(tenantId: string, classId: string, academicYearId?: string) {
    const where: any = {
      tenantId,
      studentEnrollments: {
        some: {
          classId,
          ...(academicYearId && { academicYearId }),
        },
      },
    };
    return this.prisma.student.findMany({
      where,
      include: {
        schoolLevel: true,
        studentEnrollments: {
          where: { classId },
          include: { class: true, academicYear: true },
        },
        studentGuardians: { where: { isPrimary: true }, include: { guardian: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /** Liste de toutes les inscriptions (enrollments) */
  async getEnrollments(tenantId: string, params: { academicYearId?: string, schoolLevelId?: string }) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        ...(params.academicYearId && { academicYearId: params.academicYearId }),
        ...(params.schoolLevelId && { schoolLevelId: params.schoolLevelId }),
      },
      include: {
        student: true,
        class: true,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
  }

  /** Historique unifié : admissions, réinscriptions, transferts */
  async getStudentHistory(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId, tenantId },
      include: { class: true, academicYear: true, schoolLevel: true },
      orderBy: { enrollmentDate: 'desc' },
    });
    const transfers = await this.prisma.transferRequest.findMany({
      where: { studentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const classIds = [...new Set(transfers.flatMap((t) => [t.fromClassId, t.toClassId]))];
    const classes = classIds.length
      ? await this.prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));
    return {
      student: { id: student.id, firstName: student.firstName, lastName: student.lastName, studentCode: student.studentCode },
      enrollments: enrollments.map((e) => ({
        id: e.id,
        academicYearId: e.academicYearId,
        academicYearName: (e as any).academicYear?.name,
        classId: e.classId,
        className: (e as any).class?.name,
        status: e.status,
        enrollmentType: e.enrollmentType,
        enrollmentDate: e.enrollmentDate,
        exitDate: e.exitDate,
        exitReason: e.exitReason,
        previousArrears: e.previousArrears,
      })),
      transfers: transfers.map((t) => ({
        id: t.id,
        status: t.status,
        fromClassId: t.fromClassId,
        toClassId: t.toClassId,
        fromClassName: classMap[t.fromClassId],
        toClassName: classMap[t.toClassId],
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Export EDUCMASTER — JSON conforme pour la plateforme gouvernementale Bénin (MEMP / emp.educmaster.bj).
   * Trois identifiants distincts : (1) matricule Academia Helm = interne établissement ;
   * (2) NPI = Numéro d'Identification Personnel (citoyens béninois) ; (3) numéro Educmaster = identifiant plateforme MEMP.
   */
  async exportEducmaster(tenantId: string, studentId: string): Promise<{ data: any; logId: string }> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true } },
        studentGuardians: { include: { guardian: true } },
        schoolLevel: true,
      },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    const payload = {
      exportType: 'EDUCMASTER',
      exportedAt: new Date().toISOString(),
      tenantId,
      student: {
        id: student.id,
        matriculeAcademiaHelm: student.matricule ?? student.studentCode,
        studentCode: student.studentCode,
        npi: student.npi,
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        nationality: student.nationality,
        placeOfBirth: student.placeOfBirth,
        regimeType: student.regimeType,
        status: student.status,
      },
      enrollments: (student.studentEnrollments || []).map((e) => ({
        academicYearId: e.academicYearId,
        classId: e.classId,
        className: (e as any).class?.name,
        status: e.status,
        enrollmentType: e.enrollmentType,
        previousArrears: e.previousArrears,
      })),
      guardians: (student.studentGuardians || []).map((sg) => ({
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
        ...(sg as any).guardian,
      })),
    };
    const log = await this.prisma.nationalExportLog.create({
      data: {
        tenantId,
        studentId,
        exportType: 'EDUCMASTER',
        status: 'SUCCESS',
        metadata: { exportedAt: payload.exportedAt },
      },
    });
    return { data: payload, logId: log.id };
  }

  /**
   * Journal d'audit des actions élève (Module 1)
   */
  async getStudentAuditLog(tenantId: string, studentId: string) {
    const entries = await this.prisma.studentAuditLog.findMany({
      where: { tenantId, studentId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return entries.map((e) => ({
      id: e.id,
      action: e.action,
      createdAt: e.createdAt,
      userId: e.userId,
      beforeData: e.beforeData,
      afterData: e.afterData,
    }));
  }
}
