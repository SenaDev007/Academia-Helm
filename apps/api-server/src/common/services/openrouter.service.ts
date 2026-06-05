/**
 * ============================================================================
 * OPENROUTER SERVICE - Shared AI Gateway for Academia Helm
 * ============================================================================
 *
 * Service partagé pour toutes les intégrations IA du système.
 * Utilise l'API OpenRouter (compatible OpenAI) avec le modèle GLM 4.5 Air.
 *
 * Personnalités IA supportées :
 *   - ORION : Assistant de direction (lecture seule, institutionnel)
 *   - ATLAS : Chatbot in-app (contexte tenant, conversationnel)
 *   - SARA  : Assistante commerciale (landing) + Copilote métier (modules)
 *
 * Architecture :
 *   - OpenRouter API compatible OpenAI (POST /v1/chat/completions)
 *   - Streaming SSE supporté pour les interfaces conversationnelles
 *   - Fallback gracieux quand l'API n'est pas configurée
 *   - Rate limiting intégré (respect des limites gratuites)
 *
 * Variables d'environnement :
 *   - OPENROUTER_API_KEY : Clé API OpenRouter (obligatoire pour IA réelle)
 *   - OPENROUTER_MODEL   : Modèle à utiliser (défaut: z-ai/glm-4.5-air:free)
 *   - OPENROUTER_BASE_URL: URL de base (défaut: https://openrouter.ai/api/v1)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Configuration d'un appel IA */
export interface OpenRouterChatOptions {
  /** Messages de la conversation (system, user, assistant) */
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  /** Température (0.0 - 2.0), défaut 0.6 */
  temperature?: number;
  /** Maximum de tokens en sortie, défaut 1000 */
  maxTokens?: number;
  /** Modèle à utiliser (surcharge la config globale) */
  model?: string;
  /** Activer le streaming SSE */
  stream?: boolean;
  /** Personnalité IA (pour le logging) */
  persona?: 'ORION' | 'ATLAS' | 'SARA' | 'HDIE' | 'SCE' | 'GENERAL';
  /** Timeout en ms, défaut 30000 */
  timeout?: number;
}

/** Réponse d'un appel IA (non-streaming) */
export interface OpenRouterChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  isPlaceholder: boolean;
}

/** Chunk d'un appel IA (streaming) */
export interface OpenRouterStreamChunk {
  type: 'delta' | 'final' | 'error' | 'status';
  text?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly siteUrl: string;
  private readonly siteName: string;

  /** Rate limiting : timestamp du dernier appel */
  private lastCallTimestamp = 0;
  /** Intervalle minimum entre 2 appels (ms) - 500ms pour le plan gratuit */
  private readonly minCallInterval = 500;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY') || '';
    this.model = this.configService.get<string>('OPENROUTER_MODEL') || 'z-ai/glm-4.5-air:free';
    this.baseUrl = this.configService.get<string>('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1';
    this.siteUrl = this.configService.get<string>('NEXT_PUBLIC_APP_URL') || 'https://academiahelm.com';
    this.siteName = 'Academia Helm';

    if (this.apiKey) {
      this.logger.log(`OpenRouter configured with model: ${this.model}`);
    } else {
      this.logger.warn('OPENROUTER_API_KEY not configured. All AI services will use fallback responses.');
    }
  }

  /**
   * Vérifie si l'API OpenRouter est configurée
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Retourne le modèle configuré
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Appel IA non-streaming - Retourne la réponse complète
   */
  async chat(options: OpenRouterChatOptions): Promise<OpenRouterChatResponse> {
    const persona = options.persona || 'GENERAL';

    if (!this.apiKey) {
      this.logger.warn(`[${persona}] OpenRouter not configured, returning placeholder`);
      return {
        content: this.generatePlaceholder(persona, options.messages),
        model: 'placeholder',
        isPlaceholder: true,
      };
    }

    // Rate limiting
    await this.enforceRateLimit();

    const model = options.model || this.model;
    const temperature = options.temperature ?? 0.6;
    const maxTokens = options.maxTokens ?? 1000;
    const timeout = options.timeout ?? 30000;

    this.logger.log(`[${persona}] Calling OpenRouter (${model}), temp=${temperature}, maxTokens=${maxTokens}`);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.siteName,
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.error(`[${persona}] OpenRouter API error: ${response.status} ${response.statusText} - ${errorBody}`);
        return {
          content: this.generatePlaceholder(persona, options.messages),
          model: 'error',
          isPlaceholder: true,
        };
      }

      const data = await response.json();

