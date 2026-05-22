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

import { cookies, headers } from 'next/headers';

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
  const headersList = await headers();
  
  let baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  if (!baseDomain) {
    const host = headersList.get('host') || headersList.get('x-forwarded-host');
    if (host && host.includes('academiahelm.com')) {
      baseDomain = 'academiahelm.com';
    } else if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        baseDomain = parts.slice(-2).join('.');
      }
    }
  }

  const domain = baseDomain && !baseDomain.includes('localhost') 
    ? `.${baseDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}` 
    : undefined;

  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: '/',
    domain,
  });

  cookieStore.set(TOKEN_COOKIE, session.token, {
    httpOnly: false, // DOIT être false pour que getClientToken() puisse le lire via document.cookie pour Axios
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: '/',
    domain,
  });

  const tenantId = session.tenant?.id || session.user?.tenantId;
  if (tenantId && String(tenantId).trim() !== '') {
    cookieStore.set(TENANT_ID_COOKIE, String(tenantId), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      domain,
    });
  } else {
    cookieStore.delete({ name: TENANT_ID_COOKIE, domain });
  }
}

/**
 * Supprime la session (à utiliser côté serveur uniquement)
 */
export async function clearServerSession(): Promise<void> {
  const cookieStore = await cookies();
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  const domain = baseDomain && !baseDomain.includes('localhost') 
    ? `.${baseDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}` 
    : undefined;

  cookieStore.delete({ name: SESSION_COOKIE, domain });
  cookieStore.delete({ name: TOKEN_COOKIE, domain });
  cookieStore.delete({ name: TENANT_ID_COOKIE, domain });
}

/**
 * Vérifie si l'utilisateur est authentifié (Server Component)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return session !== null;
}

