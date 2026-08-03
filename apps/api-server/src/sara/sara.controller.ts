import { Controller, Post, Body, Res, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { SaraService } from './sara.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { GetTenant } from '../common/decorators/tenant.decorator';

/**
 * 🔒 Mapping currentModule → permission RBAC requise.
 * Sarah ne peut pas parler d'un module si l'utilisateur n'a pas la permission
 * de lecture correspondante. Empêche un PARENT de demander à Sarah des infos
 * sur la paie, un ENSEIGNANT sur les candidats, etc.
 */
const MODULE_PERMISSION_MAP: Record<string, string> = {
  hr: 'RH_read',
  finance: 'FINANCES_read',
  students: 'ELEVES_read',
  pedagogy: 'ORGANISATION_PEDAGOGIQUE_read',
  exams: 'EXAMENS_read',
  communication: 'COMMUNICATION_read',
  qhse: 'QHSE_read',
  settings: 'PARAMETRES_read',
  // orion / atlas : pas de permission dédiée, géré par canAccessOrion/canAccessAtlas
};

@Controller('sara')
export class SaraController {
  constructor(
    private readonly saraService: SaraService,
  ) {}

  /**
   * Landing page SARA query (public, Closer Senior #1 mode)
   * Used by the SaraWidget on the landing page
   */
  @Public()
  @Post('query')
  async query(@Body() body: { query: string; visitorId?: string; messages?: Array<{ role: string; content: string }> }) {
    return this.saraService.handleVisitorQuery(body.query, body.visitorId, body.messages);
  }

  /**
   * Landing page SARA streaming query (public, SSE)
   * Used by the SaraWidget for real-time streaming responses
   */
  @Public()
  @Post('query/stream')
  async queryStream(
    @Body() body: { query: string; visitorId?: string; messages?: Array<{ role: string; content: string }> },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering Nginx

    try {
      const stream = this.saraService.handleVisitorQueryStream(
        body.query,
        body.visitorId,
        body.messages,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'reasoning' && chunk.reasoningText) {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: chunk.reasoningText })}\n\n`);
        } else if (chunk.type === 'status') {
          res.write(`data: ${JSON.stringify({ type: 'status', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'final') {
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
   * In-App SARA query (authenticated, Guide User mode)
   * Used by the InAppSaraGuide and module-specific Sara assistants
   *
   * 🔒 SÉCURITÉ :
   *   - JwtAuthGuard : authentification obligatoire (était MANQUANT avant)
   *   - Le schoolId du body DOIT correspondre au tenantId du JWT — empêche
   *     l'usurpation cross-tenant (un utilisateur de l'école A ne peut pas
   *     passer schoolId=école-b pour obtenir des infos sur l'école B)
   *   - RBAC par module : si currentModule='hr', l'utilisateur doit avoir
   *     la permission RH_read, etc. Sinon 403 Forbidden.
   */
  @UseGuards(JwtAuthGuard)
  @Post('inapp')
  async inappQuery(
    @GetTenant() tenant: any,
    @Body() body: {
      query: string;
      userId: string;
      schoolId: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
  ) {
    // 🔒 Isolation tenant stricte : le schoolId du body doit correspondre
    // au tenant résolu depuis le JWT. Empêche la fuite cross-tenant.
    const jwtTenantId = tenant?.id;
    if (!jwtTenantId) {
      throw new BadRequestException('Tenant non résolu depuis la session.');
    }
    if (body.schoolId && body.schoolId !== jwtTenantId) {
      throw new ForbiddenException(
        '🚨 Sécurité : le schoolId fourni ne correspond pas à votre établissement. ' +
        'Vous ne pouvez accéder qu\'aux données de votre propre tenant.',
      );
    }

    return this.saraService.handleInAppQuery(
      body.query,
      body.userId,
      jwtTenantId, // 🔒 On utilise TOUJOURS le tenant du JWT, jamais celui du body
      body.userRole,
      body.currentModule,
      body.messages,
    );
  }

  /**
   * In-App SARA streaming query (authenticated, SSE)
   * Used by the InAppSaraGuide for real-time streaming responses
   *
   * 🔒 Mêmes règles de sécurité que /sara/inapp :
   *   - JwtAuthGuard (déjà présent)
   *   - Validation schoolId == JWT.tenantId
   */
  @UseGuards(JwtAuthGuard)
  @Post('inapp/stream')
  async inappQueryStream(
    @GetTenant() tenant: any,
    @Body() body: {
      query: string;
      userId: string;
      schoolId: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
    @Res() res: Response,
  ) {
    // 🔒 Isolation tenant stricte
    const jwtTenantId = tenant?.id;
    if (!jwtTenantId) {
      res.status(400).json({ error: 'Tenant non résolu depuis la session.' });
      return;
    }
    if (body.schoolId && body.schoolId !== jwtTenantId) {
      res.status(403).json({
        error: '🚨 Sécurité : le schoolId fourni ne correspond pas à votre établissement.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering Nginx

    try {
      const stream = this.saraService.handleInAppQueryStream(
        body.query,
        body.userId,
        jwtTenantId, // 🔒 On utilise TOUJOURS le tenant du JWT
        body.userRole,
        body.currentModule,
        body.messages,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'reasoning' && chunk.reasoningText) {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: chunk.reasoningText })}\n\n`);
        } else if (chunk.type === 'status') {
          res.write(`data: ${JSON.stringify({ type: 'status', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'final') {
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
   * In-App SARA query via AI Gateway (mode avancé avec contexte MCP et outils)
   *
   * 🔒 SÉCURITÉ :
   *   - JwtAuthGuard obligatoire
   *   - Le tenantId du body DOIT correspondre au tenant du JWT
   */
  @UseGuards(JwtAuthGuard)
  @Post('gateway')
  async gatewayQuery(
    @GetTenant() tenant: any,
    @Body() body: {
      query: string;
      userId: string;
      tenantId: string;
      schoolId?: string;
    },
  ) {
    // 🔒 Isolation tenant stricte
    const jwtTenantId = tenant?.id;
    if (!jwtTenantId) {
      throw new BadRequestException('Tenant non résolu depuis la session.');
    }
    if (body.tenantId && body.tenantId !== jwtTenantId) {
      throw new ForbiddenException(
        '🚨 Sécurité : le tenantId fourni ne correspond pas à votre établissement.',
      );
    }

    return this.saraService.handleInAppQueryViaGateway(
      body.query,
      body.userId,
      jwtTenantId, // 🔒 On utilise TOUJOURS le tenant du JWT
      body.schoolId,
    );
  }

  /**
   * Get contextual suggestions based on user role and current module
   * 🔒 Authentification JWT requise (les suggestions sont contextuelles à l'utilisateur)
   */
  @UseGuards(JwtAuthGuard)
  @Post('suggestions')
  async getSuggestions(
    @Body() body: { userRole?: string; currentModule?: string },
  ) {
    return this.saraService.getContextualSuggestions(body.userRole, body.currentModule);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SARAH GUIDE IN-APP — Navigation & Onboarding (GLOBAL, pas multi-tenant strict)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sarah Guide In-App query (streaming SSE)
   *
   * ⚠️ DIFFÉRENCE avec /sara/inapp/stream :
   *   - Sarah Guide est GLOBALE (pas multi-tenant strict)
   *   - Elle n'accède à AUCUNE donnée de l'école
   *   - Elle aide UNIQUEMENT à la navigation, l'onboarding, l'explication des modules
   *
   * 🔒 Authentification JWT requise (pour connaître le rôle et le module courant)
   * Mais PAS de validation tenant — Sarah Guide est globale par design.
   */
  @UseGuards(JwtAuthGuard)
  @Post('guide/stream')
  async guideQueryStream(
    @Body() body: {
      query: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const stream = this.saraService.handleGuideQueryStream(
        body.query,
        body.userRole,
        body.currentModule,
        body.messages,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'reasoning' && chunk.reasoningText) {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: chunk.reasoningText })}\n\n`);
        } else if (chunk.type === 'status') {
          res.write(`data: ${JSON.stringify({ type: 'status', text: chunk.text })}\n\n`);
        } else if (chunk.type === 'final') {
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
   * Sarah Guide In-App query (non-streaming)
   *
   * ⚠️ Même comportement que /sara/guide/stream mais en mode non-streaming.
   */
  @UseGuards(JwtAuthGuard)
  @Post('guide')
  async guideQuery(
    @Body() body: {
      query: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
  ) {
    return this.saraService.handleGuideQuery(
      body.query,
      body.userRole,
      body.currentModule,
      body.messages,
    );
  }

}
