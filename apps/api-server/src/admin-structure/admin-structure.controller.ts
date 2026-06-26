import {
  Controller, Get, Put,
  Body, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { AdminStructureService, AdminStructureMode } from './admin-structure.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Param } from '@nestjs/common';

/**
 * ============================================================================
 * AdminStructureController — Configuration du mode d'administration scolaire
 * ============================================================================
 *
 * Endpoints :
 *
 *   (authentifiés — admin CMS)
 *     GET  /api/admin-structure/mode             → mode actuel du tenant
 *     PUT  /api/admin-structure/mode             → met à jour le mode
 *     GET  /api/admin-structure/groups           → unités administratives
 *
 *   (public — pour le rendu du site public, sans auth)
 *     GET  /api/admin-structure/public/:slug     → { mode, groups } par slug tenant
 * ============================================================================
 */

function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

const VALID_MODES: AdminStructureMode[] = ['SEPARATE', 'FUSED_MATERNELLE_PRIMAIRE'];

@Controller('admin-structure')
export class AdminStructureController {
  private readonly logger = new Logger(AdminStructureController.name);

  constructor(private readonly adminStructureService: AdminStructureService) {}

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('mode')
  async getMode(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    const mode = await this.adminStructureService.getMode(tid);
    return { mode };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put('mode')
  async setMode(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Body() body: { mode: AdminStructureMode },
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    if (!body?.mode || !VALID_MODES.includes(body.mode)) {
      throw new BadRequestException(
        `Mode invalide. Valeurs acceptées : ${VALID_MODES.join(', ')}`,
      );
    }
    await this.adminStructureService.setMode(tid, body.mode);
    return { success: true, mode: body.mode };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('groups')
  async getGroups(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    const groups = await this.adminStructureService.getAdminGroups(tid);
    const mode = await this.adminStructureService.getMode(tid);
    return { mode, groups };
  }

  @Public()
  @Get('public/:slug')
  async getPublicBySlug(@Param('slug') slug: string) {
    // Endpoint public pour le rendu du site institutionnel
    // Résout le tenant par slug/subdomain, puis renvoie mode + groups
    const tenant = await this.adminStructureService['prisma'].tenant.findFirst({
      where: {
        OR: [{ slug }, { subdomain: slug }],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true },
    });

    if (!tenant) {
      return { mode: 'SEPARATE' as AdminStructureMode, groups: [] };
    }

    const mode = await this.adminStructureService.getMode(tenant.id);
    const groups = await this.adminStructureService.getAdminGroups(tenant.id);
    return { mode, groups };
  }
}
