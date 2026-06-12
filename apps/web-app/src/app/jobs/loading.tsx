/**
 * Loading Component - /jobs Route
 *
 * Affiché pendant le chargement de la page /jobs.
 * Durée minimale de 10 secondes pour une expérience visuelle professionnelle.
 * Adaptatif desktop/mobile.
 */

'use client';

import { MinDurationScreen } from '@/components/loading/MinDurationScreen';

export default function JobsLoading() {
  return (
    <MinDurationScreen ready={false} />
  );
}
