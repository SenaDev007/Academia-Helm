/**
 * ============================================================================
 * AI CONTROLLER — API Routes pour les agents IA
 * ============================================================================
 * Points d'entrée unifiés pour les 3 agents IA via l'AIGateway.
 * Route principal : POST /ai/chat
 * Modèle : z-ai/glm-5.1 via OpenRouter
 */

import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AIGateway } from './gateway/ai-gateway';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AIRequest } from './types/ai.types';

@Controller('ai')
export class AIController {
  constructor(private readonly aiGateway: AIGateway) {}

  /**
   * Route unifiée pour tous les agents IA
   * POST /ai/chat
   */
  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chat(@Req() req: any, @Body() body: {
    agent: 'ORION' | 'SARA' | 'ATLAS';
    message: string;
    schoolId?: string;
    sessionId?: string;
    context?: Record<string, unknown>;
  }) {
    const request: AIRequest = {
      agent: body.agent,
      userId: req.user.id,
      tenantId: req.user.tenantId,
      schoolId: body.schoolId || req.user.tenantId,
      message: body.message,
      sessionId: body.sessionId,
      context: body.context,
    };

    return this.aiGateway.processRequest(request);
  }

  /**
   * Route spécifique ORION
   * POST /ai/orion
   */
  @UseGuards(JwtAuthGuard)
  @Post('orion')
  async orionChat(@Req() req: any, @Body() body: {
    message: string;
    schoolId?: string;
    sessionId?: string;
  }) {
    return this.aiGateway.processRequest({
      agent: 'ORION',
      userId: req.user.id,
      tenantId: req.user.tenantId,
      schoolId: body.schoolId || req.user.tenantId,
      message: body.message,
      sessionId: body.sessionId,
    });
  }

  /**
   * Route spécifique SARA (in-app, authentifié)
   * POST /ai/sara
   */
  @UseGuards(JwtAuthGuard)
  @Post('sara')
  async saraChat(@Req() req: any, @Body() body: {
    message: string;
    schoolId?: string;
    sessionId?: string;
    currentModule?: string;
  }) {
    return this.aiGateway.processRequest({
      agent: 'SARA',
      userId: req.user.id,
      tenantId: req.user.tenantId,
      schoolId: body.schoolId || req.user.tenantId,
      message: body.message,
      sessionId: body.sessionId,
      context: { currentModule: body.currentModule },
    });
  }

  /**
   * Route spécifique ATLAS
   * POST /ai/atlas
   */
  @UseGuards(JwtAuthGuard)
  @Post('atlas')
  async atlasChat(@Req() req: any, @Body() body: {
    message: string;
    schoolId?: string;
    sessionId?: string;
  }) {
    return this.aiGateway.processRequest({
      agent: 'ATLAS',
      userId: req.user.id,
      tenantId: req.user.tenantId,
      schoolId: body.schoolId || req.user.tenantId,
      message: body.message,
      sessionId: body.sessionId,
    });
  }
}
