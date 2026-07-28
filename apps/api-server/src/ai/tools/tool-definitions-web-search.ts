/**
 * ============================================================================
 * WEB SEARCH TOOL — Recherche Internet en temps réel pour SARA
 * ============================================================================
 *
 * ⭐ Migration depuis z-ai CLI vers WebSearchService (DuckDuckGo HTTP).
 *
 * Outil de recherche web utilisant WebSearchService (injection via factory).
 * Permet à SARA d'enrichir ses réponses avec des données du web :
 * concurrence, tendances éducatives, actualités, comparaisons.
 *
 * Agent : SARA + ALL (disponible pour tous les agents)
 * Catégorie : WEB_SEARCH
 *
 * Le function calling de NVIDIA GLM-5.2 décide autonomously quand appeler
 * cet outil — le backend exécute la recherche via WebSearchService.
 */

import type { ToolDefinition, ToolResult, MCPContext } from '../types/ai.types';
import type { WebSearchService } from '../../common/services/web-search.service';

/**
 * Factory : crée l'outil web_search en injectant WebSearchService.
 *
 * Utilisation dans ai.module.ts :
 *   this.toolRegistry.register(createWebSearchTool(webSearchService));
 */
export function createWebSearchTool(
  webSearchService: WebSearchService,
): ToolDefinition {
  return {
    name: 'web_search',
    description: `Recherche des informations sur Internet en temps réel. Utilise cet outil quand :
- L'utilisateur mentionne un concurrent ou demande une comparaison
- L'utilisateur pose des questions sur le marché éducatif en Afrique
- L'utilisateur demande des statistiques ou données sectorielles
- Tu as besoin d'informations actualisées pour appuyer tes arguments de closing
- L'utilisateur parle de réformes, lois, ou tendances du secteur éducatif`,
    version: '2.0.0',
    agent: 'SARA',
    category: 'WEB_SEARCH',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Terme de recherche web (en français, orienté marché éducatif Afrique)',
        },
        num: {
          type: 'number',
          description: 'Nombre de résultats (1-10, défaut 5)',
          default: 5,
        },
      },
      required: ['query'],
    },
    requiredPermissions: [], // Aucune permission spéciale requise
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,

    execute: async (
      params: Record<string, unknown>,
      _context: MCPContext,
    ): Promise<ToolResult> => {
      const query = String(params.query || '');
      const num = Number(params.num) || 5;

      if (!query.trim()) {
        return {
          success: false,
          data: null,
          error: 'Query parameter is required',
          metadata: { queryTime: 0, source: 'web_search' },
        };
      }

      const startTime = Date.now();
      const results = await webSearchService.search(query, num);

      if (results.length === 0) {
        return {
          success: true,
          data: { query, results: [], message: 'Aucun résultat trouvé. Utilise tes connaissances internes.' },
          metadata: { queryTime: Date.now() - startTime, source: 'web_search' },
        };
      }

      // Formatter les résultats pour SARA
      const formatted = results.map((r, i) => ({
        rank: i + 1,
        name: r.name,
        url: r.url,
        snippet: r.snippet,
        source: r.host_name,
      }));

      return {
        success: true,
        data: {
          query,
          results: formatted,
          instruction: 'Utilise ces résultats pour enrichir tes arguments. Reformule et intègre dans ton argumentaire de closing. Ne recopie pas les extraits textuellement. Si un concurrent est mentionné, mets en avant les avantages d\'Academia Helm par comparaison factuelle.',
        },
        metadata: { queryTime: Date.now() - startTime, rowCount: results.length, source: 'web_search' },
      };
    },
  };
}
