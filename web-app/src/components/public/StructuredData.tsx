/**
 * Structured Data Component
 *
 * Ajoute les données structurées JSON-LD pour le SEO
 * Composant serveur uniquement (pas de 'use client')
 */

import {
  generateOrganizationSchema,
  generateProductSchema,
  generateSoftwareApplicationSchema,
  generateWebSiteSchema,
} from '@/lib/seo';
import {
  generateReviewsOnlyGraph,
  mergeOrganizationAggregateForReviews,
} from '@/lib/seo/reviews-jsonld';
import type { PlatformReviewPublic } from '@/types/platform-review';

type Props = {
  platformReviews?: PlatformReviewPublic[];
};

export default function StructuredData({ platformReviews = [] }: Props) {
  const organizationSchema = mergeOrganizationAggregateForReviews(
    generateOrganizationSchema() as Record<string, unknown>,
    platformReviews,
  );
  const webSiteSchema = generateWebSiteSchema();
  const softwareSchema = generateSoftwareApplicationSchema();
  const productSchema = generateProductSchema();
  const reviewsGraph = generateReviewsOnlyGraph(platformReviews);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {reviewsGraph ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsGraph) }}
        />
      ) : null}
    </>
  );
}
