import {
  Controller, Get, Put, Delete,
  Body, Param, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { TenantBlockSelectionService } from './tenant-block-selection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Public } from '../auth/decorators/public.decorator';

/**
 * ============================================================================
 * TenantBlockSelectionController — Persistance des composants CMS choisis
 * ============================================================================
 *
 * Endpoints :
 *
 *   (authentifiés — admin CMS)
 *     GET    /api/tenant-block-selections              → toutes les sélections
 *     GET    /api/tenant-block-selections/:category     → une catégorie
 *     PUT    /api/tenant-block-selections/:category     → upsert { variantId, colorOverrides? }
 *     DELETE /api/tenant-block-selections/:category     → supprime
 *
 *   (public — pour le rendu du site public)
 *     GET    /api/tenant-block-selections/public/:slug  → toutes les sélections par slug
 * ============================================================================
 */

function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

@Controller('tenant-block-selections')
export class TenantBlockSelectionController {
  private readonly logger = new Logger(TenantBlockSelectionController.name);

  constructor(private readonly service: TenantBlockSelectionService) {}

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get()
  async getAll(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.getAll(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get(':category')
  async getByCategory(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('category') category: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    const selection = await this.service.getByCategory(tid, category);
    return selection || { category, variantId: null, colorOverrides: null };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put(':category')
  async upsert(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('category') category: string,
    @Body() body: { variantId: string; colorOverrides?: any },
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    if (!body?.variantId) {
      throw new BadRequestException('variantId est requis');
    }
    return this.service.upsert(tid, category, body.variantId, body.colorOverrides);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete(':category')
  async delete(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('category') category: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    await this.service.delete(tid, category);
    return { success: true };
  }

  @Public()
  @Get('public/:slug')
  async getPublicBySlug(@Param('slug') slug: string) {
    return this.service.getPublicBySlug(slug);
  }
}
