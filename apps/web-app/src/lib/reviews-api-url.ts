/**
 * URLs des avis publics : toujours en same-origin via les routes Next
 * (`/api/public/...`) pour éviter CORS et ne pas dépendre des rewrites next.config
 * (`/reviews/*` → API) qui peuvent être absents si l’origine API n’est pas résolue.
 */

export function buildReviewsPublishedUrl(): string {
  return '/api/public/reviews-published?limit=9&minRating=4';
}

export function buildReviewsSubmitUrl(): string {
  return '/api/public/reviews';
}
