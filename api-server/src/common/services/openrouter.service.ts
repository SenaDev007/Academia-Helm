/**
 * ============================================================================
 * AI SERVICE - Shared AI Gateway for Academia Helm
 * ============================================================================
 *
 * Service partagé pour toutes les intégrations IA du système.
 * Actuellement configuré pour utiliser l'endpoint Modal GLM-5.1 (gratuit).
 * Compatible avec tout endpoint OpenAI-compatible (Modal, OpenRouter, etc.).
 *
 * Personnalités IA supportées :
 *   - ORION : Assistant de direction (lecture seule, institutionnel)
 *   - ATLAS : Chatbot in-app (contexte tenant, conversationnel)
 *   - SARA  : Assistante commerciale (landing) + Copilote métier (modules)
 *
 * Architecture :
 *   - API compatible OpenAI (POST /v1/chat/completions)
 *   - Streaming SSE supporté pour les interfaces conversationnelles
 *   - Reasoning support (GLM 5.1) pour les analyses approfondies
 *   - Retry avec backoff exponentiel (3 tentatives)
 *   - Fallback de modèle automatique en cas d'indisponibilité
 *   - Rate limiting intégré
 *
 * Variables d'environnement :
 *   - OPENROUTER_API_KEY : Clé API (Modal ou OpenRouter, obligatoire pour IA réelle)
 *   - OPENROUTER_MODEL   : Modèle à utiliser (défaut: zai-org/GLM-5.1-FP8)
 *   - OPENROUTER_BASE_URL: URL de base (défaut: https://api.us-west-2.modal.direct/v1)
 *
 * Fournisseurs supportés :
 *   - Modal (gratuit)   : https://api.us-west-2.modal.direct/v1
 *   - OpenRouter (payant): https://openrouter.ai/api/v1
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
    reasoning_details?: unknown;
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
  /** Timeout en ms, défaut 60000 */
  timeout?: number;
  /** Activer le raisonnement (GLM 5.1 reasoning tokens) */
  reasoning?: boolean;
  /** Effort de raisonnement : low, medium, high */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Max tokens de raisonnement */
  maxReasoningTokens?: number;
  /** Nombre max de tentatives (défaut: 3) */
  maxRetries?: number;
  /** Activer le fallback de modèle automatique (défaut: true) */
  enableFallback?: boolean;
}

/** Réponse d'un appel IA (non-streaming) */
export interface OpenRouterChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
  };
  isPlaceholder: boolean;
  reasoning_details?: unknown;
  /** Nombre de tentatives effectuées */
  attempts?: number;
  /** Modèle fallback utilisé (si différent du modèle demandé) */
  fallbackModel?: string;
}

/** Chunk d'un appel IA (streaming) */
export interface OpenRouterStreamChunk {
  type: 'delta' | 'final' | 'error' | 'status' | 'reasoning';
  text?: string;
  reasoningText?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
  };
}

/**
 * Chaîne de fallback des modèles — si le modèle principal échoue,
 * on essaie le modèle suivant dans la liste.
 * Ordre : GLM-5.1-FP8 Modal (production) → GLM-5-FP8 Modal (fallback) → GLM 4.5 Air OpenRouter (fallback gratuit)
 *
 * NOTE : Les fallbacks OpenRouter nécessitent que OPENROUTER_FALLBACK_KEY soit configuré.
 * Si seule la clé Modal est configurée, le fallback se limitera aux modèles Modal.
 */
const MODEL_FALLBACK_CHAIN: string[] = [
  'zai-org/GLM-5.1-FP8',
  'zai-org/GLM-5-FP8',
  'z-ai/glm-4.5-air:free',
];

