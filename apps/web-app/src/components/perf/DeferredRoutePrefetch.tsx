/**
 * ============================================================================
 * DeferredRoutePrefetch — préchargement différé des top-modules du rôle
 * ============================================================================
 *
 * ⭐ PERFORMANCE (chantier GTMetrix — spéc. §3 « Découpage du code par rôle »)
 *
 * Constat : les sidebars utilisent des <Link> Next.js. En production, App
 * Router précharge par défaut les segments de route de TOUS les liens visibles
 * → au premier rendu d'un dashboard, le navigateur télécharge les chunks JS
 * de TOUS les modules de la sidebar (finance, RH, pédagogie, cantine…),
 * même ceux que le rôle n'utilisera jamais. Budget GTMetrix explosé
 * (< 2 Mo / < 50 requêtes par vue).
 *
 * Correctif en deux volets :
 *   1. `prefetch={false}` sur les <Link> des 4 shells (AdminPortalShell,
 *      PilotageSidebar, teacher/layout, parent/layout) → 0 chunk module
 *      au premier écran.
 *   2. CE COMPOSANT : une fois le premier écran rendu et le thread principal
 *      au repos (requestIdleCallback), on précharge en arrière-plan les
 *      2-3 routes les plus utilisées du rôle connecté — conformément à la
 *      spec : « charger le reste en arrière-plan une fois l'écran initial
 *      rendu (préchargement différé), pas au chargement initial ».
 *
 * Notes :
 * - router.prefetch() est un no-op si la route est déjà en cache client.
 * - Le préchargement n'attend AUCUNE donnée réseau : seuls les segments
 *   statiques (chunks + RSC shell) sont récupérés, jamais les réponses API.
 * - Idempotent et silencieux : aucune erreur remontée si une route n'existe
 *   pas pour le rôle (le prefetch d'une route non autorisée ne télécharge
 *   que son shell de redirection).
 * ============================================================================
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Filet de secours si requestIdleCallback n'est pas disponible (ms). */
const FALLBACK_DELAY_MS = 5000;

/**
 * Top-modules par rôle (max 3 — le reste se charge au clic, ~300-600 ms).
 * Les rôles non listés n'ont pas de prefetch différé (comportement neutre).
 */
const ROLE_TOP_ROUTES: Record<string, string[]> = {
  // Direction
  DIRECTOR: ['/app/students', '/app/finance', '/app/pedagogy'],
  DIRECTEUR: ['/app/students', '/app/finance', '/app/pedagogy'],
  SUPER_DIRECTOR: ['/app/students', '/app/finance', '/app/pedagogy'],
  // Secrétariat
  SECRETAIRE: ['/app/students', '/app/communication', '/app/finance'],
  // Comptabilité
  COMPTABLE: ['/app/finance', '/app/students'],
  ACCOUNTANT: ['/app/finance', '/app/students'],
  SECRETAIRE_COMPTABLE: ['/app/finance', '/app/students'],
  // Vie scolaire
  SURVEILLANT: ['/app/pedagogy', '/app/students'],
  CENSEUR: ['/app/pedagogy', '/app/exams'],
  // Promoteur & administration
  PROMOTER: ['/app/finance', '/app/students', '/app/hr'],
  PROMOTEUR: ['/app/finance', '/app/students', '/app/hr'],
  ADMIN: ['/app/students', '/app/finance', '/app/pedagogy'],
  // Portails dédiés
  TEACHER: ['/app/teacher/pedagogy', '/app/teacher/timetable'],
  ENSEIGNANT: ['/app/teacher/pedagogy', '/app/teacher/timetable'],
  PARENT: ['/app/parent/notes', '/app/parent/finance'],
};

export function DeferredRoutePrefetch({ role }: { role?: string }) {
  const router = useRouter();

  useEffect(() => {
    const routes = (role && ROLE_TOP_ROUTES[role]) || [];
    if (routes.length === 0) return;

    let cancelled = false;
    const prefetchRoutes = () => {
      if (cancelled) return;
      // Séquencé (et non boucle for-await) : chaque prefetch reste léger,
      // le thread principal n'est jamais bloqué plus de quelques ms.
      routes.forEach((route, i) => {
        setTimeout(() => {
          if (!cancelled) {
            try {
              router.prefetch(route);
            } catch {
              /* silencieux — route inconnue du rôle : no-op */
            }
          }
        }, i * 400);
      });
    };

    const ric = typeof window !== 'undefined'
      ? (window as Window & typeof globalThis).requestIdleCallback
      : undefined;

    let handle: number | ReturnType<typeof setTimeout> | undefined;
    if (typeof ric === 'function') {
      handle = ric(prefetchRoutes, { timeout: FALLBACK_DELAY_MS });
    } else {
      handle = setTimeout(prefetchRoutes, FALLBACK_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (typeof handle === 'number' && typeof window !== 'undefined') {
        const cic = (window as Window & typeof globalThis).cancelIdleCallback;
        if (typeof cic === 'function') cic(handle);
      } else if (handle !== undefined) {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
    };
  }, [role, router]);

  return null;
}

export default DeferredRoutePrefetch;
