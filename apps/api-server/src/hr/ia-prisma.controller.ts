/**
 * ============================================================================
 * IA PRISMA CONTROLLER - Helm Document Intelligence Engine (HDIE)
 * ============================================================================
 *
 * Controller pour les fonctionnalités IA du module RH :
 *   - POST /hr/ia/parse-cv       → Analyse sémantique de CV/Lettres
 *   - GET  /hr/ia/match-candidates → Matching & Classement XAI
 *   - GET  /hr/ia/detect-fraud    → Détection d'anomalies/fraude
 *   - POST /hr/ia/copilot         → Copilote RH conversationnel (Sarah)
 *   - GET  /hr/ia/status          → Statut de la configuration IA
 *
 * 🔒 SÉCURITÉ MULTI-TENANT & RBAC (CRITIQUE) :
 *   - JwtAuthGuard : authentification JWT obligatoire
 *   - TenantGuard : résout le tenant depuis le JWT (jamais depuis la query string)
 *   - PermissionsGuard + @Permissions('RH_read') : SEULS les utilisateurs ayant
 *     la permission RH_read (DIRECTEUR, COMPTABLE, CENSEUR, PROMOTEUR,
 *     PLATFORM_OWNER, SUPER_ADMIN, etc.) peuvent accéder à ces endpoints.
 *     Un ENSEIGNANT, PARENT ou ELEVE n'a PAS cette permission et sera rejeté
 *     avec 403 Forbidden.
 *   - Le tenantId est OBTENU UNIQUEMENT depuis @GetTenant() (résolu depuis le
 *     JWT). AUCUN fallback via query param — empêche l'usurpation cross-tenant.
 *
 * Utilise @GetTenant() pour la résolution du tenant.
 * Tous les endpoints nécessitent JWT + TenantGuard + PermissionsGuard.
 * ============================================================================
 */

