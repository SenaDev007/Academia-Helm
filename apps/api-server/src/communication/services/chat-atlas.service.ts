/**
 * ============================================================================
 * CHAT ATLAS SERVICE — L'IA exécutante ATLAS dans le chat Helm Connect (V5, chantier 8)
 * ============================================================================
 *
 * POST /chat/v2/atlas/ask { question, conversationId? }
 *
 * ⭐ Permet de poser une question à ATLAS directement depuis la messagerie.
 *    Si un conversationId est fourni, un contexte STRICTEMENT limité aux
 *    données du tenant et de l'UTILISATEUR est construit (les 50 derniers
 *    messages des conversations dont il est participant, tronqués), puis
 *    passé avec la question au LLM (même mécanisme que ChatSummaryService /
 *    communication-orion.service : GLM via NVIDIA_API_KEY/OPENROUTER_API_KEY,
 *    fetch natif, timeout 30 s, fallback factuel sans LLM).
 *
 * Sécurité :
 *   - Multi-tenant strict : tenantId filtré partout ;
 *   - Le contexte ne contient QUE les conversations où l'utilisateur est
 *     participant (aucune fuite inter-utilisateur) ;
 *   - Auth + TenantGuard requis (contrôleur), rate-limit 10 req/min.
 *
 * Réponse : { answer, model, conversationId?, contextMessages, usingLLM }
 * ============================================================================
 */

import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface ChatAtlasAnswer {
  answer: string;
  model: string;
  conversationId?: string;
  contextMessages: number;
  usingLLM: boolean;
}

@Injectable()
export class ChatAtlasService {
  private readonly logger = new Logger(ChatAtlasService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey =
      this.configService.get<string>('NVIDIA_API_KEY') ||
      this.configService.get<string>('OPENROUTER_API_KEY') ||
      '';
    this.model =
      this.configService.get<string>('NVIDIA_MODEL') ||
      this.configService.get<string>('OPENROUTER_MODEL') ||
      'z-ai/glm-5.2';
    this.baseUrl =
      this.configService.get<string>('NVIDIA_BASE_URL') ||
      this.configService.get<string>('OPENROUTER_BASE_URL') ||
      'https://integrate.api.nvidia.com/v1';
  }

