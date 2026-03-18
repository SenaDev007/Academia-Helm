/**
 * ============================================================================
 * BILLING GUARD - PROTECTION DES ROUTES SELON LA SOUSCRIPTION
 * ============================================================================
 * 
 * Guard production-grade qui vérifie le statut de souscription et bloque/alerte selon :
 * - dev_override → allow (mode développement)
 * - ACTIVE → allow
 * - TRIAL_ACTIVE → allow + banner flag
 * - GRACE → allow + degraded flag
 * - SUSPENDED → block write actions, allow read
 * - CANCELLED → block all except billing routes
 * 
 * Features :
 * - Cache des souscriptions (TTL 5 min)
 * - Injection du contexte billing dans la request
 * - Support decorator @RequireActiveBilling
 * - Bypass PLATFORM_OWNER
 * - Émission événements ORION en cas de blocage
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { REQUIRE_TENANT_KEY } from '../../common/decorators/require-tenant.decorator';
import { REQUIRE_ACTIVE_BILLING_KEY } from '../decorators/require-active-billing.decorator';

interface SubscriptionCache {
  subscription: any;
  cachedAt: number;
}

@Injectable()
export class BillingGuard implements CanActivate {
  private readonly logger = new Logger(BillingGuard.name);
  private readonly subscriptionCache = new Map<string, SubscriptionCache>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // ✅ Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ✅ Routes à NE JAMAIS protéger
    const path = request.url || request.route?.path || '';
    const protectedPaths = [
      '/auth',
      '/portal',
      '/billing',
      '/onboarding',
      '/fedapay',
    ];

    if (protectedPaths.some((p) => path.includes(p))) {
      return true;
    }

    // ✅ Bypass PLATFORM_OWNER
    const user = request['user'] as any;
    if (user?.role === 'PLATFORM_OWNER') {
      this.logger.debug(`✅ PLATFORM_OWNER bypass for ${user.id}`);
      return true;
    }

    // ✅ Vérifier si le tenant est requis pour cette route
    const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si le tenant n'est pas requis, on laisse passer
    if (!requireTenant) {
      return true;
    }

    const tenantId =
      request['tenantId'] ||
      request.headers['x-tenant-id'] ||
      user?.tenantId;

    if (!tenantId) {
      // Pas de tenant, laisser passer (sera géré par TenantGuard)
      return true;
    }

    // Récupérer la souscription (avec cache)
    const subscription = await this.getSubscriptionWithCache(tenantId);

    // Si pas de souscription, vérifier si c'est un tenant en cours d'onboarding
    if (!subscription) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, status: true },
      });

      if (!tenant) {
        throw new ForbiddenException('Tenant not found');
      }

      // Si le tenant existe mais n'a pas de souscription, permettre l'accès
      // (sera géré lors de l'onboarding)
      return true;
    }

    // ✅ DEV_OVERRIDE → allow (mode développement)
    if (subscription.devOverride) {
      this.logger.debug(`✅ DEV_OVERRIDE active for tenant ${tenantId}`);
      this.injectBillingContext(request, {
        status: 'DEV_ACTIVE',
        isTrial: false,
        isGrace: false,
        degradedMode: false,
        subscription,
      });
      return true;
    }

    const status = subscription.status;
    const method = request.method;
    const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    // ✅ ACTIVE → allow
    if (status === 'ACTIVE') {
      this.injectBillingContext(request, {
        status: 'ACTIVE',
        isTrial: false,
        isGrace: false,
        degradedMode: false,
        subscription,
      });
      return true;
    }

    // ✅ TRIAL_ACTIVE → allow + banner flag
    if (status === 'TRIAL_ACTIVE') {
      const isTrialExpired = subscription.trialEnd && subscription.trialEnd < new Date();
      
      this.injectBillingContext(request, {
        status: 'TRIAL_ACTIVE',
        isTrial: true,
        isGrace: isTrialExpired,
        degradedMode: false,
        subscription,
        trialEnd: subscription.trialEnd,
      });

      if (isTrialExpired) {
        this.logger.warn(
          `⚠️  Trial expired for tenant ${tenantId}, but allowing access (grace period)`
        );
        request['subscriptionWarning'] = 'TRIAL_EXPIRED';
      } else {
        request['subscriptionWarning'] = 'TRIAL_ACTIVE';
      }

      return true;
    }

    // ✅ GRACE → allow + degraded flag
    if (status === 'GRACE') {
      this.logger.warn(
        `⚠️  Tenant ${tenantId} in GRACE period - access allowed with warning`
      );
      
      this.injectBillingContext(request, {
        status: 'GRACE',
        isTrial: false,
        isGrace: true,
        degradedMode: true,
        subscription,
      });
      
      request['subscriptionWarning'] = 'GRACE_PERIOD';
      return true;
    }

    // ✅ DEV_ACTIVE → allow (mode développement)
    if (status === 'DEV_ACTIVE') {
      this.injectBillingContext(request, {
        status: 'DEV_ACTIVE',
        isTrial: false,
        isGrace: false,
        degradedMode: false,
        subscription,
      });
      return true;
    }

    // ❌ SUSPENDED → block write actions, allow read
    if (status === 'SUSPENDED') {
      if (isWriteOperation) {
        // Émettre événement ORION
        await this.emitOrionBlockEvent(tenantId, request, 'SUSPENDED', 'WRITE_BLOCKED');
        
        throw new ForbiddenException(
          'Subscription is suspended. Please renew your subscription to continue.'
        );
      }

      // Allow read operations
      this.injectBillingContext(request, {
        status: 'SUSPENDED',
        isTrial: false,
        isGrace: false,
        degradedMode: true,
        subscription,
      });
      
      request['subscriptionWarning'] = 'SUSPENDED_READ_ONLY';
      return true;
    }

    // ❌ CANCELLED → block all except billing routes
    if (status === 'CANCELLED') {
      // Autoriser uniquement les routes de facturation
      if (!path.includes('/billing/')) {
        await this.emitOrionBlockEvent(tenantId, request, 'CANCELLED', 'ALL_BLOCKED');
        
        throw new ForbiddenException(
          'Subscription is cancelled. Please contact support to reactivate.'
        );
      }

      // Permettre l'accès aux routes de facturation
      this.injectBillingContext(request, {
        status: 'CANCELLED',
        isTrial: false,
        isGrace: false,
        degradedMode: true,
        subscription,
      });
      
      return true;
    }

    // Vérifier @RequireActiveBilling decorator
    const requireActiveBilling = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ACTIVE_BILLING_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireActiveBilling && !['ACTIVE', 'TRIAL_ACTIVE', 'DEV_ACTIVE'].includes(status)) {
      await this.emitOrionBlockEvent(tenantId, request, status, 'REQUIRE_ACTIVE_BILLING');
      
      throw new ForbiddenException(
        `This action requires an active subscription. Current status: ${status}`
      );
    }

    // Par défaut, permettre l'accès (sécurité par défaut)
    this.injectBillingContext(request, {
      status: status || 'UNKNOWN',
      isTrial: false,
      isGrace: false,
      degradedMode: false,
      subscription,
    });

    return true;
  }

  /**
   * Récupère la souscription avec cache (TTL 5 min)
   */
  private async getSubscriptionWithCache(tenantId: string): Promise<any> {
    const cached = this.subscriptionCache.get(tenantId);

    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.subscription;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { subscriptionPlan: true },
    });

    if (subscription) {
      this.subscriptionCache.set(tenantId, {
        subscription,
        cachedAt: Date.now(),
      });
    }

    return subscription;
  }

  /**
   * Injecte le contexte billing dans la request
   */
  private injectBillingContext(request: Request, context: any) {
    request['billingContext'] = {
      status: context.status,
      isTrial: context.isTrial,
      isGrace: context.isGrace,
      degradedMode: context.degradedMode,
      subscription: {
        id: context.subscription?.id,
        status: context.subscription?.status,
        trialEnd: context.trialEnd || context.subscription?.trialEnd,
        currentPeriodEnd: context.subscription?.currentPeriodEnd,
        plan: context.subscription?.plan,
      },
    };
  }

  /**
   * Émet un événement ORION en cas de blocage
   */
  private async emitOrionBlockEvent(
    tenantId: string,
    request: Request,
    subscriptionStatus: string,
    blockReason: string,
  ) {
    try {
      // TODO: Intégrer avec OrionAlertsService pour émettre l'événement
      // Exemple :
      // await this.orionAlertsService.emitEvent({
      //   type: 'BILLING_BLOCK',
      //   tenantId,
      //   data: {
      //     route: request.url,
      //     method: request.method,
      //     subscriptionStatus,
      //     blockReason,
      //     userId: request['user']?.id,
      //   },
      // });

      this.logger.warn(
        `📡 ORION: BILLING_BLOCK - Tenant: ${tenantId} - Status: ${subscriptionStatus} - Reason: ${blockReason} - Route: ${request.url}`
      );
    } catch (error) {
      // Ne pas bloquer si ORION échoue
      this.logger.error('Failed to emit ORION block event:', error);
    }
  }
}
