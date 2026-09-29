/**
 * ============================================================================
 * INTERNSHIPS CONTROLLER — Flux « Stage » séparé (CDC §6, Décret n°2018-196)
 * ============================================================================
 * Le stage ne passe PLUS par le processus d'embauche salarié : il vit ici,
 * avec ses propres champs (type de stage, gratification, établissement
 * d'origine, tuteur, assurance accident du travail obligatoire avant
 * validation) et sa convention générée par le moteur de documents commun.
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Res, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { InternshipsService } from './internships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import type { Response } from 'express';
import { CreateInternshipDto, UpdateInternshipDto, InternshipStatusDto } from './dto';

@Controller('hr/internships')
@UseGuards(JwtAuthGuard, TenantGuard)
export class InternshipsController {
  constructor(private readonly internshipsService: InternshipsService) {}

  @Get()
  async findAll(
    @GetTenant() tenant: any,
    @Query('status') status?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.internshipsService.findAll(tid, { status });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @GetTenant() tenant: any,
    @Body() data: CreateInternshipDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.internshipsService.create(tid, data as any);
  }

  @Get(':id')
  async findById(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.internshipsService.findById(id, tid);
  }

  @Put(':id')
  async update(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateInternshipDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.internshipsService.update(id, tid, data as any);
  }

  @Put(':id/status')
  async changeStatus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: InternshipStatusDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.internshipsService.changeStatus(id, tid, body.status);
  }

  @Post(':id/convention')
  async generateConvention(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const result = await this.internshipsService.generateConvention(id, tid);
    // Ne pas renvoyer le buffer au JSON (trop lourd) — url + hash suffisent
    return {
      conventionUrl: result.conventionUrl,
      contentHash: result.contentHash,
      internship: result.internship,
    };
  }

  @Get(':id/convention/download')
  async downloadConvention(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const buffer = await this.internshipsService.downloadConvention(id, tid);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="convention-stage-${id.slice(0, 8)}.pdf"`,
    });
    res.send(buffer);
  }

  @Delete(':id')
  async remove(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.internshipsService.remove(id, tid);
  }
}
