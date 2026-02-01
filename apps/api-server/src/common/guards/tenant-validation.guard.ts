/**
 * ============================================================================
 * TENANT VALIDATION GUARD - ISOLATION STRICTE
 * ============================================================================
 * 
 * Guard pour valider l'existence et le statut du tenant
 * Renforce l'isolation inter-tenant
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { REQUIRE_TENANT_KEY } from '../decorators/require-tenant.decorator';

/**
 * Vérifie si l'utilisateur est PLATFORM_OWNER
 */
function isPlatformOwner(user: any): boolean {
  if (!user) return false;
  if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') return true;
  const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL;
  if (platformOwnerEmail && user.email === platformOwnerEmail) return true;
  return false;
}

@Injectable()
export class TenantValidationGuard implements CanActivate {
  constructor(
    @InjectRepository(Tenant)
    private tenantsRepository: Repository<Tenant>,
    private reflector: Reflector,
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

    // ✅ Vérifier si le tenant est requis pour cette route
    const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 🚨 Si le tenant n'est PAS requis → on laisse passer
    if (!requireTenant) {
      return true;
    }

    const user = request['user'] as any;
    
    // ✅ PLATFORM_OWNER peut bypasser le guard tenant
    if (isPlatformOwner(user)) {
      return true;
    }

    const tenantId = request['tenantId'] || 
                     request.headers['x-tenant-id'] ||
                     request.query?.tenantId ||
                     user?.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found');
    }

    // Valider l'existence du tenant
    const tenant = await this.tenantsRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    // Vérifier que le tenant est actif
    if (tenant.status !== 'active') {
      throw new UnauthorizedException(
        `Tenant is not active. Status: ${tenant.status}`
      );
    }

    // Vérifier que l'utilisateur appartient bien à ce tenant
    if (user && user.tenantId && user.tenantId !== tenantId) {
      throw new UnauthorizedException(
        'User does not belong to the specified tenant'
      );
    }

    // Attacher le tenant validé à la requête
    request['validatedTenant'] = tenant;

    return true;
  }
}

