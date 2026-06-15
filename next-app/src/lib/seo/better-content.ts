import { analyzeCompetitors } from './competitor-analysis';
import { buildSEOArticlePrompt, generateSEOArticleFromPrompt } from '../ai/content-generator';

/**
 * Génère un contenu “meilleur que la SERP” (MVP) :
 * - récupère les titres concurrents (si SERPER_API_KEY)
 * - injecte ces titres dans le prompt pour forcer différenciation + profondeur
 */
export async function generateBetterContent(keyword: string) {
  const serp = await analyzeCompetitors([keyword]);
  const titles = serp[0]?.results?.slice(0, 8).map((r) => r.title).filter(Boolean) ?? [];

  const extra =
    titles.length > 0
      ? `\n\nContexte SERP (titres observés) — tu dois te différencier et être plus utile :\n- ${titles.join(
          '\n- ',
        )}\n`
      : '';

  const prompt = `${buildSEOArticlePrompt(keyword)}${extra}`;
  return generateSEOArticleFromPrompt(prompt, { slugHint: keyword, defaultKeyword: keyword });
}
