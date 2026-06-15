import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GradesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(gradeData: any): Promise<any> {
    return this.prisma.grade.create({ data: gradeData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.grade.findFirst({
      where: { id, tenantId },
      include: { student: true, exam: true, subject: true, class: true, academicYear: true, quarter: true },
    });
  }

  async findAll(
    tenantId: string,
    studentId?: string,
    subjectId?: string,
    classId?: string,
    quarterId?: string,
    academicTrackId?: string | null,
  ): Promise<any[]> {
    const where: any = { tenantId };
    if (studentId) {
      where.studentId = studentId;
    }
    if (subjectId) {
      where.subjectId = subjectId;
    }
    if (classId) {
      where.classId = classId;
    }
    if (quarterId) {
      where.quarterId = quarterId;
    }
    if (academicTrackId !== undefined) {
      where.academicTrackId = academicTrackId;
    }
    return this.prisma.grade.findMany({
      where,
      include: { student: true, subject: true, exam: true, academicTrack: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, tenantId: string, gradeData: any): Promise<any> {
    await this.prisma.grade.updateMany({
      where: { id, tenantId },
      data: gradeData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.grade.deleteMany({
      where: { id, tenantId },
    });
  }
}