/** Codes HTTP qui méritent un retry (429 = rate limit, 500-504 = erreur serveur) */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

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
  /** Intervalle minimum entre 2 appels (ms) */
  private readonly minCallInterval = 300;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY') || '';
    this.model = this.configService.get<string>('OPENROUTER_MODEL') || 'zai-org/GLM-5.1-FP8';
    this.baseUrl = this.configService.get<string>('OPENROUTER_BASE_URL') || 'https://api.us-west-2.modal.direct/v1';
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
   * Support du reasoning pour GLM 5.1
   * Retry automatique avec backoff exponentiel + fallback de modèle
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

    const maxRetries = options.maxRetries ?? 3;
    const enableFallback = options.enableFallback ?? true;
    const requestedModel = options.model || this.model;

    // Construire la liste de modèles à essayer
    const modelsToTry: string[] = [requestedModel];
    if (enableFallback && !options.reasoning) {
      // Le fallback n'est appliqué que si le reasoning n'est pas activé
      // (le reasoning est spécifique à GLM 5.1)
      for (const fallback of MODEL_FALLBACK_CHAIN) {
        if (fallback !== requestedModel) {
          modelsToTry.push(fallback);
        }
      }
    }

    let lastError: string = '';

    for (const model of modelsToTry) {
      let attempts = 0;

      for (let i = 0; i < maxRetries; i++) {
        attempts++;
        const isFallback = model !== requestedModel;

        try {
          const result = await this.executeChatCall(options, model, persona, isFallback);
          if (result && !result.isPlaceholder) {
            return {
              ...result,
              attempts,
              fallbackModel: isFallback ? model : undefined,
            };
          }

          // Si le résultat est un placeholder à cause d'une erreur API retryable, on retry
          if (result?.model === 'error') {
            lastError = `Model ${model}: API error`;
            if (i < maxRetries - 1) {
              const delay = this.calculateBackoff(i);
              this.logger.warn(`[${persona}] Retry ${i + 1}/${maxRetries} for model ${model} in ${delay}ms`);
              await this.sleep(delay);
              continue;
            }
          } else {
            // Placeholder non-retryable (réponse vide, etc.)
            return { ...result, attempts };
          }
        } catch (error: any) {
          lastError = `Model ${model}: ${error?.message}`;
          if (i < maxRetries - 1) {
            const delay = this.calculateBackoff(i);
            this.logger.warn(`[${persona}] Retry ${i + 1}/${maxRetries} for model ${model} in ${delay}ms (error: ${error?.message})`);
            await this.sleep(delay);
          }
        }
      }

      // Si on a épuisé les retries pour ce modèle, passer au suivant
      if (model !== modelsToTry[modelsToTry.length - 1]) {
        this.logger.warn(`[${persona}] Model ${model} failed after ${maxRetries} retries, trying fallback...`);
      }
    }

    this.logger.error(`[${persona}] All models and retries exhausted. Last error: ${lastError}`);
    return {
      content: this.generatePlaceholder(persona, options.messages),
      model: 'error',
      isPlaceholder: true,
      attempts: maxRetries * modelsToTry.length,
    };
  }

  /**
   * Exécute un appel IA unique (sans retry)
   */
  private async executeChatCall(
    options: OpenRouterChatOptions,
    model: string,
    persona: string,
    isFallback: boolean,
  ): Promise<OpenRouterChatResponse | null> {
    const temperature = options.temperature ?? 0.6;
    const maxTokens = options.maxTokens ?? 1000;
    const timeout = options.timeout ?? 60000;
    const enableReasoning = options.reasoning ?? false;

    if (isFallback) {
      this.logger.log(`[${persona}] Trying fallback model: ${model}`);
    } else {
      this.logger.log(`[${persona}] Calling OpenRouter (${model}), temp=${temperature}, maxTokens=${maxTokens}, reasoning=${enableReasoning}`);
    }

    // Construire le body de la requête
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature,
      max_tokens: maxTokens,
    };

    // Ajouter le support du reasoning pour GLM 5.1
    if (enableReasoning) {
      body.reasoning = {
        enabled: true,
        ...(options.reasoningEffort ? { effort: options.reasoningEffort } : {}),
        ...(options.maxReasoningTokens ? { max_tokens: options.maxReasoningTokens } : {}),
      };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');

      // Si c'est un code retryable, on laisse le retry gérer
      if (RETRYABLE_STATUS_CODES.has(response.status)) {
        this.logger.warn(`[${persona}] Retryable API error: ${response.status} - ${errorBody}`);
        return {
          content: '',
          model: 'error',
          isPlaceholder: true,
        };
      }

      // Erreur non-retryable (400, 401, 403, etc.) — ne pas retry
      this.logger.error(`[${persona}] Non-retryable API error: ${response.status} ${response.statusText} - ${errorBody}`);
      return {
        content: this.generatePlaceholder(persona as any, options.messages),
        model: 'error',
        isPlaceholder: true,
      };
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content || '';

    if (!content.trim()) {
      this.logger.warn(`[${persona}] Empty response from OpenRouter`);
      return {
        content: this.generatePlaceholder(persona as any, options.messages),
        model: data?.model || model,
        isPlaceholder: true,
      };
    }

    // Extraire les reasoning details si disponibles
    const reasoningDetails = choice?.message?.reasoning_details;

    // Extraire les tokens de raisonnement du usage
    const usageData = data?.usage;
    const reasoningTokens = usageData?.completion_tokens_details?.reasoning_tokens;

    return {
      content,
      model: data?.model || model,
      usage: usageData ? {
        promptTokens: usageData.prompt_tokens || 0,
        completionTokens: usageData.completion_tokens || 0,
        totalTokens: usageData.total_tokens || 0,
        reasoningTokens: reasoningTokens || undefined,
      } : undefined,
      isPlaceholder: false,
      reasoning_details: reasoningDetails,
    };
  }

  /**
   * Appel IA streaming - Retourne un AsyncGenerator de chunks
   * Compatible avec le format SSE OpenAI utilisé par OpenRouter
   * Support du reasoning streaming pour GLM 5.1
   * Retry automatique avec fallback de modèle
   */
  async *chatStream(options: OpenRouterChatOptions): AsyncGenerator<OpenRouterStreamChunk> {
    const persona = options.persona || 'SARA';

    if (!this.apiKey) {
      yield { type: 'status', text: 'placeholder' };
      yield { type: 'final', text: this.generatePlaceholder(persona, options.messages) };
      return;
    }

    await this.enforceRateLimit();

    const requestedModel = options.model || this.model;
    const maxRetries = options.maxRetries ?? 2;
    const enableFallback = options.enableFallback ?? true;

    // Construire la liste de modèles à essayer
    const modelsToTry: string[] = [requestedModel];
    if (enableFallback && !options.reasoning) {
      for (const fallback of MODEL_FALLBACK_CHAIN) {
        if (fallback !== requestedModel) {
          modelsToTry.push(fallback);
        }
      }
    }

    for (const model of modelsToTry) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          yield* this.executeStreamCall(options, model, persona);
          return; // Succès — on sort
        } catch (error: any) {
          this.logger.error(`[${persona}] Streaming attempt ${attempt + 1}/${maxRetries} failed for model ${model}: ${error?.message}`);

          if (attempt < maxRetries - 1) {
            const delay = this.calculateBackoff(attempt);
            yield { type: 'status', text: `Retrying in ${delay}ms...` };
            await this.sleep(delay);
          } else if (model !== modelsToTry[modelsToTry.length - 1]) {
            this.logger.warn(`[${persona}] Falling back to next model...`);
            yield { type: 'status', text: `Switching to fallback model...` };
          }
        }
      }
    }

    yield { type: 'error', text: 'All streaming models exhausted' };
  }

  /**
   * Exécute un appel streaming unique (sans retry)
   */
  private async *executeStreamCall(
    options: OpenRouterChatOptions,
    model: string,
    persona: string,
  ): AsyncGenerator<OpenRouterStreamChunk> {
    const temperature = options.temperature ?? 0.6;
    const maxTokens = options.maxTokens ?? 600;
    const timeout = options.timeout ?? 60000;
    const enableReasoning = options.reasoning ?? false;

    this.logger.log(`[${persona}] Streaming from OpenRouter (${model}), reasoning=${enableReasoning}`);

    // Construire le body de la requête
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    if (enableReasoning) {
      body.reasoning = {
        enabled: true,
        ...(options.reasoningEffort ? { effort: options.reasoningEffort } : {}),
      };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text().catch(() => '');
      this.logger.error(`[${persona}] OpenRouter streaming error: ${response.status} - ${errorBody}`);
      throw new Error(`API error: ${response.status}`);
    }

    yield { type: 'status', text: 'streaming' };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalContent = '';
    let reasoningContent = '';

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
          const delta = evt?.choices?.[0]?.delta;

          // Reasoning delta (GLM 5.1 specific)
          if (delta?.reasoning_content) {
            reasoningContent += delta.reasoning_content;
            yield { type: 'reasoning', reasoningText: delta.reasoning_content };
          }

          // Content delta
          if (typeof delta?.content === 'string') {
            totalContent += delta.content;
            yield { type: 'delta', text: delta.content };
          }

          // Check for finish
          if (evt?.choices?.[0]?.finish_reason === 'stop') {
            // Usage info comes in the final chunk for streaming
            if (evt.usage) {
              const reasoningTokens = evt.usage.completion_tokens_details?.reasoning_tokens;
              yield {
                type: 'final',
                text: totalContent,
                usage: {
                  promptTokens: evt.usage.prompt_tokens || 0,
                  completionTokens: evt.usage.completion_tokens || 0,
                  totalTokens: evt.usage.total_tokens || 0,
                  reasoningTokens: reasoningTokens || undefined,
                },
              };
            } else {
              yield { type: 'final', text: totalContent };
            }
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
      throw new Error('No content received from API');
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

  /**
   * Appel IA avec raisonnement - Utilise le paramètre reasoning de GLM 5.1
   * Idéal pour ORION (analyses approfondies) et les prédictions
   */
  async chatWithReasoning(
    userMessage: string,
    systemPrompt: string,
    persona?: OpenRouterChatOptions['persona'],
    options?: {
      temperature?: number;
      maxTokens?: number;
      reasoningEffort?: 'low' | 'medium' | 'high';
      maxReasoningTokens?: number;
    },
  ): Promise<OpenRouterChatResponse> {
    return this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.3,
      maxTokens: options?.maxTokens ?? 1500,
      persona,
      reasoning: true,
      reasoningEffort: options?.reasoningEffort ?? 'medium',
      maxReasoningTokens: options?.maxReasoningTokens,
      // Le fallback est désactivé pour le reasoning car c'est spécifique à GLM 5.1
      enableFallback: false,
    });
  }

  // ─── RETRY & BACKOFF ──────────────────────────────────────────────────────

  /**
   * Calcule le délai de backoff exponentiel avec jitter
   * Base: 1s, 2s, 4s... avec un jitter aléatoire de ±500ms
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
    const jitter = Math.random() * 1000 - 500; // ±500ms
    return Math.min(baseDelay + jitter, 10000); // Max 10s
  }

  /**
   * Utilitaire d'attente
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── RATE LIMITING ─────────────────────────────────────────────────────────

  /**
   * Assure un intervalle minimum entre les appels API
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
