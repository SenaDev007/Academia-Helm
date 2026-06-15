/**
 * ============================================================================
 * ORION INTELLIGENCE CONTROLLER
 * ============================================================================
 * API routes pour l'intelligence ORION : score, prédictions, analyses
 * Modèle : z-ai/glm-5.1 via OpenRouter
 */

import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { OrionIntelligenceService } from './services/orion-intelligence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orion/intelligence')
@UseGuards(JwtAuthGuard)
export class OrionIntelligenceController {
  constructor(private readonly intelligenceService: OrionIntelligenceService) {}

  /**
   * GET /orion/intelligence/score
   * Calcule et retourne le score ORION de l'établissement
   */
  @Get('score')
  async getScore(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.intelligenceService.calculateOrionScore(tenantId);
  }

  /**
   * POST /orion/intelligence/predict
   * Génère une prédiction via GLM 5.1 avec reasoning
   */
  @Post('predict')
  async predict(@Req() req: any, @Body() body: { type: string; useReasoning?: boolean }) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    if (body.useReasoning) {
      return this.intelligenceService.predictWithReasoning(tenantId, userId, body.type);
    }

    return this.intelligenceService.predict(tenantId, userId, body.type);
  }

  /**
   * POST /orion/intelligence/analyze
   * Analyse complète d'un domaine via l'AI Gateway
   */
  @Post('analyze')
  async analyze(@Req() req: any, @Body() body: { domain: 'ACADEMIC' | 'FINANCE' | 'HR' | 'COMPLIANCE' | 'SECURITY' }) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    return this.intelligenceService.analyze(tenantId, userId, body.domain);
  }
}
