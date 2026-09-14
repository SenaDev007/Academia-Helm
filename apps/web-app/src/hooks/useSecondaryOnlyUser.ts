'use client';

/**
 * ============================================================================
 * USE SECONDARY ONLY USER — l'utilisateur est-il restreint au SEUL secondaire ?
 * ============================================================================
 *
 * ⭐ 2026-09-15 — Filtrage par niveau scolaire (retour utilisateur) :
 * certaines fonctionnalités sont réservées aux niveaux MATERNELLE + PRIMAIRE
 * (Planification annuelle CI-CM2 + Maternelle, cahier journal, fiches
 * pédagogiques, cahier du semainier…). Un utilisateur dont TOUT le périmètre
 * est secondaire (directeur du secondaire, enseignant affecté au secondaire)
 * ne doit PAS les voir. Seul le promoteur (et les rôles plateforme) garde
 * accès à tout.
 *
 * Sources (réactives, dans l'ordre) :
 *   1. availableLevels du SchoolLevelContext — déjà pré-filtrées par le scope
 *      serveur (/api/school-levels fusionne settings + bootstrap) : un
 *      enseignant SECONDAIRE n'a QUE [SECONDAIRE], un directeur MAT_PRI a
 *      [Maternelle, Primaire] (+ option périmètre 'ALL' ignorée ici).
 *   2. Fallback synchrone : accréditations du user, puis scope localStorage
 *      (user_scope de /context/bootstrap) — pour les tout premiers rendus.
 *
 * ⚠️ L'ENFORCEMENT réel reste serveur (applyLevelScope / AccessScopeGuard) ;
 *    ce hook ne pilote que la VISIBILITÉ UI (onglets, raccourcis, sidebar).
 */

import { useAppSession } from '@/contexts/AppSessionContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { getUserScope } from '@/lib/auth/user-scope';

/** Rôles transverses : voient tout quel que soit le niveau (promoteur…). */
const GLOBAL_ACCESS_ROLES = new Set([
  'PROMOTER',
  'PROMOTEUR',
  'PLATFORM_OWNER',
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'SCHOOL_OWNER',
  'SCHOOL_ADMIN',
  'SUPER_DIRECTOR',
  'DIRECTOR_GENERAL',
  'DIRECTEUR_GENERAL',
]);

const SECONDARY_PATTERN = /SECOND|COLLEGE|LYCEE/i;

function codesAreAllSecondary(codes: string[]): boolean {
  return codes.length > 0 && codes.every((c) => SECONDARY_PATTERN.test(String(c)));
}

export function useSecondaryOnlyUser(): boolean {
  const { user } = useAppSession();
  const { availableLevels, isLoading } = useSchoolLevel();

  const role = (user?.role || '').toUpperCase();
  if (GLOBAL_ACCESS_ROLES.has(role)) return false;

  // 1. Source réactive : les niveaux proposés au user (déjà scopés serveur).
  //    On ignore l'option virtuelle 'ALL' (« Tous les niveaux » / « Mon
    //    périmètre ») : elle ne représente pas un niveau réel.
  if (!isLoading && Array.isArray(availableLevels)) {
    const realLevels = availableLevels.filter((l) => l && l.id !== 'ALL');
    if (realLevels.length > 0) {
      return realLevels.every((l) => SECONDARY_PATTERN.test(l.code || ''));
    }
  }

  // 2. Fallback synchrone (premiers rendus / contexte en cours de chargement)
  const accreditations = (user as any)?.accreditations as string[] | undefined;
  if (Array.isArray(accreditations) && accreditations.length > 0) {
    return codesAreAllSecondary(accreditations.map(String));
  }
  const scope = getUserScope();
  if (scope && scope.allLevels === false && Array.isArray(scope.levelCodes)) {
    return codesAreAllSecondary(scope.levelCodes);
  }
  return false;
}
