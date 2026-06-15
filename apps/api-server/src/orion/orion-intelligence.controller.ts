/**
 * ============================================================================
 * ORION INTELLIGENCE CONTROLLER — Score, Predictions, Analysis
 * ============================================================================
 * Endpoints pour les moteurs d'intelligence ORION
 */

import { Controller, Get, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrionIntelligenceService } from './services/orion-intelligence.service';

@Controller('orion/intelligence')
@UseGuards(JwtAuthGuard)
export class OrionIntelligenceController {
  constructor(
    private readonly intelligenceService: OrionIntelligenceService,
  ) {}

  /**
   * GET /orion/intelligence/score
   * Calcule et retourne le score ORION de l'établissement
   */
  @Get('score')
  async getScore(@Req() req: any, @Query('schoolId') schoolId?: string) {
    const tenantId = schoolId || req.user?.tenantId;
    return this.intelligenceService.calculateOrionScore(tenantId);
  }

  /**
   * POST /orion/intelligence/analyze
   * Analyse complète d'un domaine
   */
  @Post('analyze')
  async analyze(@Req() req: any, @Body() body: { domain: string; schoolId?: string }) {
    const tenantId = body.schoolId || req.user?.tenantId;
    return this.intelligenceService.analyze(
      tenantId,
      req.user?.id,
      body.domain as any,
    );
  }

  /**
   * POST /orion/intelligence/predict
   * Prédictions ORION
   */
  @Post('predict')
  async predict(@Req() req: any, @Body() body: { type: string; schoolId?: string }) {
    const tenantId = body.schoolId || req.user?.tenantId;
    return this.intelligenceService.predict(
      tenantId,
      req.user?.id,
      body.type,
    );
  }
}
