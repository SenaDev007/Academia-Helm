/**
 * ============================================================================
 * ADMISSION SETTINGS CONTROLLER — Module Admissions configurable par le promoteur
 * ============================================================================
 *
 * Endpoints:
 *   PUBLIC (pas d'auth — pour le site institutionnel public) :
 *     GET  /api/tenant-website/public/:tenantSlug/admission
 *       — Renvoie la config admission active (steps + documents) si isActive=true,
 *         sinon null (la section est masquée sur le site public).
 *
 *   AUTH (JwtAuthGuard + TenantGuard + RolesGuard — promoteur/directeur/admin) :
 *     GET    /api/admission-settings
 *       — Récupère la config admission du tenant courant (créée si inexistante).
 *     PUT    /api/admission-settings
 *       — Met à jour la config (isActive, title, subtitle, ctaText, etc.)
 *
 *     POST   /api/admission-settings/steps
 *       — Ajoute une étape.
 *     PUT    /api/admission-settings/steps/:id
 *       — Modifie une étape.
 *     DELETE /api/admission-settings/steps/:id
 *       — Supprime une étape.
 *
 *     POST   /api/admission-settings/documents
 *       — Ajoute un document requis.
 *     PUT    /api/admission-settings/documents/:id
 *       — Modifie un document requis.
 *     DELETE /api/admission-settings/documents/:id
 *       — Supprime un document requis.
 *
 * ⭐ Pattern multi-tenant : tout est scoped par tenantId. Le promoteur ne
 * voit et ne modifie que la config de SON tenant.
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../database/prisma.service';

function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

@Controller()
@Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PROMOTER', 'admin')
export class AdmissionSettingsController {
  private readonly logger = new Logger(AdmissionSettingsController.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  ENDPOINT PUBLIC — pour le site institutionnel public
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * GET /api/tenant-website/public/:tenantSlug/admission
   * Renvoie la config admission active (steps + documents) pour le site public.
   * Si isActive=false ou config inexistante → renvoie null (section masquée).
   */
  @Public()
  @Get('tenant-website/public/:tenantSlug/admission')
  async getPublicAdmission(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { subdomain: tenantSlug }],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true },
    });
    if (!tenant) throw new BadRequestException('Établissement introuvable');

    try {
      const settings = await this.prisma.admissionSettings.findUnique({
        where: { tenantId: tenant.id },
        include: {
          steps: { where: { isActive: true }, orderBy: [{ order: 'asc' }, { num: 'asc' }] },
          documents: { where: { isActive: true }, orderBy: { order: 'asc' } },
        },
      });
      if (!settings || !settings.isActive) return null;
      return settings;
    } catch (err: any) {
      this.logger.warn(`getPublicAdmission failed for tenant ${tenant.id}: ${err?.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CONFIG GLOBALE (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('admission-settings')
  async getSettings(@GetTenant() tenant: any, @TenantId() tidFallback?: string) {
    const tid = resolveTid(tenant, tidFallback);
    return this._getOrCreateSettings(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('admission-settings')
  async updateSettings(
    @GetTenant() tenant: any,
    @TenantId() tidFallback: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant, tidFallback);
    await this._getOrCreateSettings(tid);

    const allowedFields = [
      'isActive', 'title', 'subtitle',
      'ctaText', 'ctaUrl',
      'documentsTitle', 'documentsIntro',
      'stepsTitle', 'stepsIntro',
      'ctaBlockTitle', 'ctaBlockText',
    ];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    return this.prisma.admissionSettings.update({
      where: { tenantId: tid },
      data: updateData,
      include: {
        steps: { orderBy: [{ order: 'asc' }, { num: 'asc' }] },
        documents: { orderBy: { order: 'asc' } },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ÉTAPES (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Post('admission-settings/steps')
  async createStep(
    @GetTenant() tenant: any,
    @TenantId() tidFallback: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant, tidFallback);
    const settings = await this._getOrCreateSettings(tid);
    if (!body.title) throw new BadRequestException('Titre requis pour une étape');
    return this.prisma.admissionStep.create({
      data: {
        tenantId: tid,
        admissionId: settings.id,
        num: body.num || 1,
        title: body.title,
        description: body.description || null,
        iconName: body.iconName || 'CheckCircle2',
        order: body.order ?? 0,
        isActive: body.isActive !== false,
      },
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('admission-settings/steps/:id')
  async updateStep(
    @GetTenant() tenant: any,
    @TenantId() tidFallback: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant, tidFallback);
    const step = await this.prisma.admissionStep.findFirst({
      where: { id, tenantId: tid },
    });
    if (!step) throw new BadRequestException('Étape introuvable');

    const allowedFields = ['num', 'title', 'description', 'iconName', 'order', 'isActive'];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    return this.prisma.admissionStep.update({ where: { id }, data: updateData });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Delete('admission-settings/steps/:id')
  async deleteStep(
    @GetTenant() tenant: any,
    @TenantId() tidFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tidFallback);
    const step = await this.prisma.admissionStep.findFirst({
      where: { id, tenantId: tid },
    });
    if (!step) throw new BadRequestException('Étape introuvable');
    await this.prisma.admissionStep.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DOCUMENTS REQUIS (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Post('admission-settings/documents')
  async createDocument(
    @GetTenant() tenant: any,
    @TenantId() tidFallback: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant, tidFallback);
    const settings = await this._getOrCreateSettings(tid);
    if (!body.label) throw new BadRequestException('Libellé requis pour un document');
    return this.prisma.admissionRequiredDocument.create({
      data: {
        tenantId: tid,
        admissionId: settings.id,
        label: body.label,
        description: body.description || null,
        iconName: body.iconName || 'FileText',
        order: body.order ?? 0,
        isActive: body.isActive !== false,
      },
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('admission-settings/documents/:id')
  async updateDocument(
    @GetTenant() tenant: any,
    @TenantId() tidFallback: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant, tidFallback);
    const doc = await this.prisma.admissionRequiredDocument.findFirst({
      where: { id, tenantId: tid },
    });
    if (!doc) throw new BadRequestException('Document introuvable');

    const allowedFields = ['label', 'description', 'iconName', 'order', 'isActive'];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    return this.prisma.admissionRequiredDocument.update({ where: { id }, data: updateData });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Delete('admission-settings/documents/:id')
  async deleteDocument(
    @GetTenant() tenant: any,
    @TenantId() tidFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tidFallback);
    const doc = await this.prisma.admissionRequiredDocument.findFirst({
      where: { id, tenantId: tid },
    });
    if (!doc) throw new BadRequestException('Document introuvable');
    await this.prisma.admissionRequiredDocument.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HELPER — get or create settings
  // ═══════════════════════════════════════════════════════════════════════

  private async _getOrCreateSettings(tid: string) {
    let settings = await this.prisma.admissionSettings.findUnique({
      where: { tenantId: tid },
      include: {
        steps: { orderBy: [{ order: 'asc' }, { num: 'asc' }] },
        documents: { orderBy: { order: 'asc' } },
      },
    });
    if (!settings) {
      settings = await this.prisma.admissionSettings.create({
        data: { tenantId: tid, isActive: false },
        include: { steps: true, documents: true },
      });
      this.logger.log(`Created default AdmissionSettings for tenant ${tid}`);
    }
    return settings;
  }
}
