/**
 * En développement, Next.js réécrit `/reviews/*` vers l’API Nest (voir next.config.js)
 * pour éviter les appels cross-origin depuis le navigateur.
 *
 * Désactiver : NEXT_PUBLIC_REVIEWS_DEV_PROXY=0
 */

export function reviewsUseDevSameOriginProxy(): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  if (process.env.NEXT_PUBLIC_REVIEWS_DEV_PROXY === '0') return false;
  return true;
}

export function buildReviewsPublishedUrl(): string {
  if (reviewsUseDevSameOriginProxy()) {
    // Même origine : Next réécrit vers l’API (next.config.js). Pas besoin de NEXT_PUBLIC_API_URL côté client.
    return '/reviews/published?limit=9&minRating=4';
  }
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}/reviews/published?limit=9&minRating=4`;
}

export function buildReviewsSubmitUrl(): string {
  if (reviewsUseDevSameOriginProxy()) {
    return '/reviews';
  }
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}/reviews`;
}
