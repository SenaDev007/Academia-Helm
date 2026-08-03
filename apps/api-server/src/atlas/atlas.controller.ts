import { Controller, Post, Get, Body, UseGuards, Req, Res, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { AtlasService } from './atlas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

/**
 * 🔒 ATLAS CONTROLLER — MULTI-TENANT STRICT
 *
 * Toutes les routes ATLAS sont protégées par :
 *   1. JwtAuthGuard — authentification obligatoire
 *   2. TenantGuard — résolution stricte du tenantId depuis le JWT
 *   3. Validation explicite : on utilise TOUJOURS le tenant du JWT, jamais
 *      celui du body — empêche l'usurpation cross-tenant.
 *
 * ATLAS n'accède JAMAIS aux données d'autres établissements.
 */
@Controller('atlas')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AtlasController {
  constructor(private readonly atlasService: AtlasService) {}

  /**
   * POST /atlas/chat
   * Chat ATLAS direct (avec historique sauvegardé)
   *
   * 🔒 Multi-tenant strict : tenantId résolu depuis le JWT via TenantGuard.
   */
  @Post('chat')
  async chat(
    @GetTenant() tenant: any,
    @Req() req: any,
    @Body('message') message: string,
  ) {
    const tenantId = tenant?.id;
    if (!tenantId) {
      throw new BadRequestException('Tenant non résolu depuis la session.');
    }
    const userId = req.user.id;
    return this.atlasService.sendMessage(tenantId, userId, message);
  }

  /**
   * POST /atlas/chat/stream
   * Chat ATLAS streaming (SSE) pour les réponses en temps réel
   *
   * 🔒 Multi-tenant strict : tenantId résolu depuis le JWT via TenantGuard.
   */
  @Post('chat/stream')
  async chatStream(
    @GetTenant() tenant: any,
    @Req() req: any,
    @Body('message') message: string,
    @Res() res: Response,
  ) {
    const tenantId = tenant?.id;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant non résolu depuis la session.' });
      return;
    }
    const userId = req.user.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      // Sauvegarder le message utilisateur
      await this.atlasService.saveUserMessage(tenantId, userId, message);

      const stream = this.atlasService.sendMessageStream(tenantId, userId, message);

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'reasoning' && chunk.reasoningText) {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: chunk.reasoningText })}\n\n`);
        } else if (chunk.type === 'status') {
          res.write(`data: ${JSON.stringify({ type: 'status', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'final') {
          // Sauvegarder la réponse complète dans l'historique
          await this.atlasService.saveAssistantMessage(tenantId, userId, chunk.text || '', chunk.usage);
          res.write(`data: ${JSON.stringify({ type: 'final', text: chunk.text, usage: chunk.usage })}\n\n`);
        } else if (chunk.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', text: chunk.text })}\n\n`);
        }
      }
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: error?.message || 'Stream error' })}\n\n`);
    }

    res.end();
  }

  /**
   * POST /atlas/gateway
   * Chat ATLAS via AI Gateway (mode avancé avec contexte MCP et outils)
   *
   * 🔒 Multi-tenant strict : tenantId résolu depuis le JWT via TenantGuard.
   */
  @Post('gateway')
  async gatewayChat(
    @GetTenant() tenant: any,
    @Req() req: any,
    @Body('message') message: string,
  ) {
    const tenantId = tenant?.id;
    if (!tenantId) {
      throw new BadRequestException('Tenant non résolu depuis la session.');
    }
    const userId = req.user.id;
    return this.atlasService.sendMessageViaGateway(tenantId, userId, message);
  }

  /**
   * GET /atlas/history
   * Récupère l'historique de conversation
   *
   * 🔒 Multi-tenant strict : tenantId résolu depuis le JWT via TenantGuard.
   * L'historique retourné ne contient QUE les messages du tenant courant.
   */
  @Get('history')
  async getHistory(
    @GetTenant() tenant: any,
    @Req() req: any,
  ) {
    const tenantId = tenant?.id;
    if (!tenantId) {
      throw new BadRequestException('Tenant non résolu depuis la session.');
    }
    const userId = req.user.id;
    return this.atlasService.getHistory(tenantId, userId);
  }
}
