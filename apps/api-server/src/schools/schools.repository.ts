import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SchoolsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(schoolData: any): Promise<any> {
    return this.prisma.school.create({ data: schoolData });
  }

  async findOne(tenantId: string): Promise<any | null> {
    return this.prisma.school.findFirst({
      where: { tenantId },
      include: { tenant: true },
    });
  }

  async update(tenantId: string, schoolData: any): Promise<any> {
    // Find the school by tenantId first to get its id for the where clause
    const school = await this.prisma.school.findFirst({ where: { tenantId } });
    if (!school) {
      throw new Error('School not found');
    }
    await this.prisma.school.update({
      where: { id: school.id },
      data: schoolData,
    });
    return this.findOne(tenantId);
  }
}
