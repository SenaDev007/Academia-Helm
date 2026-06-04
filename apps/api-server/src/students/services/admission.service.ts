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

  async create(tenantId: string, data: any, userId?: string) {
    return this.prisma.admission.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ?? null,
        gender: data.gender ?? null,
        status: 'PENDING',
        applicationDate: new Date(),
      },
    });
  }

  async findAll(tenantId: string, filters: any) {
    const { academicYearId, status, search } = filters;
    return this.prisma.admission.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        ...(status && { status }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
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

  async update(id: string, tenantId: string, data: any, userId?: string) {
    // Only include fields that exist in the Prisma Admission model
    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.schoolLevelId !== undefined) updateData.schoolLevelId = data.schoolLevelId;
    if (data.academicYearId !== undefined) updateData.academicYearId = data.academicYearId;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.applicationDate !== undefined) updateData.applicationDate = data.applicationDate;
    if (data.decisionDate !== undefined) updateData.decisionDate = data.decisionDate;
    if (data.decisionBy !== undefined) updateData.decisionBy = data.decisionBy;

    return this.prisma.admission.update({
      where: { id },
      data: updateData,
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
   * Conversion d'une admission ACCEPTED en Dossier Élève
   */
  async convertToStudent(id: string, tenantId: string, userId: string) {
    const admission = await this.findOne(id, tenantId);

    if (admission.status !== 'ACCEPTED') {
      throw new BadRequestException('L\'admission doit être ACCEPTÉE pour être convertie');
    }

    // Create student directly via the lifecycle service
    const student = await this.lifecycleService.preRegister(tenantId, {
      academicYearId: admission.academicYearId,
      schoolLevelId: admission.schoolLevelId,
      firstName: admission.firstName,
      lastName: admission.lastName,
      dateOfBirth: admission.dateOfBirth ?? undefined,
      gender: admission.gender ?? undefined,
    }, userId);

    // Update the admission status to CONVERTED
    await this.prisma.admission.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        decisionBy: userId,
        decisionDate: new Date(),
      },
    });

    return student;
  }
}
