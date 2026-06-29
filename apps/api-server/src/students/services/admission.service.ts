import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentsLifecycleService } from './students-lifecycle.service';

@Injectable()
export class AdmissionService {
  private readonly logger = new Logger(AdmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: StudentsLifecycleService,
  ) {}

  /**
   * Génère un numéro d'admission unique au format ADM-{YEAR}-{SEQ}.
   * La séquence est par tenant + année académique.
   *
   * On utilise une approche simple : compter les admissions existantes
   * pour ce tenant + année, +1, et formater avec padding.
   * Pas besoin de table de séquence dédiée (contrairement aux matricules
   * qui doivent être gapless et transactionnels).
   */
  private async generateAdmissionNumber(tenantId: string, academicYearId: string): Promise<string> {
    // Récupérer l'année scolaire pour extraire l'année civile
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { name: true, startDate: true },
    });
    const year = academicYear?.startDate
      ? new Date(academicYear.startDate).getFullYear().toString()
      : new Date().getFullYear().toString();

    // Compter les admissions existantes pour ce tenant + année
    const count = await this.prisma.admission.count({
      where: { tenantId, academicYearId },
    });

    const seq = String(count + 1).padStart(4, '0');
    const admissionNumber = `ADM-${year}-${seq}`;

    // Vérifier l'unicité (au cas où une admission a été supprimée → count < max seq)
    const existing = await this.prisma.admission.findFirst({
      where: { tenantId, admissionNumber },
      select: { id: true },
    });
    if (existing) {
      // Collision → utiliser un timestamp suffix pour garantir l'unicité
      const suffix = Date.now().toString().slice(-4);
      return `ADM-${year}-${seq}-${suffix}`;
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

    return this.prisma.admission.create({
      data: {
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

        // Responsable légal
        mainGuardianName: data.mainGuardianName ?? null,
        mainGuardianPhone: data.mainGuardianPhone ?? null,
        mainGuardianEmail: data.mainGuardianEmail ?? null,
        mainGuardianRelationship: data.mainGuardianRelationship ?? null,

        // Traçabilité
        admissionNumber,
        createdByUserId: userId ?? null,

        // Workflow
        status: 'PENDING',
        applicationDate: new Date(),
        notes: data.notes ?? null,
      },
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
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
        schoolLevel: true,
        academicYear: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { id, tenantId },
      include: {
        schoolLevel: true,
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

    // Responsable légal
    if (data.mainGuardianName !== undefined) updateData.mainGuardianName = data.mainGuardianName;
    if (data.mainGuardianPhone !== undefined) updateData.mainGuardianPhone = data.mainGuardianPhone;
    if (data.mainGuardianEmail !== undefined) updateData.mainGuardianEmail = data.mainGuardianEmail;
    if (data.mainGuardianRelationship !== undefined) updateData.mainGuardianRelationship = data.mainGuardianRelationship;

    // Workflow
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
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
        schoolLevel: true,
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
    const admission = await this.findOne(id, tenantId);

    if (admission.status !== 'ACCEPTED') {
      throw new BadRequestException('L\'admission doit être ACCEPTÉE pour être convertie');
    }

    // Vérifier qu'elle n'a pas déjà été convertie
    if (admission.convertedStudentId) {
      throw new BadRequestException('Cette admission a déjà été convertie en dossier élève');
    }

    // 1. Pré-inscription (crée Student + StudentEnrollment PRE_REGISTERED)
    const student = await this.lifecycleService.preRegister(tenantId, {
      academicYearId: admission.academicYearId,
      schoolLevelId: admission.schoolLevelId,
      firstName: admission.firstName,
      lastName: admission.lastName,
      dateOfBirth: admission.dateOfBirth ?? undefined,
      gender: admission.gender ?? undefined,
      placeOfBirth: admission.birthPlace ?? undefined,
      nationality: admission.nationality ?? undefined,
      classId: admission.requestedClassId ?? undefined,
    }, userId);

    // 2. Résoudre le classId pour admit()
    //    admit() requires a classId (non-null). Si l'admission n'a pas de
    //    requestedClassId, on cherche la première classe du niveau.
    let classIdForAdmit = admission.requestedClassId;

    if (!classIdForAdmit) {
      // Chercher la première classe disponible pour ce tenant + année + niveau
      const fallbackClass = await this.prisma.class.findFirst({
        where: {
          tenantId,
          academicYearId: admission.academicYearId,
          schoolLevelId: admission.schoolLevelId,
        },
        orderBy: { name: 'asc' },
        select: { id: true },
      });
      classIdForAdmit = fallbackClass?.id;

      if (!classIdForAdmit) {
        this.logger.warn(
          `Aucune classe trouvée pour tenant=${tenantId} year=${admission.academicYearId} level=${admission.schoolLevelId}. ` +
          `L'élève sera admis sans classe — affectation manuelle requise plus tard.`,
        );
      }
    }

    // 3. Admission formelle (génère matricule + StudentAccount + token QR + StudentAcademicRecord)
    //    ⚠️ Si pas de classe, on ne peut pas appeler admit() qui requires classId.
    //    Dans ce cas, on garde l'élève en PRE_REGISTERED et l'utilisateur devra
    //    l'affecter manuellement (ce qui déclenchera admit() via l'onglet Affectations).
    if (classIdForAdmit) {
      try {
        await this.lifecycleService.admit(tenantId, {
          studentId: student.id,
          academicYearId: admission.academicYearId,
          schoolLevelId: admission.schoolLevelId,
          classId: classIdForAdmit,
        }, userId);

        this.logger.log(
          `Admission ${admission.admissionNumber}: student ${student.id} admitted with matricule + account + token`,
        );
      } catch (admitErr: any) {
        // Si admit() échoue, l'élève reste en PRE_REGISTERED — on ne bloque
        // pas la conversion, on log l'erreur pour debug.
        this.logger.error(
          `Admission ${admission.admissionNumber}: admit() failed for student ${student.id}: ${admitErr.message}`,
          admitErr.stack,
        );
      }
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

    // Retourner l'élève avec ses relations
    return this.prisma.student.findUnique({
      where: { id: student.id },
      include: {
        studentEnrollments: { include: { class: true, academicYear: true } },
        schoolLevel: true,
        studentGuardians: { include: { guardian: true } },
      },
    });
  }
}
