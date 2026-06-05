import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AbsencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(absenceData: any): Promise<any> {
    return this.prisma.absence.create({ data: absenceData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.absence.findFirst({
      where: { id, tenantId },
      include: { student: true, class: true },
    });
  }

  async findAll(tenantId: string, studentId?: string, classId?: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    const where: any = { tenantId };

    if (studentId) {
      where.studentId = studentId;
    }
    if (classId) {
      where.classId = classId;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
    }

    return this.prisma.absence.findMany({
      where,
      include: { student: true, class: true },
      orderBy: { date: 'desc' },
    });
  }

  async update(id: string, tenantId: string, absenceData: any): Promise<any> {
    await this.prisma.absence.updateMany({
      where: { id, tenantId },
      data: absenceData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.absence.deleteMany({
      where: { id, tenantId },
    });
  }
}
