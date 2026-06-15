import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OpenRouterService, OpenRouterStreamChunk } from '../common/services/openrouter.service';
import { AIGateway } from '../ai/gateway/ai-gateway';

/**
 * ============================================================================
 * ATLAS SERVICE — L'Exécutant d'Academia Helm
 * ============================================================================
 *
 * ATLAS est le bras opérationnel de la plateforme. Là où ORION analyse
 * et SARA dialogue, ATLAS agit.
 *
 * Modèle : z-ai/glm-5.1 via OpenRouter
 *
 * Missions :
 *   1. Assistance quotidienne : aide à la gestion de l'établissement
 *   2. Exécution : documents, notifications, workflows (avec confirmation)
 *   3. Navigation : guide dans l'interface
 *   4. Collaboration IA : relay ORION → exécution, SARA → réalisation
 */
@Injectable()
export class AtlasService {
  private readonly logger = new Logger(AtlasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouter: OpenRouterService,
    private readonly aiGateway: AIGateway,
  ) {}

  /**
   * Sauvegarde un message utilisateur (utilisé par le streaming)
   */
  async saveUserMessage(tenantId: string, userId: string, message: string) {
    await this.prisma.atlasMessage.create({
      data: {
        tenantId,
        userId,
        content: message,
        role: 'user',
      },
    });
  }

  /**
   * Sauvegarde la réponse de l'assistant (utilisé par le streaming)
   */
  async saveAssistantMessage(
    tenantId: string,
    userId: string,
    content: string,
    usage?: { model?: string; reasoningTokens?: number },
  ) {
    await this.prisma.atlasMessage.create({
      data: {
        tenantId,
        userId,
        content,
        role: 'assistant',
        metadata: {
          model: usage?.model || 'unknown',
          isPlaceholder: false,
          reasoningTokens: usage?.reasoningTokens,
        } as any,
      },
    });
  }

