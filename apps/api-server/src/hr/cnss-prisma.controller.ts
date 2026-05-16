/**
 * ============================================================================
 * CNSS PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED)
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CNSSPrismaService } from './cnss-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('api/hr/cnss')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CNSSPrismaController {
  constructor(private readonly cnssService: CNSSPrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // DÉCLARATIONS
  // ──────────────────────────────────────────────────────────────────────────

  @Post('declarations')
  async createDeclaration(@GetTenant() tenant: any, @Body() body: any) {
    return this.cnssService.createCNSSDeclaration({
      tenantId: tenant.id,
      academicYearId: body.academicYearId,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  @Get('declarations')
  async findAllDeclarations(@GetTenant() tenant: any) {
    return this.cnssService.findAllDeclarations(tenant.id);
  }

  @Get('declarations/:id')
  async findDeclarationById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.cnssService.findDeclarationById(id, tenant.id);
  }

  @Put('declarations/:id/finalize')
  async finalizeDeclaration(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { status: 'GENERATED' | 'SUBMITTED' | 'PAID' },
  ) {
    return this.cnssService.finalizeDeclaration(id, tenant.id, body.status);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAUX CNSS ACTIF (lecture seule — édition via /hr/payroll/rates)
  // ──────────────────────────────────────────────────────────────────────────

  @Get('rates/active')
  async getActiveCNSSRate(@GetTenant() tenant: any) {
    return this.cnssService.findActiveCNSSRate(tenant.id);
  }
}
