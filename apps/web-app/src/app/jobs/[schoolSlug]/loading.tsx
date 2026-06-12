/**
 * Loading Component - /jobs/[schoolSlug] Route
 *
 * Affiché pendant le chargement de la page /jobs/:slug.
 * Durée minimale de 15 secondes pour une expérience visuelle professionnelle.
 * Adaptatif desktop/mobile.
 */

'use client';

import { MinDurationScreen } from '@/components/loading/MinDurationScreen';

export default function SchoolJobsLoading() {
  return (
    <MinDurationScreen ready={false} />
  );
}
