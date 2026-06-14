/**
 * ============================================================================
 * USE SCHOOLS MAP — HOOK DE RÉCUPÉRATION DES ÉCOLES INSCRITES POUR LA CARTE
 * ============================================================================
 *
 * Hook React qui récupère la liste des écoles inscrites sur Academia Helm
 * depuis /api/public/schools/list et les positionne sur la carte SVG du Bénin.
 *
 * Chaque école est géolocalisée via son champ `city` → BENIN_CITIES.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { BENIN_CITIES, findCityCoord, type CityCoord } from '@/data/benin-cities';

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
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSchools() {
      try {
        setLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        // Essayer d'abord l'endpoint with-jobs (plus riche en données)
        let res = await fetch('/api/public/schools/with-jobs', {
          signal: controller.signal,
        });

        if (!res.ok) {
          // Fallback vers l'endpoint list
          res = await fetch('/api/public/schools/list', {
            signal: controller.signal,
          });
        }

        if (!res.ok) {
          // Dernier fallback : search
          const fallbackRes = await fetch('/api/public/schools/search?q=aa', {
            signal: AbortSignal.timeout(10000),
          });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            if (!cancelled) {
              const list = Array.isArray(data) ? data : data.schools || [];
              setSchools(list);
            }
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        clearTimeout(timeoutId);
        const data = await res.json();
        if (!cancelled) {
          const list = Array.isArray(data) ? data : data.schools || [];
          setSchools(list);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('[useSchoolsMap] Erreur:', err.message);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSchools();
    return () => { cancelled = true; };
  }, []);

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
        name: school.schoolName || school.name,
        slug: school.slug || school.subdomain || '',
        city: school.city || null,
        schoolType: school.schoolType || null,
        logoUrl: school.logoUrl || null,
        subdomain: school.subdomain || null,
        phone: school.phonePrimary || school.primaryPhone || null,
        email: school.primaryEmail || school.email || null,
        address: school.address || null,
        slogan: school.slogan || null,
        schoolAcronym: school.schoolAcronym || school.abbreviation || null,
        website: school.website || null,
        department: school.department || null,
        x: coord.x + offsetX,
        y: coord.y + offsetY,
        deptCode: coord.dept,
      });
    }

    return result;
  }, [schools]);

  return { pins, loading, error, totalSchools: schools.length };
}
