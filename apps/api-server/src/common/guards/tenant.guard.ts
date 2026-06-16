import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { RESERVED_SUBDOMAINS, isReservedSubdomain } from '../constants/reserved-subdomains';

/**
 * Guard to extract and validate tenant_id from request
 *
 * 🔒 SÉCURITÉ MULTI-TENANT STRICTE (v2) :
 *   - Le tenantId est PRIMORDIALEMENT résolu depuis le JWT (user.tenantId)
 *   - Le header X-Tenant-ID est accepté UNIQUEMENT s'il correspond au tenantId du JWT
 *     (empêche l'usurpation cross-tenant via header injecté depuis le navigateur)
 *   - Le sous-domaine est accepté uniquement comme dernier recours, mais le JWT
 *     reste la source de vérité pour les utilisateurs authentifiés
 *
 * Ordre de résolution (SÉCURISÉ) :
 * 1. JWT token payload (tenant sélectionné via /auth/select-tenant) — SOURCE DE VÉRITÉ
 * 2. X-Tenant-ID header — accepté SEULEMENT s'il correspond au JWT (anti-usurpation)
 * 3. Subdomain (e.g., cspeb.academiahelm.com) — dernier recours pour routes publiques
 *
 * ⚠️ IMPORTANT: Ce guard ne doit JAMAIS être appliqué sur les routes d'authentification
 */
@Injectable()
export class TenantGuard implements CanActivate {
  /**
   * Sous-domaines réservés importés depuis la source centralisée.
   * @see apps/api-server/src/common/constants/reserved-subdomains.ts
   */
  private static readonly RESERVED_SUBDOMAINS = RESERVED_SUBDOMAINS;

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url || request.route?.path || '';

    // ✅ Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ✅ Exclure explicitement les routes d'authentification et de portail
    if (
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/select-tenant') ||
      path.includes('/auth/dev-login') ||
      path.includes('/auth/dev-available-tenants') ||
      path.includes('/auth/available-tenants') ||
      path.includes('/portal/auth') ||
      path.includes('/portal/search') ||
      path.includes('/portal/list') ||
      path.includes('/public/schools')
    ) {
      return true;
    }

    const user = request['user'] as any;
    const isPlatform =
      user && (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN');

    const tenantId = this.extractTenantId(request);

    if (!tenantId) {
      if (isPlatform) {
        return true;
      }
      throw new UnauthorizedException('Tenant ID not found');
    }

    request['tenantId'] = tenantId;
    return true;
  }

  /**
   * 🔒 Extraction SÉCURISÉE du tenantId — empêche l'usurpation cross-tenant.
   *
   * Le JWT est la source de vérité. Le header X-Tenant-ID n'est accepté que
   * s'il correspond au tenantId du JWT (pour les cas où le BFF le transmet
   * pour compatibilité). Un header X-Tenant-ID qui ne correspond pas au JWT
   * est IGNORE (silencieusement) pour éviter de révéler la détection.
   */
  private extractTenantId(request: Request): string | undefined {
    const user = request['user'] as any;
    const jwtTenantId = user?.tenantId;

    // 🔒 Pour les utilisateurs authentifiés (non platform), le JWT prime
    // Le header X-Tenant-ID est accepté UNIQUEMENT s'il correspond au JWT
    if (jwtTenantId && typeof jwtTenantId === 'string' && jwtTenantId.length > 0) {
      const headerTenantId = request.headers['x-tenant-id'];
      if (headerTenantId && typeof headerTenantId === 'string') {
        // Vérifier la correspondance — si mismatch, on ignore le header et on log
        if (headerTenantId !== jwtTenantId) {
          // 🚨 Tentative d'usurpation cross-tenant détectée — on ignore silencieusement
          // le header et on utilise le tenant du JWT (sécurité par défaut)
          console.warn(
            `🚨 [TenantGuard] Cross-tenant attempt: header='${headerTenantId}' vs JWT='${jwtTenantId}'. Using JWT tenant.`,
          );
        }
      }
      return jwtTenantId;
    }

    // Utilisateurs PLATFORM_OWNER / SUPER_ADMIN sans tenantId JWT — on fait confiance au header
    // (ils peuvent accéder à n'importe quel tenant pour le support/administration)
    if (user && (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN' || user.isSuperAdmin)) {
      const tenantIdHeader = request.headers['x-tenant-id'];
      if (tenantIdHeader && typeof tenantIdHeader === 'string') {
        return tenantIdHeader;
      }
    }

    // Dernier recours : sous-domaine (pour les routes publiques principalement)
    const host = request.headers.host;
    if (host && host.includes('.')) {
      const parts = host.split('.');
      if (
        parts.length > 2 &&
        !isReservedSubdomain(parts[0].toLowerCase())
      ) {
        // First part is the tenant slug/id
        // TODO: Resolve slug to tenant_id via database lookup
        return parts[0];
      }
    }

    return undefined;
  }
}
