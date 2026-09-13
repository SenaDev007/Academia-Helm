/**
 * Contexte partagé pour l'année scolaire courante.
 * Un seul état pour le sélecteur (header), la sidebar et tout le contenu.
 * Au changement d'année, toute l'app affiche les données de l'année sélectionnée.
 *
 * COMPORTEMENT "ANNÉE STRICTE" :
 * - Quand l'utilisateur bascule vers une autre année, on invalide TOUTES les
 *   queries TanStack pour forcer le rechargement avec la nouvelle année.
 * - On dispatch aussi un CustomEvent 'academic-year-changed' pour informer
 *   les composants hors React (services, hooks personnalisés, etc.).
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAppSession } from '@/contexts/AppSessionContext';
import { academicYearsKeys } from '@/lib/query/academic-years-keys';
import { fetchAcademicYearsSnapshot, readAcademicYearsSnapshot } from '@/lib/query/academic-years-fetch';
import { invalidateApiCache } from '@/lib/api/get-cache';
import type { AcademicYear } from '@/types/academic-year';

export type { AcademicYear };

/**
 * Nom du CustomEvent dispatch quand l'année scolaire change.
 * Permet aux composants hors React d'écouter le changement.
 */
export const ACADEMIC_YEAR_CHANGED_EVENT = 'academic-year-changed';

/**
 * Clés localStorage utilisées pour la persistance de l'année scolaire :
 * - STORAGE_KEY_ID ('currentAcademicYearId') : juste l'ID, lu par ce contexte
 *   pour restaurer la sélection utilisateur entre les rechargements.
 * - STORAGE_KEY_OBJ ('academicYear') : l'objet année JSON complet, lu par
 *   l'intercepteur Axios (`lib/api/client.ts`) pour injecter le header
 *   `x-academic-year-id` dans toutes les requêtes API sortantes.
 * - STORAGE_KEY_CHOICE ('academicYearUserChoice') : { chosenId, activeIdAtChoice }
 *   — le CHOIX EXPLICITE de l'utilisateur dans le sélecteur, avec l'ID de
 *   l'année active serveur AU MOMENT du choix. Tant que cette année active
 *   n'a pas changé, le choix utilisateur GAGNE sur l'année active (demande
 *   2026-09-09 : « quand on bascule vers une année précédente, toutes les
 *   données doivent se recharger pour cette année » — y compris après un
 *   refresh). Si l'admin active une NOUVELLE année côté serveur, elle gagne
 *   et le choix est nettoyé (bascule collective).
 *
 * Les DEUX premières clés doivent être écrites en parallèle pour éviter le
 * bug où l'intercepteur ne trouve pas l'année (header jamais injecté).
 */
const STORAGE_KEY_ID = 'currentAcademicYearId';
const STORAGE_KEY_OBJ = 'academicYear';
const STORAGE_KEY_CHOICE = 'academicYearUserChoice';

interface AcademicYearContextType {
  currentYear: AcademicYear | null;
  setCurrentYear: (yearId: string) => void;
  availableYears: AcademicYear[];
  /** ⭐ V19 : true tant qu'on n'a PAS encore de liste confirmation serveur —
   *  le sélecteur affiche « Chargement... » au lieu du warning rouge. */
  isLoading: boolean;
  /** ⭐ V19 : true si la liste est CONFIRMÉE vide par le serveur (≠ échec
   *  réseau en cours de retry) — seul ce cas affiche « Aucune année scolaire ». */
  isEmpty: boolean;
  /** ⭐ FIX 2026-09-14 : rechargement manuel (bouton « Réessayer » du
   *  sélecteur) — action immédiate au lieu d'attendre le refetchInterval. */
  retry: () => void;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  const urlTenantId = searchParams.get('tenant_id');
  const isPlatformOwner = user?.role === 'PLATFORM_OWNER';
  const effectiveTenantId =
    (isPlatformOwner || !tenant?.id ? urlTenantId || tenant?.id : tenant?.id) ?? undefined;
  const tenantKey = effectiveTenantId ?? 'no-tenant';

  const queryClient = useQueryClient();

