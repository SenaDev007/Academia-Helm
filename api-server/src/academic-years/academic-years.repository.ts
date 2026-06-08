import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AcademicYearsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(academicYearData: any): Promise<any> {
    return this.prisma.academicYear.create({ data: academicYearData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.academicYear.findFirst({
      where: { id, tenantId },
      include: { quarters: true },
    });
  }

  async findAll(tenantId: string): Promise<any[]> {
    return this.prisma.academicYear.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findCurrent(tenantId: string): Promise<any | null> {
    return this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
    });
  }

  async update(id: string, tenantId: string, academicYearData: any): Promise<any> {
    await this.prisma.academicYear.update({
      where: { id },
      data: academicYearData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.academicYear.delete({ where: { id } });
  }
}
