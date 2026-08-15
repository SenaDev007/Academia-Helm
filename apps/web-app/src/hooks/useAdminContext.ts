/**
 * ============================================================================
 * USE ADMIN CONTEXT — Hook pour le contexte administratif de l'utilisateur
 * ============================================================================
 *
 * Récupère le rôle admin + les niveaux scolaires de l'utilisateur connecté
 * depuis /api/staff-admin-assignments/my-context.
 *
 * Utilisé pour :
 *   1. Filtrer la sidebar (modules visibles selon le rôle)
 *   2. Filtrer TOUTES les données par niveau scolaire strict
 *   3. Adapter le dashboard selon le rôle
 *
 * Le contexte est mis en cache dans localStorage pour éviter un fetch
 * à chaque rendu. Il est invalideé au logout.
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AdminContext {
  adminRole: string | null;
  schoolLevelCodes: string[];  // ex: ['SECONDAIRE']
  schoolLevelIds: string[];    // UUIDs pour filtrer les requêtes
  staffId: string | null;
  assignments: Array<{
    id: string;
    adminRole: string;
    schoolLevelCode: string;
    functionLabel?: string;
  }>;
}

const STORAGE_KEY = 'admin_context';
const FETCH_URL = '/api/staff-admin-assignments/my-context';

function readCachedContext(): AdminContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCachedContext(ctx: AdminContext | null) {
  if (typeof window === 'undefined') return;
  try {
    if (ctx) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function useAdminContext() {
  const [context, setContext] = useState<AdminContext | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(FETCH_URL, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        // Si 401, on garde le cache
        const cached = readCachedContext();
        setContext(cached);
        return;
      }
      const data = await res.json();
      const ctx: AdminContext = {
        adminRole: data.adminRole || null,
        schoolLevelCodes: data.schoolLevelCodes || [],
        schoolLevelIds: data.schoolLevelIds || [],
        staffId: data.staffId || null,
        assignments: data.assignments || [],
      };
      writeCachedContext(ctx);
      setContext(ctx);
    } catch {
      // Erreur réseau — utiliser le cache
      const cached = readCachedContext();
      setContext(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // D'abord lire le cache pour un affichage instantané
    const cached = readCachedContext();
    if (cached) {
      setContext(cached);
      setLoading(false);
    }
    // Puis fetch pour avoir les données fraîches
    refresh();
  }, [refresh]);

  return { context, loading, refresh };
}

/**
 * Helper : vérifie si l'utilisateur a accès à un module donné.
 */
export function hasModuleAccess(
  context: AdminContext | null,
  module: string
): boolean {
  if (!context) return true; // Pas encore chargé → ne pas bloquer

  // Le promoteur a accès à tout
  if (context.adminRole === 'PROMOTER' || context.schoolLevelCodes.length === 0) {
    return true; // Pas d'affectation admin = probablement promoteur
  }

  // Importer dynamiquement les permissions (évite le cycle de dépendances)
  // Pour l'instant, on fait une vérification simple basée sur le rôle
  const ROLE_MODULES: Record<string, string[]> = {
    DIRECTEUR: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline'],
    PROVISEUR: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline'],
    DIRECTEUR_ADJOINT: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline'],
    CENSEUR: ['dashboard', 'pedagogy', 'exams', 'discipline', 'censeur'],
    SURVEILLANT_GENERAL: ['dashboard', 'students', 'discipline'],
    SURVEILLANT: ['dashboard', 'students', 'discipline'],
    SECRETAIRE: ['dashboard', 'students', 'exams'],
    COMPTABLE: ['dashboard', 'finance'],
    SECRETAIRE_COMPTABLE: ['dashboard', 'students', 'finance', 'exams'],
    ECONOME: ['dashboard', 'finance'],
    INTENDANT: ['dashboard', 'finance'],
    RESP_SCOLARITE: ['dashboard', 'students'],
    CONSEILLER_PEDAGOGIQUE: ['dashboard', 'pedagogy', 'exams'],
    DIRECTEUR_DES_ETUDES: ['dashboard', 'pedagogy', 'exams', 'students'],
    RESPONSABLE_ORIENTATIONS: ['dashboard', 'students'],
  };

  const allowedModules = ROLE_MODULES[context.adminRole || ''] || ['dashboard'];
  return allowedModules.includes(module) || allowedModules.includes('*');
}

/**
 * Helper : retourne les schoolLevelIds pour filtrer les requêtes API.
 * Si vide, l'utilisateur a accès à tous les niveaux (promoteur).
 */
export function getSchoolLevelFilter(context: AdminContext | null): string[] | null {
  if (!context) return null;
  if (context.schoolLevelIds.length === 0) return null; // Pas de filtre = tous
  return context.schoolLevelIds;
}

/**
 * Clear le cache au logout.
 */
export function clearAdminContext() {
  writeCachedContext(null);
}
