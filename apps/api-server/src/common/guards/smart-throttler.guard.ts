/**
 * ============================================================================
 * SMART THROTTLE GUARD — rate limit par UTILISATEUR, pas par IP
 * ============================================================================
 *
 * ⭐ FIX PERFORMANCE CONCURRENCE (SaaS multi-tenant) :
 *
 * Le ThrottlerGuard par défaut clé les buckets de rate limit sur `req.ip`.
 * En production (Railway), sans `trust proxy`, `req.ip` = l'IP du PROXY →
 * TOUS les utilisateurs de TOUS les tenants partageaient UN SEUL bucket
 * (300 req/min au global). Dès que ~8 utilisateurs se connectaient en
 * même temps (test école : ~20 enseignants), le throttler rejetait les
 * requêtes suivantes en 429 → « toute la plateforme buguait ».
 *
 * Ce guard remplace la clé par :
 *   - `u:<userId>` quand la requête est authentifiée (JWT validé) → chaque
 *     utilisateur a SES propres buckets (20 utilisateurs = 20 buckets).
 *   - `ip:<ip>` sinon (routes publiques : login, webhooks…) — l'IP réelle
 *     grâce à `app.set('trust proxy', true)` dans main.ts.
 *
 * Conséquence : 20 enseignants derrière le NAT d'une école ne s'auto-bloquent
 * plus mutuellement, et le login publique reste protégé par IP.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class SmartThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Utilisateur authentifié → bucket par userId (indépendant du NAT/VPN/proxy)
    const userId = req?.user?.id;
    if (typeof userId === 'string' && userId.length > 0) {
      return `u:${userId}`;
    }
    // Route publique → bucket par IP réelle (trust proxy résout X-Forwarded-For)
    return `ip:${req.ip ?? 'unknown'}`;
  }
}