  const {
    data: availableYears = [],
    isLoading,
    isFetching,
    isError,
    refetch: refetchYears,
  } = useQuery({
    queryKey: academicYearsKeys.snapshot(tenantKey),
    queryFn: () => fetchAcademicYearsSnapshot(effectiveTenantId),
    // ⭐ V19 — affichage INSTANTANÉ au login : le snapshot localStorage de la
    //    dernière session sert de données initiales pendant que le réseau
    //    répond (stale-while-revalidate). Plus de « Aucune année scolaire »
    //    pendant le chargement.
    initialData: () => readAcademicYearsSnapshot(tenantKey) ?? undefined,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // ⭐ keepPreviousData : si le fetch échoue (connexion instable), on garde
    //    les données précédentes au lieu de les remplacer par [].
    //    Sans ça, une micro-coupure réseau → availableYears=[] → l'effet
    //    ci-dessous clear le currentYear + localStorage → l'utilisateur
    //    perd son année scolaire et ne peut plus utiliser l'app.
    placeholderData: keepPreviousData,
    // ⭐ V19 — ROBUSTESSE : retry renforcé + rejouer tant que la liste est
    //    VIDE (une école a TOUJOURS au moins une année — un [] est un échec
    //    déguisé : 401 transitoire Railway, cold start Neon, 2G…).
    retry: 3,
    retryDelay: (attempt) => Math.min(1200 * 2 ** attempt, 5000),
    refetchInterval: (query) => {
      const list = query.state.data as AcademicYear[] | undefined;
      return Array.isArray(list) && list.length === 0 ? 5000 : false;
    },
    // ⭐ V19 — networkMode 'always' : la queryFn tourne AUSSI hors ligne →
    //    l'intercepteur offline sert le cache IndexedDB (response_cache) des
    //    années scolaires au lieu de mettre la query « en pause » (avant :
    //    offline → isLoading figé → sélecteur rouge).
    networkMode: 'always',
  });

  // ⭐ FIX 2026-09-14 : rechargement manuel exposé au sélecteur (bouton
  //    « Réessayer ») — React Query dédup si un fetch est déjà en cours.
  const retryYears = useCallback(() => {
    refetchYears();
  }, [refetchYears]);

  const [currentYear, setCurrentYearState] = useState<AcademicYear | null>(null);
  const availableYearsRef = useRef<AcademicYear[]>([]);
  availableYearsRef.current = availableYears;
  /** ID de la dernière année active serveur vue par cet effet — sert à
   *  détecter l'activation d'une NOUVELLE année (bascule collective) sans
   *  écraser le choix utilisateur lors d'un simple refetch. */
  const lastActiveYearIdRef = useRef<string | null>(null);

