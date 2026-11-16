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
import { StudentIdentifierService } from './student-identifier.service';
import { resolveSchoolLevelFilter } from '../../common/context/resolve-school-level';
import { applyLevelScope } from '../../common/context/scope-where';

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
    private readonly studentIdentifierService: StudentIdentifierService,
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

  /** Pré-inscription : dossier incomplet autorisé, statut PRE_REGISTERED.
   *  previousArrears permet aux nouveaux clients de saisir les arriérés
   *  antérieurs (sur papier) au moment de l'onboarding.
   *
   *  enrollmentType détermine le type de frais à appliquer :
   *    - 'NEW' (défaut) → nouvel élève → frais d'INSCRIPTION
   *    - 'REPEAT' → ancien élève → frais de REINSCRIPTION
   *  Ce paramètre est propagated depuis Admission.isNewStudent lors de la
   *  conversion d'une admission en élève (voir admission.service.ts).
   */
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
      /** ⭐ Classe OFFICIELLE (AcademicClass) — ex: CE1, CP, 6ème.
       *  Si non fournie mais que classId est fourni, on tente de la résoudre
       *  via Class.officialClassId. */
      academicClassId?: string;
      photoUrl?: string;
      npi?: string;
      previousArrears?: number;
      /** Type d'inscription : 'NEW' (défaut) pour nouvel élève, 'REPEAT' pour ancien élève */
      enrollmentType?: string;
    },
    userId?: string,
  ) {
    // Vérifier que le tenant peut inscrire un nouvel élève (plan d'abonnement)
    await this.assertCanEnroll(tenantId);

    // ⭐ FIX 2026-09-07 « miroir bilingue / multi-tables » : la FK
    //    Student.schoolLevelId référence school_levels. Le wizard envoie
    //    déjà le bon UUID (schoolLevelId du BFF — Task 27), mais par défense
    //    en profondeur on résout aussi un UUID education_levels / un miroir
    //    EN (NURSERY/PRIMARY → MATERNELLE/PRIMAIRE) ou un composite MAT_PRI.
    //    ⭐ Paiement unique : l'élève garde UN seul schoolLevelId (FR) —
    //    l'inscription/scolarité payée côté FR vaut pour la piste EN (miroir).
    if (data.schoolLevelId) {
      const resolvedIds = await resolveSchoolLevelFilter(this.prisma, tenantId, data.schoolLevelId);
      if (resolvedIds && resolvedIds.length > 0) {
        if (resolvedIds.length > 1) {
          console.warn('PRE_REGISTER_AMBIGUOUS_LEVEL', {
            tenantId,
            received: data.schoolLevelId,
            resolved: resolvedIds,
          });
        }
        data = { ...data, schoolLevelId: resolvedIds[0] };
      }
    }

    const enrollmentDate = new Date();
    const enrollmentType = data.enrollmentType || 'NEW';

    // ⭐ Résoudre academicClassId si non fourni mais que classId est fourni.
    // La classe physique (Class) a un FK officialClassId vers AcademicClass.
    let resolvedAcademicClassId = data.academicClassId;
    if (!resolvedAcademicClassId && data.classId) {
      const physicalClass = await this.prisma.class.findFirst({
        where: { id: data.classId, tenantId },
        select: { officialClassId: true },
      });
      if (physicalClass?.officialClassId) {
        resolvedAcademicClassId = physicalClass.officialClassId;
      }
    }

    // ⭐ FIX 2026-09-06 — Anomalie « élèves CP absents de la Liste des élèves » :
    //    le formulaire « Nouvelle inscription » (onglet Inscriptions) envoie
    //    UNIQUEMENT academicClassId (classe officielle), sans classId (classe
    //    physique). L'élève apparaissait dans l'onglet Inscriptions mais restait
    //    INVISIBLE dans l'onglet « Liste des élèves » (groupé par classe physique).
    //    → Résolution inverse : si une seule section physique correspond à cette
    //    classe officielle pour l'année, on l'assigne automatiquement (classId).
    //    Si plusieurs sections existent (CP-A, CP-B…), on n'en choisit AUCUNE :
    //    l'affectation reste manuelle via l'onglet Affectations (changeClass),
    //    et l'onglet « Liste des élèves » affiche désormais un groupe « Non affectés ».
    let resolvedClassId = data.classId ?? null;
    if (!resolvedClassId && resolvedAcademicClassId) {
      const physicalSections = await this.prisma.class.findMany({
        where: {
          tenantId,
          academicYearId: data.academicYearId,
          officialClassId: resolvedAcademicClassId,
        },
        select: { id: true, name: true },
      });
      if (physicalSections.length === 1) {
        resolvedClassId = physicalSections[0].id;
      }
    }

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
        // ⭐ 2026-10-01 — Numéro Educmaster (requis pour l'export des 6e vers MEMP)
        educMasterMatricule: (data as any).educMasterMatricule || null,
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
        classId: resolvedClassId,
        // ⭐ Classe officielle (AcademicClass) — résolue depuis le paramètre
        // ou depuis Class.officialClassId si seul classId est fourni.
        academicClassId: resolvedAcademicClassId ?? null,
        enrollmentType,
        enrollmentDate,
        status: ENROLLMENT_STATUS.PRE_REGISTERED,
        previousArrears: data.previousArrears ?? 0,
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
      classId: resolvedClassId,
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

    // ⭐ FIX 2026-09-07 « miroir bilingue / multi-tables » : résolution du
    //    schoolLevelId (UUID education_levels / miroir EN → school_levels).
    if (data.schoolLevelId) {
      const resolvedIds = await resolveSchoolLevelFilter(this.prisma, tenantId, data.schoolLevelId);
      if (resolvedIds && resolvedIds.length > 0) {
        data = { ...data, schoolLevelId: resolvedIds[0] };
      }
    }

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

    // Matricule GLOBAL Academia Helm (AH-STU-YY-XXX)
    // Genere a l admission pour que l eleve ait un identifiant unique
    // inter-etablissements. Stocke sur Student.globalStudentId + StudentIdentifier.
    try {
      await this.studentIdentifierService.generateGlobalMatricule(
        tenantId,
        data.studentId,
        'BJ',
        userId,
      );
      this.logger.log(`Global matricule generated for student ${data.studentId}`);
    } catch (e) {
      this.logger.warn(`Global matricule not created at admission for ${data.studentId}: ${(e as Error).message}`);
    }
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

  /**
   * ⭐ RÉPARATION D'UNE INSCRIPTION INTERROMPUE (fix 2026-09-14).
   *
   * Le wizard « Nouvelle inscription » est une orchestration frontend en 3
   * appels (preRegister → admit → guardians). Si la connexion tombe entre
   * deux appels, l'élève reste dans un état incomplet :
   *   - sans matricule (admit non exécuté),
   *   - sans dossier académique (StudentAcademicRecord),
   *   - sans identifiant global (StudentIdentifier),
   *   - sans compte financier ou avec un compte sans imputations,
   *   - ou bloqué au statut PRE_REGISTERED.
   *
   * Cette méthode est IDEMPOTENTE : elle ne fait que COMPLÉTER ce qui manque,
   * sans jamais détruire ce qui existe déjà. Appelée depuis le modal
   * « Éditer / Compléter l'inscription » — elle remplace l'ancien appel
   * changeClass() qui envoyait un UUID AcademicClass là où le backend attend
   * un UUID de classe physique (échec silencieux systématique).
   */
  async repairEnrollment(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    schoolLevelId?: string;
    /** Classe OFFICIELLE (AcademicClass) sélectionnée dans le wizard d'édition */
    academicClassId?: string;
    /** NEW (frais d'inscription) ou REPEAT (frais de réinscription) */
    enrollmentType?: string;
  }, userId?: string) {
    const report: {
      matricule?: string;
      matriculeGenerated: boolean;
      statusFixed: boolean;
      academicClassUpdated: boolean;
      physicalClassResolved?: string | null;
      academicRecordCreated: boolean;
      accountCreated: boolean;
      accountRecalculated: boolean;
      breakdownsCount: number;
      actions: string[];
    } = {
      matriculeGenerated: false,
      statusFixed: false,
      academicClassUpdated: false,
      academicRecordCreated: false,
      accountCreated: false,
      accountRecalculated: false,
      breakdownsCount: 0,
      actions: [],
    };

    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
      include: {
        studentEnrollments: { where: { academicYearId: data.academicYearId } },
      },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');

    // Résolution du niveau (miroir bilingue / multi-tables — même règle que preRegister)
    const schoolLevelId = data.schoolLevelId || student.schoolLevelId;
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      const resolvedIds = await resolveSchoolLevelFilter(this.prisma, tenantId, schoolLevelId);
      if (resolvedIds && resolvedIds.length > 0) {
        data = { ...data, schoolLevelId: resolvedIds[0] };
      }
    }
    const effectiveLevelId = (data.schoolLevelId && data.schoolLevelId !== 'ALL')
      ? data.schoolLevelId
      : student.schoolLevelId;

    // ── 1. Enrollment manquant (connexion tombée entre les 2 creates de preRegister) ──
    let enrollment = student.studentEnrollments?.[0] ?? null;
    if (!enrollment) {
      enrollment = await this.prisma.studentEnrollment.create({
        data: {
          tenantId,
          academicYearId: data.academicYearId,
          schoolLevelId: effectiveLevelId,
          studentId: student.id,
          academicClassId: data.academicClassId ?? null,
          enrollmentType: data.enrollmentType || 'NEW',
          enrollmentDate: new Date(),
          status: ENROLLMENT_STATUS.PRE_REGISTERED,
        },
      });
      report.actions.push('inscription recréée (elle manquait suite à l\'interruption)');
      await this.logAudit(tenantId, student.id, 'REPAIR_CREATE_ENROLLMENT', userId, null, {
        enrollmentId: enrollment.id,
      });
    }

    // ── 2. Classe officielle + type d'inscription ──────────────────────────
    const patch: any = {};
    if (data.academicClassId && data.academicClassId !== enrollment.academicClassId) {
      patch.academicClassId = data.academicClassId;
    }
    if (data.enrollmentType && data.enrollmentType !== enrollment.enrollmentType) {
      patch.enrollmentType = data.enrollmentType;
    }
    if (Object.keys(patch).length > 0) {
      await this.prisma.studentEnrollment.update({
        where: { id: enrollment.id },
        data: patch,
      });
      if (patch.academicClassId) {
        report.academicClassUpdated = true;
        report.actions.push('classe officielle mise à jour');
      }
      if (patch.enrollmentType) {
        report.actions.push(`type d'inscription → ${patch.enrollmentType}`);
      }
    }

    // Classe physique : ré-assigner si elle ne correspond plus à la classe officielle
    if (data.academicClassId) {
      const currentClass = enrollment.classId
        ? await this.prisma.class.findUnique({
            where: { id: enrollment.classId },
            select: { id: true, officialClassId: true },
          })
        : null;
      const classMismatch = !currentClass || currentClass.officialClassId !== data.academicClassId;
      if (classMismatch) {
        // Même règle que preRegister : section unique → assignation auto ;
        // plusieurs sections → classe physique retirée (affectation manuelle)
        const physicalSections = await this.prisma.class.findMany({
          where: {
            tenantId,
            academicYearId: data.academicYearId,
            officialClassId: data.academicClassId,
          },
          select: { id: true, name: true },
        });
        const newPhysicalClassId = physicalSections.length === 1 ? physicalSections[0].id : null;
        if (newPhysicalClassId !== enrollment.classId) {
          await this.prisma.studentEnrollment.update({
            where: { id: enrollment.id },
            data: { classId: newPhysicalClassId },
          });
          report.physicalClassResolved = newPhysicalClassId;
          report.actions.push(newPhysicalClassId
            ? 'section physique ré-affectée automatiquement'
            : 'section physique retirée (plusieurs sections possibles — affectation manuelle)');
          // Tracer le changement pour l'historique
          try {
            await this.prisma.classTransfer.create({
              data: {
                tenantId,
                academicYearId: data.academicYearId,
                schoolLevelId: effectiveLevelId,
                studentId: student.id,
                fromClassId: enrollment.classId,
                toClassId: newPhysicalClassId,
                transferDate: new Date(),
                reason: 'Réparation d\'inscription interrompue',
                approvedBy: userId,
                transferType: enrollment.classId ? 'CLASS_CHANGE' : 'INITIAL_ASSIGNMENT',
              },
            });
          } catch {}
        }
      }
    }

    // ── 3. Matricule manquant → génération (même mécanique que admit) ─────
    if (!student.matricule) {
      const schoolCode = await this.matriculeService.getSchoolCode(tenantId);
      const enrollmentYear = await this.matriculeService.getEnrollmentYearFromAcademicYear(data.academicYearId);
      const matricule = await this.prisma.$transaction(async (tx) =>
        this.matriculeService.generateInTransaction(tx, tenantId, schoolCode, enrollmentYear),
      );
      await this.prisma.student.update({
        where: { id: student.id },
        data: {
          matricule,
          enrollmentYear,
          studentCode: matricule,
          currentAcademicYearId: data.academicYearId,
        },
      });
      report.matricule = matricule;
      report.matriculeGenerated = true;
      report.actions.push(`matricule ${matricule} généré`);
    }

    // ── 4. Statut PRE_REGISTERED/PENDING → ADMITTED + dossier académique ──
    const currentEnrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: enrollment.id },
    });
    if (['PRE_REGISTERED', 'PENDING'].includes(currentEnrollment?.status ?? '')) {
      await this.prisma.studentEnrollment.update({
        where: { id: enrollment.id },
        data: { status: ENROLLMENT_STATUS.ADMITTED },
      });
      report.statusFixed = true;
      report.actions.push('statut porté à ADMITTED');

      // Historique institutionnel (comme admit)
      await this.logHistory(
        tenantId,
        student.id,
        data.academicYearId,
        currentEnrollment?.classId ?? null,
        'ADMITTED',
        'Réparation d\'inscription interrompue (complétion automatique)',
        userId,
      );
    }

    // Dossier académique — upsert idempotent (comme admit)
    const existingRecord = await this.prisma.studentAcademicRecord.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: student.id,
          academicYearId: data.academicYearId,
        },
      },
    });
    if (!existingRecord) {
      await this.prisma.studentAcademicRecord.create({
        data: {
          tenantId,
          studentId: student.id,
          academicYearId: data.academicYearId,
          schoolLevelId: effectiveLevelId,
          enrollmentStatus: 'ADMITTED',
        },
      });
      report.academicRecordCreated = true;
      report.actions.push('dossier académique créé');
    }

    // Identifiant global (AH-STU-…) si manquant — best-effort
    const existingIdentifier = await this.prisma.studentIdentifier.findFirst({
      where: { studentId: student.id },
    });
    if (!existingIdentifier) {
      try {
        await this.studentIdentifierService.generateGlobalMatricule(tenantId, student.id, 'BJ', userId);
        report.actions.push('identifiant global généré');
      } catch (e) {
        this.logger.warn(`Identifiant global non créé (réparation) pour ${student.id}: ${(e as Error).message}`);
      }
    }

    // Token de vérification publique — best-effort, non bloquant
    try {
      await this.publicVerificationService.generateVerificationToken(
        tenantId,
        student.id,
        data.academicYearId,
      );
    } catch (e) {
      this.logger.warn(`Token non créé (réparation) pour ${student.id}: ${(e as Error).message}`);
    }

    // ── 5. Compte financier + imputations ──────────────────────────────────
    //    - aucun compte → getOrCreate (crée compte + imputations)
    //    - compte SANS imputations, ou classe/type/niveau changés → recalculate
    const account = await this.prisma.studentAccount.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: student.id,
          academicYearId: data.academicYearId,
        },
      },
      include: { breakdowns: true },
    });
    const needsRecalc =
      !account ||
      account.breakdowns.length === 0 ||
      report.academicClassUpdated ||
      !!report.physicalClassResolved ||
      !!patch.enrollmentType;
    if (!account) {
      const { account: created } = await this.studentAccountService.getOrCreate(
        tenantId,
        student.id,
        data.academicYearId,
      );
      report.accountCreated = true;
      report.breakdownsCount = created?.breakdowns?.length ?? 0;
      report.actions.push('compte financier créé avec ses imputations');
    } else if (needsRecalc) {
      const updated = await this.studentAccountService.recalculate(
        student.id,
        tenantId,
        data.academicYearId,
      );
      report.accountRecalculated = true;
      report.breakdownsCount = (updated as any)?.breakdowns?.length ?? 0;
      report.actions.push('compte financier recalculé (imputations des frais)');
    } else {
      report.breakdownsCount = account.breakdowns.length;
    }

    await this.logAudit(tenantId, student.id, 'REPAIR_ENROLLMENT', userId, null, {
      academicYearId: data.academicYearId,
      ...report,
    });

    const result = await this.prisma.student.findUnique({
      where: { id: student.id },
      include: {
        studentEnrollments: {
          where: { academicYearId: data.academicYearId },
          include: { class: true, academicClass: true, academicYear: true },
        },
        schoolLevel: true,
      },
    });

    return { student: result, repair: report };
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
    reason?: string;
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

    // Vérifier que la nouvelle classe existe et appartient au tenant
    // ⭐ 2026-09-17 — également chargée pour son officialClassId (backfill
    //    de la classe officielle si l'inscription n'en a pas encore).
    const newPhysicalClass = await this.prisma.class.findFirst({
      where: { id: data.newClassId, tenantId },
    });
    if (!newPhysicalClass) throw new NotFoundException('Nouvelle classe non trouvée');

    const previousClassId = enrollment.classId;
    const updateData: { classId: string; academicClassId?: string } = { classId: data.newClassId };
    // ⭐ 2026-09-17 — Anomalie « non affectés » : backfill de la classe OFFICIELLE
    //    dès qu'on pose une classe PHYSIQUE et que academicClassId manque
    //    (inscriptions issues du sync hors-ligne sans academicClassId).
    // ⭐ FIX 2026-11-16 (1.0.15, anomalie ATCHADE Mazoune @ CSPEB) : la classe
    //    officielle doit désormais rester SYNCHRONISÉE avec la classe physique —
    //    si la nouvelle section physique (ex: CI) est rattachée à une classe
    //    officielle différente (ex: CP), on met à jour academicClassId.
    //    AVANT : l'élève changé de section CI gardait academicClassId=CP → il
    //    restait « au CP » dans l'onglet Inscriptions, les listes officielles
    //    et les templates Educ Master (groupés par classe officielle), même
    //    après plusieurs tentatives de ré-affectation.
    if (
      newPhysicalClass.officialClassId &&
      newPhysicalClass.officialClassId !== enrollment.academicClassId
    ) {
      updateData.academicClassId = newPhysicalClass.officialClassId;
    }
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: updateData,
    });

    // ⭐ Créer un enregistrement ClassTransfer pour l'historique
    if (previousClassId !== data.newClassId) {
      await this.prisma.classTransfer.create({
        data: {
          tenantId,
          academicYearId: data.academicYearId,
          schoolLevelId: enrollment.schoolLevelId,
          studentId: data.studentId,
          fromClassId: previousClassId,
          toClassId: data.newClassId,
          transferDate: new Date(),
          reason: data.reason || 'Changement de classe physique',
          approvedBy: userId,
          transferType: previousClassId ? 'CLASS_CHANGE' : 'INITIAL_ASSIGNMENT',
        },
      });
    }

    await this.logAudit(tenantId, data.studentId, 'CHANGE_CLASS', userId, {
      enrollmentId: enrollment.id,
      previousClassId,
    }, {
      enrollmentId: updatedEnrollment.id,
      classId: updatedEnrollment.classId,
      academicYearId: updatedEnrollment.academicYearId,
    });

    // ⭐ P1.3 — Recalculer le StudentAccount après changement de classe
    try {
      await this.studentAccountService.recalculate(data.studentId, tenantId, data.academicYearId);
    } catch (e: any) {
      this.logger.warn(`Compte non recalculé après changeClass: ${(e as Error).message}`);
    }

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicClass: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }

  /**
   * ⭐ Affectation initiale d'un élève vers une classe PHYSIQUE.
   * Utilisé par le sous-onglet "Affectation vers classe physique".
   * L'élève a été admis/inscrit dans une classe OFFICIELLE (academicClassId),
   * mais n'a pas encore de classe PHYSIQUE (classId NULL ou vide).
   * Cette méthode assigne la classe physique et crée un ClassTransfer
   * de type INITIAL_ASSIGNMENT.
   */
  async assignPhysicalClass(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    physicalClassId: string;
    reason?: string;
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

    // Vérifier que la classe physique existe et appartient au tenant
    const physicalClass = await this.prisma.class.findFirst({
      where: { id: data.physicalClassId, tenantId },
    });
    if (!physicalClass) throw new NotFoundException('Classe physique non trouvée');

    const previousClassId = enrollment.classId;
    const updateData: { classId: string; academicClassId?: string } = { classId: data.physicalClassId };
    // ⭐ 2026-09-17 — Anomalie « non affectés » (onglet Inscriptions) : backfill
    //    de la classe OFFICIELLE dès qu'on affecte une classe PHYSIQUE et que
    //    academicClassId manque. Sans cela, l'onglet Inscriptions considère
    //    l'élève « non affecté » bien qu'il ait une section physique.
    // ⭐ FIX 2026-11-16 (1.0.15, anomalie ATCHADE Mazoune @ CSPEB) : si la
    //    section physique rattachée correspond à une classe officielle
    //    DIFFÉRENTE de l'actuelle, la classe officielle est resynchronisée
    //    (l'élève affecté en section CI ne doit pas rester « officiellement »
    //    au CP dans les listes officielles et les templates Educ Master).
    if (
      physicalClass.officialClassId &&
      physicalClass.officialClassId !== enrollment.academicClassId
    ) {
      updateData.academicClassId = physicalClass.officialClassId;
    }
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: updateData,
    });

    // ⭐ Créer un ClassTransfer de type INITIAL_ASSIGNMENT (ou CLASS_CHANGE si déjà affecté)
    await this.prisma.classTransfer.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: enrollment.schoolLevelId,
        studentId: data.studentId,
        fromClassId: previousClassId,
        toClassId: data.physicalClassId,
        transferDate: new Date(),
        reason: data.reason || (previousClassId ? 'Réaffectation vers classe physique' : 'Affectation initiale vers classe physique'),
        approvedBy: userId,
        transferType: previousClassId ? 'CLASS_CHANGE' : 'INITIAL_ASSIGNMENT',
      },
    });

    await this.logAudit(tenantId, data.studentId, 'ASSIGN_PHYSICAL_CLASS', userId, {
      enrollmentId: enrollment.id,
      previousClassId,
    }, {
      enrollmentId: updatedEnrollment.id,
      classId: updatedEnrollment.classId,
      physicalClassName: physicalClass.name,
    });

    // ⭐ P1.3 — Recalculer le StudentAccount car la structure de frais peut
    //    dépendre de la classe physique. Sans ça, l'élève garde l'ancienne
    //    structure de frais après changement de classe → incohérence financière.
    try {
      await this.studentAccountService.recalculate(data.studentId, tenantId, data.academicYearId);
    } catch (e: any) {
      this.logger.warn(`Compte non recalculé après assignPhysicalClass: ${(e as Error).message}`);
    }

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicClass: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }

  /**
   * ⭐ Changement de série officielle d'un élève.
   * Utilisé par le sous-onglet "Changement de série".
   * Met à jour la série via l'AcademicClass rattachée à l'inscription.
   * Si l'élève n'a pas d'academicClassId, on ne peut pas changer la série
   * (il faut d'abord l'inscrire dans une classe officielle).
   */
  async changeSeries(tenantId: string, data: {
    studentId: string;
    academicYearId: string;
    newSeriesId: string;
    reason?: string;
  }, userId?: string) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        tenantId,
        academicYearId: data.academicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
      include: { academicClass: true },
    });
    if (!enrollment) throw new NotFoundException('Inscription non trouvée');

    if (!enrollment.academicClassId || !enrollment.academicClass) {
      throw new BadRequestException(
        "L'élève n'a pas de classe officielle (academicClassId). Impossible de changer la série. " +
        'Veuillez d\'abord l\'inscrire dans une classe officielle.',
      );
    }

    const previousSeriesId = enrollment.academicClass.seriesId || null;

    // ⭐ Trouver une AcademicClass équivalente (même niveau + même cycle) avec la nouvelle série
    // Si aucune AcademicClass n'existe pour cette combinaison, on lève une erreur
    const targetAcademicClass = await this.prisma.academicClass.findFirst({
      where: {
        tenantId,
        academicYearId: data.academicYearId,
        levelId: enrollment.academicClass.levelId,
        cycleId: enrollment.academicClass.cycleId,
        seriesId: data.newSeriesId,
        isActive: true,
      },
    });

    if (!targetAcademicClass) {
      throw new BadRequestException(
        "Aucune classe officielle trouvée pour cette combinaison niveau/cycle/série. " +
        "Veuillez d'abord créer la classe officielle correspondante dans le module Pédagogie.",
      );
    }

    // Mettre à jour l'inscription avec la nouvelle AcademicClass
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: { academicClassId: targetAcademicClass.id },
    });

    // ⭐ Créer un ClassTransfer de type SERIES_CHANGE
    await this.prisma.classTransfer.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: enrollment.schoolLevelId,
        studentId: data.studentId,
        fromClassId: enrollment.classId || null,
        toClassId: enrollment.classId || null, // pas de changement de classe physique
        transferDate: new Date(),
        reason: data.reason || `Changement de série : ${previousSeriesId || '—'} → ${data.newSeriesId}`,
        approvedBy: userId,
        transferType: 'SERIES_CHANGE',
        fromSeriesId: previousSeriesId,
        toSeriesId: data.newSeriesId,
      },
    });

    await this.logAudit(tenantId, data.studentId, 'CHANGE_SERIES', userId, {
      enrollmentId: enrollment.id,
      previousSeriesId,
      previousAcademicClassId: enrollment.academicClassId,
    }, {
      enrollmentId: updatedEnrollment.id,
      newAcademicClassId: targetAcademicClass.id,
      newSeriesId: data.newSeriesId,
    });

    // ⭐ P1.3 — Recalculer le StudentAccount après changement de série
    try {
      await this.studentAccountService.recalculate(data.studentId, tenantId, data.academicYearId);
    } catch (e: any) {
      this.logger.warn(`Compte non recalculé après changeSeries: ${(e as Error).message}`);
    }

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicClass: { include: { series: true } }, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
        schoolLevel: true,
      },
    });
  }

  /**
   * ⭐ Liste les élèves admis/inscrits SANS classe physique (classId NULL).
   * Utilisé par le sous-onglet "Affectation vers classe physique".
   * Retourne les élèves avec leur classe officielle (academicClass) pour permettre
   * à l'administration de les répartir dans les sections physiques.
   */
  async getStudentsWithoutPhysicalClass(tenantId: string, academicYearId: string) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        classId: null,
        status: { in: ['ADMITTED', 'PRE_REGISTERED', 'ACTIVE', 'ENROLLED'] },
      },
      include: {
        student: {
          include: {
            // ⭐ FIX 2026-09-07 : la relation directe Student.guardians n'existe plus
            // depuis la restructuration en table pivot (StudentGuardian, 2026-01-08).
            // L'ancien include « guardians » déclenchait PrismaClientValidationError
            // (400) → l'endpoint students-without-physical-class était cassé et le
            // frontend avalait l'erreur en affichant « tous affectés ».
            studentGuardians: { take: 1, include: { guardian: true } },
          },
        },
        academicClass: {
          include: {
            level: true,
            cycle: true,
            series: true,
          },
        },
        schoolLevel: true,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
  }

  /**
   * ⭐ Réinitialise toutes les affectations de classes physiques pour une année.
   * Passe classId = NULL sur toutes les inscriptions actives de l'année,
   * afin que l'administrateur puisse refaire l'affectation manuellement
   * via le sous-onglet "Affectation vers classe physique".
   *
   * ⚠️ L'academicClassId (classe officielle) est PRÉSERVÉ — seul le classId
   * (classe physique) est réinitialisé.
   */
  async resetPhysicalClassAssignments(tenantId: string, academicYearId: string): Promise<{
    reset: number;
    academicYearId: string;
  }> {
    const where = {
      tenantId,
      academicYearId,
      classId: { not: null },
      status: { in: ['ADMITTED', 'PRE_REGISTERED', 'ACTIVE', 'ENROLLED'] },
    };

    const countBefore = await this.prisma.studentEnrollment.count({ where });

    await this.prisma.studentEnrollment.updateMany({
      where,
      data: { classId: null },
    });

    this.logger.log(
      `🔄 ${countBefore} affectations de classes physiques réinitialisées ` +
      `pour tenant ${tenantId} (année ${academicYearId}). ` +
      `Classes officielles (academicClassId) préservées.`,
    );

    return { reset: countBefore, academicYearId };
  }

  /**
   * ⭐ Liste l'historique des transferts/affectations d'un tenant.
   * Utilisé par le sous-onglet "Historique".
   */
  async getClassTransfersHistory(tenantId: string, academicYearId?: string) {
    return this.prisma.classTransfer.findMany({
      where: {
        tenantId,
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true },
        },
        fromClass: { select: { id: true, name: true, code: true } },
        toClass: { select: { id: true, name: true, code: true } },
      },
      orderBy: { transferDate: 'desc' },
      take: 500,
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
   * Abandon / sortie définitive : marque l'élève comme WITHDRAWN.
   * Contrairement au transfert (vers une autre école), l'abandon est une
   * sortie définitive sans école de destination.
   *
   * États mis à jour :
   *   - StudentEnrollment.status = WITHDRAWN, exitDate, exitReason
   *   - Student.status = WITHDRAWN, isActive = false
   *   - Désactivation des tokens de vérification publique
   *
   * @param exitReason — motif de l'abandon (ABANDON, EXPULSION, DECES, DIPLOME, AUTRE)
   */
  async withdraw(
    tenantId: string,
    data: {
      studentId: string;
      academicYearId: string;
      exitReason?: string;
      exitDate?: Date;
    },
    userId?: string,
  ) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        tenantId,
        academicYearId: data.academicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
    if (!enrollment) throw new NotFoundException('Inscription non trouvée pour cette année');

    const exitDate = data.exitDate ? new Date(data.exitDate) : new Date();
    const reason = data.exitReason || 'Abandon';

    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: ENROLLMENT_STATUS.WITHDRAWN,
        exitDate,
        exitReason: reason,
      },
    });

    await this.prisma.student.update({
      where: { id: data.studentId },
      data: {
        status: 'WITHDRAWN',
        isActive: false,
      },
    });

    // Désactiver les tokens de vérification publique (cartes élève, etc.)
    await this.publicVerificationService.deactivateTokensForStudent(data.studentId).catch(() => {});

    // Journalisation institutionnelle (Sous-module C/A)
    await this.prisma.studentAuditLog.create({
      data: {
        tenantId,
        studentId: data.studentId,
        userId: userId ?? null,
        action: 'WITHDRAW',
        beforeData: { status: enrollment.status },
        afterData: {
          reason,
          exitDate: exitDate.toISOString(),
          status: 'WITHDRAWN',
        },
      },
    });

    // Historique pédagogique
    await this.logHistory(
      tenantId,
      data.studentId,
      data.academicYearId,
      enrollment.classId || '',
      'WITHDRAWN',
      `Abandon / sortie définitive : ${reason}`,
      userId,
    );

    // Audit trail
    await this.logAudit(tenantId, data.studentId, 'WITHDRAW', userId, {
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
   * Réinscription d'un élève ayant abandonné (réintégration).
   * Remet Student.status = ACTIVE, isActive = true, et crée une nouvelle
   * inscription pour l'année courante.
   */
  async reintegrate(
    tenantId: string,
    data: {
      studentId: string;
      academicYearId: string;
      /** Optionnel depuis le fix 403 du 15/11/2026 (la sentinelle 'ALL' n'est plus envoyée) */
      schoolLevelId?: string;
      classId?: string;
    },
    userId?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Élève non trouvé');
    if (student.status !== 'WITHDRAWN') {
      throw new BadRequestException('L\'élève n\'est pas en statut WITHDRAWN — réintégration impossible');
    }

    // ⭐ FIX 2026-11-15 « demi-réintégration » (élève CM2 CSPEB) : l'update
    //    Student réussissait tandis que l'update de l'inscription était avalé
    //    par un try-catch → élève ACTIVE avec inscription restée WITHDRAWN
    //    (incohérence visible : « Actif » dans Sortis et abandons, mais
    //    « Abandon » dans Inscriptions / Liste des élèves / PDF abandons).
    //    → élève + inscription désormais mis à jour DANS UNE SEULE transaction
    //    Prisma : ou tout réussit, ou tout est annulé (en cas d'échec, l'état
    //    retiré reste cohérent et l'erreur remonte à l'appelant).
    await this.prisma.$transaction(async (tx) => {
      // Remettre l'élève en statut ACTIVE
      await tx.student.update({
        where: { id: data.studentId },
        data: {
          status: 'ACTIVE',
          isActive: true,
          currentAcademicYearId: data.academicYearId,
        },
      });

      // ⭐ Au lieu de créer une nouvelle inscription (qui violerait la contrainte unique
      // @@unique([tenantId, academicYearId, studentId]) car l'inscription WITHDRAWN
      // existe déjà), on met à jour l'inscription existante.
      const existingEnrollment = await tx.studentEnrollment.findFirst({
        where: {
          studentId: data.studentId,
          tenantId,
          academicYearId: data.academicYearId,
        },
        orderBy: { enrollmentDate: 'desc' },
      });

      if (existingEnrollment) {
        // Mettre à jour l'inscription existante (WITHDRAWN → ACTIVE)
        await tx.studentEnrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: ENROLLMENT_STATUS.ACTIVE,
            exitDate: null,
            exitReason: null,
            ...(data.classId && { classId: data.classId }),
            ...(data.schoolLevelId && { schoolLevelId: data.schoolLevelId }),
          },
        });
      } else {
        // Si aucune inscription n'existe pour cette année (cas edge), en créer une
        // ⭐ schoolLevelId requis : repli sur le niveau de l'élève si absent
        //    de la requête (le champ est désormais optionnel côté frontend —
        //    la sentinelle 'ALL' n'est plus envoyée, cf. fix 403 du même jour).
        await tx.studentEnrollment.create({
          data: {
            tenantId,
            studentId: data.studentId,
            academicYearId: data.academicYearId,
            schoolLevelId: data.schoolLevelId || student.schoolLevelId,
            classId: data.classId ?? null,
            enrollmentType: 'NEW',
            enrollmentDate: new Date(),
            status: ENROLLMENT_STATUS.ACTIVE,
          },
        });
      }
    });

    await this.logHistory(
      tenantId,
      data.studentId,
      data.academicYearId,
      data.classId || '',
      'ACTIVE',
      'Réintégration après abandon',
      userId,
    );

    // ⭐ P1.4 — Écrire un audit log (était manquant avant — la réintégration
    //    n'avait aucune trace dans studentAuditLog, contrairement à withdraw/exclude/exit)
    try {
      await this.prisma.studentAuditLog.create({
        data: {
          tenantId,
          studentId: data.studentId,
          action: 'REINTEGRATE',
          performedBy: userId || null,
          beforeData: { status: 'WITHDRAWN' } as any,
          afterData: {
            status: 'ACTIVE',
            academicYearId: data.academicYearId,
            classId: data.classId || null,
            reintegratedAt: new Date(),
          } as any,
          createdAt: new Date(),
        },
      });
    } catch (e: any) {
      this.logger.warn(`[reintegrate] Could not write audit log: ${e?.message}`);
    }

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
      },
    });
  }

  /**
   * ⭐ Exclusion administrative — renvoi disciplinaire ou décision de la direction.
   * Statut student = 'EXCLUDED', isActive = false.
   * L'élève ne peut PAS être réintégré via reintegrate() (réservé WITHDRAWN).
   * Une réintégration après exclusion nécessite une décision exceptionnelle.
   */
  async exclude(
    tenantId: string,
    data: {
      studentId: string;
      academicYearId: string;
      reason: string;
      exitDate?: Date;
    },
    userId?: string,
  ) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        tenantId,
        academicYearId: data.academicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
    if (!enrollment) throw new NotFoundException('Inscription non trouvée pour cette année');

    const exitDate = data.exitDate ? new Date(data.exitDate) : new Date();
    const reason = data.reason || 'Exclusion administrative';

    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: 'EXCLUDED',
        exitDate,
        exitReason: reason,
      },
    });

    await this.prisma.student.update({
      where: { id: data.studentId },
      data: {
        status: 'EXCLUDED',
        isActive: false,
      },
    });

    await this.publicVerificationService.deactivateTokensForStudent(data.studentId).catch(() => {});

    await this.prisma.studentAuditLog.create({
      data: {
        tenantId,
        studentId: data.studentId,
        userId: userId ?? null,
        action: 'EXCLUDE',
        beforeData: { status: enrollment.status },
        afterData: { reason, exitDate: exitDate.toISOString(), status: 'EXCLUDED' },
      },
    });

    await this.logHistory(
      tenantId, data.studentId, data.academicYearId,
      enrollment.classId || '', 'EXCLUDED',
      `Exclusion administrative : ${reason}`, userId,
    );

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
      },
    });
  }

  /**
   * ⭐ Sortie fin d'année — l'élève a terminé l'année scolaire normalement.
   * Statut student = 'GRADUATED' (si terminale) ou 'INACTIVE' (si autre niveau).
   * Contrairement à withdraw/exclude, c'est une sortie naturelle non disciplinaire.
   */
  async exit(
    tenantId: string,
    data: {
      studentId: string;
      academicYearId: string;
      exitReason?: string;
      exitDate?: Date;
    },
    userId?: string,
  ) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        tenantId,
        academicYearId: data.academicYearId,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
    if (!enrollment) throw new NotFoundException('Inscription non trouvée pour cette année');

    const exitDate = data.exitDate ? new Date(data.exitDate) : new Date();
    const reason = data.exitReason || 'Sortie fin d\'année';

    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: 'COMPLETED',
        exitDate,
        exitReason: reason,
      },
    });

    await this.prisma.student.update({
      where: { id: data.studentId },
      data: {
        status: 'INACTIVE',
        isActive: false,
      },
    });

    await this.prisma.studentAuditLog.create({
      data: {
        tenantId,
        studentId: data.studentId,
        userId: userId ?? null,
        action: 'EXIT',
        beforeData: { status: enrollment.status },
        afterData: { reason, exitDate: exitDate.toISOString(), status: 'INACTIVE' },
      },
    });

    await this.logHistory(
      tenantId, data.studentId, data.academicYearId,
      enrollment.classId || '', 'COMPLETED',
      `Sortie fin d'année : ${reason}`, userId,
    );

    return this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true }, orderBy: { enrollmentDate: 'desc' } },
      },
    });
  }

  /**
   * ⭐ Historique global des mouvements (transferts, abandons, exclusions, etc.)
   * Récupère les StudentAuditLog filtrés par actions de mouvement.
   */
  async getMovementHistory(
    tenantId: string,
    academicYearId?: string,
    filters?: {
      action?: string;
      studentId?: string;
      limit?: number;
    },
  ) {
    const movementActions = [
      'CHANGE_CLASS', 'WITHDRAW', 'EXCLUDE', 'EXIT', 'REINTEGRATE',
      'TRANSFER', 'ARCHIVE', 'PRE_REGISTER', 'ADMIT', 'RE_ENROLL',
      'PROMOTE', 'PROMOTION',
    ];

    const where: any = {
      tenantId,
      action: { in: movementActions },
    };
    if (academicYearId) {
      // Filter by student's academic year — need to join via studentId
      // For now, we'll filter after fetching
    }
    if (filters?.action) {
      where.action = filters.action;
    }
    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    const limit = Math.min(filters?.limit || 200, 500);

    const logs = await this.prisma.studentAuditLog.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            photoUrl: true,
            status: true,
            schoolLevelId: true,
            schoolLevel: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      date: log.createdAt,
      beforeData: log.beforeData,
      afterData: log.afterData,
      student: log.student ? {
        id: log.student.id,
        firstName: log.student.firstName,
        lastName: log.student.lastName,
        matricule: log.student.matricule,
        photoUrl: log.student.photoUrl,
        status: log.student.status,
        levelName: log.student.schoolLevel?.name || '',
      } : null,
    }));
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
  async getEnrollments(
    tenantId: string,
    params: { academicYearId?: string; schoolLevelId?: string },
    scope?: import('../../common/context/access-scope.service').AccessScope,
  ) {
    // ⭐ 2026-09-18 — Anomalie « Élèves non affectés » (onglet Inscriptions) :
    //    appliquer le SCOPE niveau serveur (même règle que les classes
    //    académiques et les listes élèves — P3). Sans ce filtre, un rôle à
    //    périmètre restreint (ex: SECRETAIRE_COMPTABLE_SEC) recevait TOUTES
    //    les inscriptions du tenant alors que sa liste de classes ne couvre
    //    que son périmètre → l'onglet Inscriptions affichait les élèves des
    //    autres niveaux en « Élèves non affectés ». applyLevelScope est un
    //    no-op pour les comptes transverses (promoteur, allLevels).
    const where: Record<string, any> = {
      tenantId,
      ...(params.academicYearId && { academicYearId: params.academicYearId }),
      // Ignorer 'ALL' qui signifie "tous les niveaux" (pas un UUID valide)
      ...(params.schoolLevelId && params.schoolLevelId !== 'ALL' && { schoolLevelId: params.schoolLevelId }),
    };
    applyLevelScope(where, scope);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where,
      include: {
        student: {
          include: {
            studentGuardians: { include: { guardian: true } },
          },
        },
        class: true,
        // ⭐ Inclure la classe officielle (AcademicClass) pour l'affichage frontend
        // et le groupement par classe officielle dans l'onglet Inscriptions (mode=official).
        academicClass: {
          include: {
            level: true,
            cycle: true,
            series: true,
          },
        },
      },
      orderBy: { enrollmentDate: 'desc' },
    });

    // ⭐ 2026-09-17 — Anomalie « Élèves non affectés » (onglet Inscriptions) :
    //    des inscriptions créées via la synchronisation hors-ligne (Tauri/SQLite
    //    ou ancien outbox web) arrivent avec une classe PHYSIQUE (classId) mais
    //    SANS classe OFFICIELLE (academicClassId NULL). L'onglet Inscriptions
    //    groupe par classe officielle → ces élèves s'affichaient « non affectés »
    //    alors qu'ils ont une classe valide (ex: 6ème, 4ème).
    //    Auto-réparation : dériver la classe officielle depuis Class.officialClassId
    //    (chaque classe physique est liée à sa classe officielle), l'exposer dans
    //    la réponse ET la persister (best-effort, idempotent) pour que stats,
    //    exports et PDF de listes deviennent cohérents aussi.
    const toRepair = enrollments.filter((e) => !e.academicClassId && e.classId);
    if (toRepair.length > 0) {
      const physicalClasses = await this.prisma.class.findMany({
        where: {
          id: { in: [...new Set(toRepair.map((e) => e.classId!))] },
          tenantId,
        },
        select: { id: true, officialClassId: true },
      });
      const officialIds = [
        ...new Set(
          physicalClasses
            .map((c) => c.officialClassId)
            .filter((v): v is string => !!v),
        ),
      ];
      const officialClasses = officialIds.length
        ? await this.prisma.academicClass.findMany({
            where: { id: { in: officialIds }, tenantId },
            include: { level: true, cycle: true, series: true },
          })
        : [];
      const officialById = new Map(officialClasses.map((c) => [c.id, c]));
      const officialByPhysicalId = new Map(
        physicalClasses
          .filter((c) => c.officialClassId)
          .map((c) => [c.id, c.officialClassId!]),
      );
      for (const e of toRepair) {
        const officialId = officialByPhysicalId.get(e.classId!);
        const official = officialId ? officialById.get(officialId) : undefined;
        if (official) {
          (e as any).academicClassId = official.id;
          (e as any).academicClass = official;
        }
      }
      // Persistance best-effort — ne doit JAMAIS faire échouer le GET
      const repairedIds = toRepair
        .map((e) => ({ id: e.id, academicClassId: (e as any).academicClassId as string | undefined }))
        .filter((r) => !!r.academicClassId);
      if (repairedIds.length > 0) {
        try {
          await this.prisma.$transaction(
            repairedIds.map((r) =>
              this.prisma.studentEnrollment.update({
                where: { id: r.id },
                data: { academicClassId: r.academicClassId! },
              }),
            ),
          );
          this.logger.log(
            `✅ Backfill academicClassId : ${repairedIds.length} inscription(s) réparée(s) (classe physique → classe officielle)`,
          );
        } catch (err: any) {
          this.logger.warn(`Backfill academicClassId échoué (non bloquant) : ${err?.message ?? err}`);
        }
      }
    }

    return enrollments;
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

  /**
   * ⭐ Bascule "Nouvel élève / Ancien élève" pour un enrollment existant.
   *
   * Met à jour `enrollmentType` sur le StudentEnrollment (studentId +
   * academicYearId), puis recalcule le StudentAccount pour refléter le
   * changement au niveau financier :
   *   - 'NEW' → l'élève paie les frais d'INSCRIPTION (exclut REINSCRIPTION)
   *   - 'REPEAT' / 'PROMOTION' / 'TRANSFER' → l'élève paie les frais de
   *     REINSCRIPTION (exclut INSCRIPTION). S'il n'y a pas de frais de
   *     réinscription configurés, il ne paie que la scolarité.
   *
   * Le StudentAccount doit être recalculé car `getOrCreate()` short-circuit
   * si le compte existe déjà — il faut appeler `recalculate()` pour
   * reconstruire les breakdowns selon le nouveau type.
   */
  async updateEnrollmentType(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    enrollmentType: 'NEW' | 'REPEAT' | 'PROMOTION' | 'TRANSFER',
  ): Promise<{
    success: boolean;
    studentId: string;
    academicYearId: string;
    enrollmentType: string;
    previousType: string;
    accountRecalculated: boolean;
  }> {
    // ⭐ Wrap global pour éviter toute erreur 500 non gérée
    // Chaque étape critique est dans son propre try/catch
    try {
      // 1. Trouver l'enrollment existant
      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: { tenantId, studentId, academicYearId },
        select: { id: true, enrollmentType: true },
      });

      if (!enrollment) {
        throw new NotFoundException(
          `Aucune inscription trouvée pour l'élève ${studentId} sur l'année ${academicYearId}`,
        );
      }

      const previousType = enrollment.enrollmentType;

      // 2. Si pas de changement, on ne fait rien
      if (previousType === enrollmentType) {
        this.logger.log(
          `⏭️  updateEnrollmentType: pas de changement (${previousType} → ${enrollmentType}) — skip`,
        );
        return {
          success: true,
          studentId,
          academicYearId,
          enrollmentType,
          previousType,
          accountRecalculated: false,
        };
      }

      // 3. Mettre à jour l'enrollment (dans un try/catch dédié)
      try {
        await this.prisma.studentEnrollment.update({
          where: { id: enrollment.id },
          data: { enrollmentType },
        });
        this.logger.log(
          `🔄 Enrollment type mis à jour: élève ${studentId}, ${previousType} → ${enrollmentType}`,
        );
      } catch (updateErr) {
        this.logger.error(
          `❌ Échec mise à jour enrollment: ${updateErr.message}`,
        );
        throw new BadRequestException(
          `Impossible de mettre à jour le type d'inscription: ${updateErr.message}`,
        );
      }

      // 4. Recalculer le StudentAccount (best-effort, non bloquant)
      //    recalculate() gère déjà le cas où le compte n'existe pas
      let accountRecalculated = false;
      try {
        await this.studentAccountService.recalculate(studentId, tenantId, academicYearId);
        accountRecalculated = true;
        this.logger.log(
          `✅ StudentAccount recalculé pour élève ${studentId} (nouveau type: ${enrollmentType})`,
        );
      } catch (recalcErr) {
        this.logger.error(
          `❌ Échec recalcul StudentAccount pour élève ${studentId}: ${recalcErr.message}`,
        );
        // Non bloquant — l'enrollment est déjà mis à jour
      }

      // 5. Audit log (best-effort)
      try {
        await this.prisma.studentAuditLog.create({
          data: {
            tenantId,
            studentId,
            action: 'ENROLLMENT_TYPE_CHANGE',
            beforeData: { enrollmentType: previousType },
            afterData: { enrollmentType },
          },
        });
      } catch {
        // best-effort
      }

      return {
        success: true,
        studentId,
        academicYearId,
        enrollmentType,
        previousType,
        accountRecalculated,
      };
    } catch (err) {
      // Re-throw les NestJS exceptions (NotFoundException, BadRequestException)
      // qui ont déjà le bon status code
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      // Pour toute autre erreur inattendue, logger et renvoyer une erreur 500 propre
      this.logger.error(
        `❌ updateEnrollmentType erreur inattendue: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(
        `Erreur lors de la mise à jour du type d'inscription: ${err.message}`,
      );
    }
  }

  /**
   * ⭐ Supprime définitivement un élève et toutes ses données liées.
   * Utilisé quand une inscription a été faite par erreur et que l'élève
   * n'a pas encore de transactions/paiements associés.
   *
   * Sécurité :
   *   - Si l'élève a des transactions (paiements), on refuse la suppression
   *   - Si l'élève a le statut ACTIVE (validé), on refuse aussi
   *   - Seuls les statuts PRE_REGISTERED et ADMITTED sont supprimables
   *
   * Cascade :
   *   - student_audit_logs (ON DELETE CASCADE)
   *   - student_enrollments (ON DELETE CASCADE)
   *   - student_accounts → account_breakdowns (manuel)
   *   - student_photos (ON DELETE CASCADE)
   *   - student_guardians (ON DELETE CASCADE)
   *   - student_academic_records (ON DELETE CASCADE)
   *   - student_identifiers (ON DELETE CASCADE)
   *   - public_verification_tokens (manuel)
   *   - student (la ligne elle-même)
   */
  async deleteStudent(
    tenantId: string,
    studentId: string,
    userId?: string,
  ): Promise<{ success: boolean; studentId: string; message: string; details?: any }> {
    // 1. Vérifier que l'élève existe et appartient au tenant
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        studentEnrollments: true,
        studentAccounts: { include: { breakdowns: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('Élève non trouvé');
    }

    // 2. Vérifier le statut — seuls PRE_REGISTERED et ADMITTED sont supprimables
    //    (élèves dont le processus d'inscription n'a pas été finalisé/validé).
    const deletableStatuses = ['PRE_REGISTERED', 'ADMITTED'];
    const hasNonDeletable = student.studentEnrollments.some(
      (e) => !deletableStatuses.includes(e.status),
    );
    if (hasNonDeletable) {
      throw new BadRequestException(
        'Impossible de supprimer un élève déjà validé/actif. Utilisez plutôt le retrait ou le transfert.',
      );
    }

    // 3. Vérifier qu'il n'y a pas de transactions (paiements) sur AUCUN compte
    //    (un élève peut avoir un compte par année académique).
    for (const account of student.studentAccounts) {
      const hasPayments = account.breakdowns.some(
        (b) => Number(b.paidAmount) > 0,
      );
      if (hasPayments) {
        throw new BadRequestException(
          'Impossible de supprimer un élève qui a déjà des paiements enregistrés.',
        );
      }
    }

    // 4. Suppression physique — le trigger trg_prevent_student_delete bloque
    //    tout DELETE direct ; le service pose le drapeau transaction-local
    //    app.allow_student_delete APRÈS les garde-fous ci-dessus (migration
    //    20260914100000). Toute suppression hors de ce chemin reste interdite.
    this.logger.log(
      `🗑️ Suppression définitive de l'élève ${student.firstName} ${student.lastName} (${studentId})`,
    );

    // Désactiver les tokens de vérification publique (best-effort, hors transaction)
    try {
      await this.publicVerificationService.deactivateTokensForStudent(studentId);
    } catch {}

    const deleted = await this.prisma.$transaction(async (tx) => {
      // FK RESTRICT : student_transfer_requests bloque le DELETE → on purge
      // les demandes de transfert (résidus sans valeur pour un dossier abrogé).
      const transfers = await tx.studentTransferRequest.deleteMany({
        where: { studentId },
      });

      // Comptes financiers + imputations (cascade DB, mais explicite pour
      // remonter les compteurs dans la réponse)
      const breakdowns = await tx.accountBreakdown.deleteMany({
        where: { studentAccount: { studentId } },
      });
      const accounts = await tx.studentAccount.deleteMany({
        where: { studentId },
      });

      // ⭐ Drapeau GUC transaction-local — honoré par le trigger
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.allow_student_delete', 'true', true)`,
      );

      try {
        await tx.student.delete({ where: { id: studentId } });
      } catch (e: any) {
        // Message explicite si une autre contrainte bloque malgré tout
        if (e?.code === 'P2003') {
          throw new BadRequestException(
            `Des données liées empêchent la suppression (contrainte: ${e?.meta?.field_name ?? 'inconnue'}). Contactez le support avec le matricule de l'élève.`,
          );
        }
        throw e;
      }

      return { transfers: transfers.count, breakdowns: breakdowns.count, accounts: accounts.count };
    });

    // Audit log (sur le tenant, pas sur l'élève qui est supprimé)
    this.logger.log(
      `✅ Élève ${studentId} supprimé définitivement — ` +
      `${deleted.accounts} compte(s) financier(s), ${deleted.breakdowns} imputation(s), ` +
      `${deleted.transfers} demande(s) de transfert supprimés en cascade`,
    );

    return {
      success: true,
      studentId,
      message: `Élève ${student.firstName} ${student.lastName} supprimé définitivement (avec inscription, dossier, compte financier et données liées).`,
      details: deleted,
    };
  }
}