  /**
   * Envoie un message à l'IA ATLAS
   * Route via l'AI Gateway pour l'accès aux outils (function calling) en lecture seule
   */
  async sendMessage(tenantId: string, userId: string, message: string) {
    // 1. Sauvegarder le message de l'utilisateur
    await this.prisma.atlasMessage.create({
      data: {
        tenantId,
        userId,
        content: message,
        role: 'user',
      },
    });

    // 2. Essayer via l'AI Gateway pour l'accès aux outils
    try {
      const result = await this.aiGateway.processRequest({
        agent: 'ATLAS',
        userId,
        tenantId,
        schoolId: tenantId,
        message,
      });

      // 3. Sauvegarder la réponse de l'IA
      const savedResponse = await this.prisma.atlasMessage.create({
        data: {
          tenantId,
          userId,
          content: result.content,
          role: 'assistant',
          metadata: {
            model: result.model,
            isPlaceholder: result.isPlaceholder,
            toolsUsed: result.toolsUsed?.map(t => t.toolName),
          } as any,
        },
      });

      return savedResponse;
    } catch (error: any) {
      // Fallback : mode direct sans outils
      this.logger.warn(`Gateway request failed, falling back to direct mode: ${error?.message}`);

      const history = await this.prisma.atlasMessage.findMany({
        where: { tenantId, userId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: { select: { name: true } } },
      });
      const userRole = user?.role?.name || 'USER';

      const systemPrompt = this.getAtlasSystemPrompt(tenantId, tenant?.name, user, userRole);

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      const recentHistory = history.slice(-11, -1);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }

      messages.push({ role: 'user', content: message });

      const response = await this.openRouter.chat({
        messages,
        temperature: 0.4,
        maxTokens: 1000,
        persona: 'ATLAS',
      });

      const savedResponse = await this.prisma.atlasMessage.create({
        data: {
          tenantId,
          userId,
          content: response.content,
          role: 'assistant',
          metadata: {
            model: response.model,
            isPlaceholder: response.isPlaceholder,
            reasoningTokens: response.usage?.reasoningTokens,
          } as any,
        },
      });

      return savedResponse;
    }
  }

  /**
   * Version streaming de sendMessage — retourne un AsyncGenerator
   * L'historique doit être sauvegardé séparément (avant/après le stream)
   */
  async *sendMessageStream(
    tenantId: string,
    userId: string,
    message: string,
  ): AsyncGenerator<OpenRouterStreamChunk> {
    // Récupérer l'historique récent pour le contexte
    const history = await this.prisma.atlasMessage.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Récupérer le contexte du tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });

    // Récupérer le rôle utilisateur pour adapter le contexte
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { name: true } } },
    });
    const userRole = user?.role?.name || 'USER';

    const systemPrompt = this.getAtlasSystemPrompt(tenantId, tenant?.name, user, userRole);

    // Construire les messages avec l'historique
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: message });

    yield* this.openRouter.chatStream({
      messages,
      temperature: 0.4,
      maxTokens: 1000,
      persona: 'ATLAS',
    });
  }

  /**
   * Envoie un message à ATLAS via l'AI Gateway (mode avancé avec contexte MCP)
   */
  async sendMessageViaGateway(tenantId: string, userId: string, message: string) {
    return this.aiGateway.processRequest({
      agent: 'ATLAS',
      userId,
      tenantId,
      message,
    });
  }

  /**
   * Récupère l'historique de conversation
   */
  async getHistory(tenantId: string, userId: string) {
    return this.prisma.atlasMessage.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }

  // ─── SYSTEM PROMPT ─────────────────────────────────────────────────────────

  /**
   * Retourne le system prompt complet pour ATLAS
   */
  private getAtlasSystemPrompt(
    tenantId: string,
    tenantName?: string,
    user?: any,
    userRole?: string,
  ): string {
    return `Tu es ATLAS, l'IA exécutante d'Academia Helm.

═══════════════════════════════════════════════════════════
IDENTITÉ
═══════════════════════════════════════════════════════════
ATLAS est le bras opérationnel de la plateforme. Là où ORION analyse et SARA dialogue, ATLAS agit.
Tu es intégré dans l'application et tu aides les utilisateurs au quotidien.

═══════════════════════════════════════════════════════════
MISSIONS
═══════════════════════════════════════════════════════════
1. ASSISTANCE QUOTIDIENNE : Aider les administrateurs scolaires dans leur gestion
   - Gestion des élèves, enseignants, classes
   - Suivi financier et recouvrement
   - Communication avec les parents
   - Organisation pédagogique

2. EXÉCUTION : Préparer et exécuter des actions (avec confirmation humaine pour les critiques)
   - Documents : attestations, certificats, bulletins, contrats, lettres, rapports
   - Notifications : SMS, WhatsApp, email, push
   - Workflows : campagne recouvrement, génération bulletins, rapport mensuel, inscription élève
   - Exports : PDF, Excel, statistiques
   - Toute action critique nécessite confirmation humaine avant exécution

3. NAVIGATION : Guider l'utilisateur dans l'interface Academia Helm
   - Où trouver une fonctionnalité
   - Comment accomplir une tâche étape par étape
   - Comment configurer un paramètre

4. COLLABORATION IA :
   - ORION détecte les problèmes → Tu exécutes les corrections (avec validation)
   - SARA reçoit les demandes → Tu les réalises (avec confirmation si critique)
   - Tu ne décides JAMAIS seul pour les actions critiques

═══════════════════════════════════════════════════════════
DOCUMENTS QUE TU PEUX GÉNÉRER
═══════════════════════════════════════════════════════════
- Attestation de scolarité
- Certificat de fréquentation
- Bulletin trimestriel
- Reçu de paiement
- Contrat de scolarité
- Convocation de parent
- Fiche élève
- Rapport mensuel
- Rapport financier
- Attestation de travail
- Contrat enseignant
- Lettre de relance (impayés)

═══════════════════════════════════════════════════════════
WORKFLOWS AUTOMATISÉS
═══════════════════════════════════════════════════════════
- Campagne de génération de bulletins (nécessite confirmation)
- Campagne de relance impayés (nécessite confirmation)
- Rapport mensuel automatique
- Flux d'inscription nouvel élève

═══════════════════════════════════════════════════════════
CONTEXTE ÉTABLISSEMENT
═══════════════════════════════════════════════════════════
- École : ${tenantName || 'Établissement'}
- Tenant ID : ${tenantId}
- Utilisateur : ${user?.firstName || ''} ${user?.lastName || ''} (${userRole})

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
1. Tu as accès aux données du tenant mais tu es en lecture seule par défaut
2. Pour toute action d'écriture, tu demandes confirmation explicite à l'utilisateur
3. Pour toute action sur plus de 10 entités, tu demandes confirmation
4. Sois concis, professionnel et actionnable
5. Propose des actions concrètes quand c'est pertinent
6. Réponds en français par défaut
7. Si tu ne connais pas la réponse, dis-le honnêtement
8. Ne génère JAMAIS de données fictives
9. Cite toujours tes sources de données
10. Adapte ton vocabulaire au rôle de l'utilisateur (${userRole})
11. Log chaque action dans l'audit trail
12. En cas d'erreur partielle, continue et rapporte les éléments échoués`;
  }
}
