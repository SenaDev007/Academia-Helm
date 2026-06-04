/**
 * ============================================================================
 * ORION KPI CONTROLLER - MODULE 8
 * ============================================================================
 */

import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { KPICalculationService } from './services/kpi-calculation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { UpsertKpiDefinitionDto, CalculateKpiDto } from './dto/kpi.dto';

@Controller('orion/kpi')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrionKPIController {
  constructor(private readonly kpiService: KPICalculationService) {}

  @Get('definitions')
  async findAllDefinitions(@GetTenant() tenant: any) {
    return this.kpiService.findAllKpiDefinitions(tenant.id);
  }

  @Post('definitions')
  async upsertDefinition(@GetTenant() tenant: any, @Body() data: UpsertKpiDefinitionDto) {
    return this.kpiService.upsertKpiDefinition(tenant.id, data);
  }

  @Get('snapshots')
  async findSnapshots(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('kpiId') kpiId?: string,
    @Query('category') category?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.kpiService.findKPISnapshots(tenant.id, {
      academicYearId,
      schoolLevelId,
      kpiId,
      category,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Post('calculate')
  async calculateKPIs(
    @GetTenant() tenant: any,
    @Body() body: CalculateKpiDto,
  ) {
    const kpis = await this.kpiService.calculateSystemKPIs(
      tenant.id,
      body.academicYearId,
      body.schoolLevelId,
    );

    // Sauvegarder les snapshots
    const definitions = await this.kpiService.findAllKpiDefinitions(tenant.id);
    const kpiMap = new Map(definitions.map(d => [d.code, d]));

    for (const kpi of kpis) {
      const definition = kpiMap.get(kpi.code);
      if (definition) {
        await this.kpiService.saveKPISnapshot(tenant.id, {
          kpiId: definition.id,
          academicYearId: body.academicYearId,
          schoolLevelId: body.schoolLevelId,
          value: kpi.value,
          period: new Date().toISOString().slice(0, 7), // YYYY-MM
          metadata: { category: kpi.category, scope: kpi.scope },
        });
      }
    }

    return kpis;
  }
}

