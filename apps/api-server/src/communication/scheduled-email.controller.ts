/**
 * ============================================================================
 * SCHEDULED EMAIL CONTROLLER — Endpoints pour programmer des emails
 * ============================================================================
 *
 * Permet au recruteur (ou tout staff authentifié) de :
 *   - Créer un email programmé (POST)
 *   - Lister les emails programmés (GET)
 *   - Annuler un email programmé (PUT :id/cancel)
 *   - Supprimer un email programmé (DELETE :id)
 *
 * Endpoints :
 *   POST   /api/communication/scheduled-emails
 *   GET    /api/communication/scheduled-emails
 *   GET    /api/communication/scheduled-emails/:id
 *   PUT    /api/communication/scheduled-emails/:id/cancel
 *   DELETE /api/communication/scheduled-emails/:id
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { ScheduledEmailService, CreateScheduledEmailDto } from './scheduled-email.service';

@Controller('communication/scheduled-emails')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ScheduledEmailController {
  constructor(private readonly scheduledEmailService: ScheduledEmailService) {}

  /**
   * POST /api/communication/scheduled-emails
   * Crée un email programmé.
   */
  @Post()
  async create(
    @GetTenant() tenant: any,
    @Body() body: CreateScheduledEmailDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.scheduledEmailService.create(tid, body);
  }

  /**
   * GET /api/communication/scheduled-emails
   * Liste les emails programmés du tenant.
   */
  @Get()
  async findAll(
    @GetTenant() tenant: any,
    @Query('status') status?: string,
    @Query('recipientType') recipientType?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.scheduledEmailService.findAll(tid, {
      status,
      recipientType,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  /**
   * GET /api/communication/scheduled-emails/:id
   * Récupère un email programmé par son ID.
   */
  @Get(':id')
  async findOne(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.scheduledEmailService.findOne(id, tid);
  }

  /**
   * PUT /api/communication/scheduled-emails/:id/cancel
   * Annule un email programmé PENDING.
   */
  @Put(':id/cancel')
  async cancel(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.scheduledEmailService.cancel(id, tid);
  }

  /**
   * DELETE /api/communication/scheduled-emails/:id
   * Supprime un email programmé.
   */
  @Delete(':id')
  async delete(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    await this.scheduledEmailService.delete(id, tid);
    return { success: true };
  }
}
