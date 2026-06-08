import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(auditLogData: any): Promise<any> {
    return this.prisma.auditLog.create({ data: auditLogData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.auditLog.findFirst({
      where: { id, tenantId },
    });
  }

  async findAll(tenantId: string, filters?: {
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const where: any = { tenantId };

    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.resource) {
      where.resource = filters.resource;
    }
    if (filters?.action) {
      where.action = filters.action;
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByResource(resource: string, resourceId: string, tenantId: string): Promise<any[]> {
    return this.prisma.auditLog.findMany({
      where: { resource, resourceId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
