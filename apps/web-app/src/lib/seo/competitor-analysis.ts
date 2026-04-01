export type CompetitorPage = {
  title: string;
  link: string;
  snippet?: string;
};

export type CompetitorAnalysis = {
  keyword: string;
  results: CompetitorPage[];
};

/**
 * Analyse SERP via un provider optionnel (ex: Serper.dev).
 * Nécessite `SERPER_API_KEY`. Sans clé, renvoie une liste vide (mode dégradé).
 */
export async function analyzeCompetitors(keywords: string[]): Promise<CompetitorAnalysis[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return keywords.map((k) => ({ keyword: k, results: [] }));
  }

  const out: CompetitorAnalysis[] = [];
  for (const keyword of keywords) {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: keyword, gl: 'bj', hl: 'fr', num: 10 }),
      cache: 'no-store',
    });
    if (!res.ok) {
      out.push({ keyword, results: [] });
      continue;
    }
    const json = (await res.json()) as any;
    const organic = Array.isArray(json?.organic) ? json.organic : [];
    out.push({
      keyword,
      results: organic
        .map((r: any) => ({
          title: String(r.title || ''),
          link: String(r.link || ''),
          snippet: String(r.snippet || ''),
        }))
        .filter((r: CompetitorPage) => r.title && r.link),
    });
  }
  return out;
}

