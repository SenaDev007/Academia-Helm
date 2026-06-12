/**
 * Session Management - Client Side
 * 
 * Fonctions de gestion de session utilisables côté client uniquement
 */

const TOKEN_COOKIE = 'academia_token';

/**
 * Récupère le token JWT (Client Component)
 */
export function getClientToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Lire depuis les cookies du navigateur
  const cookies = document.cookie.split('; ');
  const tokenCookie = cookies.find(row => row.startsWith(`${TOKEN_COOKIE}=`));
  return tokenCookie ? tokenCookie.split('=')[1] : null;
}

/**
 * Définit le token côté client (pour les Server Actions)
 */
export function setClientToken(token: string): void {
  if (typeof window === 'undefined') return;
  
  // Définir le cookie côté client
  const expires = new Date();
  expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 jours
  
  let baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  if (!baseDomain && typeof window !== 'undefined') {
    const host = window.location.host;
    if (host.includes('academiahelm.com')) {
      baseDomain = 'academiahelm.com';
    } else if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        baseDomain = parts.slice(-2).join('.');
      }
    }
  }

  const domainStr = baseDomain && !baseDomain.includes('localhost') 
    ? `; domain=.${baseDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}` 
    : '';

  document.cookie = `${TOKEN_COOKIE}=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}${domainStr}`;
}

