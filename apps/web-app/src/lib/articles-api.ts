import type { Article } from '@/types/article';
import { articlesData } from '@/data/articles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const USE_API = process.env.NEXT_PUBLIC_USE_CMS === 'true';

export async function getAllArticles(): Promise<Article[]> {
  if (USE_API) {
    try {
      const res = await fetch(`${API_URL}/api/articles`, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error();
      return res.json();
    } catch {
      return articlesData;
    }
  }
  return articlesData;
}

export async function getArticle(slug: string): Promise<Article | null> {
  if (USE_API) {
    try {
      const res = await fetch(`${API_URL}/api/articles/${slug}`, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error();
      return res.json();
    } catch {
      return articlesData.find((a) => a.slug === slug) ?? null;
    }
  }
  return articlesData.find((a) => a.slug === slug) ?? null;
}

