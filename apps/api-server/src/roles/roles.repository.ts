import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(roleData: any): Promise<any> {
    return this.prisma.role.create({ data: roleData });
  }

  async findOne(id: string, tenantId?: string | null): Promise<any | null> {
    const where: any = { id };
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }
    return this.prisma.role.findFirst({ where });
  }

  async findAll(tenantId?: string | null): Promise<any[]> {
    const where: any = {};
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }
    return this.prisma.role.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByName(name: string, tenantId?: string | null): Promise<any | null> {
    const where: any = { name };
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }
    return this.prisma.role.findFirst({ where });
  }

  async update(id: string, tenantId: string | null, roleData: any): Promise<any> {
    await this.prisma.role.update({ where: { id }, data: roleData });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string | null): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }
}
