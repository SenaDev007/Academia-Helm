import { pickNextKeywords } from './keyword-strategy';
import { analyzeCompetitors } from './competitor-analysis';
import { generateBetterContent } from './better-content';

/**
 * Orchestrateur SEO (MVP).
 * - Choisit des mots-clés prioritaires
 * - (Optionnel) analyse SERP (si SERPER_API_KEY)
 * - Génère du contenu via Anthropic
 *
 * La persistance (écriture MDX) est faite par les scripts côté Node (scripts/auto-publish.js).
 */
export async function runSEOEngine() {
  const batch = pickNextKeywords(3);
  const keywords = batch.map((x) => x.keyword);

  const competitor = await analyzeCompetitors(keywords);

  // MVP: on génère directement l’article; la stratégie "better content" peut incorporer competitor[*]
  const articles = [];
  for (const kw of keywords) {
    const article = await generateBetterContent(kw);
    articles.push({ keyword: kw, article, competitor: competitor.find((c) => c.keyword === kw) });
  }
  return { keywords, articles };
}

