import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(subjectData: any): Promise<any> {
    return this.prisma.subject.create({ data: subjectData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.subject.findFirst({
      where: { id, tenantId },
      include: { academicYear: true, schoolLevel: true },
    });
  }

  async findAll(tenantId: string, level?: string, academicYearId?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (level) {
      where.schoolLevelId = level;
    }
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    return this.prisma.subject.findMany({
      where,
      include: { schoolLevel: true },
      orderBy: { code: 'asc' },
    });
  }

  async update(id: string, tenantId: string, subjectData: any): Promise<any> {
    await this.prisma.subject.updateMany({
      where: { id, tenantId },
      data: subjectData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.subject.deleteMany({
      where: { id, tenantId },
    });
  }
}
