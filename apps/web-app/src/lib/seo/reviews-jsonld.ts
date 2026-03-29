import { BRAND } from '@/lib/brand';
import { getPublicSiteUrl } from '@/lib/seo';
import type { PlatformReviewPublic } from '@/types/platform-review';

type OrgSchema = Record<string, unknown>;

/**
 * Ajoute AggregateRating à l’Organization uniquement si des avis publiés existent (données réelles).
 */
export function mergeOrganizationAggregateForReviews(
  organizationSchema: OrgSchema,
  reviews: PlatformReviewPublic[],
): OrgSchema {
  if (!reviews.length) return organizationSchema;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const ratingValue = Math.round((sum / reviews.length) * 10) / 10;
  return {
    ...organizationSchema,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(ratingValue),
      bestRating: '5',
      worstRating: '1',
      ratingCount: String(reviews.length),
    },
  };
}

/**
 * Graphe JSON-LD des avis individuels (itemReviewed = Organization).
 */
export function generateReviewsOnlyGraph(reviews: PlatformReviewPublic[]) {
  if (!reviews.length) return null;
  const siteUrl = getPublicSiteUrl();
  const itemReviewed = {
    '@type': 'Organization',
    name: BRAND.name,
    url: siteUrl,
  };

  return {
    '@context': 'https://schema.org',
    '@graph': reviews.map((r) => ({
      '@type': 'Review',
      '@id': `${siteUrl}#review-${r.id}`,
      author: {
        '@type': 'Person',
        name: [r.authorLabel, r.roleLabel].filter(Boolean).join(', ').slice(0, 100),
      },
      reviewBody: r.quote,
      ...(r.verifiedAt ? { datePublished: r.verifiedAt } : {}),
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      itemReviewed: { ...itemReviewed },
    })),
  };
}
