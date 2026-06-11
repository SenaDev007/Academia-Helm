/**
 * Loading State - État de chargement subtil pour les transitions de pages App
 * 
 * Utilisé automatiquement par Next.js lors de la navigation entre pages.
 * Affiche un indicateur de chargement INLINE (pas plein écran) pour éviter
 * les flashs blancs disruptifs lors de chaque clic sur un module/onglet.
 */

import { Loader2 } from 'lucide-react';

export default function AppLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 text-blue-600 animate-spin mr-2" />
      <span className="text-sm text-gray-500">Chargement…</span>
    </div>
  );
}
