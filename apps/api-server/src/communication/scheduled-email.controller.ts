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
import { ScheduledEmailService, CreateScheduledEmailDto } from './services/scheduled-email.service';
import { ScheduledEmailDispatcherService } from './services/scheduled-email-dispatcher.service';

@Controller('communication/scheduled-emails')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ScheduledEmailController {
  constructor(
    private readonly scheduledEmailService: ScheduledEmailService,
    // ⭐ AUDIT COÛT NEON : notifie le dispatcher (armement en mémoire)
    //    après chaque création/annulation/suppression — remplace le polling
    //    chaque minute qui maintenait Neon éveillé 24h/24.
    private readonly scheduledEmailDispatcher: ScheduledEmailDispatcherService,
  ) {}

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
    const created = await this.scheduledEmailService.create(tid, body);
    // ⭐ Armement événementiel de l'envoi à l'heure exacte (zéro polling DB)
    this.scheduledEmailDispatcher.notifyScheduledChanged().catch(() => {});
    return created;
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
    const cancelled = await this.scheduledEmailService.cancel(id, tid);
    // ⭐ Réaligne les timers (l'email annulé ne doit plus être armé)
    this.scheduledEmailDispatcher.notifyScheduledChanged().catch(() => {});
    return cancelled;
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
    this.scheduledEmailDispatcher.notifyScheduledChanged().catch(() => {});
    return { success: true };
  }
}
