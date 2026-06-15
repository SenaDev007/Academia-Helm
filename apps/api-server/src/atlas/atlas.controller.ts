import { Controller, Post, Get, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { AtlasService } from './atlas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('atlas')
@UseGuards(JwtAuthGuard)
export class AtlasController {
  constructor(private readonly atlasService: AtlasService) {}

  /**
   * Chat avec ATLAS
   * POST /atlas/chat
   */
  @Post('chat')
  async chat(@Req() req: any, @Body('message') message: string) {
    return this.atlasService.sendMessage(req.user.tenantId, req.user.id, message);
  }

  /**
   * Historique de conversation
   * GET /atlas/history
   */
  @Get('history')
  async getHistory(@Req() req: any) {
    return this.atlasService.getHistory(req.user.tenantId, req.user.id);
  }

  /**
   * Générer un document
   * POST /atlas/documents/generate
   */
  @Post('documents/generate')
  async generateDocument(@Req() req: any, @Body() body: {
    documentType: string;
    entityId: string;
    parameters?: Record<string, unknown>;
  }) {
    return this.atlasService.generateDocument(
      req.user.tenantId,
      req.user.id,
      body.documentType as any,
      body.entityId,
      body.parameters,
    );
  }

  /**
   * Exécuter un workflow
   * POST /atlas/execute
   */
  @Post('execute')
  async executeWorkflow(@Req() req: any, @Body() body: {
    workflowType: string;
    parameters?: Record<string, unknown>;
  }) {
    return this.atlasService.executeWorkflow(
      req.user.tenantId,
      req.user.id,
      body.workflowType as any,
      body.parameters,
    );
  }

  /**
   * Confirmer un workflow
   * POST /atlas/executions/:id/confirm
   */
  @Post('executions/:id/confirm')
  async confirmWorkflow(@Req() req: any, @Param('id') executionId: string) {
    return this.atlasService.confirmWorkflow(executionId, req.user.tenantId);
  }

  /**
   * Envoyer des notifications
   * POST /atlas/notifications/send
   */
  @Post('notifications/send')
  async sendNotification(@Req() req: any, @Body() body: {
    type: string;
    recipients: string[];
    channel?: string;
    templateParameters?: Record<string, unknown>;
  }) {
    return this.atlasService.sendNotification(
      req.user.tenantId,
      req.user.id,
      body.type as any,
      body.recipients,
      (body.channel as any) || 'email',
      body.templateParameters,
    );
  }

  /**
   * Générer un rapport
   * POST /atlas/reports/generate
   */
  @Post('reports/generate')
  async generateReport(@Req() req: any, @Body() body: {
    reportType: string;
    period?: string;
  }) {
    return this.atlasService.generateReport(
      req.user.tenantId,
      req.user.id,
      body.reportType,
      body.period,
    );
  }
}
