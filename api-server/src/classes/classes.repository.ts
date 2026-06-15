import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ClassesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(classData: any): Promise<any> {
    return this.prisma.class.create({ data: classData });
  }

  async findOne(id: string, tenantId: string, schoolLevelId: string): Promise<any | null> {
    return this.prisma.class.findFirst({
      where: { id, tenantId, schoolLevelId },
      include: { academicYear: true },
    });
  }

  async findAll(
    tenantId: string,
    schoolLevelId: string,
    pagination: { skip: number; take: number },
    academicYearId?: string,
  ): Promise<any[]> {
    const where: any = { tenantId, schoolLevelId };
    const include: any = {};

    if (academicYearId) {
      where.academicYearId = academicYearId;
      include.academicYear = true;
    }

    return this.prisma.class.findMany({
      where,
      include: Object.keys(include).length > 0 ? include : undefined,
      orderBy: { name: 'asc' },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  async count(
    tenantId: string,
    schoolLevelId: string,
    academicYearId?: string,
  ): Promise<number> {
    const where: any = { tenantId, schoolLevelId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    return this.prisma.class.count({ where });
  }

  async update(id: string, tenantId: string, classData: any): Promise<any> {
    await this.prisma.class.updateMany({
      where: { id, tenantId },
      data: classData,
    });
    return this.prisma.class.findFirst({
      where: { id, tenantId },
      include: { academicYear: true },
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.class.deleteMany({
      where: { id, tenantId },
    });
  }
}
