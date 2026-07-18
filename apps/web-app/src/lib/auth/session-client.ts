/**
 * Session Management - Client Side
 * 
 * Fonctions de gestion de session utilisables côté client uniquement
 */

const TOKEN_COOKIE = 'academia_token';

/**
 * Récupère le token JWT (Client Component)
 * 
 * Lit le token depuis le cookie 'academia_token' en priorité,
 * puis fallback sur localStorage 'accessToken' (utilisé par persistClientSession).
 */
export function getClientToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // 1. Lire depuis les cookies du navigateur
  const cookies = document.cookie.split('; ');
  const tokenCookie = cookies.find(row => row.startsWith(`${TOKEN_COOKIE}=`));
  if (tokenCookie) {
    const token = tokenCookie.split('=')[1];
    if (token) return token;
  }
  
  // 2. Fallback : lire depuis localStorage (utilisé par persistClientSession)
  const localStorageToken = localStorage.getItem('accessToken')?.trim();
  if (localStorageToken) return localStorageToken;
  
  return null;
}

/**
 * Définit le token côté client (pour les Server Actions)
 *
 * ⭐ Multi-tenant isolation (Juillet 2026) :
 * Cookie host-only (pas de `domain`) pour isoler les sessions entre
 * sous-domaines. Chaque tenant a sa propre session, permettant d'ouvrir
 * 2 tenants dans 2 onglets sans conflit.
 */
export function setClientToken(token: string): void {
  if (typeof window === 'undefined') return;

  // Définir le cookie côté client — host-only (pas de `domain`)
  const expires = new Date();
  expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 jours

  document.cookie = `${TOKEN_COOKIE}=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

