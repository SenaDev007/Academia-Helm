/**
 * ============================================================================
 * AI GATEWAY — Academia Helm Enterprise AI Architecture
 * ============================================================================
 * Gateway central pour toutes les requêtes IA. Responsable de :
 *   - Authentification et validation du contexte
 *   - Routing vers le bon agent (ORION, SARA, ATLAS)
 *   - Injection du contexte MCP
 *   - Rate limiting par tenant et utilisateur
 *   - Audit logging complet
 *   - Gestion des erreurs et fallbacks
 *
 * Conforme à la spécification v2.0 Tome 5 §5.1
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OpenRouterService } from '../../common/services/openrouter.service';
import { MCPContextComposer } from '../mcp/mcp-context-composer';
import { ToolRegistry } from '../tools/tool-registry';
import {
  AIRequest,
  AIResponse,
  AIAgentName,
  MCPContext,
  AIAuditEntry,
  AIBudgetStatus,
  AICostEntry,
  ToolCallResult,
} from '../types/ai.types';

// Rate limits par plan (requêtes/heure)
const RATE_LIMITS: Record<string, { perMinute: number; perHour: number; perDay: number }> = {
  SEED: { perMinute: 10, perHour: 200, perDay: 1000 },
  GROW: { perMinute: 25, perHour: 500, perDay: 5000 },
  LEAD: { perMinute: 60, perHour: 2000, perDay: 20000 },
};

// Coûts estimés par modèle (USD pour 1M tokens)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'z-ai/glm-4.5-air:free': { input: 0, output: 0 },
  'google/gemini-2.0-flash-001': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-pro-preview': { input: 1.25, output: 10.0 },
  'anthropic/claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
};

// Budgets mensuels par plan (USD)
const MONTHLY_BUDGETS: Record<string, number> = {
  SEED: 5,
  GROW: 25,
  LEAD: 100,
};

@Injectable()
export class AIGateway {
  private readonly logger = new Logger(AIGateway.name);

  // Simple in-memory rate limiting
  private readonly rateLimitCounters: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouter: OpenRouterService,
    private readonly mcpComposer: MCPContextComposer,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  /**
   * Point d'entrée principal pour toute requête IA
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // 1. Authentification & validation du tenant
      await this.validateTenantContext(request);

      // 2. Rate limiting
      this.checkRateLimit(request.userId, request.tenantId);

      // 3. Composition du contexte MCP
      const context = await this.mcpComposer.compose({
        userId: request.userId,
        tenantId: request.tenantId,
        schoolId: request.schoolId,
        sessionId: request.sessionId,
      });

      // 4. Sécurité : sanitization du prompt
      this.sanitizeInput(request.message);

      // 5. Vérification du budget IA
      await this.checkBudget(request.tenantId);

      // 6. Router vers l'agent approprié
      const response = await this.routeToAgent(request, context);

      // 7. Audit logging
      const executionMs = Date.now() - startTime;
      await this.logAudit({
        agent: request.agent,
        userId: request.userId,
        tenantId: request.tenantId,
        operation: 'chat',
        input: request.message.substring(0, 500),
        output: response.content?.substring(0, 500),
        toolsUsed: response.toolsUsed?.map(t => t.toolName),
        model: response.model,
        tokensUsed: response.usage?.totalTokens,
        executionMs,
        success: true,
      });

      // 8. Cost tracking
      if (response.usage && response.model) {
        await this.trackCost({
          agent: request.agent,
          model: response.model,
          inputTokens: response.usage.promptTokens,
          outputTokens: response.usage.completionTokens,
          tenantId: request.tenantId,
          userId: request.userId,
          operation: 'chat',
        } as AICostEntry);
      }

      return { ...response, executionMs };
    } catch (error: any) {
      const executionMs = Date.now() - startTime;
      this.logger.error(`[${request.agent}] Request failed: ${error?.message}`);

      // Audit de l'échec
      await this.logAudit({
        agent: request.agent,
        userId: request.userId,
        tenantId: request.tenantId,
        operation: 'chat',
        input: request.message.substring(0, 500),
        executionMs,
        success: false,
        errorMessage: error?.message,
      });

      return {
        agent: request.agent,
        content: this.generateErrorResponse(request.agent, error),
        isPlaceholder: true,
        executionMs,
      };
    }
  }

  // ─── ROUTING ────────────────────────────────────────────────────────────

  private async routeToAgent(request: AIRequest, context: MCPContext): Promise<AIResponse> {
    switch (request.agent) {
      case 'ORION':
        return this.processOrionRequest(request, context);
      case 'SARA':
        return this.processSaraRequest(request, context);
      case 'ATLAS':
        return this.processAtlasRequest(request, context);
      default:
        throw new Error(`Unknown agent: ${request.agent}`);
    }
  }

  /**
   * Traitement ORION — Analyse décisionnelle
   */
  private async processOrionRequest(request: AIRequest, context: MCPContext): Promise<AIResponse> {
    const availableTools = this.toolRegistry.getOpenAIToolsFormat('ORION', context.userPermissions);

    const systemPrompt = this.buildOrionSystemPrompt(context, availableTools);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Ajouter l'historique de session si disponible
    if (context.conversationHistory?.length) {
      for (const turn of context.conversationHistory.slice(-10)) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    messages.push({ role: 'user', content: request.message });

    const response = await this.openRouter.chat({
      messages,
      temperature: 0.1, // Très bas pour ORION — factual
      maxTokens: 1500,
      persona: 'ORION',
    });

    return {
      agent: 'ORION',
      content: response.content,
      isPlaceholder: response.isPlaceholder,
      model: response.model,
      usage: response.usage,
      confidence: response.isPlaceholder ? 60 : 95,
      executionMs: 0, // sera rempli par le caller
    };
  }

  /**
   * Traitement SARA — Assistante conversationnelle
   */
  private async processSaraRequest(request: AIRequest, context: MCPContext): Promise<AIResponse> {
    const availableTools = this.toolRegistry.getOpenAIToolsFormat('SARA', context.userPermissions);
    const toolDescriptions = this.toolRegistry.getToolsDescription('SARA', context.userPermissions);

    const systemPrompt = this.buildSaraSystemPrompt(context, toolDescriptions);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Ajouter l'historique de session
    if (context.conversationHistory?.length) {
      for (const turn of context.conversationHistory.slice(-10)) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    messages.push({ role: 'user', content: request.message });

    const response = await this.openRouter.chat({
      messages,
      temperature: 0.6,
      maxTokens: 1000,
      persona: 'SARA',
    });

    // SARA peut suggérer des actions
    const suggestedActions = this.extractSuggestedActions(response.content, context);

    return {
      agent: 'SARA',
      content: response.content,
      isPlaceholder: response.isPlaceholder,
      model: response.model,
      usage: response.usage,
      sessionId: request.sessionId,
      suggestedActions,
      executionMs: 0,
    };
  }

  /**
   * Traitement ATLAS — Exécutant
   */
  private async processAtlasRequest(request: AIRequest, context: MCPContext): Promise<AIResponse> {
    const availableTools = this.toolRegistry.getOpenAIToolsFormat('ATLAS', context.userPermissions);
    const toolDescriptions = this.toolRegistry.getToolsDescription('ATLAS', context.userPermissions);

    const systemPrompt = this.buildAtlasSystemPrompt(context, toolDescriptions);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Ajouter l'historique de session
    if (context.conversationHistory?.length) {
      for (const turn of context.conversationHistory.slice(-10)) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    messages.push({ role: 'user', content: request.message });

    const response = await this.openRouter.chat({
      messages,
      temperature: 0.4, // Modéré pour ATLAS — précision dans l'exécution
      maxTokens: 1200,
      persona: 'ATLAS',
    });

    return {
      agent: 'ATLAS',
      content: response.content,
      isPlaceholder: response.isPlaceholder,
      model: response.model,
      usage: response.usage,
      sessionId: request.sessionId,
      suggestedActions: this.extractAtlasActions(response.content, context),
      executionMs: 0,
    };
  }

  // ─── SYSTEM PROMPTS ─────────────────────────────────────────────────────

  private buildOrionSystemPrompt(context: MCPContext, tools: unknown[]): string {
    return `Tu es ORION, le moteur analytique et décisionnel de Academia Helm.

Ta mission : analyser les données réelles de l'établissement scolaire et produire des insights structurés, des alertes et des recommandations.

Règles strictes :
- Tu analyses uniquement les données du tenant ${context.schoolId}.
- Tu ne modifies jamais aucune donnée.
- Tu ne génères pas de documents.
- Tu ne parles pas directement aux utilisateurs finaux.
- Toutes tes réponses sont au format JSON structuré.
- Tu appelles les outils disponibles pour accéder aux données.
- Tu quantifies toujours tes affirmations avec des données réelles.
- Tu classes toujours tes alertes par priorité : CRITICAL, HIGH, MEDIUM, LOW.

Contexte actuel :
- École : ${context.schoolName}
- Année académique : ${context.currentAcademicYear}
- Utilisateur demandeur : ${context.userRole} - ${context.userName}

Outils disponibles : ${JSON.stringify(tools, null, 2)}

Produis une analyse complète, précise et actionnable basée exclusivement sur les données réelles.`;
  }

  private buildSaraSystemPrompt(context: MCPContext, toolsDescription: string): string {
    // Adapter le prompt selon le rôle
    const roleConfig = this.getSaraRoleConfig(context.userRole as any);

    return `Tu es SARA AI, l'assistante intelligente de Academia Helm.

Contexte utilisateur :
- Nom : ${context.userName}
- Rôle : ${context.userRole}
- École : ${context.schoolName}
- Année académique : ${context.currentAcademicYear}
- Période : ${context.currentPeriod}

Mode conversationnel : ${roleConfig.mode}
Vocabulaire : ${roleConfig.vocabulary}
Ton : ${roleConfig.tone}

Règles strictes :
1. Tu accèdes aux données uniquement via les outils disponibles.
2. Tu respectes strictement le RBAC. Si l'utilisateur n'a pas accès à une donnée, tu l'indiques poliment sans donner la donnée.
3. Tu cites toujours tes sources de données ("Selon les données de la plateforme...").
4. Pour toute action irréversible, tu demandes une confirmation avant d'appeler ATLAS.
5. Tu adaptes ton vocabulaire au rôle utilisateur.
6. Tu es précise, concise et actionnable dans tes réponses.
7. Si une demande dépasse tes capacités, tu l'indiques clairement.
8. Tu ne génères jamais de données fictives. Jamais.

Accès utilisateur :
- Voir tous les élèves : ${context.canViewAllStudents}
- Voir les finances : ${context.canViewFinance}
- Voir les RH : ${context.canViewHR}
- Déclencher ATLAS : ${context.canTriggerAtlas}
- Voir ORION : ${context.canViewOrion}
${context.assignedClasses?.length ? `- Classes assignées : ${context.assignedClasses.join(', ')}` : ''}
${context.childrenIds?.length ? `- Enfants : ${context.childrenIds.length} enfant(s)` : ''}

Outils disponibles :
${toolsDescription}

Historique récent :
${context.conversationHistory?.slice(-5).map(t => `${t.role}: ${t.content}`).join('\n') || 'Aucun historique'}`;
  }

  private buildAtlasSystemPrompt(context: MCPContext, toolsDescription: string): string {
    return `Tu es ATLAS, l'IA d'exécution de Academia Helm.

Ta mission : exécuter les actions autorisées — générer des documents, automatiser des workflows, envoyer des notifications, produire des rapports.

Règles strictes :
1. Tu n'exécutes jamais une action sans avoir vérifié les permissions de l'utilisateur.
2. Pour toute action sur plus de 10 entités (10+ élèves, 10+ notifications), tu demandes confirmation.
3. Tu loges chaque action dans l'audit log avant de l'exécuter.
4. Tu retournes toujours un statut d'exécution précis.
5. En cas d'erreur partielle, tu continues et rapportes les éléments échoués.
6. Tu ne supprimes jamais de données sans confirmation explicite.

Contexte :
- École : ${context.schoolName}
- Demandé par : ${context.userName} (${context.userRole})
- Permissions exécution : ${context.canTriggerAtlas ? 'OUI' : 'NON'}

Outils disponibles :
${toolsDescription}`;
  }

  private getSaraRoleConfig(role: string): { mode: string; vocabulary: string; tone: string } {
    const configs: Record<string, { mode: string; vocabulary: string; tone: string }> = {
      DIRECTION: { mode: 'SARA Direction', vocabulary: 'stratégique, synthétique, décisionnel', tone: 'assertif, orienté décision' },
      SUPER_DIRECTEUR: { mode: 'SARA Direction', vocabulary: 'stratégique, synthétique, décisionnel', tone: 'assertif, orienté décision' },
      PROMOTEUR: { mode: 'SARA Direction', vocabulary: 'stratégique, synthétique, décisionnel', tone: 'assertif, orienté décision' },
      ENSEIGNANT: { mode: 'SARA Enseignant', vocabulary: 'pédagogique, pratique, centré classe', tone: 'collaboratif, expert pédagogique' },
      TEACHER: { mode: 'SARA Enseignant', vocabulary: 'pédagogique, pratique, centré classe', tone: 'collaboratif, expert pédagogique' },
      COMPTABLE: { mode: 'SARA Comptable', vocabulary: 'financier, précis, chiffré', tone: 'factuel, orienté données' },
      PARENT: { mode: 'SARA Parent', vocabulary: 'accessible, rassurant, centré enfant', tone: 'bienveillant, clair, pédagogique' },
      ELEVE: { mode: 'SARA Élève', vocabulary: 'simple, encourageant, éducatif', tone: 'motivant, adapté à l\'âge' },
      SURVEILLANT: { mode: 'SARA Vie Scolaire', vocabulary: 'discipline, présence, suivi', tone: 'ferme mais bienveillant' },
    };
    return configs[role] || { mode: 'SARA Standard', vocabulary: 'professionnel, clair', tone: 'neutre, aidant' };
  }

  // ─── SECURITY ───────────────────────────────────────────────────────────

  /**
   * Validation du contexte tenant — isolation stricte
   */
  private async validateTenantContext(request: AIRequest): Promise<void> {
    if (!request.tenantId) {
      throw new Error('Tenant ID is required for AI requests');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.tenantId },
    });

    if (!tenant) {
      throw new Error('Invalid tenant');
    }
  }

  /**
   * Sanitization des inputs — protection contre l'injection de prompt
   */
  private sanitizeInput(input: string): void {
    const forbiddenPatterns = [
      /ignore previous instructions/i,
      /forget your system prompt/i,
      /you are now/i,
      /act as/i,
      /jailbreak/i,
      /DAN mode/i,
      /reveal your instructions/i,
      /show me your prompt/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(input)) {
        this.logger.warn(`Prompt injection attempt detected: "${input.substring(0, 100)}"`);
        throw new Error('Input contains potentially harmful content');
      }
    }

    // Limiter la longueur
    if (input.length > 2000) {
      throw new Error('Input too long (max 2000 characters)');
    }
  }

  /**
   * Rate limiting par utilisateur et tenant
   */
  private checkRateLimit(userId: string, tenantId: string): void {
    const key = `user:${userId}`;
    const now = Date.now();
    const counter = this.rateLimitCounters.get(key);

    if (!counter || now > counter.resetAt) {
      this.rateLimitCounters.set(key, { count: 1, resetAt: now + 60000 }); // 1 minute window
      return;
    }

    counter.count++;
    if (counter.count > 30) { // 30 requests per minute per user
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }
  }

  /**
   * Vérification du budget IA
   */
  private async checkBudget(tenantId: string): Promise<void> {
    // Simple check — en production, utiliserait Redis ou une table dédiée
    // Pour l'instant, on laisse passer
  }

  // ─── AUDIT & COST ───────────────────────────────────────────────────────

  private async logAudit(entry: AIAuditEntry): Promise<void> {
    try {
      await this.prisma.orionAuditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: `[${entry.agent}] ${entry.operation}`,
          resource: entry.input?.substring(0, 200) || '',
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          details: {
            agent: entry.agent,
            operation: entry.operation,
            output: entry.output?.substring(0, 500),
            toolsUsed: entry.toolsUsed,
            model: entry.model,
            tokensUsed: entry.tokensUsed,
            executionMs: entry.executionMs,
            success: entry.success,
            errorMessage: entry.errorMessage,
          } as any,
        },
      });
    } catch (error: any) {
      // Audit logging ne doit jamais bloquer le flux principal
      this.logger.warn(`Failed to log AI audit: ${error?.message}`);
    }
  }

  private async trackCost(entry: AICostEntry): Promise<void> {
    const costs = MODEL_COSTS[entry.model] || { input: 0, output: 0 };
    const inputCost = (entry.inputTokens / 1_000_000) * costs.input;
    const outputCost = (entry.outputTokens / 1_000_000) * costs.output;
    const totalCost = inputCost + outputCost;

    if (totalCost > 0) {
      this.logger.log(
        `[${entry.agent}] Cost: $${totalCost.toFixed(6)} (${entry.inputTokens}+${entry.outputTokens} tokens, ${entry.model})`,
      );
    }
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────

  private extractSuggestedActions(content: string, context: MCPContext): AIResponse['suggestedActions'] {
    const actions: AIResponse['suggestedActions'] = [];

    if (context.canViewOrion && /analyse|prédiction|alerte/i.test(content)) {
      actions.push({
        type: 'ORION_ANALYSIS',
        label: 'Voir l\'analyse ORION',
        description: 'Consulter l\'analyse complète d\'ORION',
        requiresConfirmation: false,
      });
    }

    if (context.canTriggerAtlas && /générer|rapport|document/i.test(content)) {
      actions.push({
        type: 'ATLAS_DOCUMENT',
        label: 'Générer le document',
        description: 'Demander à ATLAS de générer le document',
        requiresConfirmation: true,
      });
    }

    return actions;
  }

  private extractAtlasActions(content: string, context: MCPContext): AIResponse['suggestedActions'] {
    const actions: AIResponse['suggestedActions'] = [];

    if (/confirmation|confirmer/i.test(content)) {
      actions.push({
        type: 'CONFIRMATION',
        label: 'Confirmer l\'action',
        description: 'Confirmer l\'exécution de l\'action proposée',
        requiresConfirmation: true,
      });
    }

    return actions;
  }

  private generateErrorResponse(agent: AIAgentName, error: any): string {
    switch (agent) {
      case 'ORION':
        return `ORION n'a pas pu compléter l'analyse. Veuillez réessayer dans quelques instants.`;
      case 'SARA':
        return `Désolée, j'ai rencontré une erreur. Pouvez-vous reformuler votre demande ?`;
      case 'ATLAS':
        return `ATLAS n'a pas pu exécuter l'action demandée. Veuillez vérifier vos permissions et réessayer.`;
      default:
        return `Une erreur s'est produite. Veuillez réessayer.`;
    }
  }
}
