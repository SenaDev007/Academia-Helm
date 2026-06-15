/**
 * ============================================================================
 * LOADING STATE - ÉTAT DE CHARGEMENT POUR LES PAGES APP
 * ============================================================================
 * 
 * ✅ Loading state global pour toutes les pages de l'application
 * Utilisé automatiquement par Next.js lors de la navigation
 */

import { LoadingState } from '@/components/ui/feedback/LoadingState';

export default function AppLoading() {
  return <LoadingState message="Chargement de la page..." fullScreen />;
}
