/**
 * ============================================================================
 * ORION AI CONTROLLER — Endpoints pour le chat ORION
 * ============================================================================
 *
 * POST /api/orion/chat — Chat naturel avec ORION
 * POST /api/orion/analyze — Analyse prédictive
 *
 * Le widget ORION (OrionWidget.tsx) dans le frontend appelle ces endpoints.
 * Disponible dans toute l'application via le widget flottant.
 * ============================================================================
 */

import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { OrionAiService } from './orion-ai.service';

@Controller('orion')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrionAiController {
  constructor(private readonly orionAi: OrionAiService) {}

  /**
   * ⭐ POST /api/orion/chat
   * Chat naturel avec ORION propulsé par GLM-5.2
   * Body: { message: string, academicYearId?: string }
   */
  @Post('chat')
  async chat(
    @GetTenant() tenant: any,
    @Body() body: { message: string; academicYearId?: string },
  ) {
    if (!body.message || !body.message.trim()) {
      return {
        success: false,
        response: 'Veuillez saisir un message.',
        timestamp: new Date().toISOString(),
      };
    }
    return this.orionAi.chat(tenant.id, body.message, body.academicYearId);
  }

  /**
   * ⭐ POST /api/orion/analyze
   * Analyse prédictive — génère alertes et recommandations
   * Body: { academicYearId?: string }
   */
  @Post('analyze')
  async analyze(
    @GetTenant() tenant: any,
    @Body() body: { academicYearId?: string },
  ) {
    return this.orionAi.analyze(tenant.id, body.academicYearId);
  }
}
