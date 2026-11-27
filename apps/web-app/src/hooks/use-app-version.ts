'use client';

/**
 * ============================================================================
 * useAppVersion — version applicative DYNAMIQUE pour les footers (2026-11-27)
 * ============================================================================
 *
 * Affiche instantanément la version bundlée au build (identique serveur/client
 * → aucun mismatch d'hydratation), puis la remplace après montage par la
 * dernière version connue : cache localStorage (< 1 h, sans requête) ou
 * GET /health de l'API (version réellement déployée + commit Railway).
 *
 * - Aucun état de chargement visible (pas de « v… » qui clignote).
 * - Aucune requête réseau si le cache de moins d'1 h est valide.
 * - SSR-safe par construction.
 *
 * Usage :
 *   const { version, commit, source } = useAppVersion();
 *   // → « v1.0.58 » dans le footer, automatique à chaque livraison.
 */

import { useEffect, useState } from 'react';
import {
  BUNDLED_APP_VERSION,
  fetchAppVersion,
  type AppVersionInfo,
} from '@/lib/app-version';

export function useAppVersion(): AppVersionInfo {
  // Premier rendu (serveur ET client) : version bundlée — jamais localStorage
  // ici, sinon le HTML serveur ≠ premier rendu client → mismatch d'hydratation.
  const [info, setInfo] = useState<AppVersionInfo>({
    version: BUNDLED_APP_VERSION,
    source: 'bundled',
  });

  useEffect(() => {
    let cancelled = false;
    const revalidate = async () => {
      try {
        const fresh = await fetchAppVersion();
        if (!cancelled && fresh?.version) setInfo(fresh);
      } catch {
        // Silencieux : la version bundlée reste affichée.
      }
    };
    void revalidate();
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
