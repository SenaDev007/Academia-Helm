import { Injectable, Logger } from '@nestjs/common';

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
 * WEB SEARCH SERVICE — Recherche Internet via DuckDuckGo HTML
 * ============================================================================
 *
 * ⭐ Migration depuis z-ai CLI vers une implémentation autonome.
 *
 * Utilise DuckDuckGo HTML (lite.duckduckgo.com) — gratuit, sans clé API,
 * sans limite de taux restrictive. Le parsing HTML est simple et robuste.
 *
 * Ce service est utilisé par :
 *   - SARA (enrichissement de prompt avant l'appel GLM-5.2)
 *   - Le tool registry (function calling `web_search` — GLM-5.2 décide
 *     autonomously quand appeler cet outil)
 *
 * L'ancienne implémentation utilisait `execFile('z-ai', ['function', ...])`
 * qui nécessitait le package z-ai-web-dev-sdk. Désormais, c'est un simple
 * fetch() HTTP — plus de dépendance SDK externe.
 * ============================================================================
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
      const maxResults = Math.min(num, 10);
      this.logger.log(`Web search: "${query}" (max ${maxResults} results)`);

      // ⭐ Utiliser DuckDuckGo HTML Lite (gratuit, pas de clé API, pas de JS)
      const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!response.ok) {
        this.logger.warn(`Web search HTTP ${response.status} for "${query}"`);
        return [];
      }

      const html = await response.text();
      const results = this.parseDuckDuckGoLite(html, maxResults);

      this.logger.log(`Web search "${query}" → ${results.length} results`);
      return results;
    } catch (error: any) {
      this.logger.warn(`Web search failed for "${query}": ${error?.message}`);
      return [];
    }
  }

  /**
   * Parse le HTML de DuckDuckGo Lite pour extraire les résultats
   */
  private parseDuckDuckGoLite(html: string, maxResults: number): WebSearchResult[] {
    const results: WebSearchResult[] = [];

    try {
      // DuckDuckGo Lite utilise un tableau simple avec des liens
      // Pattern: <a href="URL" class="result-link">TITLE</a>
      // Suivi d'un <td class="result-snippet">SNIPPET</td>

      // Extraire tous les liens de résultats
      const linkPattern =
        /<a[^>]*href="([^"]+)"[^>]*class="result-link"[^>]*>(.*?)<\/a>/gis;
      const snippetPattern =
        /<td[^>]*class="result-snippet"[^>]*>(.*?)<\/td>/gis;

      const links: { url: string; name: string }[] = [];
      let match: RegExpExecArray | null;

      while ((match = linkPattern.exec(html)) !== null) {
        const url = match[1];
        const name = this.stripHtml(match[2]).trim();
        if (url && name && !url.startsWith('javascript:')) {
          links.push({ url, name });
        }
      }

      const snippets: string[] = [];
      while ((match = snippetPattern.exec(html)) !== null) {
        snippets.push(this.stripHtml(match[1]).trim());
      }

      // Combiner liens + snippets
      for (let i = 0; i < Math.min(links.length, maxResults); i++) {
        const link = links[i];
        const snippet = snippets[i] || '';
        const hostName = this.extractHostName(link.url);

        results.push({
          url: link.url,
          name: link.name,
          snippet: snippet.substring(0, 300), // Limiter la longueur du snippet
          host_name: hostName,
          rank: i + 1,
          date: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      this.logger.warn(`Failed to parse DuckDuckGo HTML: ${error?.message}`);
    }

    return results;
  }

  /**
   * Retire les balises HTML d'une chaîne
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  /**
   * Extrait le nom d'hôte depuis une URL
   */
  private extractHostName(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.substring(0, 50);
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
