"use client";

/**
 * Hook pour récupérer l'identité de l'école (nom, logo, contact)
 * depuis l'API /api/settings/identity.
 *
 * ⭐ FIX PERFORMANCE CONCURRENCE — cache module-level 5 min + dédup en vol :
 *    ce hook était monté dans le layout ET la page du dashboard enseignant
 *    (2× par onglet) + SettingsBootstrapPrefetch + PilotageTopBar (+ sur
 *    chaque événement 'online'). Avec 20 utilisateurs = rafales de fetchs
 *    identiques. Le cache partagé ramène ça à 1 fetch par onglet / 5 min.
 */

import { useState, useEffect, useCallback } from "react";

export interface SchoolIdentity {
  schoolName: string;
  schoolAcronym?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
}

const IDENTITY_CACHE_TTL_MS = 5 * 60 * 1000;
let identityCache: { value: SchoolIdentity | null; expiresAt: number } | null = null;
let identityInFlight: Promise<SchoolIdentity | null> | null = null;

/** Fetch partagé (tous les montages du hook attendent la MÊME promesse). */
async function fetchSchoolIdentity(): Promise<SchoolIdentity | null> {
  if (identityCache && identityCache.expiresAt > Date.now()) {
    return identityCache.value;
  }
  if (identityInFlight) {
    return identityInFlight;
  }
  const request = (async () => {
    try {
      const res = await fetch("/api/settings/identity", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const value: SchoolIdentity = {
          schoolName: data.schoolName || "",
          schoolAcronym: data.schoolAcronym,
          logoUrl: data.logoUrl,
          phone: data.phone,
          email: data.email,
          address: data.address,
          website: data.website,
        };
        identityCache = { value, expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS };
        return value;
      }
    } catch {
      // silencieux
    }
    return null;
  })();
  identityInFlight = request;
  try {
    return await request;
  } finally {
    identityInFlight = null;
  }
}

export function useSchoolIdentity() {
  const [identity, setIdentity] = useState<SchoolIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const value = await fetchSchoolIdentity();
    setIdentity(value);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { identity, loading };
}
