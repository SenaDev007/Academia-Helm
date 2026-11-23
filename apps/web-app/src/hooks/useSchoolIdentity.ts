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

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSecondaryIdentity } from "@/services/settings.service";

export interface SchoolIdentity {
  schoolName: string;
  schoolAcronym?: string;
  slogan?: string;
  logoUrl?: string;
  phone?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  postalCode?: string;
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
        // ⭐ 2026-11-23 — MAPPING COMPLET (module Paramètres → onglet Identité) :
        //    AVANT, `phone: data.phone` lisait une clé INEXISTANTE (le backend
        //    renvoie phonePrimary/phoneSecondary) → même la ligne « Tél : » de
        //    l'en-tête des bulletins était vide ; email/whatsapp/site/ville/
        //    département/slogan n'étaient pas mappés du tout. Désormais TOUTE
        //    l'identité (contacts, localisation, branding) est exposée aux
        //    interfaces qui l'affichent avant les tableaux (Registre des notes,
        //    Bulletins).
        const next: SchoolIdentity = {
          schoolName: data.schoolName || "",
          schoolAcronym: data.schoolAcronym,
          slogan: data.slogan,
          logoUrl: data.logoUrl,
          phone: data.phonePrimary || data.phoneSecondary || data.phone,
          phonePrimary: data.phonePrimary,
          phoneSecondary: data.phoneSecondary,
          whatsapp: data.whatsapp,
          email: data.email,
          address: data.address,
          city: data.city,
          department: data.department,
          country: data.country,
          postalCode: data.postalCode,
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

/**
 * ⭐ 2026-11-23 — IDENTITÉ DE L'ÉCOLE RÉSOLUE PAR NIVEAU (module Examen).
 *
 * Exige promoteur : « quand il s'agit de la maternelle et du primaire, ce sont
 * les informations de l'école maternel-primaire dans les informations PAR DÉFAUT
 * de l'école qui s'affichent, et quand il s'agit du secondaire, ce sont les
 * informations du secondaire comme défini dans l'onglet identité module
 * paramètres. »
 *
 *   - Maternelle / Primaire → profil GLOBAL (identité par défaut) ;
 *   - Secondaire           → profil « Identité école secondaire » (Paramètres →
 *     Identité) fusionné champ à champ (chaque champ non vide du profil
 *     secondaire remplace le champ global).
 *
 * Partagé entre l'onglet Bulletins et l'onglet Registre des notes (module
 * Examen) — même résolution d'identité pour les deux interfaces.
 */
export function useSchoolIdentityForLevel(
  levelCode?: string | null,
  tenantId?: string | null,
) {
  const { identity: baseIdentity, loading } = useSchoolIdentity();
  const isSecondaire = levelCode === "SECONDAIRE" || levelCode === "SECONDARY" || levelCode === "SEC";

  const [secondaryProfile, setSecondaryProfile] = useState<any | null>(null);
  useEffect(() => {
    if (!isSecondaire) {
      setSecondaryProfile(null);
      return;
    }
    let cancelled = false;
    getSecondaryIdentity(tenantId ?? undefined)
      .then((res: any) => {
        if (!cancelled) {
          setSecondaryProfile(res?.configured && res?.profile ? res.profile : null);
        }
      })
      .catch(() => {
        if (!cancelled) setSecondaryProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isSecondaire, tenantId]);

  const identity = useMemo(() => {
    const sec = secondaryProfile;
    if (!isSecondaire || !sec || !baseIdentity) return baseIdentity;
    const merged: any = { ...baseIdentity };
    if (sec.schoolName) merged.schoolName = sec.schoolName;
    if (sec.schoolAcronym) merged.schoolAcronym = sec.schoolAcronym;
    if (sec.slogan) merged.slogan = sec.slogan;
    if (sec.logoUrl) merged.logoUrl = sec.logoUrl;
    if (sec.address) merged.address = sec.address;
    if (sec.city) merged.city = sec.city;
    if (sec.department) merged.department = sec.department;
    if (sec.phonePrimary) {
      merged.phonePrimary = sec.phonePrimary;
      merged.phone = sec.phonePrimary;
    }
    if (sec.phoneSecondary) merged.phoneSecondary = sec.phoneSecondary;
    if (sec.whatsapp) merged.whatsapp = sec.whatsapp;
    if (sec.email) merged.email = sec.email;
    if (sec.website) merged.website = sec.website;
    return merged as SchoolIdentity;
  }, [baseIdentity, isSecondaire, secondaryProfile]);

  return {
    identity,
    baseIdentity,
    loading,
    secondaryApplied: isSecondaire && !!secondaryProfile,
  };
}
