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
    const where: any = { tenantId };
    const include: any = {
      schoolLevel: true,  // ← toujours inclure le niveau scolaire
    };

    // 'ALL' ou absent → ne pas filtrer par niveau (retourner toutes les classes)
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    if (academicYearId) {
      where.academicYearId = academicYearId;
      include.academicYear = true;
    }

    return this.prisma.class.findMany({
      where,
      include,
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
    const where: any = { tenantId };
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }
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
