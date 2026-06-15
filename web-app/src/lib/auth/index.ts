/**
 * Authentication Helper - Session API (cookies)
 *
 * Session basée sur les cookies academia_session / academia_token (API NestJS).
 * Réexporte getServerSession pour les Server Components.
 */

export { getServerSession } from '@/lib/auth/session';

/** Options d'authentification (compatibilité) — l'auth réelle est gérée par l'API. */
export const authOptions = {
  providers: [],
};
