/**
 * ============================================================================
 * USER SCOPE (frontend) — périmètre Rôles × Pistes × Niveaux
 * ============================================================================
 * ⭐ P4 du filtre intelligent. Le scope est résolu CÔTÉ SERVEUR (AccessScopeService)
 *    depuis les profils métier (Teacher/Staff/affectations) et exposé :
 *    - dans la réponse du login (enseignant : `scope`)
 *    - dans /context/bootstrap (`scope`)
 *    Le frontend le persiste ici (localStorage) et s'en sert pour piloter :
 *    - la langue UI (mono-piste EN → interface en anglais)
 *    - la piste courante (BilingualContext)
 *    - les sélecteurs de niveau verrouillés (mono-niveau)
 *
 * ⚠️ Le scope frontend n'est qu'une optimisation d'UX : l'ENFORCEMENT réel
 *    est serveur (AccessScopeGuard + scope-where.ts). Une falsification du
 *    localStorage ne donne accès à rien.
 * ============================================================================
 */

export interface UserScope {
  levelCodes?: string[];
  levelIds?: string[];
  allLevels?: boolean;
  trackCodes?: string[];
  allTracks?: boolean;
  locale?: 'fr' | 'en';
  teacherId?: string | null;
  staffId?: string | null;
  isTeacher?: boolean;
  classIds?: string[] | null;
}

const SCOPE_KEY = 'user_scope';

/**
 * Lit le scope persistant (localStorage) — null si absent.
 * Sources essayées dans l'ordre : clé dédiée `user_scope`, puis
 * session.user.scope (si le post-login l'y a stocké).
 */
export function getUserScope(): UserScope | null {
  if (typeof window === 'undefined') return null;
  try {
    const direct = localStorage.getItem(SCOPE_KEY);
    if (direct) {
      const parsed = JSON.parse(direct);
      if (parsed && typeof parsed === 'object') return parsed as UserScope;
    }
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      const scope = parsed?.user?.scope ?? parsed?.scope;
      if (scope && typeof scope === 'object') return scope as UserScope;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Persiste le scope (appelé après login / context bootstrap). */
export function persistUserScope(scope: UserScope | null | undefined): void {
  if (typeof window === 'undefined' || !scope) return;
  try {
    localStorage.setItem(SCOPE_KEY, JSON.stringify(scope));
    // ⭐ P4-bis : notifier les contexts montés (I18nContext, BilingualContext…)
    //    Le scope arrive de façon ASYNCHRONE (login → redirection → bootstrap
    //    TenantContext) — les providers ont souvent déjà été montés avec la
    //    locale de repli. Sans cet événement, la langue du profil n'était
    //    jamais appliquée pour les comptes du portail école (directeurs).
    window.dispatchEvent(new CustomEvent('user-scope-loaded', { detail: scope }));
  } catch {
    /* ignore quota errors */
  }
}

/** Purge le scope (logout). */
export function clearUserScope(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SCOPE_KEY);
  } catch {
    /* ignore */
  }
}

/** Vrai si l'utilisateur est mono-piste (UI verrouillée sur SA piste). */
export function isMonoTrack(scope: UserScope | null): boolean {
  if (!scope) return false;
  if (scope.allTracks) return false;
  return Array.isArray(scope.trackCodes) && scope.trackCodes.length === 1;
}

/** La seule piste autorisée ('FR' | 'EN') — null si bi-piste/inconnu. */
export function getOnlyTrack(scope: UserScope | null): 'FR' | 'EN' | null {
  if (!isMonoTrack(scope)) return null;
  return scope!.trackCodes![0] === 'EN' ? 'EN' : 'FR';
}
