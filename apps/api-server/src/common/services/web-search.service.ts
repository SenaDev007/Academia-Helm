import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Résultat d'une recherche web
 */
export interface WebSearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
  date: string;
}

/**
 * ============================================================================
 * WEB SEARCH SERVICE — Recherche Internet via z-ai CLI
 * ============================================================================
 *
 * Utilise le CLI `z-ai` (SDK z-ai-web-dev-sdk) pour effectuer des recherches
 * web en temps réel. Permet à SARA d'enrichir ses réponses avec des données
 * du web (concurrents, tendances éducatives, actualités, etc.).
 *
 * Le CLI est installé globalement : /usr/local/bin/z-ai
 * Commande : z-ai function --name "web_search" --args '{"query": "...", "num": N}'
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  /**
   * Effectue une recherche web et retourne les résultats
   *
   * @param query - Terme de recherche
   * @param num - Nombre de résultats (max 10, défaut 5)
   * @returns Résultats de recherche
   */
  async search(query: string, num: number = 5): Promise<WebSearchResult[]> {
    try {
      const args = JSON.stringify({ query, num: Math.min(num, 10) });

      const { stdout, stderr } = await execFileAsync(
        'z-ai',
        ['function', '--name', 'web_search', '--args', args],
        {
          timeout: 15000, // 15 secondes max
          maxBuffer: 1024 * 1024, // 1MB buffer
        },
      );

      // Le CLI affiche des lignes de log avant le JSON — on extrait le JSON
      const jsonStart = stdout.indexOf('[');
      if (jsonStart === -1) {
        this.logger.warn('No JSON array found in web search output');
        return [];
      }

      const jsonStr = stdout.slice(jsonStart);
      const results: WebSearchResult[] = JSON.parse(jsonStr);

      this.logger.log(`Web search "${query}" → ${results.length} results`);
      return results;
    } catch (error: any) {
      this.logger.warn(`Web search failed for "${query}": ${error?.message}`);
      return [];
    }
  }

  /**
   * Recherche web formatée pour injection dans un prompt SARA
   * Retourne un résumé concis des résultats, prêt à être inclus dans le contexte
   *
   * @param query - Terme de recherche
   * @param num - Nombre de résultats (défaut 5)
   * @returns Texte formaté avec les résultats, ou chaîne vide si échec
   */
  async searchForPrompt(query: string, num: number = 5): Promise<string> {
    const results = await this.search(query, num);

    if (results.length === 0) {
      return '';
    }

    const formatted = results
      .map((r, i) => `${i + 1}. ${r.name} (${r.host_name})\n   ${r.snippet}`)
      .join('\n\n');

    return `RÉSULTATS DE RECHERCHE WEB pour "${query}" :\n${formatted}`;
  }
}
