/**
 * Données de secours pour la section avis de la landing page.
 *
 * IMPORTANT : ces données ne sont PLUS utilisées dans ReviewsSection.
 * La section avis affiche désormais uniquement les avis réels provenant de la base de données.
 *
 * Ce fichier est conservé uniquement pour la rétrocompatibilité avec HelmNativeReviewsSection
 * si celui-ci est toujours utilisé ailleurs.
 *
 * @deprecated Utiliser l'API /api/public/reviews-published à la place.
 */

export interface HelmReview {
  id: string;
  quote: string;
  author: string;
  role: string;
  org: string;
  rating: number;
}

export const HELM_LANDING_REVIEWS: HelmReview[] = [];
