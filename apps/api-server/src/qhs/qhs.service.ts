import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateQhsIncidentDto } from './dto/create-qhs-incident.dto';
import { UpdateQhsIncidentDto } from './dto/update-qhs-incident.dto';

@Injectable()
export class QhsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // INCIDENTS
  // ============================================================================

  async createIncident(
    tenantId: string,
    createDto: CreateQhsIncidentDto,
    createdById?: string,
  ) {
    return this.prisma.qhsIncident.create({
      data: {
        tenantId,
        academicYearId: createDto.academicYearId,
        schoolLevelId: createDto.schoolLevelId,
        type: createDto.type,
        sourceModule: createDto.sourceModule,
        category: createDto.category,
        gravity: createDto.gravity,
        status: createDto.status || 'OUVERT',
        title: createDto.title,
        description: createDto.description,
        location: createDto.location,
        relatedResourceType: createDto.relatedResourceType,
        relatedResourceId: createDto.relatedResourceId,
        metadata: createDto.metadata,
        createdById,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
      },
    });
  }

  async findAllIncidents(
    tenantId: string,
    academicYearId?: string,
    schoolLevelId?: string,
    filters?: {
      type?: string;
      gravity?: string;
      status?: string;
    },
  ) {
    const where: any = {
      tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.gravity) {
      where.gravity = filters.gravity;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.qhsIncident.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
        correctiveActions: {
          select: {
            id: true,
            action: true,
            status: true,
            dueDate: true,
            completedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneIncident(id: string, tenantId: string) {
    const incident = await this.prisma.qhsIncident.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        validatedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
        correctiveActions: {
          include: {
            owner: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        decisions: {
          include: {
            decidedBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: {
            decidedAt: 'desc',
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident QHSE with ID ${id} not found`);
    }

    return incident;
  }

  async updateIncident(
    id: string,
    tenantId: string,
    updateDto: UpdateQhsIncidentDto,
  ) {
    await this.findOneIncident(id, tenantId);

    return this.prisma.qhsIncident.update({
      where: { id },
      data: {
        ...updateDto,
        validatedAt: updateDto.validatedById ? new Date() : undefined,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        validatedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  // ============================================================================
  // RISK REGISTER
  // ============================================================================

  async findAllRisks(
    tenantId: string,
    academicYearId?: string,
    schoolLevelId?: string,
  ) {
    const where: any = {
      tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    return this.prisma.qhsRiskRegister.findMany({
      where,
      include: {
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: {
        level: 'desc',
      },
    });
  }

  async findOneRisk(id: string, tenantId: string) {
    const risk = await this.prisma.qhsRiskRegister.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!risk) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }

    return risk;
  }

  // ============================================================================
  // AUDITS
  // ============================================================================

  async findAllAudits(
    tenantId: string,
    academicYearId?: string,
    schoolLevelId?: string,
  ) {
    const where: any = {
      tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    return this.prisma.qhsAudit.findMany({
      where,
      include: {
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOneAudit(id: string, tenantId: string) {
    const audit = await this.prisma.qhsAudit.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
      },
    });

    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    return audit;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  async getStatistics(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const [incidents, risks, audits] = await Promise.all([
      this.prisma.qhsIncident.groupBy({
        by: ['gravity', 'status'],
        where,
        _count: true,
      }),
      this.prisma.qhsRiskRegister.groupBy({
        by: ['level', 'status'],
        where,
        _count: true,
      }),
      this.prisma.qhsAudit.groupBy({
        by: ['status', 'globalResult'],
        where,
        _count: true,
      }),
    ]);

    return {
      incidents: {
        byGravity: incidents.filter((i) => i.gravity),
        byStatus: incidents.filter((i) => i.status),
      },
      risks: {
        byLevel: risks.filter((r) => r.level),
        byStatus: risks.filter((r) => r.status),
      },
      audits: {
        byStatus: audits.filter((a) => a.status),
        byResult: audits.filter((a) => a.globalResult),
      },
    };
  }
}

