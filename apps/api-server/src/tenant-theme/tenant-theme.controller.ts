import {
  Controller, Get, Put, Body, Param, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { TenantThemeService } from './tenant-theme.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Public } from '../auth/decorators/public.decorator';

/**
 * ============================================================================
 * TenantThemeController — Gestion du thème du site institutionnel
 * ============================================================================
 *
 * Endpoints :
 *
 *   (authentifiés — admin CMS)
 *     GET  /api/tenant-theme                   → settings actuels du tenant
 *     PUT   /api/tenant-theme                  → met à jour themeId + mode
 *
 *   (public — pour le rendu du site public, sans auth)
 *     GET   /api/tenant-theme/public/:slug     → { themeId, mode } par slug tenant
 *
 * Le thème par défaut (Academia Helm Navy/Blue/Gold) est renvoyé si aucun
 * thème n'est configuré.
 * ============================================================================
 */

function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

@Controller('tenant-theme')
export class TenantThemeController {
  private readonly logger = new Logger(TenantThemeController.name);

  constructor(private readonly themeService: TenantThemeService) {}

  // ─── ENDPOINTS AUTHENTIFIÉS (CMS admin) ──────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get()
  async getSettings(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.themeService.getSettings(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put()
  async setSettings(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Body() body: { themeId?: string | null; mode?: 'light' | 'dark' | 'auto' },
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.themeService.setSettings(tid, body);
  }

  // ─── ENDPOINT PUBLIC (rendu site institutionnel) ─────────────────────────

  @Public()
  @Get('public/:slug')
  async getPublicSettings(@Param('slug') slug: string) {
    return this.themeService.getPublicSettingsBySlug(slug);
  }
}