  /**
   * Répond à une question posée depuis le chat, avec un contexte limité aux
   * données VISIBLES PAR L'UTILISATEUR (ses conversations uniquement).
   */
  async ask(
    tenantId: string,
    userId: string,
    question: string,
    conversationId?: string,
  ): Promise<ChatAtlasAnswer> {
    if (!question || !question.trim()) {
      throw new ForbiddenException('Une question est requise');
    }

    // 1. Construire le contexte : 50 derniers messages VISIBLES par l'utilisateur
    const transcript = conversationId
      ? await this.buildConversationContext(tenantId, userId, conversationId)
      : await this.buildAllConversationsContext(tenantId, userId);

    // 2. Prompt système — identité ATLAS + garde-fous confidentialité
    const systemPrompt = this.buildSystemPrompt(!!conversationId);
    const userPrompt = transcript
      ? `Contexte des messages (strictement limité aux conversations de l'utilisateur) :\n\n${transcript}\n\nQuestion : ${question.trim()}`
      : `Aucun contexte de conversation n'est disponible.\n\nQuestion : ${question.trim()}`;

    // 3. Appel LLM (mécanisme ChatSummaryService) — fallback sans clé
    if (this.apiKey) {
      try {
        const answer = await this.callGlm(systemPrompt, userPrompt);
        if (answer) {
          return {
            answer,
            model: this.model,
            ...(conversationId ? { conversationId } : {}),
            contextMessages: this.contextMessageCount,
            usingLLM: true,
          };
        }
      } catch (e: any) {
        this.logger.warn(`callGlm failed: ${e.message} — fallback`);
      }
    }

    // 4. Fallback factuel sans LLM (réponse honnête, pas d'invention)
    return {
      answer:
        `ATLAS n'est pas joignable pour le moment (service LLM non configuré). ` +
        `Votre question a bien été reçue : « ${question.trim().substring(0, 200)} ». ` +
        (transcript
          ? `Contexte disponible : ${this.contextMessageCount} message(s) de vos conversations.`
          : `Aucun contexte de conversation n'était nécessaire.`),
      model: 'fallback',
      ...(conversationId ? { conversationId } : {}),
      contextMessages: this.contextMessageCount,
      usingLLM: false,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  CONTEXTE — STRICTEMENT limité aux données de l'utilisateur
  // ═════════════════════════════════════════════════════════════════

  private contextMessageCount = 0;

  /**
   * Les 50 derniers messages d'UNE conversation où l'utilisateur est
   * participant (vérification d'accès incluse), tronqués à 500 caractères.
   */
  private async buildConversationContext(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<string | null> {
    // ⛔ Vérification d'accès : l'utilisateur doit être PARTICIPANT actif
    const access: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 1
      FROM "chat_participants" p
      JOIN "chat_conversations" c ON c.id = p."conversationId"
      WHERE p."conversationId" = $1 AND p."userId" = $2
        AND p."leftAt" IS NULL AND c."tenantId" = $3
      LIMIT 1
    `,
      conversationId,
      userId,
      tenantId,
    );
    if (access.length === 0) {
      throw new ForbiddenException("Vous n'avez pas accès à cette conversation");
    }

    const messages = await this.fetchVisibleMessages(tenantId, userId, conversationId, 50);
    return this.formatTranscript(messages);
  }

  /**
   * Les 50 derniers messages TOUTES conversations de l'utilisateur
   * (uniquement celles où il est participant actif).
   */
  private async buildAllConversationsContext(
    tenantId: string,
    userId: string,
  ): Promise<string | null> {
    const messages = await this.fetchVisibleMessages(tenantId, userId, undefined, 50);
    return this.formatTranscript(messages);
  }

  /**
   * Récupère les N derniers messages VISIBLES par l'utilisateur :
   * conversations du tenant où il est participant actif, messages non
   * supprimés, triés du plus récent au plus ancien.
   */
  private async fetchVisibleMessages(
    tenantId: string,
    userId: string,
    conversationId: string | undefined,
    limit: number,
  ): Promise<any[]> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT m.id, m."conversationId", m."senderId", m."content", m."type", m."createdAt",
             c."name" AS "conversationName", c."type" AS "conversationType",
             u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName"
      FROM "chat_messages" m
      JOIN "chat_conversations" c ON c.id = m."conversationId" AND c."tenantId" = $1
      JOIN "chat_participants" p ON p."conversationId" = c.id AND p."userId" = $2 AND p."leftAt" IS NULL
      LEFT JOIN "users" u ON u.id = m."senderId"
      WHERE m."deletedAt" IS NULL
        ${conversationId ? 'AND m."conversationId" = $4' : ''}
      ORDER BY m."createdAt" DESC
      LIMIT $3
    `,
      ...(conversationId ? [tenantId, userId, limit, conversationId] : [tenantId, userId, limit]),
    );
    this.contextMessageCount = rows.length;
    return rows;
  }

  /** Formate les messages en transcript lisible (tronqué, sans HTML). */
  private formatTranscript(messages: any[]): string | null {
    if (!messages || messages.length === 0) return null;
    // Chronologique (ancien → récent) pour la lisibilité
    const lines = messages
      .slice()
      .reverse()
      .map((m) => {
        const sender =
          `${m.senderFirstName || ''} ${m.senderLastName || ''}`.trim() || 'Utilisateur';
        const content = (m.content || `[${m.type}]`)
          .replace(/<[^>]*>/g, '')
          .trim()
          .substring(0, 500); // tronqué
        const time = m.createdAt
          ? new Date(m.createdAt).toISOString().substring(0, 16).replace('T', ' ')
          : '';
        const conv =
          m.conversationType === 'GROUP' && m.conversationName ? `[${m.conversationName}] ` : '';
        return `[${time}] ${conv}${sender} : ${content}`;
      });
    return lines.join('\n');
  }

  // ═════════════════════════════════════════════════════════════════
  //  PROMPT + LLM (même mécanisme que ChatSummaryService)
  // ═════════════════════════════════════════════════════════════════

  private buildSystemPrompt(withConversation: boolean): string {
    const scope = withConversation
      ? 'une conversation précise de la messagerie Helm Connect'
      : 'les conversations récentes de la messagerie Helm Connect';
    return `Tu es ATLAS, l'IA d'exécution et d'assistance d'Academia Helm, intégrée à la messagerie Helm Connect.

L'utilisateur te pose une question. Tu disposes du contexte de ${scope}, STRICTEMENT limité aux conversations dont il est participant (établissement scolaire : parents, enseignants, direction).

Règles :
- Réponds en français, de façon concise et actionnable (2 à 5 phrases en général) ;
- Base-toi UNIQUEMENT sur le contexte fourni et la question — n'invente JAMAIS de faits, de chiffres ou de décisions qui ne figurent pas dans le contexte ;
- Si le contexte ne contient pas la réponse, dis-le clairement et propose la démarche pour l'obtenir (qui contacter, où chercher) ;
- Ne divulgue AUCUNE information d'un autre utilisateur en dehors des conversations fournies ;
- Si la question concerne une action (envoyer un document, programmer un devoir…), décris les étapes dans l'interface Helm/Academia Helm plutôt que d'inventer une API.`;
  }

  /** Appelle le LLM (GLM) — retourne le texte de réponse ou null. */
  private async callGlm(systemPrompt: string, userPrompt: string): Promise<string | null> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 800,
      stream: false,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 s

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal as any,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown');
        this.logger.warn(`GLM API error ${response.status}: ${errText}`);
        return null;
      }

      const data = (await response.json()) as any;
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) return null;
      return content.trim();
    } finally {
      clearTimeout(timeout);
    }
  }
}
