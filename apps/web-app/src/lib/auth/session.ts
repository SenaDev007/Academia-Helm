/**
 * Session Management - Server Side
 * 
 * Gestion sécurisée des sessions utilisateur (Server Components uniquement)
 */

import { cookies, headers } from 'next/headers';
import type { AuthSession, User, Tenant } from '@/types';

const SESSION_COOKIE = 'academia_session';
const TOKEN_COOKIE = 'academia_token';
/** Cookie non-httpOnly : lu côté client (axios, sync offline). Doit rester aligné avec la session. */
const TENANT_ID_COOKIE = 'x-tenant-id';


/**
 * Récupère la session depuis les cookies (Server Component)
 */
export async function getServerSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  
  if (!sessionCookie) return null;

  try {
    const session: AuthSession = JSON.parse(sessionCookie.value);
    
    // Vérifier l'expiration
    if (new Date(session.expiresAt) < new Date()) {
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error parsing session:', error);
    return null;
  }
}

/**
 * Récupère le token JWT depuis les cookies (Server Component)
 */
export async function getServerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE);
  return tokenCookie?.value || null;
}

/**
 * Définit la session (à utiliser côté serveur uniquement)
 * Note: Cette fonction doit être appelée dans un Server Action ou Route Handler
 *
 * ⭐ Multi-tenant isolation (Juillet 2026) :
 * Les cookies sont HOST-ONLY (pas de `domain` défini) pour que chaque
 * sous-domaine (ex: csp-mon-avenir-plus-ndali.academiahelm.bj) ait sa
 * propre session indépendante. Cela permet d'ouvrir 2 tenants différents
 * dans 2 onglets sans que l'un écrase la session de l'autre.
 * Trade-off : pas de SSO cross-tenant (l'utilisateur doit se reconnecter
 * par sous-domaine — c'est le comportement attendu pour des écoles
 * distinctes).
 */
export async function setServerSession(session: AuthSession): Promise<void> {
  const cookieStore = await cookies();

  // ⭐ Pas de `domain` → cookie host-only, scoped au sous-domaine exact.
  // Cela isole les sessions entre tenants (csp-mon-avenir-plus-ndali vs
  // cspebeveil-afrique-education par exemple).
  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: '/',
  });

  cookieStore.set(TOKEN_COOKIE, session.token, {
    httpOnly: false, // DOIT être false pour que getClientToken() puisse le lire via document.cookie pour Axios
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: '/',
  });

  const tenantId = session.tenant?.id || session.user?.tenantId;
  if (tenantId && String(tenantId).trim() !== '') {
    cookieStore.set(TENANT_ID_COOKIE, String(tenantId), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  } else {
    cookieStore.delete({ name: TENANT_ID_COOKIE, path: '/' });
  }
}

/**
 * Supprime la session (à utiliser côté serveur uniquement)
 *
 * ⭐ Host-only cookies : on supprime sans `domain` pour matcher les cookies
 * créés par setServerSession.
 */
export async function clearServerSession(): Promise<void> {
  const cookieStore = await cookies();

  // Supprimer avec path='/' (et sans domain) pour matcher les cookies host-only
  cookieStore.delete({ name: SESSION_COOKIE, path: '/' });
  cookieStore.delete({ name: TOKEN_COOKIE, path: '/' });
  cookieStore.delete({ name: TENANT_ID_COOKIE, path: '/' });
}

/**
 * Vérifie si l'utilisateur est authentifié (Server Component)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return session !== null;
}

