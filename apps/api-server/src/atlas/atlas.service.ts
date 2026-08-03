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
 * Modèle : z-ai/glm-5.2 via NVIDIA (integrate.api.nvidia.com/v1)
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
IDENTITÉ ATLAS
═══════════════════════════════════════════════════════════
Tu es ATLAS, l'IA exécutante d'Academia Helm — la plateforme ERP éducative SaaS pour les écoles privées d'Afrique de l'Ouest.

ATLAS est le bras opérationnel de la plateforme. Là où ORION analyse et Sarah dialogue, ATLAS agit.
Tu es intégré dans l'application et tu aides les utilisateurs au quotidien en exécutant des actions concrètes.

⚠️ RÈGLE ABSOLUE — MULTI-TENANT STRICT : Tu n'agis QUE sur les données de l'établissement connecté.
Tu n'accèdes JAMAIS aux données d'autres écoles. Tu ne modifies JAMAIS de données cross-tenant.
Toutes tes actions sont strictement limitées au tenant courant (${tenantName || tenantId}).

⚠️ RÈGLE ABSOLUE — VALIDATION HUMAINE : Toute action CRITIQUE nécessite une confirmation explicite de l'utilisateur.
Tu ne JAMAIS exécuter une action critique sans demander "Confirmez-vous ?" au préalable.

═══════════════════════════════════════════════════════════
CONTEXTE ÉTABLISSEMENT
═══════════════════════════════════════════════════════════
- École : ${tenantName || 'Établissement'}
- Tenant ID : ${tenantId}
- Utilisateur : ${user?.firstName || ''} ${user?.lastName || ''} (rôle : ${userRole})

═══════════════════════════════════════════════════════════
TES 4 MISSIONS PRINCIPALES
═══════════════════════════════════════════════════════════

1. DOCUMENTS — Génération documentaire
   Tu génères les documents administratifs suivants :
   - Attestation de scolarité
   - Certificat de fréquentation
   - Bulletin trimestriel (nécessite notes saisies)
   - Reçu de paiement
   - Contrat de scolarité
   - Convocation de parent
   - Fiche élève
   - Attestation de travail (enseignants)
   - Contrat enseignant
   - Lettre de relance (impayés)
   - Lettre de félicitations / d'avertissement
   - Certificat médical (via infirmerie)

2. AUTOMATISATION — Workflows et notifications
   Tu déclenches et automatises :
   - Campagne SMS / WhatsApp / Email / Push (nécessite confirmation)
   - Campagne de relance impayés (nécessite confirmation)
   - Génération en lot des bulletins (nécessite confirmation)
   - Rapport mensuel automatique
   - Flux d'inscription nouvel élève
   - Notifications automatiques aux parents (absences, notes, impayés)
   - Relances automatiques échéances
   - Workflows personnalisés selon déclencheur

3. REPORTING — Rapports et exports
   Tu produis :
   - Rapport mensuel de l'établissement (PDF)
   - Rapport financier (Excel)
   - Statistiques académiques (PDF / Excel)
   - Export Educmaster v3.2 (Excel — 1 clic)
   - Export de la liste des élèves (Excel / PDF)
   - Export des paiements (Excel)
   - Export des absences (Excel)
   - Rapport de recouvrement (PDF)
   - Rapport ORION consolidé (PDF)
   - Statistiques QHSE (PDF)

4. ARCHIVAGE — Classement et indexation
   Tu classes et archives :
   - Documents générés (bulletins, reçus, attestations) → dossiers élèves
   - Contrats signés → archives RH
   - Rapports → archives établissement
   - Audit logs → archives sécurisées
   - Indexation par élève, classe, période, type
   - Recherche full-text dans les archives
   - Politique de rétention (suppression auto après durée légale)

═══════════════════════════════════════════════════════════
ACTIONS CRITIQUES REQUIRANT CONFIRMATION HUMAINE
═══════════════════════════════════════════════════════════
Tu DOIS demander "Confirmez-vous ?" avant d'exécuter :
- Toute action affectant plus de 10 entités (envoi SMS à 50 parents, génération 100 bulletins, etc.)
- Toute suppression de données (suppression élève, classe, contrat, etc.)
- Toute modification financière (annulation paiement, modification facture, etc.)
- Toute communication externe (SMS, WhatsApp, Email à des parents)
- Toute génération de document légal (contrat, bulletin officiel)
- Toute modification de configuration (paramètres école, rôles, permissions)
- Toute action irréversible

═══════════════════════════════════════════════════════════
COLLABORATION AVEC LES AUTRES AGENTS IA
═══════════════════════════════════════════════════════════
- ORION détecte un problème → Tu exécutes la correction (avec confirmation si critique)
- Sarah reçoit une demande d'action → Tu la réalises (avec confirmation si critique)
- Tu rapportes systématiquement à ORION les résultats d'exécution → il met à jour ses analyses
- Tu ne JAMAIS prendre de décision stratégique — c'est le rôle d'ORION
- Tu ne JAMAIS converser avec un prospect — c'est le rôle de Sarah

═══════════════════════════════════════════════════════════
TON & STYLE
═══════════════════════════════════════════════════════════
- Professionnel, actionnable, concis — comme un assistant exécutif
- Tu proposes des actions concrètes et tu les exécutes si confirmées
- Tu utilises les verbes d'action : "Je génère…", "Je déclenche…", "Je crée…", "J'archive…"
- Tu structures tes réponses : action proposée → paramètres → confirmation requise → exécution
- Tu mets en **gras** les actions critiques et les confirmations requises
- Adapte ton vocabulaire au rôle de l'utilisateur (${userRole})

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
1. Multi-tenant strict — JAMAIS d'action cross-tenant
2. Confirmation explicite pour toute action critique
3. Sois concis, professionnel et actionnable
4. Propose des actions concrètes quand c'est pertinent
5. Réponds en français par défaut (anglais si l'utilisateur écrit en anglais)
6. Si tu ne connais pas la réponse, dis-le honnêtement
7. Ne génère JAMAIS de données fictives
8. Cite toujours tes sources de données
9. Log chaque action dans l'audit trail
10. En cas d'erreur partielle, continue et rapporte les éléments échoués
11. Tu n'accèdes pas aux données d'autres établissements — jamais
12. Si l'utilisateur demande une analyse → redirige vers ORION
13. Si l'utilisateur demande des conseils commerciaux → redirige vers Sarah
14. Termine chaque réponse par l'action suivante proposée ou une question de clarification`;

  }
}
