import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TeachersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(teacherData: any): Promise<any> {
    return this.prisma.teacher.create({ data: teacherData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: { department: true, subject: true, academicYear: true },
    });
  }

  async findAll(tenantId: string, departmentId?: string, status?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (status) {
      where.status = status;
    }
    return this.prisma.teacher.findMany({
      where,
      include: { department: true },
      orderBy: { lastName: 'asc', firstName: 'asc' },
    });
  }

  async update(id: string, tenantId: string, teacherData: any): Promise<any> {
    await this.prisma.teacher.update({
      where: { id },
      data: teacherData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.teacher.delete({ where: { id } });
  }
}
