import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async create(
    createAuditLogDto: CreateAuditLogDto,
    tenantId: string,
    userId?: string,
  ): Promise<AuditLog> {
    return this.auditLogsRepository.create({
      ...createAuditLogDto,
      tenantId,
      userId: userId ?? null,
    });
  }

  async findAll(
    tenantId: string,
    filters?: {
      userId?: string;
      resource?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<AuditLog[]> {
    return this.auditLogsRepository.findAll(tenantId, filters);
  }

  async findOne(id: string, tenantId: string): Promise<AuditLog> {
    const auditLog = await this.auditLogsRepository.findOne(id, tenantId);
    if (!auditLog) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }
    return auditLog;
  }

  async findByResource(
    resource: string,
    resourceId: string,
    tenantId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogsRepository.findByResource(resource, resourceId, tenantId);
  }
}

