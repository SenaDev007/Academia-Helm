/**
 * ============================================================================
 * AI CONTROLLER — API Routes pour l'écosystème IA
 * ============================================================================
 * Endpoints centralisés pour les 3 agents IA.
 * Conforme à la spécification v2.0 Tome 5 §5.1
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AIGateway } from './gateway/ai-gateway';
import { ToolRegistry } from './tools/tool-registry';
import { AIRequest } from './types/ai.types';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly aiGateway: AIGateway,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  /**
   * Chat avec n'importe quel agent IA
   * POST /ai/chat
   */
  @Post('chat')
  async chat(@Req() req: any, @Body() body: {
    agent: 'ORION' | 'SARA' | 'ATLAS';
    message: string;
    sessionId?: string;
    context?: Record<string, unknown>;
  }) {
    const request: AIRequest = {
      agent: body.agent,
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      message: body.message,
      sessionId: body.sessionId,
      context: body.context,
    };

    return this.aiGateway.processRequest(request);
  }

  // ─── ORION ROUTES ───────────────────────────────────────────────────────

  /**
   * POST /ai/orion/analyze
   * Analyse ORION par domaine
   */
  @Post('orion/analyze')
  async orionAnalyze(@Req() req: any, @Body() body: {
    domain: string;
    schoolId?: string;
  }) {
    const domain = body.domain || 'academic';
    const request: AIRequest = {
      agent: 'ORION',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      schoolId: body.schoolId || req.user?.tenantId,
      message: `Analyse le domaine ${domain} de l'établissement. Fournis les indicateurs clés, les alertes et les recommandations.`,
      context: { domain },
    };
    return this.aiGateway.processRequest(request);
  }

  /**
   * GET /ai/orion/score
   * Score ORION de l'établissement
   */
  @Get('orion/score')
  async orionScore(@Req() req: any, @Query('schoolId') schoolId?: string) {
    const request: AIRequest = {
      agent: 'ORION',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      schoolId: schoolId || req.user?.tenantId,
      message: 'Calcule le score ORION global de l\'établissement avec les sous-scores par domaine (académique, finance, RH, conformité, sécurité).',
    };
    return this.aiGateway.processRequest(request);
  }

  /**
   * POST /ai/orion/predict
   * Prédictions ORION
   */
  @Post('orion/predict')
  async orionPredict(@Req() req: any, @Body() body: {
    type: string;
    schoolId?: string;
  }) {
    const request: AIRequest = {
      agent: 'ORION',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      schoolId: body.schoolId || req.user?.tenantId,
      message: `Génère une prédiction de type ${body.type || 'exam'} pour l'établissement. Inclue le niveau de confiance et les facteurs contributeurs.`,
    };
    return this.aiGateway.processRequest(request);
  }

  // ─── SARA ROUTES ────────────────────────────────────────────────────────

  /**
   * POST /ai/sara/chat
   * Chat avec SARA (in-app, authentifié)
   */
  @Post('sara/chat')
  async saraChat(@Req() req: any, @Body() body: {
    message: string;
    sessionId?: string;
  }) {
    const request: AIRequest = {
      agent: 'SARA',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      message: body.message,
      sessionId: body.sessionId,
    };
    return this.aiGateway.processRequest(request);
  }

  /**
   * POST /ai/sara/search
   * Recherche intelligente via SARA
   */
  @Post('sara/search')
  async saraSearch(@Req() req: any, @Body() body: {
    query: string;
    category?: string;
  }) {
    const request: AIRequest = {
      agent: 'SARA',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      message: `Recherche : ${body.query}. Catégorie : ${body.category || 'toutes'}.`,
    };
    return this.aiGateway.processRequest(request);
  }

  // ─── ATLAS ROUTES ───────────────────────────────────────────────────────

  /**
   * POST /ai/atlas/execute
   * Exécuter un workflow ATLAS
   */
  @Post('atlas/execute')
  async atlasExecute(@Req() req: any, @Body() body: {
    workflowId: string;
    parameters?: Record<string, unknown>;
  }) {
    const request: AIRequest = {
      agent: 'ATLAS',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      message: `Exécute le workflow ${body.workflowId} avec les paramètres fournis. ${body.parameters ? JSON.stringify(body.parameters) : ''}`,
      context: { workflowId: body.workflowId, parameters: body.parameters },
    };
    return this.aiGateway.processRequest(request);
  }

  /**
   * POST /ai/atlas/documents/generate
   * Générer un document via ATLAS
   */
  @Post('atlas/documents/generate')
  async atlasGenerateDocument(@Req() req: any, @Body() body: {
    documentType: string;
    entityId: string;
    parameters?: Record<string, unknown>;
  }) {
    const request: AIRequest = {
      agent: 'ATLAS',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      message: `Génère un document de type ${body.documentType} pour l'entité ${body.entityId}.`,
      context: { documentType: body.documentType, entityId: body.entityId, parameters: body.parameters },
    };
    return this.aiGateway.processRequest(request);
  }

  /**
   * POST /ai/atlas/notifications/send
   * Envoyer des notifications via ATLAS
   */
  @Post('atlas/notifications/send')
  async atlasSendNotification(@Req() req: any, @Body() body: {
    type: string;
    recipients: string[];
    templateId?: string;
    parameters?: Record<string, unknown>;
  }) {
    const request: AIRequest = {
      agent: 'ATLAS',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      message: `Envoie une notification de type ${body.type} à ${body.recipients.length} destinataire(s).`,
      context: { notificationType: body.type, recipients: body.recipients },
    };
    return this.aiGateway.processRequest(request);
  }

  /**
   * POST /ai/atlas/reports/generate
   * Générer un rapport via ATLAS
   */
  @Post('atlas/reports/generate')
  async atlasGenerateReport(@Req() req: any, @Body() body: {
    reportType: string;
    period?: string;
  }) {
    const request: AIRequest = {
      agent: 'ATLAS',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      message: `Génère un rapport de type ${body.reportType} pour la période ${body.period || 'courante'}.`,
    };
    return this.aiGateway.processRequest(request);
  }

  // ─── TOOLS DISCOVERY ────────────────────────────────────────────────────

  /**
   * GET /ai/tools
   * Liste les outils disponibles pour l'utilisateur courant
   */
  @Get('tools')
  async listTools(@Req() req: any) {
    const tools = this.toolRegistry.getAll();
    return {
      total: tools.length,
      tools: tools.map(t => ({
        name: t.name,
        version: t.version,
        description: t.description,
        category: t.category,
        agent: t.agent,
        isReadOnly: t.isReadOnly,
        requiresConfirmation: t.requiresConfirmation,
      })),
    };
  }

  /**
   * GET /ai/status
   * Statut de l'infrastructure IA
   */
  @Get('status')
  async getStatus() {
    return {
      status: 'operational',
      gateway: 'active',
      mcp: 'active',
      toolRegistry: 'active',
      totalTools: this.toolRegistry.getAll().length,
      agents: {
        ORION: { status: 'active', type: 'analytique', readOnly: true },
        SARA: { status: 'active', type: 'conversationnel', readOnly: false },
        ATLAS: { status: 'active', type: 'exécution', readOnly: false },
      },
    };
  }
}
