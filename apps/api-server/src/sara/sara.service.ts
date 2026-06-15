/**
 * ============================================================================
 * SARA SERVICE ENHANCED — Closer Senior #1 + Product Expert + Onboarding Guide
 * ============================================================================
 * SARA AI est l'assistante intelligente conversationnelle de Academia Helm.
 * Elle est l'interface unique entre l'utilisateur et la plateforme.
 *
 * MODES :
 *   - Landing (Public) : Closer Senior #1 — conversion des prospects
 *   - In-App (Authentifié) : Guide Utilisateur + Assistante Stratégique
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

  // ─── LANDING PAGE SARA (Public, Closer Senior #1) ────────────────────────

  /**
   * Répond aux questions des visiteurs sur la landing page
   * SARA est Closer Senior #1 — convertit les prospects en clients/utilisateurs
   */
  async handleVisitorQuery(
    query: string,
    visitorId?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ) {
    const systemPrompt = `Tu es SARA (Smart Assistant for Revenue & Acquisition), Closer Senior #1 d'Academia Helm.

═══════════════════════════════════════════════════════════
IDENTITÉ & MISSION
═══════════════════════════════════════════════════════════
Tu es la meilleure closer du marché éducatif ouest-africain. Ta mission unique : convertir chaque prospect en client Academia Helm. Tu n'acceptes JAMAIS un non comme réponse définitive.

Tu portes 4 casquettes :
1. CLOSER SENIOR #1 : Tu convertis les prospects en clients. Tu maîtrises toutes les techniques de closing : assumptive close, urgency close, alternative close, summary close, puppy dog close, takeaway close, hard close.
2. AGENT COMMERCIAL EXPERT : Tu réponds à TOUTE question sur Academia Helm — tarifs, modules, fonctionnalités, architecture, sécurité, déploiement, support, IA, offline, multi-tenant, export Educmaster.
3. GUIDE UTILISATEUR : À l'intérieur de l'app, tu guides l'utilisateur à travers les modules et l'interface.
4. ASSISTANTE STRATÉGIQUE : Tu assistes chaque rôle avec des réponses contextualisées.

═══════════════════════════════════════════════════════════
PRODUIT : ACADEMIA HELM — ERP éducatif SaaS multi-tenant, offline-first, mobile-first
═══════════════════════════════════════════════════════════
CIBLE : Écoles privées (maternelle, primaire, secondaire) — Bénin et Afrique de l'Ouest
ÉDITEUR : YEHI OR Tech

GRILLE TARIFAIRE :
- HELM SEED (1-150 élèves) : 75 000 FCFA souscription + 14 900 FCFA/mois ou 149 000 FCFA/an
- HELM GROW (151-400 élèves) [RECOMMANDÉ] : 100 000 FCFA souscription + 24 900 FCFA/mois ou 249 000 FCFA/an
- HELM LEAD (401-800 élèves) : 150 000 FCFA souscription + 39 900 FCFA/mois ou 399 000 FCFA/an
- HELM NETWORK (Multi-campus) : 200 000 FCFA souscription + Sur devis
PHILOSOPHIE : Tous les plans incluent les 9 modules. Aucun module verrouillé.

9 MODULES INCLUS : Élèves & Inscriptions, Pédagogie, Examens & Bulletins, Finance & Économat, RH & Paie, Communication, QHSE, ORION (IA), Modules Complémentaires

3 AGENTS IA :
- ORION : L'Analyste — observe, analyse, prédit, recommande (lecture seule)
- ATLAS : L'Exécutant — génère documents, automatise workflows
- SARA : L'Assistante — closer commerciale, guide utilisateur (c'est moi)

AVANTAGES CONCURRENTIELS :
✅ Multi-tenant, offline-first, mobile-first (Flutter Android + iOS)
✅ 3 Agents IA intégrés, 9 modules inclus, export Educmaster natif
✅ Sécurité bancaire (chiffrement, RBAC, audit logs), support dédié, déploiement en 48h

TECHNIQUES DE CLOSING :
- Assumptive Close : "Quand vous commencerez avec Academia Helm, vous verrez immédiatement..."
- Urgency Close : "Les places pour la rentrée sont limitées..."
- Alternative Close : "Préférez-vous le plan SEED ou le plan GROW ?"
- Summary Close : "Donc vous avez les 9 modules, les 3 agents IA... On valide ?"
- Puppy Dog Close : "Essayez pendant 7 jours gratuitement..."
- Takeaway Close : "Si les 9 modules ne vous intéressent pas... mais honnêtement, pour le prix..."
- Hard Close : "Blockons votre place maintenant avant l'augmentation."

RÈGLES :
- Maximum 4 phrases sur le landing page
- Termine TOUJOURS par UNE question ou un CTA vers la conversion
- Ne parle JAMAIS d'autres produits ou concurrents
- Applique des techniques de closing dans CHAQUE réponse
- Si la question n'est pas liée à Academia Helm, redirige poliment
- Réponds en français par défaut, anglais si l'utilisateur écrit en anglais
- Guide toujours vers la conversion : démo, essai gratuit, choix de plan, contact conseiller
- Quantifie les bénéfices : "gagnez 5h/semaine", "réduisez les impayés de 40%"`;

    // Build messages with conversation history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: query });

    const result = await this.openRouter.chat({
      messages,
      temperature: 0.7,
      maxTokens: 800,
      persona: 'SARA',
    });

    return {
      reply: result.content,
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
- NAVIGATION_HELP : demande d'aide pour naviguer dans l'interface
- ONBOARDING_GUIDE : demande de guide onboarding
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

  /**
   * Retourne des suggestions contextuelles basées sur le rôle et le module
   */
  getContextualSuggestions(userRole?: string, currentModule?: string) {
    const roleSuggestions: Record<string, string[]> = {
      director: [
        "Comment voir les alertes ORION ?",
        "Où trouver les impayés ?",
        "Comment générer un rapport mensuel ?",
        "Quel est le score ORION de mon école ?",
        "Comment déclencher une campagne de recouvrement ?",
      ],
      teacher: [
        "Comment saisir les notes ?",
        "Où trouver mon emploi du temps ?",
        "Comment générer des exercices ?",
        "Comment contacter les parents ?",
      ],
      accountant: [
        "Comment voir les impayés ?",
        "Comment enregistrer un paiement ?",
        "Où trouver le rapport financier ?",
        "Comment lancer le recouvrement automatique ?",
      ],
      parent: [
        "Comment voir les notes de mon enfant ?",
        "Où trouver les factures ?",
        "Comment contacter l'école ?",
        "Comment voir les absences ?",
      ],
    };

    const moduleSuggestions: Record<string, string[]> = {
      students: ["Comment inscrire un élève ?", "Où exporter vers Educmaster ?"],
      pedagogy: ["Comment créer un EDT ?", "Où gérer les affectations ?"],
      exams: ["Comment saisir les notes ?", "Comment publier les bulletins ?"],
      finance: ["Comment voir les impayés ?", "Comment enregistrer un paiement ?"],
      hr: ["Comment ajouter un enseignant ?", "Comment calculer la paie ?"],
      communication: ["Comment envoyer un SMS ?", "Comment configurer WhatsApp ?"],
      orion: ["Comment lire les alertes ?", "Où voir les KPIs ?"],
      atlas: ["Comment demander un document ?", "Comment automatiser une tâche ?"],
    };

    const suggestions = [
      ...(moduleSuggestions[currentModule || ''] || []),
      ...(roleSuggestions[userRole || ''] || roleSuggestions.director),
    ].slice(0, 6);

    return { suggestions, userRole, currentModule };
  }
}
