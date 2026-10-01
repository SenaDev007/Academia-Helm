import { ReactNode } from 'react';

/**
 * Layout /federis (groupe patronat) — pass-through.
 *
 * ⭐ FIX « PAGE BLANCHE » AUX CHANGEMENTS DE MODULE (2026-09-30) :
 * ce layout pass-through existe UNIQUEMENT pour ancrer le loading.tsx du
 * même niveau (frontière Suspense partagée par TOUS les modules Federis).
 *
 * Avant : seuls certains modules disposaient d'un loading.tsx propre ; pour
 * les autres, la frontière la plus proche était… loading.tsx à la RACINE
 * (AcademiaLoader plein écran) → l'application semblait disparaître à
 * chaque bascule entre modules.
 *
 * Maintenant : chaque module garde son loading.tsx dédié (frontière la plus
 * proche = prioritaire) et ce filet de sécurité attrape tout module présent
 * ou futur qui en serait dépourvu — plus JAMAIS de page blanche.
 */
export default function FederisGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
