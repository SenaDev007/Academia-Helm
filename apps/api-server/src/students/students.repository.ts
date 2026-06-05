import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StudentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(studentData: any): Promise<any> {
    return this.prisma.student.create({ data: studentData });
  }

  async findOne(id: string, tenantId: string, schoolLevelId: string): Promise<any | null> {
    return this.prisma.student.findFirst({
      where: { id, tenantId, schoolLevelId },
    });
  }

  async findAll(
    tenantId: string,
    schoolLevelId: string,
    pagination: { skip: number; take: number },
    academicYearId?: string,
  ): Promise<any[]> {
    const where: any = { tenantId, schoolLevelId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    return this.prisma.student.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        tenantId: true,
        schoolLevelId: true,
        createdAt: true,
      },
    });
  }

  async count(tenantId: string, schoolLevelId: string, academicYearId?: string): Promise<number> {
    const where: any = { tenantId, schoolLevelId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    return this.prisma.student.count({ where });
  }

  async update(
    id: string,
    tenantId: string,
    schoolLevelId: string,
    studentData: any,
  ): Promise<any> {
    await this.prisma.student.updateMany({
      where: { id, tenantId, schoolLevelId },
      data: studentData,
    });
    return this.findOne(id, tenantId, schoolLevelId);
  }

  async delete(id: string, tenantId: string, schoolLevelId: string): Promise<void> {
    await this.prisma.student.deleteMany({
      where: { id, tenantId, schoolLevelId },
    });
  }

  async findByUserId(tenantId: string, userId: string): Promise<any[]> {
    return this.prisma.student.findMany({
      where: { tenantId, createdBy: userId },
    });
  }
}
