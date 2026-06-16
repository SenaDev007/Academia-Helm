/**
 * ============================================================================
 * WEB SEARCH TOOL — Recherche Internet en temps réel pour SARA
 * ============================================================================
 *
 * Outil de recherche web utilisant le CLI z-ai (SDK z-ai-web-dev-sdk).
 * Permet à SARA d'enrichir ses réponses avec des données du web :
 * concurrence, tendances éducatives, actualités, comparaisons.
 *
 * Agent : SARA + ALL (disponible pour tous les agents)
 * Catégorie : WEB_SEARCH
 */

import { Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition, ToolResult, MCPContext } from '../types/ai.types';

const execFileAsync = promisify(execFile);

const logger = new Logger('WebSearchTool');

/**
 * Effectue une recherche web via le CLI z-ai
 */
async function executeWebSearch(query: string, num: number = 5): Promise<Array<{
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
}>> {
  try {
    const args = JSON.stringify({ query, num: Math.min(num, 10) });
    const { stdout } = await execFileAsync(
      'z-ai',
      ['function', '--name', 'web_search', '--args', args],
      { timeout: 15000, maxBuffer: 1024 * 1024 },
    );

    const jsonStart = stdout.indexOf('[');
    if (jsonStart === -1) return [];

    return JSON.parse(stdout.slice(jsonStart));
  } catch (error: any) {
    logger.warn(`Web search failed: ${error?.message}`);
    return [];
  }
}

/**
 * Définition de l'outil web_search pour le Tool Registry
 */
export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: `Recherche des informations sur Internet en temps réel. Utilise cet outil quand :
- L'utilisateur mentionne un concurrent ou demande une comparaison
- L'utilisateur pose des questions sur le marché éducatif en Afrique
- L'utilisateur demande des statistiques ou données sectorielles
- Tu as besoin d'informations actualisées pour appuyer tes arguments de closing
- L'utilisateur parle de réformes, lois, ou tendances du secteur éducatif`,
  version: '1.0.0',
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
    const results = await executeWebSearch(query, num);

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
