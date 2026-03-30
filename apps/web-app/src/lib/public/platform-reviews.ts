import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { PlatformReviewPublic } from '@/types/platform-review';

function backendReviewsUrl(): string {
  const API = getApiBaseUrlForRoutes();
  return API.endsWith('/api')
    ? `${API}/public/platform-reviews`
    : `${API}/api/public/platform-reviews`;
}

/**
 * Récupère les avis publiés (SSR / Route Handler). Retourne [] en cas d’erreur.
 */
export async function fetchPublishedPlatformReviews(): Promise<PlatformReviewPublic[]> {
  try {
    const res = await fetch(backendReviewsUrl(), {
      next: { revalidate: 120 },
      headers: { Accept: 'application/json' },
      signal:
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(12_000)
          : undefined,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { reviews?: unknown };
    if (!Array.isArray(data.reviews)) return [];
    return data.reviews.filter(isValidReview);
  } catch {
    return [];
  }
}

function isValidReview(x: unknown): x is PlatformReviewPublic {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.quote === 'string' &&
    typeof o.authorLabel === 'string' &&
    typeof o.roleLabel === 'string' &&
    typeof o.organizationLabel === 'string' &&
    typeof o.rating === 'number' &&
    o.rating >= 1 &&
    o.rating <= 5
  );
}
