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
  schoolLevelCodes: string[];
  schoolLevelIds: string[];
  staffId: string | null;
  extraModules: string[]; // Modules supplémentaires accordés par le promoteur
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
        extraModules: data.extraModules || [],
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

  // ⭐ (sept. 2026 — retour promoteur « au retour de la connexion, il faut
  //    recharger avant que les données ne se chargent ») : NetworkRecovery
  //    émet 'ah:network-restored' APRÈS une sonde de connectivité réussie —
  //    on rafraîchit alors le contexte admin (rôles/niveaux/accréditations)
  //    sans rechargement manuel de la page.
  useEffect(() => {
    const onNetworkRestored = () => refresh();
    window.addEventListener('ah:network-restored', onNetworkRestored);
    return () => window.removeEventListener('ah:network-restored', onNetworkRestored);
  }, [refresh]);

  return { context, loading, refresh };
}

/**
 * Rôles admin « promoteur » — accès complet, SANS restriction de niveau scolaire.
 * ⭐ 2026-09-17 — les DEUX orthographes coexistent en base selon la source
 *    (assignment adminRole='PROMOTEUR' français vs 'PROMOTER' anglais —
 *    cf. commit 5f71eb32e « Add 'PROMOTEUR' (French) to all role arrays »).
 *    Un check mono-orthographe a déjà fait disparaître TOUS les modules
 *    principaux de la sidebar du vrai promoteur (Task 76).
 */
const PROMOTER_ADMIN_ROLES = ['PROMOTER', 'PROMOTEUR'];

export function hasModuleAccess(
  context: AdminContext | null,
  module: string
): boolean {
  if (!context) return true; // Pas encore chargé → ne pas bloquer

  // Le promoteur a accès à tout (les deux orthographes)
  if (
    PROMOTER_ADMIN_ROLES.includes(context.adminRole || '') ||
    context.schoolLevelCodes.length === 0
  ) {
    return true; // Pas d'affectation admin = probablement promoteur
  }

  // ⭐ Vérifier les accréditations supplémentaires (modules accordés par le promoteur)
  if (context.extraModules && context.extraModules.includes(module)) {
    return true;
  }

  // Mapping rôle → modules de base
  const ROLE_MODULES: Record<string, string[]> = {
    // ⭐ Promoteur (les deux orthographes) : accès complet — filet de sécurité
    //    même si le check dédié ci-dessus évoluait.
    PROMOTER: ['*'],
    PROMOTEUR: ['*'],
    DIRECTEUR: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline', 'director'],
    PROVISEUR: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline', 'director'],
    DIRECTEUR_ADJOINT: ['dashboard', 'students', 'pedagogy', 'exams', 'discipline', 'director'],
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
    DIRECTEUR_DES_ETUDES: ['dashboard', 'pedagogy', 'exams', 'students', 'director'],
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
  // ⭐ Le promoteur n'est JAMAIS filtré par niveau scolaire (accès global à
  //    son école), même si son assignment porte un schoolLevelCode (ex: MAT_PRI).
  if (PROMOTER_ADMIN_ROLES.includes(context.adminRole || '')) return null;
  if (context.schoolLevelIds.length === 0) return null; // Pas de filtre = tous
  return context.schoolLevelIds;
}

/**
 * Clear le cache au logout.
 */
export function clearAdminContext() {
  writeCachedContext(null);
}
