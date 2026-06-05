import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FeeConfigurationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(feeConfigurationData: any): Promise<any> {
    return this.prisma.feeConfiguration.create({ data: feeConfigurationData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.feeConfiguration.findFirst({
      where: { id, tenantId },
      include: { class: true, academicYear: true },
    });
  }

  async findAll(tenantId: string, classId?: string, academicYearId?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (classId) {
      where.classId = classId;
    }
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    return this.prisma.feeConfiguration.findMany({
      where,
      include: { class: true, academicYear: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, tenantId: string, feeConfigurationData: any): Promise<any> {
    await this.prisma.feeConfiguration.updateMany({
      where: { id, tenantId },
      data: feeConfigurationData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.feeConfiguration.deleteMany({
      where: { id, tenantId },
    });
  }
}
