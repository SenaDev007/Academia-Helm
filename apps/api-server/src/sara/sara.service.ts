/**
 * ============================================================================
 * SARA SERVICE ENHANCED — Conversation Engine + Tool Calling + Memory
 * ============================================================================
 * SARA AI est l'assistante intelligente conversationnelle de Academia Helm.
 * Elle est l'interface unique entre l'utilisateur et la plateforme.
 *
 * Conforme à la spécification v2.0 Tome 3
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OpenRouterService } from '../common/services/openrouter.service';
import { AIGateway } from '../ai/gateway/ai-gateway';
import { MCPContextComposer } from '../ai/mcp/mcp-context-composer';
import { ToolRegistry } from '../ai/tools/tool-registry';
import {
  SaraIntent,
  SaraRole,
  ConversationTurn,
  MCPContext,
} from '../ai/types/ai.types';

@Injectable()
export class SaraService {
  private readonly logger = new Logger(SaraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouter: OpenRouterService,
    private readonly aiGateway: AIGateway,
    private readonly mcpComposer: MCPContextComposer,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  // ─── LANDING PAGE SARA (Public, Commercial) ─────────────────────────────

  /**
   * Répond aux questions des visiteurs sur la landing page
   * SARA est orientée "conversion" et "vente"
   */
  async handleVisitorQuery(query: string, visitorId?: string) {
    const systemPrompt = `Tu es SARA (School Administration Robotic Assistant), l'IA commerciale d'Academia Helm.
Ton but est de convaincre les directeurs d'école et promoteurs d'adopter notre solution.
Sois professionnelle, rassurante et mets en avant les bénéfices : gain de temps, sécurité, multi-tenant, offline-first.

RÈGLES :
- Maximum 4 phrases
- Termine toujours par UNE question pour continuer la conversation
- Ne parle jamais d'autres produits ou concurrents
- Si la question n'est pas liée à Academia Helm, redirige poliment
- Réponds uniquement en français`;

    const content = await this.openRouter.simpleChat(
      query,
      systemPrompt,
      'SARA',
      0.6,
    );

    return {
      reply: content,
      visitorId,
      timestamp: new Date(),
      isAiEnhanced: this.openRouter.isConfigured(),
    };
  }

  // ─── IN-APP SARA (Authenticated, Context-Aware) ─────────────────────────

  /**
   * Chat avec SARA en mode in-app — utilise l'AI Gateway avec MCP + Tools
   */
  async handleInAppChat(
    tenantId: string,
    userId: string,
    message: string,
    sessionId?: string,
  ) {
    // Déléguer à l'AI Gateway qui gère MCP, RBAC, tools, audit
    const response = await this.aiGateway.processRequest({
      agent: 'SARA',
      userId,
      tenantId,
      message,
      sessionId,
    });

    // Sauvegarder la conversation dans AtlasMessage (réutilisé pour SARA aussi)
    try {
      await this.prisma.atlasMessage.create({
        data: {
          tenantId,
          userId,
          content: message,
          role: 'user',
          metadata: { agent: 'SARA', sessionId } as any,
        },
      });

      await this.prisma.atlasMessage.create({
        data: {
          tenantId,
          userId,
          content: response.content,
          role: 'assistant',
          metadata: {
            agent: 'SARA',
            sessionId,
            model: response.model,
            toolsUsed: response.toolsUsed?.map(t => t.toolName),
            isPlaceholder: response.isPlaceholder,
          } as any,
        },
      });
    } catch (error: any) {
      // La sauvegarde ne doit pas bloquer la réponse
      this.logger.warn(`Failed to save SARA conversation: ${error?.message}`);
    }

    return {
      reply: response.content,
      sessionId: response.sessionId || sessionId,
      suggestedActions: response.suggestedActions,
      toolsUsed: response.toolsUsed,
      model: response.model,
      executionMs: response.executionMs,
      isAiEnhanced: !response.isPlaceholder,
    };
  }

  // ─── INTENT DETECTION ───────────────────────────────────────────────────

  /**
   * Détecte l'intention de l'utilisateur pour router vers le bon outil
   */
  async detectIntent(message: string, userRole: SaraRole): Promise<SaraIntent> {
    const intentPrompt = `Analyse le message suivant d'un utilisateur avec le rôle "${userRole}" dans un système de gestion scolaire.
Détermine l'intention parmi ces catégories :
- QUERY_STUDENT_GRADES : demande de notes
- QUERY_STUDENT_ATTENDANCE : demande d'absences
- QUERY_FINANCE_UNPAID : demande d'impayés
- QUERY_TEACHER_SCHEDULE : demande d'emploi du temps
- QUERY_ORION_ANALYSIS : demande d'analyse ORION
- QUERY_NOTIFICATIONS : demande de notifications
- GENERATE_EXERCISES : demande d'exercices pédagogiques
- CREATE_EVALUATION : demande de création d'évaluation
- SEARCH_PEDAGOGY_LIBRARY : recherche pédagogique
- GENERATE_DOCUMENT : demande de génération de document
- SEND_NOTIFICATION : demande d'envoi de notification
- TRIGGER_WORKFLOW : demande de déclenchement de workflow
- HELP_REQUEST : demande d'aide
- FEATURE_EXPLANATION : demande d'explication d'une fonctionnalité
- PROCEDURE_QUERY : question sur une procédure
- UNKNOWN : impossible de déterminer

Message : "${message}"

Réponds UNIQUEMENT avec le nom de l'intention, sans autre texte.`;

    const result = await this.openRouter.simpleChat(
      message,
      intentPrompt,
      'SARA',
      0.1,
    );

    // Valider que l'intent retourné est dans la liste
    const validIntents: SaraIntent[] = [
      'QUERY_STUDENT_GRADES', 'QUERY_STUDENT_ATTENDANCE', 'QUERY_FINANCE_UNPAID',
      'QUERY_TEACHER_SCHEDULE', 'QUERY_ORION_ANALYSIS', 'QUERY_NOTIFICATIONS',
      'GENERATE_EXERCISES', 'CREATE_EVALUATION', 'SEARCH_PEDAGOGY_LIBRARY',
      'GENERATE_DOCUMENT', 'SEND_NOTIFICATION', 'TRIGGER_WORKFLOW',
      'HELP_REQUEST', 'FEATURE_EXPLANATION', 'PROCEDURE_QUERY', 'UNKNOWN',
    ];

    const detected = result.trim().toUpperCase() as SaraIntent;
    return validIntents.includes(detected) ? detected : 'UNKNOWN';
  }

  // ─── ROLE-BASED CAPABILITIES ────────────────────────────────────────────

  /**
   * Vérifie si un rôle peut exécuter une intention donnée
   */
  canExecuteIntent(intent: SaraIntent, role: SaraRole): boolean {
    const rolePermissions: Record<SaraRole, SaraIntent[]> = {
      DIRECTION: [
        'QUERY_STUDENT_GRADES', 'QUERY_STUDENT_ATTENDANCE', 'QUERY_FINANCE_UNPAID',
        'QUERY_TEACHER_SCHEDULE', 'QUERY_ORION_ANALYSIS', 'QUERY_NOTIFICATIONS',
        'GENERATE_DOCUMENT', 'SEND_NOTIFICATION', 'TRIGGER_WORKFLOW',
        'HELP_REQUEST', 'FEATURE_EXPLANATION', 'PROCEDURE_QUERY',
      ],
      PROMOTEUR: [
        'QUERY_STUDENT_GRADES', 'QUERY_STUDENT_ATTENDANCE', 'QUERY_FINANCE_UNPAID',
        'QUERY_TEACHER_SCHEDULE', 'QUERY_ORION_ANALYSIS', 'QUERY_NOTIFICATIONS',
        'GENERATE_DOCUMENT', 'SEND_NOTIFICATION', 'TRIGGER_WORKFLOW',
        'HELP_REQUEST', 'FEATURE_EXPLANATION', 'PROCEDURE_QUERY',
      ],
      ENSEIGNANT: [
        'QUERY_STUDENT_GRADES', 'QUERY_STUDENT_ATTENDANCE',
        'QUERY_TEACHER_SCHEDULE', 'QUERY_NOTIFICATIONS',
        'GENERATE_EXERCISES', 'CREATE_EVALUATION', 'SEARCH_PEDAGOGY_LIBRARY',
        'HELP_REQUEST', 'FEATURE_EXPLANATION', 'PROCEDURE_QUERY',
      ],
      COMPTABLE: [
        'QUERY_FINANCE_UNPAID', 'QUERY_NOTIFICATIONS',
        'GENERATE_DOCUMENT', 'SEND_NOTIFICATION', 'TRIGGER_WORKFLOW',
        'HELP_REQUEST', 'FEATURE_EXPLANATION', 'PROCEDURE_QUERY',
      ],
      PARENT: [
        'QUERY_STUDENT_GRADES', 'QUERY_STUDENT_ATTENDANCE',
        'QUERY_NOTIFICATIONS', 'HELP_REQUEST', 'FEATURE_EXPLANATION',
        'PROCEDURE_QUERY',
      ],
      ELEVE: [
        'QUERY_STUDENT_GRADES', 'QUERY_NOTIFICATIONS',
        'HELP_REQUEST', 'FEATURE_EXPLANATION',
      ],
      SURVEILLANT: [
        'QUERY_STUDENT_ATTENDANCE', 'QUERY_NOTIFICATIONS',
        'HELP_REQUEST', 'FEATURE_EXPLANATION', 'PROCEDURE_QUERY',
      ],
    };

    return rolePermissions[role]?.includes(intent) || false;
  }

  // ─── SESSIONS ───────────────────────────────────────────────────────────

  /**
   * Récupère l'historique de conversation SARA
   */
  async getSessionHistory(tenantId: string, userId: string, sessionId?: string) {
    return this.prisma.atlasMessage.findMany({
      where: {
        tenantId,
        userId,
        metadata: { path: ['agent'], equals: 'SARA' },
        ...(sessionId ? { metadata: { path: ['sessionId'], equals: sessionId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }
}