      const content = data?.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        this.logger.warn(`[${persona}] Empty response from OpenRouter`);
        return {
          content: this.generatePlaceholder(persona, options.messages),
          model: data?.model || model,
          isPlaceholder: true,
        };
      }

      return {
        content,
        model: data?.model || model,
        usage: data?.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        } : undefined,
        isPlaceholder: false,
      };
    } catch (error: any) {
      this.logger.error(`[${persona}] OpenRouter call failed: ${error?.message}`);
      return {
        content: this.generatePlaceholder(persona, options.messages),
        model: 'error',
        isPlaceholder: true,
      };
    }
  }

  /**
   * Appel IA streaming - Retourne un AsyncGenerator de chunks
   * Compatible avec le format SSE OpenAI utilisé par OpenRouter
   */
  async *chatStream(options: OpenRouterChatOptions): AsyncGenerator<OpenRouterStreamChunk> {
    const persona = options.persona || 'SARA';

    if (!this.apiKey) {
      yield { type: 'status', text: 'placeholder' };
      yield { type: 'final', text: this.generatePlaceholder(persona, options.messages) };
      return;
    }

    await this.enforceRateLimit();

    const model = options.model || this.model;
    const temperature = options.temperature ?? 0.6;
    const maxTokens = options.maxTokens ?? 600;
    const timeout = options.timeout ?? 30000;

    this.logger.log(`[${persona}] Streaming from OpenRouter (${model})`);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.siteName,
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok || !response.body) {
        const errorBody = await response.text().catch(() => '');
        this.logger.error(`[${persona}] OpenRouter streaming error: ${response.status} - ${errorBody}`);
        yield { type: 'error', text: `API error: ${response.status}` };
        return;
      }

      yield { type: 'status', text: 'streaming' };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const evt = JSON.parse(jsonStr);

            // OpenAI-compatible delta format (used by OpenRouter)
            const delta = evt?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string') {
              totalContent += delta;
              yield { type: 'delta', text: delta };
            }

            // Check for finish
            if (evt?.choices?.[0]?.finish_reason === 'stop') {
              yield { type: 'final', text: totalContent };
              return;
            }
          } catch {
            // Ignore malformed chunks
          }
        }
      }

      // If we didn't get a stop signal, yield what we have
      if (totalContent) {
        yield { type: 'final', text: totalContent };
      } else {
        yield { type: 'error', text: 'No content received from API' };
      }
    } catch (error: any) {
      this.logger.error(`[${persona}] Streaming failed: ${error?.message}`);
      yield { type: 'error', text: error?.message || 'Streaming error' };
    }
  }

  /**
   * Appel IA simple (raccourci) - Un seul message utilisateur
   */
  async simpleChat(
    userMessage: string,
    systemPrompt: string,
    persona?: OpenRouterChatOptions['persona'],
    temperature?: number,
  ): Promise<string> {
    const result = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: temperature ?? 0.6,
      persona,
    });

    return result.content;
  }

  /**
   * Appel IA structuré - Demande une réponse JSON
   */
  async structuredChat<T>(
    userMessage: string,
    systemPrompt: string,
    persona?: OpenRouterChatOptions['persona'],
  ): Promise<{ data: T | null; isPlaceholder: boolean; raw: string }> {
    const enhancedPrompt = `${systemPrompt}\n\nIMPORTANT: Réponds UNIQUEMENT avec du JSON valide, sans markdown ni commentaires.`;

    const result = await this.chat({
      messages: [
        { role: 'system', content: enhancedPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3, // Plus bas pour du JSON structuré
      persona,
    });

    if (result.isPlaceholder) {
      return { data: null, isPlaceholder: true, raw: result.content };
    }

    // Extraire le JSON de la réponse (peut contenir du markdown)
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return { data: parsed as T, isPlaceholder: false, raw: result.content };
      } catch {
        this.logger.warn(`[${persona}] Failed to parse JSON response`);
        return { data: null, isPlaceholder: true, raw: result.content };
      }
    }

    return { data: null, isPlaceholder: true, raw: result.content };
  }

  // ─── RATE LIMITING ─────────────────────────────────────────────────────────

  /**
   * Assure un intervalle minimum entre les appels API
   * pour respecter les limites du plan gratuit OpenRouter
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTimestamp;
    if (elapsed < this.minCallInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minCallInterval - elapsed));
    }
    this.lastCallTimestamp = Date.now();
  }

  // ─── PLACEHOLDER FALLBACKS ─────────────────────────────────────────────────

  /**
   * Génère une réponse placeholder quand l'IA n'est pas configurée
   */
  private generatePlaceholder(
    persona: OpenRouterChatOptions['persona'],
    messages: Array<{ role: string; content: string }>,
  ): string {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';

    switch (persona) {
      case 'ORION':
        return "Les données sont disponibles mais l'IA ORION nécessite une clé API OpenRouter pour l'analyse. Contactez l'administrateur pour activer l'intelligence artificielle.";

      case 'ATLAS':
        return "Bonjour ! Je suis ATLAS, votre assistant Academia Helm. L'intégration IA est en cours de configuration. Je pourrai bientôt répondre à vos questions sur la gestion de votre établissement.";

      case 'SARA':
        return "Bonjour ! Je suis SARA, l'assistante Academia Helm. Notre solution permet de gérer votre école de manière moderne et sécurisée. Souhaitez-vous une démonstration ?";

      case 'HDIE':
        return "Le moteur HDIE (Helm Document Intelligence Engine) est prêt à être activé. Configurez la clé API OpenRouter pour bénéficier de l'analyse sémantique de CV et du matching IA.";

      case 'SCE':
        return "Le moteur SCE (Sara Compose Engine) est prêt. Configurez la clé API OpenRouter pour générer des épreuves et documents pédagogiques avec l'IA.";

      default:
        return `L'intelligence artificielle n'est pas encore configurée. Votre message : "${lastUserMsg.substring(0, 50)}..." a bien été reçu. Activez OPENROUTER_API_KEY pour les réponses IA.`;
    }
  }
}
