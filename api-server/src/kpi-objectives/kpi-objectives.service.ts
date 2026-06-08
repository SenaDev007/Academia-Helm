import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateKpiObjectiveDto } from './dto/create-kpi-objective.dto';
import { UpdateKpiObjectiveDto } from './dto/update-kpi-objective.dto';

@Injectable()
export class KpiObjectivesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createDto: CreateKpiObjectiveDto, createdById?: string) {
    return this.prisma.kpiObjective.create({
      data: {
        tenantId,
        kpiId: createDto.kpiId,
        academicYearId: createDto.academicYearId,
        schoolLevelId: createDto.schoolLevelId,
        period: createDto.period,
        targetValue: createDto.targetValue,
        minAcceptable: createDto.minAcceptable,
        maxAcceptable: createDto.maxAcceptable,
        status: createDto.status || 'DRAFT',
        createdById,
      },
      include: {
        kpi: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            unit: true,
          },
        },
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findAll(
    tenantId: string,
    academicYearId?: string,
    schoolLevelId?: string,
    kpiId?: string,
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

    if (kpiId) {
      where.kpiId = kpiId;
    }

    return this.prisma.kpiObjective.findMany({
      where,
      include: {
        kpi: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            unit: true,
          },
        },
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const objective = await this.prisma.kpiObjective.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        kpi: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            unit: true,
          },
        },
        academicYear: {
          select: { id: true, label: true },
        },
        schoolLevel: {
          select: { id: true, code: true, label: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!objective) {
      throw new NotFoundException(`KPI Objective with ID ${id} not found`);
    }

    return objective;
  }

  async update(id: string, tenantId: string, updateDto: UpdateKpiObjectiveDto) {
    await this.findOne(id, tenantId);

    return this.prisma.kpiObjective.update({
      where: { id },
      data: updateDto,
      include: {
        kpi: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            unit: true,
          },
        },
      },
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.kpiObjective.delete({
      where: { id },
    });
  }

  // ============================================================================
  // OBJECTIVES WITH ACTUAL VALUES (comparison)
  // ============================================================================

  async getObjectivesWithActuals(
    tenantId: string,
    academicYearId?: string,
    schoolLevelId?: string,
  ) {
    const objectives = await this.findAll(tenantId, academicYearId, schoolLevelId);

    // Pour chaque objectif, récupérer les valeurs réelles depuis kpi_snapshots
    const objectivesWithActuals = await Promise.all(
      objectives.map(async (objective) => {
        // Récupérer la dernière snapshot pour ce KPI
        const latestSnapshot = await this.prisma.kpiSnapshot.findFirst({
          where: {
            tenantId,
            kpiId: objective.kpiId,
            academicYearId: objective.academicYearId,
            schoolLevelId: objective.schoolLevelId || null,
          },
          orderBy: {
            computedAt: 'desc',
          },
        });

        const actualValue = latestSnapshot?.value || null;
        const gap = actualValue !== null ? actualValue - objective.targetValue : null;
        const percentageGap =
          actualValue !== null && objective.targetValue !== 0
            ? ((gap / objective.targetValue) * 100).toFixed(2)
            : null;

        // Déterminer le statut automatique si non défini
        let computedStatus = objective.status;
        if (actualValue !== null) {
          if (gap === 0 || Math.abs(gap) < 0.01) {
            computedStatus = 'ACHIEVED';
          } else if (
            objective.minAcceptable &&
            objective.maxAcceptable &&
            actualValue >= objective.minAcceptable &&
            actualValue <= objective.maxAcceptable
          ) {
            computedStatus = 'ACTIVE';
          } else if (gap > 0 && gap > objective.targetValue * 0.1) {
            computedStatus = 'AT_RISK';
          } else if (gap < 0 && Math.abs(gap) > objective.targetValue * 0.1) {
            computedStatus = 'OFF_TRACK';
          }
        }

        return {
          ...objective,
          actualValue,
          gap,
          percentageGap: percentageGap ? parseFloat(percentageGap) : null,
          computedStatus,
        };
      }),
    );

    return objectivesWithActuals;
  }
}

