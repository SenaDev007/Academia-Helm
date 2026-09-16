"use client";

/**
 * Hook pour récupérer l'identité de l'école (nom, logo, contact)
 * depuis l'API /api/settings/identity.
 *
 * ⭐ Task 73 (2026-09-17 — lenteurs UI admin) : CACHE LOCAL instantané.
 * AVANT : fetch à CHAQUE montage → la réponse pèse ~218 KB (logo base64)
 * → ~1-1,4 s en production, en concurrence avec les requêtes critiques
 * (sélecteur de niveau, KPI) — la sidebar affichait le nom/logo de l'école
 * en retard. Le promoteur (PilotageLayout, useSchoolIdentity partagé) subissait
 * le même ralentissement.
 * APRÈS : lecture SYNCHRONE du cache localStorage au premier rendu
 * (affichage immédiat du nom/logo), puis revalidation réseau en arrière-plan
 * (stale-while-revalidate) — TTL 12 h, purge à la déconnexion via l'événement
 * 'user-context-reset'. L'identité d'une école (nom, logo, téléphone) change
 * rarement : un cache d'une demi-journée est sans risque.
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

/** Clé de cache localStorage (une seule identité par sous-domaine/onglet). */
const CACHE_KEY = "ah_school_identity_cache";
/** TTL du cache : 12 h (l'identité change rarement). */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface CachedIdentity {
  data: SchoolIdentity;
  ts: number;
}

function readCache(): SchoolIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIdentity;
    if (!parsed?.data || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: SchoolIdentity): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() } as CachedIdentity));
  } catch {
    /* quota — non bloquant */
  }
}

export function useSchoolIdentity() {
  // ⭐ Premier rendu : cache instantané (null si absent/expiré)
  const [identity, setIdentity] = useState<SchoolIdentity | null>(() => readCache());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/identity", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const next: SchoolIdentity = {
          schoolName: data.schoolName || "",
          schoolAcronym: data.schoolAcronym,
          logoUrl: data.logoUrl,
          phone: data.phone,
          email: data.email,
          address: data.address,
          website: data.website,
        };
        setIdentity(next);
        // ⭐ Mise à jour du cache (revalidation) — le prochain montage sera
        //    instantané même si cette requête a pris 1 s.
        writeCache(next);
      }
    } catch {
      // Réseau indisponible : on GARDE le cache éventuel (déjà dans l'état)
      setIdentity((prev) => prev);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ⭐ Purge du cache à la déconnexion / reset de contexte utilisateur
  useEffect(() => {
    const onReset = () => {
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    };
    window.addEventListener("user-context-reset", onReset);
    return () => {
      window.removeEventListener("user-context-reset", onReset);
    };
  }, []);

  return { identity, loading };
}
