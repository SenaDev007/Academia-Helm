/**
 * ============================================================================
 * CHAT SUMMARY SERVICE — ORION-powered conversation summaries (V3-3)
 * ============================================================================
 *
 * Génère un résumé structuré d'une conversation Helm Connect via GLM-5.2.
 *
 * Rôle : appelé par `POST /chat/conversations/:id/summarize`, prend les N
 * derniers messages d'une conversation et demande au LLM de produire :
 *   - Une synthèse en 2-3 phrases
 *   - Les points clés (max 5 bullet points)
 *   - Les action items / décisions prises (max 3)
 *   - Une suggestion de titre pour la conversation (max 60 chars)
 *
 * Pattern :
 *   - Fire-and-forget côté UI (la requête peut prendre 5-10s)
 *   - Multi-tenant strict : tenantId filtré dans toutes les requêtes
 *   - Cache le résumé dans `chat_conversation_summaries` table (TODO: V3-3.x)
 *     pour éviter de régénérer à chaque demande. Pour V3-3 initial, on
 *     régénère à chaque demande — le cache viendra ensuite.
 *   - Fallback sans LLM : si NVIDIA_API_KEY absent, on retourne un résumé
 *     basique (comptage des messages, expéditeurs principaux, etc.).
 *
 * Réutilise le pattern d'appel LLM de OrionAiService.callGlmModel.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ChatService } from './chat.service';

export interface ChatSummaryResult {
  conversationId: string;
  summary: string; // synthèse 2-3 phrases
  keyPoints: string[]; // max 5 bullet points
  actionItems: string[]; // max 3 actions / décisions
  suggestedTitle: string; // max 60 chars
  messageCount: number;
  participantCount: number;
  generatedAt: string; // ISO
  usingLLM: boolean; // false if fallback
}

@Injectable()
export class ChatSummaryService {
  private readonly logger = new Logger(ChatSummaryService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
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
   * Génère un résumé structuré d'une conversation.
   *
   * @param tenantId Le tenant (multi-tenant strict)
   * @param userId L'utilisateur qui demande le résumé (doit être participant)
   * @param conversationId L'ID de la conversation
   * @param options.maxMessages Nombre max de messages à inclure (défaut 50)
   */
  async summarizeConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
    options?: { maxMessages?: number },
  ): Promise<ChatSummaryResult> {
    const maxMessages = options?.maxMessages ?? 50;

    // 1. Récupérer la conversation + vérifier l'accès
    const conversation = await this.chatService.getConversation(tenantId, userId, conversationId);

    // 2. Récupérer les messages (les N derniers)
    const messages = await this.chatService.listMessages(
      tenantId,
      userId,
      conversationId,
      { limit: maxMessages },
    );

    if (!messages || messages.length === 0) {
      return {
        conversationId,
        summary: 'Cette conversation ne contient encore aucun message.',
        keyPoints: [],
        actionItems: [],
        suggestedTitle: conversation.name || 'Nouvelle conversation',
        messageCount: 0,
        participantCount: 0,
        generatedAt: new Date().toISOString(),
        usingLLM: false,
      };
    }

    // 3. Récupérer les noms des participants
    const participantIds = new Set<string>();
    for (const m of messages as any[]) {
      if (m.senderId) participantIds.add(m.senderId);
    }
    const participants = await this.prisma.user.findMany({
      where: { id: { in: Array.from(participantIds) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const participantMap = new Map<string, string>();
    for (const p of participants) {
      participantMap.set(p.id, `${p.firstName} ${p.lastName}`.trim() || 'Utilisateur');
    }

    // 4. Format the messages for the LLM
    const formattedMessages = (messages as any[])
      .map((m) => {
        const senderName = participantMap.get(m.senderId) || 'Utilisateur';
        const content = (m.content || '').replace(/<[^>]*>/g, '').trim(); // strip HTML
        if (!content) return null;
        return `[${senderName}]: ${content.substring(0, 500)}`;
      })
      .filter(Boolean)
      .join('\n');

    // 5. Construire le prompt système
    const systemPrompt = `Tu es ORION, l'assistant analytique d'Academia Helm. On te demande de résumer une conversation entre membres d'un établissement scolaire (parents, enseignants, direction).

Réponds STRICTEMENT au format JSON suivant (et RIEN d'autre, pas de markdown, pas de code block) :
{
  "summary": "2-3 phrases de synthèse sur le contenu de la conversation",
  "keyPoints": ["point clé 1", "point clé 2", ...],  // max 5 bullet points
  "actionItems": ["action 1", "décision 1", ...],  // max 3 actions/décisions identifiées
  "suggestedTitle": "titre suggéré pour la conversation (max 60 caractères)"
}

Règles :
- Réponds en français
- Sois factuel — ne speculate pas sur ce qui n'est pas dit
- Si la conversation est courte ou sans substance, retourne des tableaux vides
- Le titre suggéré doit refléter le sujet principal, pas les participants`;

    const userPrompt = `Voici la conversation à résumer (les ${messages.length} derniers messages) :

${formattedMessages}

Génère le résumé structuré JSON demandé.`;

    // 6. Appeler le LLM
    if (this.apiKey) {
      try {
        const llmResponse = await this.callGlm(systemPrompt, userPrompt);
        if (llmResponse) {
          return {
            conversationId,
            ...llmResponse,
            messageCount: messages.length,
            participantCount: participants.length,
            generatedAt: new Date().toISOString(),
            usingLLM: true,
          };
        }
      } catch (e: any) {
        this.logger.warn(`callGlm failed: ${e.message} — using fallback`);
      }
    }

    // 7. Fallback sans LLM
    return this.buildFallbackSummary(conversationId, conversation, messages as any[], participants);
  }

  /**
   * Appelle GLM-5.2 et parse la réponse JSON.
   */
  private async callGlm(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    suggestedTitle: string;
  } | null> {
    try {
      const url = `${this.baseUrl}/chat/completions`;
      const body = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 1500,
        stream: false,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown');
        this.logger.warn(`GLM API error ${response.status}: ${errText}`);
        return null;
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;

      // Parse JSON (le LLM peut inclure du markdown ou des code blocks)
      const jsonStr = content
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(jsonStr);

      return {
        summary: String(parsed.summary || '').trim(),
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 5)
          : [],
        actionItems: Array.isArray(parsed.actionItems)
          ? parsed.actionItems.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 3)
          : [],
        suggestedTitle: String(parsed.suggestedTitle || '').trim().substring(0, 60),
      };
    } catch (e: any) {
      this.logger.error(`callGlm exception: ${e.message}`, e.stack);
      return null;
    }
  }

  /**
   * Fallback sans LLM : génère un résumé basique (comptage, top expéditeurs, etc.).
   */
  private buildFallbackSummary(
    conversationId: string,
    conversation: any,
    messages: any[],
    participants: any[],
  ): ChatSummaryResult {
    // Top expéditeur
    const senderCounts = new Map<string, number>();
    for (const m of messages) {
      const c = senderCounts.get(m.senderId) || 0;
      senderCounts.set(m.senderId, c + 1);
    }
    let topSenderName = 'Utilisateur';
    let topSenderCount = 0;
    for (const [sid, count] of senderCounts.entries()) {
      if (count > topSenderCount) {
        topSenderCount = count;
        const p = participants.find((u) => u.id === sid);
        topSenderName = p ? `${p.firstName} ${p.lastName}`.trim() : 'Utilisateur';
      }
    }

    // Période couverte
    const first = messages[messages.length - 1];
    const last = messages[0];
    const firstDate = new Date(first.createdAt).toLocaleDateString('fr-FR');
    const lastDate = new Date(last.createdAt).toLocaleDateString('fr-FR');

    return {
      conversationId,
      summary: `Conversation ${conversation.name || 'sans titre'} contenant ${messages.length} message(s) échangé(s) entre ${participants.length} participant(s) du ${firstDate} au ${lastDate}. ${topSenderName} est le participant le plus actif (${topSenderCount} message(s)).`,
      keyPoints: [
        `${messages.length} message(s) échangé(s)`,
        `${participants.length} participant(s)`,
        `Période : ${firstDate} → ${lastDate}`,
        `Participant le plus actif : ${topSenderName} (${topSenderCount} message(s))`,
      ],
      actionItems: [],
      suggestedTitle: (conversation.name || `Conversation (${messages.length} messages)`).substring(0, 60),
      messageCount: messages.length,
      participantCount: participants.length,
      generatedAt: new Date().toISOString(),
      usingLLM: false,
    };
  }
}
