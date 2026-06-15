import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DisciplineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(disciplineData: any): Promise<any> {
    return this.prisma.discipline.create({ data: disciplineData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.discipline.findFirst({
      where: { id, tenantId },
      include: { student: true, reporter: true },
    });
  }

  async findAll(tenantId: string, studentId?: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    const where: any = { tenantId };

    if (studentId) {
      where.studentId = studentId;
    }
    if (startDate || endDate) {
      where.incidentDate = {};
      if (startDate) {
        where.incidentDate.gte = startDate;
      }
      if (endDate) {
        where.incidentDate.lte = endDate;
      }
    }

    return this.prisma.discipline.findMany({
      where,
      include: { student: true, reporter: true },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async update(id: string, tenantId: string, disciplineData: any): Promise<any> {
    await this.prisma.discipline.updateMany({
      where: { id, tenantId },
      data: disciplineData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.discipline.deleteMany({
      where: { id, tenantId },
    });
  }
}
