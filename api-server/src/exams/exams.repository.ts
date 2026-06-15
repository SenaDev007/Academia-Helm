import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ExamsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(examData: any): Promise<any> {
    return this.prisma.exam.create({ data: examData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.exam.findFirst({
      where: { id, tenantId },
      include: { subject: true, class: true, academicYear: true, quarter: true },
    });
  }

  async findAll(
    tenantId: string, 
    classId?: string, 
    subjectId?: string, 
    academicYearId?: string,
    academicTrackId?: string | null, // NULL = track par défaut (FR)
  ): Promise<any[]> {
    const where: any = { tenantId };
    if (classId) {
      where.classId = classId;
    }
    if (subjectId) {
      where.subjectId = subjectId;
    }
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    // Filtrer par academic track si spécifié
    // Si academicTrackId est null, on filtre les examens sans track (FR par défaut)
    // Si academicTrackId est défini, on filtre par ce track
    if (academicTrackId !== undefined) {
      where.academicTrackId = academicTrackId;
    }
    return this.prisma.exam.findMany({
      where,
      include: { subject: true, class: true, academicTrack: true },
      orderBy: { examDate: 'desc' },
    });
  }

  async update(id: string, tenantId: string, examData: any): Promise<any> {
    await this.prisma.exam.update({
      where: { id },
      data: examData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.exam.delete({ where: { id } });
  }
}
