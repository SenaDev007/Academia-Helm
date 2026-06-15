/**
 * ============================================================================
 * PORTAL CONTROLLER - GESTION DES PORTALS
 * ============================================================================
 */

import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PortalSessionService } from '../services/portal-session.service';
import { OrionInitService } from '../services/orion-init.service';

@Controller('portal')
@UseGuards(JwtAuthGuard)
export class PortalController {
  constructor(
    private readonly portalSessionService: PortalSessionService,
    private readonly orionInitService: OrionInitService,
  ) {}

  /**
   * Sélectionne une école et crée une session de portail
   */
  @Post('select-school')
  async selectSchool(
    @Body() body: { tenantId: string; portalType: 'SCHOOL' | 'TEACHER' | 'PARENT' },
    @Req() request: any,
  ) {
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const session = await this.portalSessionService.createSession(
      body.tenantId,
      body.portalType,
      request.user?.id,
      ipAddress,
      userAgent,
    );

    return {
      sessionId: session.id,
      tenantId: body.tenantId,
      portalType: body.portalType,
      redirectUrl: this.buildRedirectUrl(body.tenantId, body.portalType),
    };
  }

  /**
   * Initialise ORION après connexion
   */
  @Post('init-orion')
  async initOrion(
    @Body() body: { tenantId: string; portalType: 'SCHOOL' | 'TEACHER' | 'PARENT' },
    @Req() request: any,
  ) {
    return this.orionInitService.initializeOrion(
      body.tenantId,
      request.user.id,
      body.portalType,
    );
  }

  /**
   * Récupère les KPIs ORION
   */
  @Get('orion/kpis/:tenantId')
  async getOrionKPIs(
    @Param('tenantId') tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.orionInitService.getOrionKPIs(tenantId, academicYearId, schoolLevelId);
  }

  /**
   * Récupère les alertes ORION
   */
  @Get('orion/alerts/:tenantId')
  async getOrionAlerts(
    @Param('tenantId') tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionInitService.getOrionAlerts(tenantId, academicYearId);
  }

  /**
   * Récupère toutes les données du dashboard ORION
   */
  @Get('orion/dashboard/:tenantId')
  async getOrionDashboard(
    @Param('tenantId') tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.orionInitService.getOrionDashboard(tenantId, academicYearId, schoolLevelId);
  }

  /**
   * Construit l'URL de redirection vers le sous-domaine
   */
  private buildRedirectUrl(
    tenantId: string,
    portalType: 'SCHOOL' | 'TEACHER' | 'PARENT',
  ): string {
    // TODO: Récupérer le slug depuis la base de données
    // Pour l'instant, on utilise un placeholder
    const portalParam = portalType.toLowerCase();
    return `https://${tenantId}.academia-hub.com/login?portal=${portalParam}`;
  }
}

