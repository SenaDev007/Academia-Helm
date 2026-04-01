import { Redis } from '@upstash/redis';

export type RankPoint = {
  keyword: string;
  position: number | null;
  checkedAt: string;
};

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Stockage minimal : on conserve une série temporelle par keyword.
 * La collecte de position nécessite un provider SERP (ex: Serper).
 */
export async function storeRankPoint(point: RankPoint) {
  const redis = getRedis();
  if (!redis) return;
  const key = `rank:${point.keyword}`;
  await redis.lpush(key, JSON.stringify(point));
  await redis.ltrim(key, 0, 89); // ~90 points
}

export async function getRankHistory(keyword: string): Promise<RankPoint[]> {
  const redis = getRedis();
  if (!redis) return [];
  const key = `rank:${keyword}`;
  const list = (await redis.lrange(key, 0, 89)) as string[];
  return list
    .map((x) => {
      try {
        return JSON.parse(x) as RankPoint;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as RankPoint[];
}

function normalizeHost(input: string): string {
  try {
    const u = new URL(input);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return input.replace(/^www\./, '').toLowerCase();
  }
}

/**
 * Suit la position (organic) pour un domaine cible via Serper.
 * Retourne null si non trouvé dans le top N.
 */
export async function trackKeywordRank(keyword: string, targetDomain?: string): Promise<RankPoint> {
  const apiKey = process.env.SERPER_API_KEY;
  const domain = normalizeHost(targetDomain || process.env.SEO_TRACK_DOMAIN || 'academiahelm.com');

  const checkedAt = new Date().toISOString();
  if (!apiKey) {
    return { keyword, position: null, checkedAt };
  }

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: keyword, gl: 'bj', hl: 'fr', num: 20 }),
    cache: 'no-store',
  });
  if (!res.ok) return { keyword, position: null, checkedAt };

  const json = (await res.json()) as any;
  const organic = Array.isArray(json?.organic) ? json.organic : [];
  let position: number | null = null;
  organic.forEach((r: any, idx: number) => {
    const link = String(r.link || '');
    if (!link) return;
    if (normalizeHost(link).endsWith(domain)) {
      if (position === null) position = idx + 1;
    }
  });

  const point: RankPoint = { keyword, position, checkedAt };
  await storeRankPoint(point);
  return point;
}

