import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class QuartersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(quarterData: any): Promise<any> {
    return this.prisma.quarter.create({ data: quarterData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.quarter.findFirst({
      where: { id, tenantId },
      include: { academicYear: true },
    });
  }

  async findAll(tenantId: string, academicYearId?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    return this.prisma.quarter.findMany({
      where,
      orderBy: { number: 'asc' },
    });
  }

  async findCurrent(tenantId: string): Promise<any | null> {
    return this.prisma.quarter.findFirst({
      where: { tenantId, isCurrent: true },
    });
  }

  async update(id: string, tenantId: string, quarterData: any): Promise<any> {
    await this.prisma.quarter.update({
      where: { id },
      data: quarterData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.quarter.delete({ where: { id } });
  }
}
