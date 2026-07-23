/**
 * ============================================================================
 * USE SCHOOLS MAP — HOOK DE RÉCUPÉRATION DES ÉCOLES INSCRITES POUR LA CARTE
 * ============================================================================
 *
 * ⚠️ REFACTORED : utilise maintenant usePublicSchools() (React Query partagé).
 * Avant : fetch direct dans useEffect avec 15s timeout + 3 fallbacks en cascade.
 * Maintenant : partage le cache React Query avec SchoolSearch et useSchoolBranding.
 *
 * Chaque école est géolocalisée via son champ `city` → BENIN_CITIES.
 * ============================================================================
 */

'use client';

import { useMemo } from 'react';
import { BENIN_CITIES, findCityCoord } from '@/data/benin-cities';
import { usePublicSchools } from '@/lib/query/use-public-schools';

/* ── Types ───────────────────────────────────────────────────────────── */

export interface SchoolPin {
  /** ID de l'école */
  id: string;
  /** Nom de l'école */
  name: string;
  /** Slug pour l'URL */
  slug: string;
  /** Ville */
  city: string | null;
  /** Type d'école (PRIMAIRE, SECONDAIRE, MIXTE) */
  schoolType: string | null;
  /** Logo URL */
  logoUrl: string | null;
  /** Sous-domaine */
  subdomain: string | null;
  /** Téléphone principal */
  phone: string | null;
  /** Email principal */
  email: string | null;
  /** Adresse physique */
  address: string | null;
  /** Slogan / devise */
  slogan: string | null;
  /** Acronyme de l'école */
  schoolAcronym: string | null;
  /** Site web */
  website: string | null;
  /** Département */
  department: string | null;
  /** Coordonnées SVG sur la carte */
  x: number;
  y: number;
  /** Code département */
  deptCode: string;
}

/* ── Hook ────────────────────────────────────────────────────────────── */

export function useSchoolsMap() {
  // ⭐ Hook partagé — utilise le cache React Query.
  // endpoint='with-jobs' car la carte a besoin du nombre d'offres d'emploi.
  // Si l'endpoint with-jobs échoue, on fallback sur 'list' via un second hook.
  const {
    schools: schoolsWithJobs,
    isLoading: loadingJobs,
    error: errorJobs,
  } = usePublicSchools({ endpoint: 'with-jobs' });

  // Fallback : si with-jobs est vide, utiliser 'list'
  const {
    schools: schoolsList,
    isLoading: loadingList,
    error: errorList,
  } = usePublicSchools({
    endpoint: 'list',
    enabled: schoolsWithJobs.length === 0 && !loadingJobs,
  });

  const schools = schoolsWithJobs.length > 0 ? schoolsWithJobs : schoolsList;
  const isLoading = loadingJobs || (schoolsWithJobs.length === 0 && loadingList);
  const error = errorJobs && errorList ? errorJobs : null;

  /* ── Transformer les écoles en pins positionnés sur la carte ── */
  const pins: SchoolPin[] = useMemo(() => {
    const result: SchoolPin[] = [];

    // Grouper les écoles par position (même coordonnées SVG)
    const positionMap = new Map<string, number>();

    for (const school of schools) {
      const cityName = school.city || school.address || '';
      const coord = findCityCoord(cityName, undefined);
      if (!coord) continue; // École non localisable → ignorée

      // Clé de position pour détecter les chevauchements
      const posKey = `${coord.x},${coord.y}`;
      const overlapIdx = positionMap.get(posKey) || 0;
      positionMap.set(posKey, overlapIdx + 1);

      // Décalage spiral si plusieurs écoles au même endroit
      let offsetX = 0;
      let offsetY = 0;
      if (overlapIdx > 0) {
        const angle = (overlapIdx * 2.4) % (2 * Math.PI);
        const dist = 8 + overlapIdx * 3;
        offsetX = Math.round(Math.cos(angle) * dist * 10) / 10;
        offsetY = Math.round(Math.sin(angle) * dist * 10) / 10;
      }

      result.push({
        id: school.id,
        name: (school as any).schoolName || school.name,
        slug: school.slug || school.subdomain || '',
        city: school.city || null,
        schoolType: school.schoolType || null,
        logoUrl: school.logoUrl || null,
        subdomain: school.subdomain || null,
        phone: (school as any).phonePrimary || (school as any).primaryPhone || null,
        email: (school as any).primaryEmail || school.email || null,
        address: school.address || null,
        slogan: school.slogan || null,
        schoolAcronym: school.schoolAcronym || (school as any).abbreviation || null,
        website: school.website || null,
        department: school.department || null,
        x: coord.x + offsetX,
        y: coord.y + offsetY,
        deptCode: coord.dept,
      });
    }

    return result;
  }, [schools]);

  return { pins, loading: isLoading, error, totalSchools: schools.length };
}
