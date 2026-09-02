/**
 * ============================================================================
 * TENANT SUSPENSION GUARD — MODE LECTURE SEULE POUR LES ÉCOLES SUSPENDUES
 * ============================================================================
 *
 * ⭐ Application back-end du contrôle piloté depuis le back-office
 *    (/platform/tenants → « Suspendre » / « Réactiver »).
 *
 * Règle :
 *   - Une école (tenant) suspendue (Tenant.status = 'suspended' /
 *     subscriptionStatus = 'SUSPENDED' / HelmSubscription.status = 'SUSPENDED')
 *     conserve un accès en LECTURE : toutes les requêtes GET/HEAD/OPTIONS
 *     passent.
 *   - Toute requête d'ÉCRITURE (POST/PUT/PATCH/DELETE) portant ce tenant est
 *     rejetée en 403 avec le code TENANT_SUSPENDED_READ_ONLY — jusqu'au
 *     règlement et à la réactivation depuis le back-office.
 *
 * Exemptions (écritures autorisées même suspendu — pour permettre à l'école
 * de se mettre à jour / régler) :
 *   - Routes @Public (plateforme, onboarding, portail public…) : elles ne
 *     portent pas de contexte tenant.
 *   - /billing/renew, /billing/reactivate, /billing/bilingual/* : paiement
 *     et réactivation de l'option bilingue.
 *   - /auth/* : connexion / sélection de tenant / refresh.
 *
 * Performance : statut mis en cache 30 s par tenant (clé tenantId) — le
 * guard ne fait qu'au plus une requête SQL toutes les 30 s par école active.
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

/** Durée du cache du statut de suspension (ms). */
const SUSPENSION_CACHE_TTL_MS = 30_000;

/** Préfixes de chemins dont les écritures restent autorisées en suspension. */
const WRITES_ALLOWED_WHEN_SUSPENDED = [
  '/billing/renew',
  '/billing/reactivate',
  '/billing/unblock-enrollment',
  '/billing/bilingual',
  '/billing/subscription-status',
  '/billing/cron',
  '/auth/',
];

@Injectable()
export class TenantSuspensionGuard implements CanActivate {
  private readonly logger = new Logger(TenantSuspensionGuard.name);
  /** tenantId → { suspended, cachedAt } */
  private readonly cache = new Map<string, { suspended: boolean; cachedAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = String(request.method || 'GET').toUpperCase();

    // ✅ Les lectures passent toujours (mode lecture seule, pas blocage total)
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    // ✅ Routes publiques (plateforme admin, onboarding, portail…) : pas de
    //    contexte tenant — elles sont protégées par ailleurs (header proxy).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const path = request.url || request.route?.path || '';

    // ✅ Écritures nécessaires au règlement / à la reconnexion
    if (WRITES_ALLOWED_WHEN_SUSPENDED.some((p) => path.includes(p))) {
      return true;
    }

    // ── Résolution du tenant (mêmes sources que ContextValidationGuard) ──
    const user = request['user'] as any;
    const contextData = request['context'] as { tenantId?: string } | undefined;
    const tenantId: string | undefined =
      contextData?.tenantId ||
      (request as any).tenantId ||
      (request.headers['x-tenant-id'] as string | undefined) ||
      user?.tenantId ||
      undefined;

    if (!tenantId) {
      // Requête sans contexte tenant (auth, plateforme…) — rien à bloquer.
      return true;
    }

    // Les administrateurs plateforme n'ont pas de tenant_id, mais par prudence :
    if (user && (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_ADMIN')) {
      return true;
    }

    const suspended = await this.isSuspended(tenantId);
    if (suspended) {
      this.logger.warn(
        `Écriture bloquée (mode lecture seule) — tenant ${tenantId} suspendu : ${method} ${path}`,
      );
      throw new ForbiddenException({
        statusCode: 403,
        code: 'TENANT_SUSPENDED_READ_ONLY',
        message:
          "Votre établissement est actuellement suspendu (abonnement expiré ou suspension émise par la plateforme). " +
          "L'accès reste disponible en lecture seule. Merci de régulariser le paiement pour rétablir l'accès complet.",
      });
    }

    return true;
  }

  /** Statut de suspension avec cache court (TTL 30 s). */
  private async isSuspended(tenantId: string): Promise<boolean> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < SUSPENSION_CACHE_TTL_MS) {
      return cached.suspended;
    }

    let suspended = false;
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          status: true,
          subscriptionStatus: true,
          helmSubscription: { select: { status: true } },
        },
      });
      if (!tenant) {
        suspended = false;
      } else {
        suspended =
          tenant.status === 'suspended' ||
          tenant.subscriptionStatus === 'SUSPENDED' ||
          tenant.subscriptionStatus === 'BLOCKED' ||
          tenant.helmSubscription?.status === 'SUSPENDED' ||
          tenant.helmSubscription?.status === 'BLOCKED';
      }
    } catch (err: any) {
      // Fail-open : en cas d'erreur DB on ne bloque pas (les autres guards
      // valident déjà l'authentification et le contexte).
      this.logger.warn(`Suspension check failed for tenant ${tenantId}: ${err?.message}`);
      return false;
    }

    this.cache.set(tenantId, { suspended, cachedAt: Date.now() });
    return suspended;
  }
}
