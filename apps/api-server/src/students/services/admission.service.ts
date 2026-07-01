import { Injectable, NotFoundException, BadRequestException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentsLifecycleService } from './students-lifecycle.service';
import { StudentIdentifierService } from './student-identifier.service';
import { StorageService } from '../../common/services/storage.service';
import { AdmissionNotificationService } from './admission-notification.service';
import { NotificationService } from '../../notifications/notification.service';

@Injectable()
export class AdmissionService {
  private readonly logger = new Logger(AdmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: StudentsLifecycleService,
    private readonly studentIdentifierService: StudentIdentifierService,
    private readonly storageService: StorageService,
    private readonly notificationService: AdmissionNotificationService,
    private readonly inAppNotificationService: NotificationService,
  ) {}

  /**
   * Génère un numéro d'admission unique.
   * Format UNIFIÉ : <CODE_ECOLE>-A-<YY>-<XXXX>
   * ex: CSPEB-A-25-0001
   *
   * Le préfixe "A" (Admission) différencie ce numéro de l'Élève (E),
   * Personnel (P), Facture (F), etc. au sein de la même école.
   *
   * La séquence est par tenant + année académique.
   */
  private async generateAdmissionNumber(tenantId: string, academicYearId: string): Promise<string> {
    // Récupérer l'année scolaire pour extraire l'année civile
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { name: true, startDate: true },
    });
    const fullYear = academicYear?.startDate
      ? new Date(academicYear.startDate).getFullYear()
      : new Date().getFullYear();
    const year2 = fullYear.toString().slice(-2);

    // Récupérer le code école (réutilise la même logique que MatriculeService)
    let schoolCode = 'AH';
    try {
      const identity = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId },
        select: { schoolAcronym: true },
        orderBy: { createdAt: 'desc' },
      });
      if (identity?.schoolAcronym) {
        const code = identity.schoolAcronym
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 6);
        if (code.length >= 2) schoolCode = code;
      }
    } catch { /* fallback to 'AH' */ }

    // Compter les admissions existantes pour ce tenant + année
    const count = await this.prisma.admission.count({
      where: { tenantId, academicYearId },
    });

    const seq = String(count + 1).padStart(4, '0');
    const admissionNumber = `${schoolCode}-A-${year2}-${seq}`;

    // Vérifier l'unicité (au cas où une admission a été supprimée → count < max seq)
    const existing = await this.prisma.admission.findFirst({
      where: { tenantId, admissionNumber },
      select: { id: true },
    });
    if (existing) {
      // Collision → utiliser un timestamp suffix pour garantir l'unicité
      const suffix = Date.now().toString().slice(-4);
      return `${schoolCode}-A-${year2}-${seq}-${suffix}`;
    }

    return admissionNumber;
  }

  /**
   * Crée une nouvelle admission avec TOUS les champs du formulaire.
   *
   * ⚠️ Avant la Phase 1, cette méthode ne persistait que 6 champs (firstName,
   * lastName, dateOfBirth, gender, status, applicationDate). Les 14 autres
   * champs collectés par AdmissionForm.tsx étaient silencieusement dropped.
   *
   * Maintenant, tous les champs sont persistés (merci à la migration
   * 20260701080000_extend_admissions_table).
   */
  async create(tenantId: string, data: any, userId?: string) {
    // Générer le numéro d'admission
    const admissionNumber = await this.generateAdmissionNumber(tenantId, data.academicYearId);

    try {
      // ⚠️ Utiliser ONLY les champs qui existent dans le schéma Prisma actuel.
      // La relation schoolLevel a été supprimée du schéma — ne pas l'inclure.
      // schoolLevelId est une simple String maintenant (pas de relation).
      const createData: any = {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender ?? null,

        // Identité élève
        birthPlace: data.birthPlace ?? null,
        nationality: data.nationality ?? 'Béninoise',
        address: data.address ?? null,

        // Vœux académiques
        requestedClassId: data.requestedClassId || null,
        requestedSeriesId: data.requestedSeriesId || null,
        wantsBilingual: data.wantsBilingual ?? false,
        previousSchool: data.previousSchool ?? null,
        previousLevel: data.previousLevel ?? null,
        changeReason: data.changeReason ?? null,

        // Responsable légal
        mainGuardianName: data.mainGuardianName ?? null,
        mainGuardianPhone: data.mainGuardianPhone ?? null,
        mainGuardianEmail: data.mainGuardianEmail ?? null,
        mainGuardianRelationship: data.mainGuardianRelationship ?? null,
        mainGuardianAddress: data.mainGuardianAddress ?? null,
        mainGuardianProfession: data.mainGuardianProfession ?? null,

        // Traçabilité
        admissionNumber,
        createdByUserId: userId ?? null,

        // Workflow
        status: 'PENDING',
        applicationDate: new Date(),
        notes: data.notes ?? null,
      };

      this.logger.log(`Creating admission: tenantId=${tenantId}, schoolLevelId=${data.schoolLevelId}, academicYearId=${data.academicYearId}, admissionNumber=${admissionNumber}`);

      const result = await this.prisma.admission.create({
        data: createData,
      });

      this.logger.log(`Admission created successfully: id=${result.id}, admissionNumber=${result.admissionNumber}`);
      return result;
    } catch (error: any) {
      this.logger.error(
        `Failed to create admission: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Liste les admissions avec filtres.
   *
   * Filtres supportés : academicYearId, schoolLevelId, status, search.
   *
   * ⚠️ Avant la Phase 1, schoolLevelId n'était PAS filtré (le frontend
   * l'envoyait mais le backend l'ignorait). Maintenant corrigé.
   */
  async findAll(tenantId: string, filters: any) {
    const { academicYearId, schoolLevelId, status, search } = filters;
    return this.prisma.admission.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        ...(schoolLevelId && schoolLevelId !== 'ALL' && { schoolLevelId }),
        ...(status && { status }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { admissionNumber: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        academicYear: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { id, tenantId },
      include: {
        academicYear: true,
        tenant: true,
      },
    });
    if (!admission) throw new NotFoundException('Admission non trouvée');
    return admission;
  }

  /**
   * Met à jour une admission avec TOUS les champs persistables.
   */
  async update(id: string, tenantId: string, data: any, userId?: string) {
    const updateData: any = {};

    // Identité élève
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.birthPlace !== undefined) updateData.birthPlace = data.birthPlace;
    if (data.nationality !== undefined) updateData.nationality = data.nationality;
    if (data.address !== undefined) updateData.address = data.address;

    // Vœux académiques
    if (data.schoolLevelId !== undefined) updateData.schoolLevelId = data.schoolLevelId;
    if (data.academicYearId !== undefined) updateData.academicYearId = data.academicYearId;
    if (data.requestedClassId !== undefined) updateData.requestedClassId = data.requestedClassId || null;
    if (data.requestedSeriesId !== undefined) updateData.requestedSeriesId = data.requestedSeriesId || null;
    if (data.wantsBilingual !== undefined) updateData.wantsBilingual = data.wantsBilingual;
    if (data.previousSchool !== undefined) updateData.previousSchool = data.previousSchool;
    if (data.previousLevel !== undefined) updateData.previousLevel = data.previousLevel;
    if (data.changeReason !== undefined) updateData.changeReason = data.changeReason;

    // Responsable légal
    if (data.mainGuardianName !== undefined) updateData.mainGuardianName = data.mainGuardianName;
    if (data.mainGuardianPhone !== undefined) updateData.mainGuardianPhone = data.mainGuardianPhone;
    if (data.mainGuardianEmail !== undefined) updateData.mainGuardianEmail = data.mainGuardianEmail;
    if (data.mainGuardianRelationship !== undefined) updateData.mainGuardianRelationship = data.mainGuardianRelationship;
    if (data.mainGuardianAddress !== undefined) updateData.mainGuardianAddress = data.mainGuardianAddress;
    if (data.mainGuardianProfession !== undefined) updateData.mainGuardianProfession = data.mainGuardianProfession;

    // Workflow
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.reviewComment !== undefined) updateData.reviewComment = data.reviewComment;
    if (data.decisionComment !== undefined) updateData.decisionComment = data.decisionComment;
    if (data.applicationDate !== undefined) updateData.applicationDate = data.applicationDate;
    if (data.decisionDate !== undefined) updateData.decisionDate = data.decisionDate;
    if (data.decisionBy !== undefined) updateData.decisionBy = data.decisionBy;

    // Entretien / Test
    if (data.interviewDate !== undefined) updateData.interviewDate = data.interviewDate ? new Date(data.interviewDate) : null;
    if (data.testDate !== undefined) updateData.testDate = data.testDate ? new Date(data.testDate) : null;
    if (data.testScore !== undefined) updateData.testScore = data.testScore;

    // Traçabilité
    if (data.convertedStudentId !== undefined) updateData.convertedStudentId = data.convertedStudentId;

    return this.prisma.admission.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: true,
      },
    });
  }

  async submit(id: string, tenantId: string) {
    return this.update(id, tenantId, { status: 'SUBMITTED' });
  }

  async decide(id: string, tenantId: string, decision: 'ACCEPTED' | 'REJECTED', comment: string, userId: string) {
    return this.update(id, tenantId, {
      status: decision,
      notes: comment,
      decisionBy: userId,
      decisionDate: new Date(),
    });
  }

  /**
   * Change le statut d'une admission vers n'importe quel statut valide.
   * Permet de gérer les workflow étendus : UNDER_REVIEW, WAITLISTED,
   * MISSING_DOCUMENTS, INTERVIEW_REQUIRED, TEST_REQUIRED, CANCELLED.
   *
   * ⚠️ Ne pas utiliser pour CONVERTED (utiliser convertToStudent() qui
   * fait le flux complet preRegister + admit + Guardian).
   */
  async changeStatus(id: string, tenantId: string, newStatus: string, comment: string, userId: string) {
    const VALID_STATUSES = [
      'PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'MISSING_DOCUMENTS',
      'INTERVIEW_REQUIRED', 'TEST_REQUIRED', 'ACCEPTED', 'REJECTED',
      'WAITLISTED', 'CANCELLED',
      // 'CONVERTED' exclus — seulement via convertToStudent()
    ];

    if (!VALID_STATUSES.includes(newStatus)) {
      throw new BadRequestException(`Statut invalide: ${newStatus}. Statuts valides: ${VALID_STATUSES.join(', ')}`);
    }

    // Si le nouveau statut est une décision (ACCEPTED/REJECTED), on enregistre
    // la date + l'auteur de la décision. Sinon, c'est juste un changement de workflow.
    const isDecision = ['ACCEPTED', 'REJECTED'].includes(newStatus);

    return this.update(id, tenantId, {
      status: newStatus,
      notes: comment || undefined,
      ...(isDecision && {
        decisionBy: userId,
        decisionDate: new Date(),
      }),
    });
  }

  /**
   * Conversion d'une admission ACCEPTED en Dossier Élève complet.
   *
   * ⚠️ Phase 2 : cette méthode fait maintenant le flux COMPLET :
   *   1. preRegister() → crée Student + StudentEnrollment (PRE_REGISTERED)
   *   2. admit() → génère matricule, StudentAccount, token QR, StudentAcademicRecord
   *   3. Crée Guardian + StudentGuardian à partir des infos responsable légal
   *   4. Marque l'admission comme CONVERTED + link convertedStudentId
   *
   * Avant Phase 2 : seul preRegister() était appelé → l'élève n'avait ni
   * matricule, ni compte financier, ni guardian, ni token de vérification.
   *
   * Gestion de la classe :
   *   - Si admission.requestedClassId est défini → on l'utilise
   *   - Sinon → on cherche la première classe disponible du niveau scolaire
   *   - Si aucune classe n'existe → on admet sans classe (classId null),
   *     l'élève sera affecté manuellement plus tard via l'onglet Affectations
   */
  async convertToStudent(id: string, tenantId: string, userId: string) {
    try {
      const admission = await this.findOne(id, tenantId);

      if (admission.status !== 'ACCEPTED') {
        throw new BadRequestException('L\'admission doit être ACCEPTÉE pour être convertie');
      }

      // Vérifier qu'elle n'a pas déjà été convertie
      if (admission.convertedStudentId) {
        throw new BadRequestException('Cette admission a déjà été convertie en dossier élève');
      }

      this.logger.log(
        `convertToStudent START — admission=${admission.admissionNumber} ` +
        `tenantId=${tenantId} schoolLevelId=${admission.schoolLevelId} ` +
        `academicYearId=${admission.academicYearId} requestedClassId=${admission.requestedClassId || 'null'}`,
      );

      // ⚠️ RÉSOLUTION DU schoolLevelId pour students
      // admissions.schoolLevelId → education_levels (UUID)
      // students.schoolLevelId → school_levels (UUID différent !)
      // Il faut convertir education_levels → school_levels par nom (MATERNELLE/PRIMAIRE/SECONDAIRE).
      let studentSchoolLevelId = admission.schoolLevelId;

      // Vérifier si schoolLevelId est un UUID de school_levels (pas education_levels)
      const schoolLevel = await this.prisma.schoolLevel.findUnique({
        where: { id: admission.schoolLevelId },
        select: { id: true, name: true, code: true },
      }).catch(() => null);

      if (!schoolLevel) {
        // schoolLevelId n'est pas dans school_levels → c'est un education_levels
        // Résoudre par nom vers school_levels
        const eduLevel = await this.prisma.educationLevel.findUnique({
          where: { id: admission.schoolLevelId },
          select: { name: true },
        }).catch(() => null);

        if (eduLevel) {
          // Chercher le school_levels correspondant par nom ou code
          const levelName = eduLevel.name.toUpperCase();
          const matchingSchoolLevel = await this.prisma.schoolLevel.findFirst({
            where: {
              tenantId,
              OR: [
                { name: { equals: eduLevel.name, mode: 'insensitive' } },
                { code: { equals: levelName, mode: 'insensitive' } },
              ],
            },
            select: { id: true, name: true },
          });

          if (matchingSchoolLevel) {
            studentSchoolLevelId = matchingSchoolLevel.id;
            this.logger.log(
              `convertToStudent: schoolLevelId converti education_levels(${eduLevel.name}) → school_levels(${matchingSchoolLevel.name})`,
            );
          } else {
            throw new BadRequestException(
              `Aucun niveau scolaire (school_levels) trouvé pour "${eduLevel.name}". ` +
              `Vérifiez que les niveaux sont configurés dans l'établissement.`,
            );
          }
        }
      }

      // ⚠️ Vérifier que requestedClassId existe toujours dans classes
      // (peut avoir été supprimé après la soumission de l'admission)
      let validClassId = admission.requestedClassId;
      if (validClassId) {
        const classExists = await this.prisma.class.findUnique({
          where: { id: validClassId },
          select: { id: true },
        }).catch(() => null);
        if (!classExists) {
          this.logger.warn(
            `convertToStudent: requestedClassId ${validClassId} n'existe plus dans classes → ignoré`,
          );
          validClassId = null;
        }
      }

      // 1. Pré-inscription (crée Student + StudentEnrollment PRE_REGISTERED)
      const student = await this.lifecycleService.preRegister(tenantId, {
        academicYearId: admission.academicYearId,
        schoolLevelId: studentSchoolLevelId,  // ← UUID de school_levels (pas education_levels)
        firstName: admission.firstName,
        lastName: admission.lastName,
        dateOfBirth: admission.dateOfBirth ?? undefined,
        gender: admission.gender ?? undefined,
        placeOfBirth: admission.birthPlace ?? undefined,
        nationality: admission.nationality ?? undefined,
        classId: validClassId ?? undefined,  // ← null si classe supprimée
      }, userId);

      this.logger.log(`convertToStudent: preRegister OK, student.id=${student.id}`);

    // 2. Résoudre le classId pour admit()
      //    admit() requires a classId (non-null). Si l'admission n'a pas de
      //    requestedClassId (ou classe supprimée), on cherche la première classe du niveau.
      let classIdForAdmit = validClassId;

      if (!classIdForAdmit) {
        // Chercher la première classe disponible pour ce tenant + année + niveau
        // ⚠️ Utiliser studentSchoolLevelId (school_levels) et non admission.schoolLevelId (education_levels)
        // car classes.schoolLevelId → school_levels
        const fallbackClass = await this.prisma.class.findFirst({
          where: {
            tenantId,
            schoolLevelId: studentSchoolLevelId,
          },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
        classIdForAdmit = fallbackClass?.id;

        if (classIdForAdmit) {
          this.logger.log(
            `convertToStudent: classe fallback trouvée : ${fallbackClass?.name} (${classIdForAdmit})`,
          );
        } else {
          this.logger.warn(
            `Aucune classe trouvée pour tenant=${tenantId} level=${studentSchoolLevelId}. ` +
            `L'élève sera admis sans classe — affectation manuelle requise plus tard.`,
          );
        }
      }

      // 3. Admission formelle (génère matricule + StudentAccount + token QR + StudentAcademicRecord)
      //
      //    ⚠️ Fix 2026-07-01 : admit() accepte désormais classId optionnel.
      //    On appelle TOUJOURS admit() — même sans classe — pour générer le
      //    matricule local (Student.matricule) et le matricule global
      //    (StudentIdentifier). Sans cela, l'élève reste "actif sans matricule"
      //    et ORION génère une alerte critique.
      //
      //    Si classIdForAdmit est null, l'élève sera admis sans classe et
      //    l'admin devra l'affecter via l'onglet Affectations (changeClass).
      try {
        await this.lifecycleService.admit(tenantId, {
          studentId: student.id,
          academicYearId: admission.academicYearId,
          schoolLevelId: studentSchoolLevelId,  // ← school_levels UUID
          classId: classIdForAdmit,  // ← peut être null (admit() le gère)
        }, userId);

        this.logger.log(
          `Admission ${admission.admissionNumber}: student ${student.id} admitted` +
          `${classIdForAdmit ? ' with class ' + classIdForAdmit : ' WITHOUT class (affectation manuelle requise)'}` +
          ` — matricule generated`,
        );

        // 3b. Générer le matricule GLOBAL (AH-STU-YY-XXXXXX)
        //     Ce matricule est unique sur toute la plateforme Academia Helm.
        //     Il est verrouillé (locked) et ne change jamais, même si l'élève
        //     change d'école. Il est stocké sur Student.globalStudentId +
        //     StudentIdentifier.
        try {
          await this.studentIdentifierService.generateGlobalMatricule(
            tenantId,
            student.id,
            'BJ',
            userId,
          );
          this.logger.log(
            `Admission ${admission.admissionNumber}: global matricule generated for student ${student.id}`,
          );
        } catch (globalMatErr: any) {
          // Non bloquant — l'élève a déjà son matricule local (généré par admit())
          this.logger.warn(
            `Admission ${admission.admissionNumber}: global matricule generation failed (non-blocking): ${globalMatErr.message}`,
          );
        }
      } catch (admitErr: any) {
        // Si admit() échoue, l'élève reste en PRE_REGISTERED — on ne bloque
        // pas la conversion, on log l'erreur pour debug.
        this.logger.error(
          `Admission ${admission.admissionNumber}: admit() failed for student ${student.id}: ${admitErr.message}`,
          admitErr.stack,
        );
      }

    // 4. Créer le Guardian + StudentGuardian à partir du responsable légal
    if (admission.mainGuardianName || admission.mainGuardianPhone || admission.mainGuardianEmail) {
      try {
        // Parser le nom du guardian (peut être "M. KOFFI Emmanuel" → firstName="Emmanuel", lastName="KOFFI")
        // On stocke tout dans lastName si on ne peut pas parser, pour ne pas perdre d'info.
        const guardianName = admission.mainGuardianName || 'Responsable légal';
        const nameParts = guardianName.trim().split(/\s+/);
        let guardianFirstName = '';
        let guardianLastName = guardianName;
        if (nameParts.length >= 2) {
          // Si le premier mot est un titre (M., Mme, Mlle, Mr), on le saute
          const firstWord = nameParts[0].toUpperCase();
          const isTitle = ['M.', 'M', 'MR', 'MME', 'MLLE', 'MONSIEUR', 'MADAME'].includes(firstWord);
          const offset = isTitle ? 1 : 0;
          if (nameParts.length > offset + 1) {
            guardianFirstName = nameParts.slice(offset, -1).join(' ');
            guardianLastName = nameParts[nameParts.length - 1];
          }
        }

        // Créer ou récupérer le Guardian (par phone ou email pour éviter les doublons)
        const existingGuardian = await this.prisma.guardian.findFirst({
          where: {
            tenantId,
            OR: [
              ...(admission.mainGuardianPhone ? [{ phone: admission.mainGuardianPhone }] : []),
              ...(admission.mainGuardianEmail ? [{ email: admission.mainGuardianEmail }] : []),
            ],
          },
        });

        let guardianId: string;
        if (existingGuardian) {
          guardianId = existingGuardian.id;
        } else {
          const newGuardian = await this.prisma.guardian.create({
            data: {
              tenantId,
              firstName: guardianFirstName,
              lastName: guardianLastName,
              phone: admission.mainGuardianPhone,
              email: admission.mainGuardianEmail,
              relationship: admission.mainGuardianRelationship || 'PARENT',
              address: admission.address,
            },
          });
          guardianId = newGuardian.id;
        }

        // Lier le guardian à l'élève (isPrimary = true car c'est le responsable principal)
        await this.prisma.studentGuardian.upsert({
          where: {
            studentId_guardianId: {
              studentId: student.id,
              guardianId,
            },
          },
          update: { isPrimary: true },
          create: {
            tenantId,
            studentId: student.id,
            guardianId,
            relationship: 'PARENT',
            isPrimary: true,
          },
        });

        this.logger.log(
          `Admission ${admission.admissionNumber}: Guardian ${guardianId} linked to student ${student.id}`,
        );
      } catch (guardianErr: any) {
        // Ne pas bloquer la conversion si le guardian échoue
        this.logger.error(
          `Admission ${admission.admissionNumber}: Guardian creation failed: ${guardianErr.message}`,
          guardianErr.stack,
        );
      }
    }

    // 5. Marquer l'admission comme CONVERTED + link le student
      await this.prisma.admission.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          decisionBy: userId,
          decisionDate: new Date(),
          convertedStudentId: student.id,
        },
      });

      this.logger.log(
        `Admission ${admission.admissionNumber} converted to student ${student.id}`,
      );

      // 6. Fire-and-forget : envoyer email de confirmation d'inscription au parent
      this.notificationService
        .notifyAdmissionConverted({
          admissionId: id,
          tenantId,
          studentId: student.id,
        })
        .catch((err) =>
          this.logger.error(
            `notifyAdmissionConverted failed: ${err.message}`,
            err.stack,
          ),
        );

      // Retourner l'élève avec ses relations
      return this.prisma.student.findUnique({
        where: { id: student.id },
        include: {
          studentEnrollments: { include: { class: true, academicYear: true } },
          schoolLevel: true,
          studentGuardians: { include: { guardian: true } },
        },
      });
    } catch (err: any) {
      // Log détaillé pour diagnostic
      this.logger.error(
        `convertToStudent FAILED — admissionId=${id} tenantId=${tenantId} ` +
        `error=${err?.message} code=${err?.code || 'N/A'} ` +
        `meta=${err?.meta ? JSON.stringify(err.meta) : 'N/A'}`,
        err.stack,
      );

      // Prisma errors
      if (err?.code === 'P2003') {
        throw new BadRequestException(
          `Erreur de référence (P2003) lors de la conversion : ${err.meta ? JSON.stringify(err.meta) : 'détails inconnus'}. ` +
          `Vérifiez que le niveau scolaire et l'année académique existent.`,
        );
      }
      if (err?.code === 'P2002') {
        throw new BadRequestException(
          `Conflit d'unicité (P2002) : ${err.meta ? JSON.stringify(err.meta) : 'détails inconnus'}. ` +
          `Un élève avec ces informations existe peut-être déjà.`,
        );
      }

      // NestJS exceptions (BadRequest, Forbidden, etc.) — propager telles quelles
      if (err?.status === 400 || err?.status === 403 || err?.status === 404) {
        throw err;
      }

      // Erreur inconnue — wrap en BadRequest avec message détaillé
      throw new BadRequestException(
        `Échec de la conversion : ${err?.message || 'erreur inconnue'}. ` +
        `Code: ${err?.code || 'N/A'}. Consultez les logs backend pour plus de détails.`,
      );
    }
  }

  // ═══ DOCUMENTS ═══

  async getDocuments(admissionId: string, tenantId: string) {
    return this.prisma.admissionDocument.findMany({
      where: { admissionId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(admissionId: string, tenantId: string, data: {
    documentType: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    fileSize?: number;
    comment?: string;
  }) {
    return this.prisma.admissionDocument.create({
      data: {
        tenantId,
        admissionId,
        documentType: data.documentType,
        fileName: data.fileName ?? null,
        filePath: data.filePath ?? null,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? null,
        comment: data.comment ?? null,
        status: 'SUBMITTED',
      },
    });
  }

  /**
   * Upload d'un document d'admission via data URL (base64).
   * Pattern aligné sur le module RH (StaffPrismaService.uploadStaffDocumentDataUrl).
   *
   * Stocke le data URL directement dans filePath — pas de dépendance Vercel Blob.
   * Le téléchargement se fait ensuite via downloadAdmissionDocument() qui
   * décode le base64 et renvoie le buffer binaire avec Content-Disposition: inline.
   */
  async uploadAdmissionDocumentDataUrl(
    admissionId: string,
    tenantId: string,
    body: {
      documentType: string;
      fileName: string;
      fileDataUrl: string;
      mimeType: string;
      fileSize: number;
      comment?: string;
      expiresAt?: string;
    },
  ): Promise<any> {
    // Vérifier que l'admission existe
    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, tenantId },
      select: { id: true, admissionNumber: true },
    });
    if (!admission) {
      throw new NotFoundException(`Demande d'admission introuvable`);
    }

    // Valider le format data URL
    const trimmed = (body.fileDataUrl ?? '').trim();
    const m = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    if (!m) {
      throw new BadRequestException('Format attendu : data URL base64 (data:...;base64,...).');
    }
    const detectedMime = m[1].trim().toLowerCase();

    // Vérifier la taille (max 20 Mo décodés)
    let buffer: Buffer;
    try {
      buffer = Buffer.from(m[2], 'base64');
    } catch {
      throw new BadRequestException('Base64 invalide.');
    }
    if (buffer.length > 20 * 1024 * 1024) {
      throw new BadRequestException('Fichier trop volumineux (max 20 Mo décodés).');
    }

    // Stocker le data URL directement dans filePath (pattern RH)
    const filePath = trimmed;

    this.logger.log(
      `Upload document admission ${admission.admissionNumber} — type=${body.documentType} — ${buffer.length} octets`,
    );

    return this.prisma.admissionDocument.create({
      data: {
        tenantId,
        admissionId,
        documentType: body.documentType,
        fileName: body.fileName,
        filePath,
        fileSize: body.fileSize || buffer.length,
        mimeType: body.mimeType || detectedMime,
        comment: body.comment || null,
        status: 'SUBMITTED',
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
  }

  /**
   * Télécharge le fichier binaire d'un document d'admission.
   * Gère 3 sources : data URL (base64), URL HTTPS (Vercel Blob), storage service.
   * Pattern aligné sur StaffPrismaService.downloadStaffDocument.
   */
  async downloadAdmissionDocument(
    documentId: string,
    admissionId: string,
    tenantId: string,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const doc = await this.prisma.admissionDocument.findFirst({
      where: { id: documentId, admissionId, tenantId },
    });
    if (!doc) {
      throw new NotFoundException(`Document non trouvé`);
    }

    const filePath = doc.filePath || '';

    // ─── 1. Data URL : décoder directement le base64 ────────────────────
    if (filePath.startsWith('data:')) {
      const m = /^data:([^;]+);base64,(.+)$/i.exec(filePath);
      if (m) {
        const buffer = Buffer.from(m[2], 'base64');
        return {
          buffer,
          fileName: doc.fileName || `document-${documentId}`,
          mimeType: doc.mimeType || m[1],
        };
      }
    }

    // ─── 2. URL HTTPS (Vercel Blob ou autre) : fetch direct ────────────
    if (filePath.startsWith('https://') || filePath.startsWith('http://')) {
      try {
        const response = await fetch(filePath);
        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          return {
            buffer,
            fileName: doc.fileName || `document-${documentId}`,
            mimeType: doc.mimeType || 'application/octet-stream',
          };
        }
      } catch {
        // URL fetch failed — try storage service below
      }
    }

    // ─── 3. Storage service (R2/S3/local) ───────────────────────────────
    if (filePath) {
      try {
        const buffer = await this.storageService.downloadFile(filePath);
        return {
          buffer,
          fileName: doc.fileName || `document-${documentId}`,
          mimeType: doc.mimeType || 'application/octet-stream',
        };
      } catch {
        // storage download failed
      }

      // ─── 4. Fallback filesystem local ────────────────────────────────
      try {
        const fs = await import('fs');
        const path = await import('path');
        const absolutePath = path.join(process.cwd(), filePath);
        if (fs.existsSync(absolutePath)) {
          const buffer = fs.readFileSync(absolutePath);
          return {
            buffer,
            fileName: doc.fileName || `document-${documentId}`,
            mimeType: doc.mimeType || 'application/octet-stream',
          };
        }
      } catch {
        // local filesystem fallback failed
      }
    }

    throw new NotFoundException(
      `Fichier du document introuvable: ${doc.fileName || documentId}`,
    );
  }

  async updateDocument(documentId: string, tenantId: string, data: any) {
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.comment !== undefined) updateData.comment = data.comment;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (data.validatedById !== undefined) updateData.validatedById = data.validatedById;
    if (data.validatedAt !== undefined) updateData.validatedAt = data.validatedAt ? new Date(data.validatedAt) : null;

    return this.prisma.admissionDocument.update({
      where: { id: documentId },
      data: updateData,
    });
  }

  async validateDocument(documentId: string, tenantId: string, userId: string) {
    return this.prisma.admissionDocument.update({
      where: { id: documentId },
      data: {
        status: 'VALIDATED',
        validatedById: userId,
        validatedAt: new Date(),
      },
    });
  }

  async rejectDocument(documentId: string, tenantId: string, userId: string, comment: string) {
    return this.prisma.admissionDocument.update({
      where: { id: documentId },
      data: {
        status: 'REJECTED',
        validatedById: userId,
        validatedAt: new Date(),
        comment,
      },
    });
  }

  async deleteDocument(documentId: string, tenantId: string) {
    return this.prisma.admissionDocument.delete({
      where: { id: documentId },
    });
  }

  // ═══ INTERVIEWS ═══

  async getInterviews(admissionId: string, tenantId: string) {
    return this.prisma.admissionInterview.findMany({
      where: { admissionId, tenantId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async createInterview(admissionId: string, tenantId: string, data: {
    type: string;
    scheduledAt?: string;
    responsibleId?: string;
    comment?: string;
  }) {
    return this.prisma.admissionInterview.create({
      data: {
        tenantId,
        admissionId,
        type: data.type,
        status: 'PLANNED',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        responsibleId: data.responsibleId ?? null,
        comment: data.comment ?? null,
      },
    });
  }

  async updateInterview(interviewId: string, tenantId: string, data: any) {
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (data.conductedAt !== undefined) updateData.conductedAt = data.conductedAt ? new Date(data.conductedAt) : null;
    if (data.responsibleId !== undefined) updateData.responsibleId = data.responsibleId;
    if (data.result !== undefined) updateData.result = data.result;
    if (data.score !== undefined) updateData.score = data.score;
    if (data.comment !== undefined) updateData.comment = data.comment;
    if (data.recommendation !== undefined) updateData.recommendation = data.recommendation;

    return this.prisma.admissionInterview.update({
      where: { id: interviewId },
      data: updateData,
    });
  }

  async completeInterview(interviewId: string, tenantId: string, data: {
    result?: string;
    score?: number;
    comment?: string;
    recommendation?: string;
    status?: string;
  }) {
    return this.prisma.admissionInterview.update({
      where: { id: interviewId },
      data: {
        status: data.status || 'DONE',
        conductedAt: new Date(),
        result: data.result ?? null,
        score: data.score ?? null,
        comment: data.comment ?? null,
        recommendation: data.recommendation ?? null,
      },
    });
  }

  // ═══ EXTENDED ENDPOINTS ═══

  async requestDocuments(id: string, tenantId: string, comment: string, userId: string) {
    return this.changeStatus(id, tenantId, 'MISSING_DOCUMENTS', comment, userId);
  }

  async waitlist(id: string, tenantId: string, comment: string, userId: string) {
    return this.changeStatus(id, tenantId, 'WAITLISTED', comment, userId);
  }

  async cancel(id: string, tenantId: string, comment: string, userId: string) {
    return this.changeStatus(id, tenantId, 'CANCELLED', comment, userId);
  }

  async accept(id: string, tenantId: string, comment: string, userId: string) {
    return this.decide(id, tenantId, 'ACCEPTED', comment, userId);
  }

  async reject(id: string, tenantId: string, comment: string, userId: string) {
    return this.decide(id, tenantId, 'REJECTED', comment, userId);
  }

  async delete(id: string, tenantId: string) {
    const admission = await this.findOne(id, tenantId);
    if (admission.convertedStudentId) {
      throw new BadRequestException('Impossible de supprimer une admission déjà convertie en élève');
    }
    return this.prisma.admission.delete({ where: { id } });
  }

  // ═══ PUBLIC PORTAL — Soumission depuis le portail public ═══

  /**
   * Soumission publique d'une demande d'admission (sans authentification).
   *
   * Pattern aligné sur RecruitmentService.applyJob :
   *   1. Résoudre tenantId depuis body.tenantId (le frontend l'inclut explicitement)
   *   2. Résoudre academicYearId actif du tenant (si non fourni dans le body)
   *   3. Vérifier doublon (même email parent + même année + même tenant)
   *   4. Créer l'Admission en DB (status PENDING, admissionNumber auto-généré)
   *   5. Créer un AdmissionDocument par fichier uploadé (filePath = data URL)
   *   6. Fire-and-forget : envoyer email de confirmation au parent
   *   7. Retourner { admission, documents }
   *
   * Sécurité :
   *   - Pas de JWT (endpoint @Public) — tenantId est trusted depuis le body
   *   - Les fichiers sont validés via DataUrlValidationPipe côté controller
   *   - Le statut est forcé à PENDING (jamais ACCEPTED/CONVERTED depuis le portail)
   */
  async applyAdmission(body: any, files: any): Promise<{ admission: any; documents: any[] }> {
    let tenantId = body.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId est requis pour soumettre une demande d\'admission');
    }

    // ⚠️ Le frontend peut envoyer un slug (ex: "cspeb") au lieu d'un UUID.
    // On résout le tenant par slug OU par UUID pour éviter les 400 "année académique introuvable".
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
    if (!isUuid) {
      // Résoudre l'UUID du tenant depuis le slug ou le subdomain
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          status: { not: 'WITHDRAWN' },
          OR: [{ subdomain: tenantId }, { slug: tenantId }],
        },
        select: { id: true },
      });
      if (!tenant) {
        throw new BadRequestException(`Établissement introuvable pour le slug "${tenantId}"`);
      }
      tenantId = tenant.id;
    }

    // Valider champs obligatoires
    if (!body.firstName || !body.lastName) {
      throw new BadRequestException('Prénom et nom de l\'élève sont requis');
    }

    // Résoudre l'année académique active du tenant si non fournie
    let academicYearId = body.academicYearId;
    if (!academicYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { startDate: 'desc' },
      });
      if (!activeYear) {
        throw new BadRequestException('Aucune année académique active pour cet établissement');
      }
      academicYearId = activeYear.id;
    }

    // Résoudre schoolLevelId — le frontend envoie un code (MATERNELLE/PRIMARY/SECONDARY)
    // mais la FK admissions.schoolLevelId → education_levels.id exige un UUID.
    // On résout le code vers l'UUID correspondant dans education_levels.
    let schoolLevelId = body.schoolLevelId;
    const isLevelUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolLevelId || '');

    if (!schoolLevelId || !isLevelUuid) {
      // Déduire le nom du niveau depuis candidateType ou schoolLevelId
      const candidateType = (body.candidateType || '').toUpperCase();
      const codeToName: Record<string, string> = {
        MATERNELLE: 'MATERNELLE',
        PRIMARY: 'PRIMAIRE',
        SECONDARY: 'SECONDAIRE',
      };
      const levelName = codeToName[candidateType]
        || (schoolLevelId ? schoolLevelId.toUpperCase() : '')
        || 'PRIMAIRE';

      // Résoudre l'UUID depuis education_levels (FK obligatoire)
      const level = await this.prisma.educationLevel.findFirst({
        where: {
          tenantId,
          name: levelName,
        },
        select: { id: true },
      });
      if (!level) {
        throw new BadRequestException(
          `Niveau scolaire "${levelName}" introuvable pour cet établissement. ` +
          `Niveaux disponibles : MATERNELLE, PRIMAIRE, SECONDAIRE.`,
        );
      }
      schoolLevelId = level.id;
    }

    // Vérifier doublon : même email parent + même tenant + même année académique
    if (body.mainGuardianEmail) {
      const existing = await this.prisma.admission.findFirst({
        where: {
          tenantId,
          academicYearId,
          mainGuardianEmail: body.mainGuardianEmail,
          firstName: body.firstName,
          lastName: body.lastName,
          status: { notIn: ['REJECTED', 'CANCELLED'] },
        },
        select: { id: true, admissionNumber: true, status: true },
      });
      if (existing) {
        throw new ConflictException(
          `Une demande d'admission existe déjà pour ${body.firstName} ${body.lastName} ` +
          `(${existing.admissionNumber || 'sans numéro'}) avec l'email ${body.mainGuardianEmail}. ` +
          `Statut actuel : ${existing.status}.`,
        );
      }
    }

    // Générer le numéro d'admission
    const admissionNumber = await this.generateAdmissionNumber(tenantId, academicYearId);

    // Préparer les données d'admission
    const createData: any = {
      tenantId,
      academicYearId,
      schoolLevelId,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      gender: body.gender ?? null,
      birthPlace: body.birthPlace ?? null,
      nationality: body.nationality ?? 'Béninoise',
      address: body.address ?? null,

      // Vœux académiques
      requestedClassId: body.requestedClassId || null,
      requestedSeriesId: body.requestedSeriesId || null,
      wantsBilingual: body.wantsBilingual ?? false,
      previousSchool: body.previousSchool ?? null,
      previousLevel: body.previousLevel ?? null,
      changeReason: body.changeReason ?? null,

      // Responsable légal
      mainGuardianName: body.mainGuardianName ?? null,
      mainGuardianPhone: body.mainGuardianPhone ?? null,
      mainGuardianEmail: body.mainGuardianEmail ?? null,
      mainGuardianRelationship: body.mainGuardianRelationship ?? null,
      mainGuardianAddress: body.mainGuardianAddress ?? null,
      mainGuardianProfession: body.mainGuardianProfession ?? null,

      // Traçabilité
      admissionNumber,
      // createdByUserId = null (pas d'utilisateur authentifié)
      // metadata : conserver la source pour audit
      metadata: {
        source: 'PORTAL_PUBLIC',
        candidateType: body.candidateType || null,
        submittedAt: new Date().toISOString(),
      },

      // Workflow
      status: 'PENDING',
      applicationDate: new Date(),
      notes: body.message || body.notes || null,
    };

    // Convertir les fichiers en data URLs (pattern recruitment.service.ts:2149)
    const dataUrlForFile = (f: Express.Multer.File): string | null => {
      if (!f?.buffer) return null;
      return `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
    };

    // Mapping : clé du body → documentType dans AdmissionDocument
    const docTypeMap: Record<string, string> = {
      birthCertificate: 'BIRTH_CERTIFICATE',
      idPhoto: 'ID_PHOTO',
      lastReportCard: 'REPORT_CARD',
      schoolCertificate: 'SCHOOL_CERTIFICATE',
      npi: 'NPI',
    };

    // Préparer les documents à créer dans la transaction
    const documentsToCreate: Array<{
      documentType: string;
      fileName: string;
      filePath: string;
      mimeType: string;
      fileSize: number;
    }> = [];

    for (const [bodyKey, docType] of Object.entries(docTypeMap)) {
      const fileArr = files[bodyKey];
      if (Array.isArray(fileArr) && fileArr.length > 0) {
        const f = fileArr[0];
        const filePath = dataUrlForFile(f);
        if (filePath) {
          documentsToCreate.push({
            documentType: docType,
            fileName: f.originalname || `${docType.toLowerCase()}.pdf`,
            filePath,
            mimeType: f.mimetype || 'application/octet-stream',
            fileSize: f.size || 0,
          });
        }
      }
    }

    // Transaction : créer admission + documents
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const admission = await tx.admission.create({ data: createData });

          const documents: any[] = [];
          for (const doc of documentsToCreate) {
            const created = await tx.admissionDocument.create({
              data: {
                tenantId,
                admissionId: admission.id,
                documentType: doc.documentType,
                fileName: doc.fileName,
                filePath: doc.filePath,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                status: 'SUBMITTED',
              },
            });
            documents.push(created);
          }

          return { admission, documents };
        },
        { timeout: 30000 },
      );

      this.logger.log(
        `Admission publique créée : id=${result.admission.id}, ` +
        `numéro=${result.admission.admissionNumber}, ` +
        `élève=${body.firstName} ${body.lastName}, ` +
        `documents=${result.documents.length}`,
      );

      // Fire-and-forget : envoyer email de confirmation au parent
      const documentsSubmitted = result.documents.map((d) => ({
        type: d.documentType,
        fileName: d.fileName,
      }));

      this.notificationService
        .notifyAdmissionReceived({
          admissionId: result.admission.id,
          tenantId,
          documentsSubmitted,
        })
        .catch((err) =>
          this.logger.error(
            `notifyAdmissionReceived failed: ${err.message}`,
            err.stack,
          ),
        );

      // Fire-and-forget : créer une notification in-app pour le staff d'admission
      // (cloche header + future notification push)
      this.inAppNotificationService
        .notifyAdmissionStaff({
          admissionId: result.admission.id,
          tenantId,
          admission: {
            firstName: body.firstName,
            lastName: body.lastName,
            admissionNumber: result.admission.admissionNumber,
          },
          requestedClassLabel: body.targetLevel || body.message, // libre, best-effort
        })
        .catch((err) =>
          this.logger.error(
            `notifyAdmissionStaff failed: ${err.message}`,
            err.stack,
          ),
        );

      return result;
    } catch (err: any) {
      // P2003 = foreign key violation — identifier le champ fautif
      if (err?.code === 'P2003') {
        this.logger.error(
          `P2003 FK violation on admission create — ` +
          `tenantId=${createData.tenantId}, academicYearId=${createData.academicYearId}, ` +
          `schoolLevelId=${createData.schoolLevelId}, requestedClassId=${createData.requestedClassId}, ` +
          `meta: ${err.meta ? JSON.stringify(err.meta) : 'N/A'}`,
          err.stack,
        );
        throw new BadRequestException(
          `Erreur de référence (P2003) : un identifiant ne correspond à aucun enregistrement. ` +
          `Détails : ${err.meta ? JSON.stringify(err.meta) : 'inconnu'}. ` +
          `Vérifiez que l'établissement et l'année académique existent.`,
        );
      }
      throw err;
    }
  }
}