  /**
   * Invalide toutes les queries TanStack quand l'année scolaire change.
   * Cela force le rechargement des données de tous les modules avec la
   * nouvelle année (dashboard, students, finance, hr, exams, etc.).
   *
   * On préserve les queries liées aux années scolaires elles-mêmes
   * (academicYearsKeys) pour éviter une boucle de rechargement.
   *
   * ⭐ FIX 2026-09-09 (« bascule d'année globale ») : on purge AUSSI le cache
   * GET 45 s (get-cache.ts — utilisé par apiFetch ET financeFetch). Sans
   * ça, les endpoints appelés SANS academicYearId explicite dans l'URL
   * (qui dépendent du header x-academic-year-id / de l'année injectée
   * serveur) continuaient de servir les données de l'ANCIENNE année
   * jusqu'à 45 s après le switch — incohérent avec la demande
   * « toutes les données doivent se recharger pour l'année sélectionnée ».
   */
  const invalidateQueriesForYearChange = useCallback(() => {
    // Invalider toutes les queries sauf celles liées aux années scolaires
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return true;
        // Préserver les queries 'academic-years' (sinon boucle)
        const firstKey = String(key[0]);
        if (firstKey === 'academic-years') return false;
        return true;
      },
    });
    // ⭐ Purge du cache GET client (45 s) — les clés (GET:… / finance:…)
    // ne contiennent PAS l'année, il faut les vider pour éviter de servir
    // les données de l'ancienne année après le switch.
    invalidateApiCache();
  }, [queryClient]);

  useEffect(() => {
    if (!availableYears.length) {
      // ⭐ NE PAS clear l'année si on est en train de charger (isLoading/isFetching).
      return;
    }

    // ⭐ FIX 2026-09-09 (« le switch d'année ne tient pas ») :
    // AVANT : `selectedYear = activeYear ?? savedYear ?? …` — l'année ACTIVE
    // serveur écrasait la sélection utilisateur à CHAQUE re-exécution de cet
    // effet (refetch du snapshot des années après invalidation/reconnexion) →
    // l'utilisateur qui avait basculé sur 2025-2026 se retrouvait REMIS sur
    // 2026-2027 sans action de sa part → « les données ne se rechargent pas
    // pour l'année sélectionnée ».
    // APRÈS, dans l'ordre :
    //   1. Si l'année active serveur a CHANGÉ depuis le choix utilisateur
    //      (l'admin a activé une nouvelle année) → elle gagne, le choix est
    //      nettoyé (bascule collective).
    //   2. L'année courante EN MÉMOIRE, si toujours valide → conservée
    //      (jamais écrasée par un refetch silencieux).
    //   3. Le CHOIX utilisateur persisté (flag dédié), si toujours proposé.
    //   4. L'année active serveur (premier chargement sans choix).
    //   5. La première année disponible.

    const activeYear = availableYears.find((y) => y.isCurrent) ?? null;

    // 1. Changement d'année active serveur → nettoyer le choix utilisateur
    //    (bascule collective vers la nouvelle année activée).
    if (
      lastActiveYearIdRef.current &&
      activeYear &&
      lastActiveYearIdRef.current !== activeYear.id
    ) {
      try { localStorage.removeItem(STORAGE_KEY_CHOICE); } catch { /* ignore */ }
    }
    lastActiveYearIdRef.current = activeYear?.id ?? null;

    // 2. Année courante en mémoire toujours valide → la conserver (sync de
    //    l'objet si le label a changé côté serveur, sans changer l'ID).
    if (currentYear && availableYears.some((y) => y.id === currentYear.id)) {
      const synced = availableYears.find((y) => y.id === currentYear.id) ?? currentYear;
      if (synced !== currentYear) setCurrentYearState(synced);
      return;
    }

    // 3. Choix utilisateur persisté (tant que l'année est encore proposée)
    let userChoice: { chosenId?: string; activeIdAtChoice?: string } | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CHOICE);
        if (raw) userChoice = JSON.parse(raw);
      } catch { /* ignore */ }
    }
    const chosenYear = userChoice?.chosenId
      ? availableYears.find((y) => y.id === userChoice.chosenId) ?? null
      : null;

    // 4-5. Choix utilisateur → sinon année active → sinon 1re année
    const selectedYear = chosenYear ?? activeYear ?? availableYears[0] ?? null;

    if (selectedYear) {
      const previousYearId = currentYear?.id;
      setCurrentYearState(selectedYear);

      // ⭐ TOUJOURS écrire dans localStorage, même si l'année n'a pas changé.
      //    Cela garantit que si le localStorage était stale (ancienne année),
      //    il est mis à jour avec l'année sélectionnée.
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ID, selectedYear.id);
        try {
          localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(selectedYear));
        } catch {
          /* ignore quota errors */
        }
      }

      // Si l'année a changé (pas juste le premier chargement), invalider les queries
      if (previousYearId && previousYearId !== selectedYear.id) {
        invalidateQueriesForYearChange();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(ACADEMIC_YEAR_CHANGED_EVENT, {
              detail: { previousYearId, newYearId: selectedYear.id },
            }),
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableYears, isLoading]);

  const setCurrentYear = useCallback((yearId: string) => {
    const years = availableYearsRef.current;
    const year = years.find((y) => y.id === yearId);
    if (year) {
      const previousYearId = currentYear?.id;
      setCurrentYearState(year);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ID, yearId);
        // Synchroniser aussi l'objet JSON complet pour l'intercepteur Axios
        try {
          localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(year));
        } catch {
          /* ignore quota errors */
        }
        // ⭐ FIX 2026-09-09 : persister le CHOIX EXPLICITE utilisateur avec
        //    l'année active serveur du moment. Tant que celle-ci ne change
        //    pas, le choix survit aux refresh/refetch (le sélecteur « tient ») ;
        //    si l'admin active une nouvelle année, le nettoyage ci-dessus
        //    (effet) restaure la priorité serveur.
        try {
          const activeIdAtChoice = years.find((y) => y.isCurrent)?.id ?? null;
          localStorage.setItem(
            STORAGE_KEY_CHOICE,
            JSON.stringify({ chosenId: yearId, activeIdAtChoice }),
          );
        } catch {
          /* ignore quota errors */
        }
      }
      // Si l'année a vraiment changé, invalider toutes les queries TanStack
      // pour forcer le rechargement avec la nouvelle année
      if (previousYearId !== yearId) {
        invalidateQueriesForYearChange();
        // Dispatcher un CustomEvent pour informer les composants hors React
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(ACADEMIC_YEAR_CHANGED_EVENT, {
              detail: { previousYearId, newYearId: yearId },
            }),
          );
        }
      }
    }
  }, [currentYear?.id, invalidateQueriesForYearChange]);

  // ⭐ V19 — « Chargement... » tant qu'on n'a PAS de confirmation serveur :
  //    (a) premier chargement en cours ; (b) refetch avec liste encore vide ;
  //    (c) erreur en cours de retry (une école a toujours ≥ 1 année — un []
  //    est un échec déguisé, PAS un état métier). Le warning rouge « Aucune
  //    année scolaire » n'apparaît que si la liste est confirmée vide.
  const loading =
    isLoading ||
    (isFetching && availableYears.length === 0) ||
    (isError && availableYears.length === 0);
  // ⭐ V19 : vide CONFIRMÉ (réponse serveur ok, liste réellement vide).
  const isEmptyConfirmed = !loading && availableYears.length === 0;

  const value = useMemo<AcademicYearContextType>(
    () => ({
      currentYear,
      setCurrentYear,
      availableYears,
      isLoading: loading,
      isEmpty: isEmptyConfirmed,
      retry: retryYears,
    }),
    [currentYear, setCurrentYear, availableYears, loading, isEmptyConfirmed, retryYears]
  );

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}

export function useAcademicYearContext(): AcademicYearContextType {
  const context = useContext(AcademicYearContext);
  if (context === undefined) {
    throw new Error('useAcademicYearContext must be used within AcademicYearProvider');
  }
  return context;
}

