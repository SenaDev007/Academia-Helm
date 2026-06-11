/**
 * Loading State - App Shell
 *
 * Affiché pendant les transitions de pages dans l'espace app.
 * Durée minimale de 15 secondes pour une expérience visuelle professionnelle.
 */

'use client';

import { MinDurationScreen } from '@/components/loading/MinDurationScreen';

export default function AppLoading() {
  return (
    <MinDurationScreen ready={false} variant="default" />
  );
}