import {
  Controller, Get, Post, Body, Query,
  UseGuards, BadRequestException, ForbiddenException, Req, Res,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { IaPrismaService } from './ia-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('hr/ia')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions('RH_read')
export class IaPrismaController {
  constructor(private readonly iaService: IaPrismaService) {}

  // ─── CV Parsing ─────────────────────────────────────────────────────────────

  /**
   * POST /api/hr/ia/parse-cv
   *
   * Analyse sémantique d'un CV ou d'une lettre de motivation.
   * Le body peut contenir :
   *   - fileUrl : URL du fichier à analyser
   *   - base64Data : Données du fichier encodées en base64
   *   - fileName : Nom du fichier
   *   - mimeType : Type MIME du fichier
   *   - candidateId : ID d'un candidat existant à enrichir (tenant-scoped)
   */
  @Post('parse-cv')
  async parseCv(
    @GetTenant() tenant: any,
    @Body() body: {
      fileUrl?: string;
      base64Data?: string;
      fileName?: string;
      mimeType?: string;
      candidateId?: string;
    },
  ) {
    // 🔒 Isolation tenant stricte — le tenantId vient UNIQUEMENT du JWT
    const tid = tenant?.id;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.iaService.parseCv(tid, body);
  }

  // ─── Matching & Classement (XAI) ────────────────────────────────────────────

  /**
   * GET /api/hr/ia/match-candidates
   *
   * Retourne les scores de matching XAI pour les candidats DU TENANT COURANT.
   * Paramètres optionnels :
   *   - jobId : Filtrer les résultats pour un poste spécifique
   */
  @Get('match-candidates')
  async matchCandidates(
    @GetTenant() tenant: any,
    @Query('jobId') jobId?: string,
  ) {
    const tid = tenant?.id;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.iaService.matchCandidates(tid, jobId);
  }

  // ─── Fraud Detection ────────────────────────────────────────────────────────

  /**
   * GET /api/hr/ia/detect-fraud
   *
   * Détecte les anomalies et risques de fraude dans les candidatures
   * DU TENANT COURANT uniquement.
   */
  @Get('detect-fraud')
  async detectFraud(
    @GetTenant() tenant: any,
  ) {
    const tid = tenant?.id;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.iaService.detectFraud(tid);
  }

  // ─── Copilote RH ────────────────────────────────────────────────────────────

  /**
   * POST /api/hr/ia/copilot
   *
   * Chat avec Sarah, l'Assistante RH.
   * 🔒 Sarah ne peut accéder QU'aux données RH du tenant courant (résolu
   *    depuis le JWT) et ne communique QU'avec les utilisateurs ayant la
   *    permission RH_read (vérifiée par PermissionsGuard).
   *
   * Le body doit contenir :
   *   - message : Le message/question de l'utilisateur
   *   - conversationHistory (optionnel) : Historique de la conversation
   */
  @Post('copilot')
  async copilotChat(
    @GetTenant() tenant: any,
    @Req() req: Request,
    @Body() body: {
      message: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
  ) {
    if (!body.message || !body.message.trim()) {
      return {
        reply: 'Veuillez poser une question pour que je puisse vous aider.',
        isAiEnhanced: false,
        timestamp: new Date().toISOString(),
      };
    }

    // 🔒 Isolation tenant stricte — AUCUN fallback via query param
    const tid = tenant?.id;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }

    // 🔒 Contexte utilisateur pour le RBAC conversationnel de Sarah.
    // PermissionsGuard a déjà vérifié que l'utilisateur a RH_read (sinon 403).
    // On transmet le rôle et les permissions à Sarah pour qu'elle adapte sa
    // réponse (ex: un COMPTABLE n'a que RH_read, pas PAIE_write — Sarah ne
    // lui proposera pas d'actions d'écriture sur la paie).
    const user = req['user'] as any;
    const userContext = {
      userId: user?.id,
      role: user?.role || 'UNKNOWN',
      permissions: Array.isArray(user?.permissions) ? user.permissions : [],
      isSuperAdmin: !!user?.isSuperAdmin,
    };

    return this.iaService.copilotChat(
      tid,
      body.message,
      body.conversationHistory,
      userContext,
    );
  }

  // ─── Copilote RH — STREAMING SSE ───────────────────────────────────────────

  /**
   * POST /api/hr/ia/copilot/stream
   *
   * Version streaming (Server-Sent Events) du Copilote RH (Sarah).
   * Réponse identique à /copilot mais diffusée en temps réel via SSE,
   * comme sur la landing page (/sara/query/stream).
   *
   * Format SSE : `data: {"type":"delta","text":"..."}\n\n`
   *
   * 🔒 Mêmes règles de sécurité que /copilot :
   *   - JwtAuthGuard + TenantGuard + PermissionsGuard (@Permissions('RH_read'))
   *   - tenantId résolu UNIQUEMENT depuis le JWT
   *   - RBAC conversationnel via userContext
   */
  @Post('copilot/stream')
  async copilotChatStream(
    @GetTenant() tenant: any,
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: {
      message: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
  ) {
    // Headers SSE — doit être défini AVANT tout write
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering Nginx

    // Validation : message vide → on renvoie un delta unique + final
    if (!body.message || !body.message.trim()) {
      const reply = 'Veuillez poser une question pour que je puisse vous aider.';
      res.write(`data: ${JSON.stringify({ type: 'delta', text: reply })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'final', text: reply })}\n\n`);
      res.end();
      return;
    }

    // 🔒 Isolation tenant stricte — AUCUN fallback via query param
    const tid = tenant?.id;
    if (!tid) {
      const errMsg = 'Tenant ID requis pour cette opération';
      res.write(`data: ${JSON.stringify({ type: 'error', text: errMsg })}\n\n`);
      res.end();
      return;
    }

    // 🔒 Contexte utilisateur pour le RBAC conversationnel de Sarah.
    const user = req['user'] as any;
    const userContext = {
      userId: user?.id,
      role: user?.role || 'UNKNOWN',
      permissions: Array.isArray(user?.permissions) ? user.permissions : [],
      isSuperAdmin: !!user?.isSuperAdmin,
    };

    try {
      const stream = this.iaService.copilotChatStream(
        tid,
        body.message,
        body.conversationHistory,
        userContext,
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

  // ─── IA Status ──────────────────────────────────────────────────────────────

  /**
   * GET /api/hr/ia/status
   *
   * Retourne le statut de la configuration IA du module.
   * 🔒 Nécessite RH_read (déjà appliqué au niveau du contrôleur).
   */
  @Get('status')
  async getStatus() {
    const isConfigured = this.iaService.isAiConfigured();

    return {
      configured: isConfigured,
      provider: isConfigured ? 'IA' : null,
      engine: 'HDIE v2.0',
      features: {
        cvParsing: {
          available: isConfigured,
          mode: isConfigured ? 'AI-powered' : 'placeholder',
        },
        matching: {
          available: true,
          mode: 'rule-based + AI-enhanced',
          aiEnhanced: isConfigured,
        },
        fraudDetection: {
          available: true,
          mode: 'heuristic + AI-enhanced',
          aiEnhanced: isConfigured,
        },
        copilot: {
          available: true,
          mode: isConfigured ? 'AI-powered' : 'rule-based',
        },
      },
    };
  }
}
