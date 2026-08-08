/**
 * ============================================================================
 * MODEL ENSEMBLE SERVICE — Multi-modèle IA pour Academia Helm
 * ============================================================================
 *
 * Service qui gère l'ensemble de 3 modèles IA via NVIDIA API :
 *
 *   1. GLM 5.2 (z-ai/glm-5.2)
 *      - Modèle principal, bon équilibre coût/performance
 *      - Reasoning natif (paramètre reasoning.enabled)
 *      - Streaming SSE compatible
 *      - Utilisé pour : Sarah (closer), Sarah Guide (navigation), conversation générale
 *
 *   2. MiniMax-M3 (minimaxai/minimax-m3)
 *      - Raisonnement sophistiqué, max_tokens 8192
 *      - Temperature 1, top_p 0.95
 *      - Utilisé pour : ORION (analyses complexes, prédictions, rapports décisionnels)
 *      - Excellente qualité de raisonnement pour tâches analytiques
 *
 *   3. GPT-OSS-120B (openai/gpt-oss-120b)
 *      - Function calling natif, structured output
 *      - Mathématiques, raisonnement étape par étape
 *      - Utilisé pour : ATLAS (exécution avec tools, function calling)
 *      - Expose reasoning_content pour le raisonnement transparent
 *
 * Stratégie de routing :
 *   - SARA (landing + guide) → GLM 5.2 (rapide, conversationnel)
 *   - ORION → MiniMax-M3 (raisonnement analytique approfondi)
 *   - ATLAS → GPT-OSS-120B (function calling, structured output)
 *   - Si un modèle échoue → fallback vers GLM 5.2 (modèle de secours universel)
 *
 * Tous les modèles sont accessibles via NVIDIA API (integrate.api.nvidia.com/v1)
 * avec la même clé API (NVIDIA_API_KEY).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Les 3 modèles disponibles dans l'ensemble */
export type ModelId = 'glm-5.2' | 'minimax-m3' | 'gpt-oss-120b';

/** Configuration spécifique à chaque modèle */
interface ModelConfig {
  /** ID du modèle côté NVIDIA API */
  nvidiaModel: string;
  /** Température recommandée */
  temperature: number;
  /** top_p recommandé */
  topP: number;
  /** Max tokens recommandé */
  maxTokens: number;
  /** Supporte le reasoning natif (paramètre reasoning) */
  supportsReasoning: boolean;
  /** Supporte le function calling (tools) */
  supportsFunctionCalling: boolean;
  /** Expose reasoning_content dans la réponse */
  exposesReasoningContent: boolean;
  /** Description du modèle */
  description: string;
}

/** Configuration de chaque modèle de l'ensemble */
const MODEL_CONFIGS: Record<ModelId, ModelConfig> = {
  'glm-5.2': {
    nvidiaModel: 'z-ai/glm-5.2',
    temperature: 0.7,
    topP: 1,
    maxTokens: 4000,
    supportsReasoning: true,
    supportsFunctionCalling: true,
    exposesReasoningContent: true,
    description: 'GLM 5.2 — Modèle principal, équilibre coût/performance, reasoning natif',
  },
  'minimax-m3': {
    nvidiaModel: 'minimaxai/minimax-m3',
    temperature: 1,
    topP: 0.95,
    maxTokens: 8192,
    supportsReasoning: false, // Utilise reasoning_content dans la réponse, pas le paramètre reasoning
    supportsFunctionCalling: true,
    exposesReasoningContent: true,
    description: 'MiniMax-M3 — Raisonnement sophistiqué, idéal pour analyses complexes',
  },
  'gpt-oss-120b': {
    nvidiaModel: 'openai/gpt-oss-120b',
    temperature: 1,
    topP: 1,
    maxTokens: 4096,
    supportsReasoning: false, // Utilise reasoning_content dans la réponse
    supportsFunctionCalling: true,
    exposesReasoningContent: true,
    description: 'GPT-OSS-120B — Function calling, mathématiques, structured output',
  },
};

/** Mapping agent → modèle recommandé */
const AGENT_MODEL_MAPPING: Record<string, ModelId> = {
  SARA: 'glm-5.2',       // Closer + Guide : rapide, conversationnel
  ORION: 'minimax-m3',   // Analyste : raisonnement sophistiqué
  ATLAS: 'gpt-oss-120b', // Exécuteur : function calling, structured output
  HDIE: 'glm-5.2',
  SCE: 'glm-5.2',
  GENERAL: 'glm-5.2',
};

@Injectable()
export class ModelEnsembleService {
  private readonly logger = new Logger(ModelEnsembleService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('NVIDIA_API_KEY') ||
      this.configService.get<string>('OPENROUTER_API_KEY') ||
      '';
    this.baseUrl =
      this.configService.get<string>('NVIDIA_BASE_URL') ||
      this.configService.get<string>('OPENROUTER_BASE_URL') ||
      'https://integrate.api.nvidia.com/v1';

    if (this.apiKey) {
      this.logger.log(
        `Model Ensemble configured — ${Object.keys(MODEL_CONFIGS).length} models available: ${Object.values(MODEL_CONFIGS).map(m => m.nvidiaModel).join(', ')}`,
      );
    } else {
      this.logger.warn('NVIDIA_API_KEY not configured. Model Ensemble will not work.');
    }
  }

  /**
   * Retourne le modèle recommandé pour un agent donné
   */
  getModelForAgent(agent: string): ModelId {
    return AGENT_MODEL_MAPPING[agent] || 'glm-5.2';
  }

