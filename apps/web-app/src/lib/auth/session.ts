/**
 * Session Management - Server Side
 * 
 * Gestion sécurisée des sessions utilisateur (Server Components uniquement)
 */

import { cookies } from 'next/headers';
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
 */
export async function setServerSession(session: AuthSession): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: '/',
  });

  cookieStore.set(TOKEN_COOKIE, session.token, {
    httpOnly: true,
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
    cookieStore.delete(TENANT_ID_COOKIE);
  }
}

/**
 * Supprime la session (à utiliser côté serveur uniquement)
 */
export async function clearServerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(TOKEN_COOKIE);
  cookieStore.delete(TENANT_ID_COOKIE);
}

/**
 * Vérifie si l'utilisateur est authentifié (Server Component)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return session !== null;
}

