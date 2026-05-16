import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdmissionStatus, Gender } from '@prisma/client';
import { StudentsLifecycleService } from './students-lifecycle.service';

@Injectable()
export class AdmissionService {
  private readonly logger = new Logger(AdmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: StudentsLifecycleService,
  ) {}

  async create(tenantId: string, data: any, userId?: string) {
    return this.prisma.studentAdmission.create({
      data: {
        ...data,
        tenantId,
        createdById: userId,
        status: 'DRAFT' as AdmissionStatus,
      },
    });
  }

  async findAll(tenantId: string, filters: any) {
    const { academicYearId, status, search } = filters;
    return this.prisma.studentAdmission.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        ...(status && { status: status as AdmissionStatus }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { admissionNumber: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        requestedLevel: true,
        requestedClass: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const admission = await this.prisma.studentAdmission.findFirst({
      where: { id, tenantId },
      include: {
        documents: true,
        interviews: true,
        requestedLevel: true,
        requestedClass: true,
        requestedSeries: true,
      },
    });
    if (!admission) throw new NotFoundException('Admission non trouvée');
    return admission;
  }

  async update(id: string, tenantId: string, data: any, userId?: string) {
    return this.prisma.studentAdmission.update({
      where: { id },
      data: {
        ...data,
        updatedById: userId,
      },
    });
  }

  async submit(id: string, tenantId: string) {
    return this.update(id, tenantId, { status: 'SUBMITTED' as AdmissionStatus });
  }

  async decide(id: string, tenantId: string, decision: 'ACCEPTED' | 'REJECTED', comment: string, userId: string) {
    return this.update(id, tenantId, {
      status: decision as AdmissionStatus,
      decisionComment: comment,
      decisionById: userId,
      decisionAt: new Date(),
    });
  }

  /**
   * Conversion d'une admission ACCEPTED en Dossier Élève
   */
  async convertToStudent(id: string, tenantId: string, userId: string) {
    const admission = await this.findOne(id, tenantId);
    
    if (admission.status !== 'ACCEPTED') {
      throw new BadRequestException('L\'admission doit être ACCEPTÉE pour être convertie');
    }
    
    if (admission.convertedStudentId) {
      throw new BadRequestException('Cette admission a déjà été convertie');
    }

    // Workflow de conversion via le service cycle de vie existant
    // Note: On utilise preRegister pour créer le dossier élève initial
    const student = await this.lifecycleService.preRegister(tenantId, {
      academicYearId: admission.academicYearId,
      schoolLevelId: admission.requestedLevelId || '',
      firstName: admission.firstName,
      lastName: admission.lastName,
      dateOfBirth: admission.birthDate || undefined,
      gender: admission.gender || undefined,
      nationality: admission.nationality || undefined,
      placeOfBirth: admission.birthPlace || undefined,
      classId: admission.requestedClassId || undefined,
      photoUrl: admission.photoUrl || undefined,
    }, userId);

    // Mettre à jour l'admission pour marquer la conversion
    await this.prisma.studentAdmission.update({
      where: { id },
      data: {
        status: 'CONVERTED' as AdmissionStatus,
        convertedStudentId: student.id,
        convertedAt: new Date(),
      },
    });

    return student;
  }
}
