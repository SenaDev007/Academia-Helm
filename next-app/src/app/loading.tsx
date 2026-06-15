/**
 * Loading Component - Root Level
 *
 * Affiché pendant le chargement initial des pages racine.
 * Durée minimale de 15 secondes pour une expérience visuelle professionnelle.
 */

'use client';

import { MinDurationScreen } from '@/components/loading/MinDurationScreen';

export default function Loading() {
  return (
    <MinDurationScreen ready={false} />
  );
}
