/**
 * ============================================================================
 * IA PRISMA CONTROLLER - Helm Document Intelligence Engine (HDIE)
 * ============================================================================
 *
 * Controller pour les fonctionnalités IA du module RH :
 *   - POST /hr/ia/parse-cv       → Analyse sémantique de CV/Lettres
 *   - GET  /hr/ia/match-candidates → Matching & Classement XAI
 *   - GET  /hr/ia/detect-fraud    → Détection d'anomalies/fraude
 *   - POST /hr/ia/copilot         → Copilote RH conversationnel (Sara)
 *   - GET  /hr/ia/status          → Statut de la configuration IA
 *
 * Utilise @GetTenant() pour la résolution du tenant.
 * Tous les endpoints nécessitent JWT + TenantGuard.
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { IaPrismaService } from './ia-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('hr/ia')
@UseGuards(JwtAuthGuard, TenantGuard)
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
   *   - candidateId : ID d'un candidat existant à enrichir
   */
  @Post('parse-cv')
  async parseCv(
    @GetTenant() tenant: any,
    @Body() body: {
      tenantId?: string;
      fileUrl?: string;
      base64Data?: string;
      fileName?: string;
      mimeType?: string;
      candidateId?: string;
    },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.iaService.parseCv(tid, body);
  }

  // ─── Matching & Classement (XAI) ────────────────────────────────────────────

  /**
   * GET /api/hr/ia/match-candidates
   *
   * Retourne les scores de matching XAI pour les candidats.
   * Paramètres optionnels :
   *   - jobId : Filtrer les résultats pour un poste spécifique
   */
  @Get('match-candidates')
  async matchCandidates(
    @GetTenant() tenant: any,
    @Query('jobId') jobId?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.iaService.matchCandidates(tid, jobId);
  }

  // ─── Fraud Detection ────────────────────────────────────────────────────────

  /**
   * GET /api/hr/ia/detect-fraud
   *
   * Détecte les anomalies et risques de fraude dans les candidatures.
   */
  @Get('detect-fraud')
  async detectFraud(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.iaService.detectFraud(tid);
  }

  // ─── Copilote RH ────────────────────────────────────────────────────────────

  /**
   * POST /api/hr/ia/copilot
   *
   * Chat avec le Copilote RH (Sara).
   * Le body doit contenir :
   *   - message : Le message/question de l'utilisateur
   *   - conversationHistory (optionnel) : Historique de la conversation
   */
  @Post('copilot')
  async copilotChat(
    @GetTenant() tenant: any,
    @Body() body: {
      message: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    if (!body.message || !body.message.trim()) {
      return {
        reply: 'Veuillez poser une question pour que je puisse vous aider.',
        isAiEnhanced: false,
        timestamp: new Date().toISOString(),
      };
    }

    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }

    return this.iaService.copilotChat(
      tid,
      body.message,
      body.conversationHistory,
    );
  }

  // ─── IA Status ──────────────────────────────────────────────────────────────

  /**
   * GET /api/hr/ia/status
   *
   * Retourne le statut de la configuration IA du module.
   */
  @Get('status')
  async getStatus() {
    const isConfigured = this.iaService.isAiConfigured();

    return {
      configured: isConfigured,
      provider: isConfigured ? 'OpenRouter (z-ai/glm-4.5-air)' : null,
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