  /**
   * Retourne la configuration complète d'un modèle
   */
  getModelConfig(modelId: ModelId): ModelConfig {
    return MODEL_CONFIGS[modelId];
  }

  /**
   * Retourne l'ID du modèle NVIDIA (pour l'API call)
   */
  getNvidiaModel(modelId: ModelId): string {
    return MODEL_CONFIGS[modelId].nvidiaModel;
  }

  /**
   * Retourne la liste de tous les modèles disponibles
   */
  getAvailableModels(): ModelId[] {
    return Object.keys(MODEL_CONFIGS) as ModelId[];
  }

  /**
   * Vérifie si l'ensemble est configuré
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Retourne la clé API et l'URL de base (pour les services qui font leurs propres appels)
   */
  getCredentials(): { apiKey: string; baseUrl: string } {
    return { apiKey: this.apiKey, baseUrl: this.baseUrl };
  }

  /**
   * Construit le body de la requête pour un modèle donné
   *
   * Adapté aux spécificités de chaque modèle :
   *   - GLM 5.2 : supporte le paramètre reasoning.enabled
   *   - MiniMax-M3 : temperature 1, top_p 0.95, max_tokens 8192
   *   - GPT-OSS-120B : temperature 1, top_p 1, max_tokens 4096
   */
  buildRequestBody(
    modelId: ModelId,
    messages: Array<{ role: string; content: string }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      tools?: unknown[];
      toolChoice?: string;
      reasoning?: boolean;
      reasoningEffort?: 'low' | 'medium' | 'high';
    } = {},
  ): Record<string, unknown> {
    const config = MODEL_CONFIGS[modelId];

    const body: Record<string, unknown> = {
      model: config.nvidiaModel,
      messages,
      temperature: options.temperature ?? config.temperature,
      top_p: config.topP,
      max_tokens: options.maxTokens ?? config.maxTokens,
    };

    // Streaming
    if (options.stream) {
      body.stream = true;
    }

    // Reasoning (uniquement pour GLM 5.2 qui supporte le paramètre reasoning)
    if (options.reasoning && config.supportsReasoning) {
      body.reasoning = {
        enabled: true,
        ...(options.reasoningEffort ? { effort: options.reasoningEffort } : {}),
      };
    }

    // Function calling (tous les modèles supportent tools)
    if (options.tools && options.tools.length > 0 && config.supportsFunctionCalling) {
      body.tools = options.tools;
      body.tool_choice = options.toolChoice || 'auto';
    }

    return body;
  }

  /**
   * Extrait le contenu et le reasoning de la réponse d'un modèle
   *
   * GLM 5.2 : content dans message.content, reasoning dans message.reasoning_details
   * MiniMax-M3 : content dans message.content, reasoning dans message.reasoning_content
   * GPT-OSS-120B : content dans message.content, reasoning dans message.reasoning_content
   */
  extractResponse(choice: any, modelId: ModelId): {
    content: string;
    reasoningContent?: string;
    toolCalls?: any[];
  } {
    const message = choice?.message || {};
    const content = message.content || '';
    const toolCalls = message.tool_calls;

    // GLM 5.2 expose le reasoning dans reasoning_details (format détaillé)
    // MiniMax-M3 et GPT-OSS-120B exposent le reasoning dans reasoning_content (format string)
    let reasoningContent: string | undefined;

    if (modelId === 'glm-5.2') {
      // GLM 5.2 : reasoning_details est un array d'objets
      if (message.reasoning_details && Array.isArray(message.reasoning_details)) {
        reasoningContent = message.reasoning_details
          .map((r: any) => r?.text || r?.content || '')
          .filter(Boolean)
          .join('\n');
      }
    } else {
      // MiniMax-M3 et GPT-OSS-120B : reasoning_content est une string
      if (message.reasoning_content && typeof message.reasoning_content === 'string') {
        reasoningContent = message.reasoning_content;
      }
    }

    return { content, reasoningContent, toolCalls };
  }

  /**
   * Extrait le delta de streaming pour un modèle donné
   *
   * En streaming, les modèles exposent le reasoning différemment :
   *   - GLM 5.2 : delta.reasoning_content (string)
   *   - MiniMax-M3 : delta.reasoning_content (string)
   *   - GPT-OSS-120B : delta.reasoning_content (string)
   */
  extractStreamDelta(delta: any): {
    content?: string;
    reasoningContent?: string;
  } {
    const content = typeof delta?.content === 'string' ? delta.content : undefined;
    const reasoningContent =
      typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : undefined;

    return { content, reasoningContent };
  }

  /**
   * Retourne un modèle de fallback si le modèle principal échoue
   *
   * Stratégie : GLM 5.2 est le fallback universel (modèle le plus fiable).
   * Si GLM 5.2 échoue, on essaie MiniMax-M3, puis GPT-OSS-120B.
   */
  getFallbackChain(primaryModel: ModelId): ModelId[] {
    const chain: ModelId[] = [primaryModel];

    // Ajouter GLM 5.2 en premier fallback (sauf si c'est déjà le modèle principal)
    if (primaryModel !== 'glm-5.2') {
      chain.push('glm-5.2');
    }

    // Ajouter les autres modèles restants
    (Object.keys(MODEL_CONFIGS) as ModelId[]).forEach((model) => {
      if (!chain.includes(model)) {
        chain.push(model);
      }
    });

    return chain;
  }

  /**
   * Retourne une description lisible du routing pour les logs
   */
  describeRouting(): string {
    return Object.entries(AGENT_MODEL_MAPPING)
      .map(([agent, model]) => `${agent} → ${MODEL_CONFIGS[model].nvidiaModel}`)
      .join(' | ');
  }
}
