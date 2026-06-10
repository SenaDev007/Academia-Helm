import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(permissionData: any): Promise<any> {
    return this.prisma.permission.create({ data: permissionData });
  }

  async findOne(id: string): Promise<any | null> {
    return this.prisma.permission.findFirst({ where: { id } });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.permission.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByName(name: string): Promise<any | null> {
    return this.prisma.permission.findFirst({ where: { name } });
  }

  async findByResource(resource: string): Promise<any[]> {
    return this.prisma.permission.findMany({
      where: { resource },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, permissionData: any): Promise<any> {
    await this.prisma.permission.update({ where: { id }, data: permissionData });
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.permission.delete({ where: { id } });
  }
}
