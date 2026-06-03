/**
 * ============================================================================
 * CNSS PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller aligné sur le service CNSSPrismaService réécrit.
 * Utilise CNSSRate, EmployeeCNSS, CNSSDeclaration, CNSSDeclarationLine.
 *
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CNSSPrismaService } from './cnss-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { UpsertCNSSRateDto, CreateCNSSDeclarationDto } from './dto/index';

@Controller('hr/cnss')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CNSSPrismaController {
  constructor(private readonly cnssService: CNSSPrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // TAUX CNSS
  // ──────────────────────────────────────────────────────────────────────────

  @Get('rates/active')
  async getActiveCNSSRate(@Query('countryCode') countryCode: string = 'BJ') {
    return this.cnssService.findActiveCNSSRate(countryCode);
  }

  @Post('rates')
  async upsertCNSSRate(@Body() body: UpsertCNSSRateDto) {
    return this.cnssService.upsertCNSSRate({
      countryCode: body.countryCode,
      employeeRate: body.employeeRate,
      employerRate: body.employerRate,
      salaryCeiling: body.salaryCeiling,
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AFFILIATIONS EMPLOYÉS CNSS
  // ──────────────────────────────────────────────────────────────────────────

  @Get('employees')
  async findAllEmployeeCNSS(@GetTenant() tenant: any) {
    return this.cnssService.findAllEmployeeCNSS(tenant.id);
  }

  @Post('employees')
  async findOrCreateEmployeeCNSS(
    @GetTenant() tenant: any,
    @Body() body: { staffId: string; cnssNumber?: string },
  ) {
    return this.cnssService.findOrCreateEmployeeCNSS(
      body.staffId, tenant.id, body.cnssNumber,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DÉCLARATIONS
  // ──────────────────────────────────────────────────────────────────────────

  @Post('declarations')
  async createDeclaration(@GetTenant() tenant: any, @Body() body: CreateCNSSDeclarationDto) {
    return this.cnssService.createCNSSDeclaration({
      tenantId: tenant.id,
      academicYearId: body.academicYearId,
      month: body.month,
      notes: body.notes,
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
    @Body() body: {
      status: 'SUBMITTED' | 'PAID';
      paymentReference?: string;
      paymentProofPath?: string;
    },
  ) {
    return this.cnssService.finalizeDeclaration(
      id, tenant.id, body.status,
      body.paymentReference, body.paymentProofPath,
    );
  }
}
