import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DepartmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(departmentData: any): Promise<any> {
    return this.prisma.department.create({ data: departmentData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.department.findFirst({
      where: { id, tenantId },
      include: { manager: true },
    });
  }

  async findAll(tenantId: string): Promise<any[]> {
    return this.prisma.department.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, tenantId: string, departmentData: any): Promise<any> {
    await this.prisma.department.update({
      where: { id },
      data: departmentData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.department.delete({ where: { id } });
  }
}
