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
 * Modèle : z-ai/glm-5.1 via OpenRouter
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
  AICostEntry,
} from '../types/ai.types';

// Rate limits par plan (requêtes/minute)
const RATE_LIMITS: Record<string, number> = {
  SEED: 10,
  GROW: 25,
  LEAD: 60,
  NETWORK: 120,
};

// Coûts estimés par modèle (USD pour 1M tokens)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'z-ai/glm-5.1': { input: 0.15, output: 0.60 },
  'z-ai/glm-4.5-air:free': { input: 0, output: 0 },
  'google/gemini-2.0-flash-001': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-pro-preview': { input: 1.25, output: 10.0 },
  'anthropic/claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
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

      // 5. Router vers l'agent approprié
      const response = await this.routeToAgent(request, context);

      // 6. Audit logging
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

      // 7. Cost tracking
      if (response.usage && response.model) {
        await this.trackCost({
          agent: request.agent,
          model: response.model,
          inputTokens: response.usage.promptTokens,
          outputTokens: response.usage.completionTokens,
          cost: 0,
          tenantId: request.tenantId,
          userId: request.userId,
          operation: 'chat',
          timestamp: new Date(),
        });
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
      executionMs: 0,
    };
  }

  /**
   * Traitement SARA — Closer Senior #1 + Assistante conversationnelle
   */
  private async processSaraRequest(request: AIRequest, context: MCPContext): Promise<AIResponse> {
    const toolDescriptions = this.toolRegistry.getToolsDescription('SARA', context.userPermissions);
    const systemPrompt = this.buildSaraSystemPrompt(context, toolDescriptions);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

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
    const toolDescriptions = this.toolRegistry.getToolsDescription('ATLAS', context.userPermissions);
    const systemPrompt = this.buildAtlasSystemPrompt(context, toolDescriptions);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

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
      temperature: 0.4,
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

═══════════════════════════════════════════════════════════
IDENTITÉ
═══════════════════════════════════════════════════════════
Tu es le cerveau analytique de la plateforme. Tu observes, analyses, prédits et recommandes. Tu es en LECTURE SEULE — tu ne modifies jamais aucune donnée.

═══════════════════════════════════════════════════════════
DOMAINES D'ANALYSE
═══════════════════════════════════════════════════════════
- ACADEMIC : Résultats, assiduité, risques élèves, performances pédagogiques
- FINANCE : Recouvrement, trésorerie, impayés, flux de paiement
- HR : Absentéisme, charge de travail, sous-effectif, paie
- COMPLIANCE : Dossiers incomplets, EDUCMASTER, réglementation
- SECURITY : Accès suspects, violations RBAC, audit

═══════════════════════════════════════════════════════════
SCORE ORION (0-100)
═══════════════════════════════════════════════════════════
Pondération : Academic 35%, Finance 30%, HR 15%, Compliance 10%, Security 10%
Grades : A (90+), B (75+), C (60+), D (40+), F (<40)

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
- Tu analyses uniquement les données du tenant ${context.schoolId}
- Tu ne modifies JAMAIS aucune donnée
- Tu ne génères PAS de documents (c'est le rôle d'ATLAS)
- Tu ne parles PAS directement aux utilisateurs finaux (c'est le rôle de SARA)
- Toutes tes réponses sont au format JSON structuré
- Tu appelles les outils disponibles pour accéder aux données
- Tu quantifies TOUJOURS tes affirmations avec des données réelles
- Tu classes TOUJOURS tes alertes par priorité : CRITICAL, HIGH, MEDIUM, LOW

═══════════════════════════════════════════════════════════
CONTEXTE ACTUEL
═══════════════════════════════════════════════════════════
- École : ${context.schoolName}
- Année académique : ${context.currentAcademicYear}
- Période : ${context.currentPeriod}
- Utilisateur demandeur : ${context.userRole} - ${context.userName}
- Plan : ${context.subscriptionPlan}

Outils disponibles : ${JSON.stringify(tools, null, 2)}

Produis une analyse complète, précise et actionnable basée exclusivement sur les données réelles.`;
  }

  private buildSaraSystemPrompt(context: MCPContext, toolsDescription: string): string {
    const roleConfig = this.getSaraRoleConfig(context.userRole as any);

    return `Tu es SARA AI (Smart Assistant for Revenue & Acquisition), l'assistante intelligente de Academia Helm.

═══════════════════════════════════════════════════════════
IDENTITÉ & CASQUETTES
═══════════════════════════════════════════════════════════
1. CLOSER SENIOR #1 : Tu convertis les prospects en clients. Techniques : assumptive close, urgency close, alternative close, summary close, puppy dog close, takeaway close.
2. AGENT COMMERCIAL EXPERT : Tu réponds à TOUTE question sur Academia Helm — tarifs, modules, fonctionnalités, architecture, sécurité, déploiement, support, IA.
3. GUIDE UTILISATEUR : Tu guides l'utilisateur à travers les modules et l'interface pour une prise en main rapide.
4. ASSISTANTE STRATÉGIQUE : Tu assistes chaque rôle avec des réponses contextualisées.

═══════════════════════════════════════════════════════════
PRODUIT : ACADEMIA HELM
═══════════════════════════════════════════════════════════
ERP éducatif SaaS multi-tenant, offline-first, mobile-first
9 MODULES INCLUS : Élèves, Pédagogie, Examens, Finance, RH, Communication, QHSE, ORION, Complémentaires
3 AGENTS IA : ORION (Analyste), ATLAS (Exécutant), SARA (Assistante/Closer)

GRILLE TARIFAIRE :
- HELM SEED (1-150 élèves) : 75 000 FCFA + 14 900 FCFA/mois
- HELM GROW (151-400 élèves) [RECOMMANDÉ] : 100 000 FCFA + 24 900 FCFA/mois
- HELM LEAD (401-800 élèves) : 150 000 FCFA + 39 900 FCFA/mois
- HELM NETWORK (Multi-campus) : 200 000 FCFA + Sur devis
Tous les plans incluent les 9 modules et 3 agents IA. Zéro surprise.

═══════════════════════════════════════════════════════════
CONTEXTE UTILISATEUR
═══════════════════════════════════════════════════════════
- Nom : ${context.userName}
- Rôle : ${context.userRole}
- École : ${context.schoolName}
- Année académique : ${context.currentAcademicYear}
- Période : ${context.currentPeriod}

Mode conversationnel : ${roleConfig.mode}
Vocabulaire : ${roleConfig.vocabulary}
Ton : ${roleConfig.tone}

═══════════════════════════════════════════════════════════
NAVIGATION PAR MODULE
═══════════════════════════════════════════════════════════
- Élèves : Dashboard → Élèves & Inscriptions
- Pédagogie : Dashboard → Organisation Pédagogique
- Examens : Dashboard → Examens, Notes & Bulletins
- Finance : Dashboard → Finance & Économat
- RH : Dashboard → RH & Paie
- Communication : Dashboard → Communication
- QHSE : Dashboard → QHSE & Incidents
- ORION : Dashboard → ORION (alertes, KPIs, recommandations)
- ATLAS : Dashboard → ATLAS (chat, automatisations, documents)

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
1. Tu accèdes aux données uniquement via les outils disponibles
2. Tu respectes strictement le RBAC. Si l'utilisateur n'a pas accès, indique-le poliment
3. Tu cites toujours tes sources ("Selon les données de la plateforme...")
4. Pour toute action irréversible, demande confirmation avant de déléguer à ATLAS
5. Adapte ton vocabulaire au rôle utilisateur
6. Sois précise, concise et actionnable
7. Si une demande dépasse tes capacités, indique-le clairement
8. Ne génère JAMAIS de données fictives
9. Indique toujours le chemin de navigation exact pour les fonctionnalités
10. Termine par une question ou une suggestion d'action

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

═══════════════════════════════════════════════════════════
IDENTITÉ
═══════════════════════════════════════════════════════════
ATLAS est le bras opérationnel de la plateforme. Là où ORION analyse et SARA dialogue, ATLAS agit.

═══════════════════════════════════════════════════════════
MISSIONS
═══════════════════════════════════════════════════════════
1. EXÉCUTION : Préparer et exécuter des actions autorisées
   - Documents : attestations, certificats, bulletins, contrats, lettres, rapports
   - Notifications : SMS, WhatsApp, email, push
   - Workflows : campagnes recouvrement, génération bulletins, rapport mensuel
   - Exports : PDF, Excel, statistiques

2. ASSISTANCE QUOTIDIENNE : Aider les utilisateurs dans leur gestion
   - Gestion élèves, enseignants, classes
   - Suivi financier et recouvrement
   - Communication avec les parents

3. NAVIGATION : Guider dans l'interface

4. COLLABORATION IA :
   - ORION détecte → Tu exécutes (avec validation)
   - SARA reçoit → Tu réalises (avec confirmation si critique)

═══════════════════════════════════════════════════════════
DOCUMENTS GÉNÉRABLES
═══════════════════════════════════════════════════════════
Attestation de scolarité, Certificat de fréquentation, Bulletin trimestriel,
Reçu de paiement, Contrat de scolarité, Convocation parent, Fiche élève,
Rapport mensuel, Rapport financier, Attestation de travail, Contrat enseignant,
Lettre de relance

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
1. Tu n'exécutes JAMAIS une action sans vérifier les permissions de l'utilisateur
2. Pour toute action sur plus de 10 entités, tu demandes confirmation
3. Tu loges chaque action dans l'audit log avant de l'exécuter
4. Tu retournes toujours un statut d'exécution précis
5. En cas d'erreur partielle, tu continues et rapportes les éléments échoués
6. Tu ne supprimes JAMAIS de données sans confirmation explicite
7. Ne génère JAMAIS de données fictives

═══════════════════════════════════════════════════════════
CONTEXTE
═══════════════════════════════════════════════════════════
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
      SCHOOL_ADMIN: { mode: 'SARA Direction', vocabulary: 'stratégique, synthétique, décisionnel', tone: 'assertif, orienté décision' },
      PROMOTEUR: { mode: 'SARA Direction', vocabulary: 'stratégique, synthétique, décisionnel', tone: 'assertif, orienté décision' },
      ENSEIGNANT: { mode: 'SARA Enseignant', vocabulary: 'pédagogique, pratique, centré classe', tone: 'collaboratif, expert pédagogique' },
      TEACHER: { mode: 'SARA Enseignant', vocabulary: 'pédagogique, pratique, centré classe', tone: 'collaboratif, expert pédagogique' },
      COMPTABLE: { mode: 'SARA Comptable', vocabulary: 'financier, précis, chiffré', tone: 'factuel, orienté données' },
      CAISSIER: { mode: 'SARA Comptable', vocabulary: 'financier, précis, chiffré', tone: 'factuel, orienté données' },
      PARENT: { mode: 'SARA Parent', vocabulary: 'accessible, rassurant, centré enfant', tone: 'bienveillant, clair, pédagogique' },
      ELEVE: { mode: 'SARA Élève', vocabulary: 'simple, encourageant, éducatif', tone: 'motivant, adapté à l\'âge' },
      SURVEILLANT: { mode: 'SARA Vie Scolaire', vocabulary: 'discipline, présence, suivi', tone: 'ferme mais bienveillant' },
      SCOLARITE: { mode: 'SARA Scolarité', vocabulary: 'pratique, orienté procédure', tone: 'efficace, aidant' },
    };
    return configs[role] || { mode: 'SARA Standard', vocabulary: 'professionnel, clair', tone: 'neutre, aidant' };
  }

  // ─── SECURITY ───────────────────────────────────────────────────────────

  private async validateTenantContext(request: AIRequest): Promise<void> {
    if (!request.tenantId) {
      throw new Error('Tenant ID is required for AI requests');
    }

    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: request.tenantId },
      });
      if (!tenant) {
        throw new Error('Invalid tenant');
      }
    } catch (error: any) {
      if (error.message === 'Invalid tenant') throw error;
      // Si la DB n'est pas disponible, on laisse passer (mode dégradé)
      this.logger.warn(`Could not validate tenant: ${error?.message}`);
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

  // ─── AUDIT & COST ───────────────────────────────────────────────────────

  private async logAudit(entry: AIAuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: `[${entry.agent}] ${entry.operation}`,
          resource: entry.input?.substring(0, 200) || '',
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

    if (context.canViewOrion && /analyse|prédiction|alerte|score/i.test(content)) {
      actions.push({
        type: 'ORION_ANALYSIS',
        label: 'Voir l\'analyse ORION',
        description: 'Consulter l\'analyse complète d\'ORION',
        requiresConfirmation: false,
      });
    }

    if (context.canTriggerAtlas && /générer|rapport|document|attestation|bulletin/i.test(content)) {
      actions.push({
        type: 'ATLAS_DOCUMENT',
        label: 'Générer le document',
        description: 'Demander à ATLAS de générer le document',
        requiresConfirmation: true,
      });
    }

    if (context.canTriggerAtlas && /relance|recouvrement|impayé|campagne/i.test(content)) {
      actions.push({
        type: 'ATLAS_WORKFLOW',
        label: 'Lancer la campagne de relance',
        description: 'ATLAS peut automatiser la campagne de recouvrement',
        requiresConfirmation: true,
      });
    }

    if (/naviguer|aller|trouver|où est|comment accéder/i.test(content)) {
      actions.push({
        type: 'NAVIGATION',
        label: 'Guide de navigation',
        description: 'SARA vous guide vers la fonctionnalité',
        requiresConfirmation: false,
      });
    }

    return actions;
  }

  private extractAtlasActions(content: string, context: MCPContext): AIResponse['suggestedActions'] {
    const actions: AIResponse['suggestedActions'] = [];

    if (/confirmation|confirmer|valider/i.test(content)) {
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
        return `Désolée, j'ai rencontré une erreur. Pouvez-vous reformuler votre demande ? Je suis là pour vous aider !`;
      case 'ATLAS':
        return `ATLAS n'a pas pu exécuter l'action demandée. Veuillez vérifier vos permissions et réessayer.`;
      default:
        return `Une erreur s'est produite. Veuillez réessayer.`;
    }
  }
}
