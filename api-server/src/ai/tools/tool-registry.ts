/**
 * ============================================================================
 * TOOL REGISTRY — Academia Helm AI Tool Calling Architecture
 * ============================================================================
 * Registre central des outils IA. Chaque outil est versionné, auditable,
 * et contrôlé par RBAC. Les IA n'accèdent JAMAIS directement aux données.
 *
 * Conforme à la spécification v2.0 Tome 5 §5.3
 * Modèle : z-ai/glm-5.1 via OpenRouter
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ToolDefinition,
  ToolResult,
  MCPContext,
  AIAgentName,
} from '../types/ai.types';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools: Map<string, ToolDefinition> = new Map();

  /**
   * Enregistre un outil dans le registre
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool "${tool.name}" already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registered: ${tool.name} v${tool.version} (${tool.category}) [${tool.agent}]`);
  }

  /**
   * Enregistre plusieurs outils
   */
  registerMany(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Récupère un outil par son nom
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Liste tous les outils enregistrés
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Récupère les outils disponibles pour un agent donné,
   * filtrés par les permissions utilisateur
   */
  getAvailableTools(agent: AIAgentName | 'ALL', userPermissions: string[]): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => {
      // L'outil doit être disponible pour cet agent
      if (tool.agent !== 'ALL' && tool.agent !== agent) {
        return false;
      }
      // L'utilisateur doit avoir au moins une des permissions requises
      if (tool.requiredPermissions.length === 0) {
        return true;
      }
      return tool.requiredPermissions.some(p => userPermissions.includes(p));
    });
  }

  /**
   * Exécute un outil avec validation complète
   */
  async execute(
    toolName: string,
    parameters: Record<string, unknown>,
    context: MCPContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    // 1. Vérifier que l'outil existe
    const tool = this.tools.get(toolName);
    if (!tool) {
      this.logger.error(`Tool not found: ${toolName}`);
      return {
        success: false,
        data: null,
        error: `Tool "${toolName}" not found`,
        metadata: { queryTime: Date.now() - startTime, source: 'tool-registry' },
      };
    }

    // 2. Valider les permissions
    if (tool.requiredPermissions.length > 0) {
      const hasPermission = tool.requiredPermissions.some(
        p => context.userPermissions.includes(p),
      );
      if (!hasPermission) {
        this.logger.warn(`Permission denied for tool "${toolName}" by user ${context.userId}`);
        return {
          success: false,
          data: null,
          error: `Permission denied: you don't have access to tool "${toolName}"`,
          metadata: { queryTime: Date.now() - startTime, source: 'tool-registry' },
        };
      }
    }

    // 3. Valider le tenant (critical security)
    if (tool.requiresTenant && !context.schoolId) {
      return {
        success: false,
        data: null,
        error: 'Tenant context required for this tool',
        metadata: { queryTime: Date.now() - startTime, source: 'tool-registry' },
      };
    }

    // 4. Injecter le tenant dans les paramètres
    const enrichedParams = tool.requiresTenant
      ? { ...parameters, tenantId: context.schoolId }
      : parameters;

    // 5. Exécuter l'outil
    try {
      const result = await tool.execute(enrichedParams, context);
      this.logger.log(
        `Tool "${toolName}" executed in ${Date.now() - startTime}ms (success: ${result.success})`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(`Tool "${toolName}" execution failed: ${error?.message}`);
      return {
        success: false,
        data: null,
        error: error?.message || 'Tool execution failed',
        metadata: { queryTime: Date.now() - startTime, source: 'tool-registry' },
      };
    }
  }

  /**
   * Génère la description des outils pour injection dans le prompt IA
   */
  getToolsDescription(agent: AIAgentName | 'ALL', userPermissions: string[]): string {
    const tools = this.getAvailableTools(agent, userPermissions);
    if (tools.length === 0) return 'Aucun outil disponible.';

    return tools
      .map(tool => {
        const params = JSON.stringify(tool.inputSchema, null, 2);
        return `- ${tool.name} (v${tool.version}): ${tool.description}\n  Paramètres: ${params}\n  Lecture seule: ${tool.isReadOnly} | Confirmation requise: ${tool.requiresConfirmation}`;
      })
      .join('\n\n');
  }

  /**
   * Génère les outils au format OpenAI Function Calling
   * Compatible avec GLM 5.1 tool calling via OpenRouter
   */
  getOpenAIToolsFormat(agent: AIAgentName | 'ALL', userPermissions: string[]): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    const tools = this.getAvailableTools(agent, userPermissions);
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }
}
