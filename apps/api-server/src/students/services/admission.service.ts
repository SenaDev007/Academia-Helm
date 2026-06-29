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
   * Conversion d'une admission ACCEPTED en Dossier Élève.
   *
   * ⚠️ Phase 1 : cette méthode appelle encore preRegister() (pas admit()).
   * Le passage à admit() sera fait en Phase 2 (génération matricule +
   * StudentAccount + Guardian + convertedStudentId).
   *
   * Pour l'instant, on persiste au moins le convertedStudentId pour la
   * traçabilité.
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

    // Create student directly via the lifecycle service
    const student = await this.lifecycleService.preRegister(tenantId, {
      academicYearId: admission.academicYearId,
      schoolLevelId: admission.schoolLevelId,
      firstName: admission.firstName,
      lastName: admission.lastName,
      dateOfBirth: admission.dateOfBirth ?? undefined,
      gender: admission.gender ?? undefined,
      placeOfBirth: admission.birthPlace ?? undefined,
      nationality: admission.nationality ?? undefined,
    }, userId);

    // Update the admission status to CONVERTED + link the student
    await this.prisma.admission.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        decisionBy: userId,
        decisionDate: new Date(),
        convertedStudentId: student.id,
      },
    });

    this.logger.log(`Admission ${admission.admissionNumber} converted to student ${student.id}`);

    return student;
  }
}
