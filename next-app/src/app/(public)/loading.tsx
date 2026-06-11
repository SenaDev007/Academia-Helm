/**
 * Loading Component - Public Pages
 *
 * Affiché pendant le chargement des pages publiques.
 * Durée minimale de 15 secondes pour une expérience visuelle professionnelle.
 */

'use client';

import { MinDurationScreen } from '@/components/loading/MinDurationScreen';

export default function PublicLoading() {
  return (
    <MinDurationScreen ready={false} />
  );
}
