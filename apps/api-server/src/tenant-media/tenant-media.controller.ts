import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { TenantMediaService, UploadMediaInput } from './tenant-media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * ============================================================================
 * TenantMediaController — Bibliothèque médias tenant-scoped
 * ============================================================================
 *
 * Endpoints (tous authentifiés + tenant-scoped) :
 *
 *   POST   /api/tenant-media
 *     Body: { fileDataUrl, fileName, mimeType, folder?, alt?, tags? }
 *     → upload + optimisation Sharp + 3 variantes + persistance DB
 *
 *   GET    /api/tenant-media?folder=&type=&search=&limit=&offset=
 *     → liste paginée (default 50, max 200)
 *
 *   GET    /api/tenant-media/folders
 *     → liste des dossiers utilisés (avec compteurs)
 *
 *   GET    /api/tenant-media/:id
 *     → détail d'un média (URLs résolues)
 *
 *   PUT    /api/tenant-media/:id
 *     Body: { name?, alt?, tags?, folder? }
 *     → met à jour les métadonnées (pas le fichier)
 *
 *   DELETE /api/tenant-media/:id
 *     → supprime le média (DB + storage)
 *
 *   POST   /api/tenant-media/:id/use
 *     → incrémente le compteur d'usage (quand l'image est utilisée dans une page)
 *
 *   POST   /api/tenant-media/:id/unuse
 *     → décrémente le compteur d'usage
 *
 *   POST   /api/tenant-media/cleanup-orphans
 *     → supprime les fichiers storage orphelins (admin only)
 * ============================================================================
 */

function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

@Controller('tenant-media')
export class TenantMediaController {
  private readonly logger = new Logger(TenantMediaController.name);

  constructor(private readonly mediaService: TenantMediaService) {}

  // ─── UPLOAD ─────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post()
  async upload(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @CurrentUser() user: any,
    @Body() body: UploadMediaInput,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.mediaService.upload(tid, user?.id, body);
  }

  // ─── LIST ───────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get()
  async list(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Query('folder') folder?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.mediaService.list(tid, {
      folder,
      type,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  // ─── FOLDERS ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('folders')
  async listFolders(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.mediaService.listFolders(tid);
  }

  // ─── GET BY ID ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get(':id')
  async getById(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.mediaService.getById(tid, id);
  }

  // ─── UPDATE ─────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put(':id')
  async update(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
    @Body() body: { name?: string; alt?: string | null; tags?: string[]; folder?: string },
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.mediaService.update(tid, id, body);
  }

  // ─── DELETE ─────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete(':id')
  async delete(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    await this.mediaService.delete(tid, id);
    return { success: true };
  }

  // ─── USAGE TRACKING ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post(':id/use')
  async incrementUsage(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    await this.mediaService.incrementUsage(tid, id);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post(':id/unuse')
  async decrementUsage(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    await this.mediaService.decrementUsage(tid, id);
    return { success: true };
  }

  // ─── CLEANUP ORPHANS (admin) ────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('cleanup-orphans')
  async cleanupOrphans(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.mediaService.cleanupOrphans(tid);
  }
}
