/**
 * ============================================================================
 * IA PRISMA CONTROLLER - Sara Compose Engine (SCE) for Pedagogy
 * ============================================================================
 *
 * Controller pour les fonctionnalités IA du module Pédagogie (Sara Compose) :
 *   - POST /pedagogy/ia/generate      → Génération d'épreuves, devoirs, exercices
 *   - POST /pedagogy/ia/analyze        → Analyse de documents pédagogiques
 *   - GET  /pedagogy/ia/insights       → Insights & recommandations pédagogiques
 *   - GET  /pedagogy/ia/detect-anomalies → Détection d'anomalies pédagogiques
 *   - POST /pedagogy/ia/copilot        → Copilote pédagogique conversationnel (Sara)
 *   - POST /pedagogy/ia/import-journal → Import depuis le Cahier Journal
 *   - GET  /pedagogy/ia/status         → Statut de la configuration IA
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
} from '@nestjs/common';
import { IaPrismaService } from './ia-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('pedagogy/ia')
@UseGuards(JwtAuthGuard, TenantGuard)
export class IaPrismaController {
  constructor(private readonly iaService: IaPrismaService) {}

  // ─── Génération de Documents Pédagogiques ────────────────────────────────────

  /**
   * POST /api/pedagogy/ia/generate
   *
   * Génère un document pédagogique (épreuve, devoir, exercice, fiche d'activité).
   * Le body doit contenir :
   *   - type : Type de document ('composition' | 'devoir' | 'interrogation' | 'fiche-activite')
   *   - subjectId : ID de la matière
   *   - classId : ID de la classe (optionnel)
   *   - academicYearId : ID de l'année académique
   *   - teacherId : ID de l'enseignant
   *   - questions : Nombre de questions (défaut: 5)
   *   - difficulty : Difficulté ('facile' | 'moyen' | 'difficile' | 'mixte')
   *   - style : Style de génération ('situation-probleme' | 'classique' | 'examen-officiel' | 'ludique')
   *   - notions : Notions/titres de leçons à couvrir
   *   - skillId : ID du skill IA sélectionné (optionnel)
   *   - screenshots : Captures d'écran uploadées (optionnel, base64[])
   *   - journalEntries : Entrées du cahier journal importées (optionnel)
   */
  @Post('generate')
  async generateDocument(
    @GetTenant() tenant: any,
    @Body() body: {
      type?: string;
      subjectId?: string;
      classId?: string;
      academicYearId?: string;
      teacherId?: string;
      questions?: number;
      difficulty?: string;
      style?: string;
      notions?: string[];
      skillId?: string;
      screenshots?: string[];
      journalEntries?: string[];
    },
  ) {
    return this.iaService.generateDocument(tenant.id, body);
  }

  // ─── Analyse de Documents Pédagogiques ──────────────────────────────────────

  /**
   * POST /api/pedagogy/ia/analyze
   *
   * Analyse un document pédagogique existant (fiche, plan de cours, etc.).
   * Le body peut contenir :
   *   - documentId : ID d'un document existant à analyser
   *   - content : Contenu textuel à analyser
   *   - analysisType : Type d'analyse ('quality' | 'coverage' | 'difficulty' | 'alignment')
   */
  @Post('analyze')
  async analyzeDocument(
    @GetTenant() tenant: any,
    @Body() body: {
      documentId?: string;
      content?: string;
      analysisType?: string;
    },
  ) {
    return this.iaService.analyzeDocument(tenant.id, body);
  }

  // ─── Insights & Recommandations Pédagogiques ────────────────────────────────

  /**
   * GET /api/pedagogy/ia/insights
   *
   * Retourne des insights et recommandations pédagogiques basés sur les données
   * du tenant (couverture des programmes, performance des classes, etc.).
   * Paramètres optionnels :
   *   - teacherId : Filtrer pour un enseignant spécifique
   *   - classId : Filtrer pour une classe spécifique
   *   - scope : Portée ('global' | 'teacher' | 'class')
   */
  @Get('insights')
  async getInsights(
    @GetTenant() tenant: any,
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string,
    @Query('scope') scope?: string,
  ) {
    return this.iaService.getInsights(tenant.id, {
      teacherId,
      classId,
      scope: scope || 'global',
    });
  }

  // ─── Détection d'Anomalies Pédagogiques ─────────────────────────────────────

  /**
   * GET /api/pedagogy/ia/detect-anomalies
   *
   * Détecte les anomalies et incohérences dans les données pédagogiques :
   *   - Cahiers journal non remplis
   *   - Plans de cours manquants
   *   - Couverture de programme insuffisante
   *   - Emplois du temps en conflit
   *   - Assignations sans profil enseignant
   */
  @Get('detect-anomalies')
  async detectAnomalies(@GetTenant() tenant: any) {
    return this.iaService.detectAnomalies(tenant.id);
  }

  // ─── Copilote Pédagogique (Sara) ────────────────────────────────────────────

  /**
   * POST /api/pedagogy/ia/copilot
   *
   * Chat avec le Copilote Pédagogique (Sara).
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
  ) {
    if (!body.message || !body.message.trim()) {
      return {
        reply: 'Veuillez poser une question pour que je puisse vous aider avec vos besoins pédagogiques.',
        isAiEnhanced: false,
        timestamp: new Date().toISOString(),
      };
    }

    return this.iaService.copilotChat(
      tenant.id,
      body.message,
      body.conversationHistory,
    );
  }

  // ─── Import depuis le Cahier Journal ────────────────────────────────────────

  /**
   * POST /api/pedagogy/ia/import-journal
   *
   * Importe les entrées du cahier journal pour générer des suggestions
   * de contenu pédagogique.
   * Le body doit contenir :
   *   - teacherId : ID de l'enseignant
   *   - weekStartDate : Date de début de semaine (ISO string)
   *   - academicYearId : ID de l'année académique
   */
  @Post('import-journal')
  async importJournal(
    @GetTenant() tenant: any,
    @Body() body: {
      teacherId: string;
      weekStartDate?: string;
      academicYearId?: string;
    },
  ) {
    return this.iaService.importJournal(tenant.id, body);
  }

  // ─── IA Status ──────────────────────────────────────────────────────────────

  /**
   * GET /api/pedagogy/ia/status
   *
   * Retourne le statut de la configuration IA du module Pédagogie.
   */
  @Get('status')
  async getStatus() {
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAiKey = !!process.env.OPENAI_API_KEY;

    return {
      configured: hasAnthropicKey || hasOpenAiKey,
      provider: hasAnthropicKey ? 'Claude (Anthropic)' : hasOpenAiKey ? 'OpenAI' : null,
      engine: 'SCE v1.0 (Sara Compose Engine)',
      features: {
        documentGeneration: {
          available: hasAnthropicKey || hasOpenAiKey,
          mode: (hasAnthropicKey || hasOpenAiKey) ? 'AI-powered' : 'template-based',
          supportedTypes: ['composition', 'devoir', 'interrogation', 'fiche-activite'],
          supportedStyles: ['situation-probleme', 'classique', 'examen-officiel', 'ludique'],
        },
        documentAnalysis: {
          available: hasAnthropicKey || hasOpenAiKey,
          mode: (hasAnthropicKey || hasOpenAiKey) ? 'AI-powered' : 'rule-based',
        },
        insights: {
          available: true,
          mode: 'rule-based',
          aiEnhanced: hasAnthropicKey || hasOpenAiKey,
        },
        anomalyDetection: {
          available: true,
          mode: 'heuristic',
          aiEnhanced: hasAnthropicKey || hasOpenAiKey,
        },
        copilot: {
          available: true,
          mode: (hasAnthropicKey || hasOpenAiKey) ? 'AI-powered' : 'rule-based',
        },
        journalImport: {
          available: true,
          mode: 'data-driven',
        },
      },
    };
  }
}
