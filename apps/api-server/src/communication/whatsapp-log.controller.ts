/**
 * ============================================================================
 * WHATSAPP LOG CONTROLLER
 * ============================================================================
 *
 * Endpoints pour :
 *   - Lister / consulter les WhatsappLogs (page History)
 *   - Statistiques agrégées (dashboard)
 *
 * Miroir du EmailLogController mais pour WhatsApp.
 * Tous les endpoints @Public (le tenantId est passé en query), conformément
 * au pattern existant.
 * ============================================================================
 */

import {
  Controller, Get, Param, Query, Req, BadRequestException, Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsAppLogService } from './services/whatsapp-log.service';

@Controller('communication')
export class WhatsAppLogController {
  private readonly logger = new Logger(WhatsAppLogController.name);

  constructor(private readonly whatsappLogService: WhatsAppLogService) {}

  /**
   * Liste les WhatsappLogs d'un tenant avec filtres + pagination.
   *
   * Query params:
   *   - tenantId (requis)
   *   - category, module, status, recipient, templateId
   *   - dateFrom, dateTo (ISO)
   *   - page, pageSize (default 20, max 100)
   */
  @Public()
  @Get('whatsapp-logs')
  async listWhatsAppLogs(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('category') category?: string,
    @Query('module') module?: string,
    @Query('status') status?: string,
    @Query('recipient') recipient?: string,
    @Query('templateId') templateId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }

    return this.whatsappLogService.listLogs({
      tenantId: tid,
      category: category as any,
      module,
      status: status as any,
      recipient,
      templateId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  /**
   * Détail d'un WhatsappLog.
   */
  @Public()
  @Get('whatsapp-logs/:id')
  async getWhatsAppLog(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }
    return this.whatsappLogService.getLog(id, tid);
  }

  /**
   * Statistiques agrégées (dashboard).
   */
  @Public()
  @Get('whatsapp-logs-stats')
  async getStats(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }
    return this.whatsappLogService.getStats(
      tid,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }
}
