/**
 * ============================================================================
 * PV / STATS / PROMOTION PDF CONTROLLER
 * ============================================================================
 *
 * Endpoints pour générer les PDF officiels du module Examen :
 *   - POST /api/institutional-exams/pv-stats-promotion/proces-verbal
 *   - POST /api/institutional-exams/pv-stats-promotion/statistiques
 *   - POST /api/institutional-exams/pv-stats-promotion/promotion
 *
 * Tous les PDF sont au format A4 PAYSAGE avec en-tête officiel République
 * du Bénin + drapeau + ministère + école (même charte que les bulletins).
 *
 * Le branding (nom école, logo, slogan, téléphone, email) est résolu côté
 * backend via tenant_identity_profile, comme pour les bulletins.
 * ============================================================================
 */

import {
  Controller, Post, Body, UseGuards, Res, Headers,
} from '@nestjs/common';
import { PvStatsPromotionPdfService } from './services/pv-stats-promotion-pdf.service';
import { PrismaService } from '../../database/prisma.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
// ⭐ 2026-11-13 — Identité secondaire : helper partagé (écoles combinées).
import { resolveLevelIdentityOverlay, applyLevelIdentityOverlay } from '../../common/context/resolve-level-identity';

@Controller('institutional-exams/pv-stats-promotion')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PvStatsPromotionPdfController {
  constructor(
    private readonly pdfService: PvStatsPromotionPdfService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Helper : résoudre isSecondary depuis scopeLevel ─────────────────────
  //    ⭐ 2026-09-30 — FIX en-tête PDF : le ministère affiché doit correspondre
  //    au niveau scolaire (maternel/primaire vs secondaire). Avant, le
  //    branding n'avait pas isSecondary → tous les PDF affichaient
  //    « Ministère des Enseignements Maternel et Primaire » même pour le
  //    secondaire.
  private resolveIsSecondary(scopeLevel: string | null | undefined): boolean {
    if (!scopeLevel) return false;
    const level = String(scopeLevel).toUpperCase().trim();
    return level === 'SECONDAIRE' || level === 'SECONDARY';
  }

  // ─── Helper : branding école (même pattern que bulletins.controller) ─────
  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true, address: true, phonePrimary: true, email: true, slogan: true },
      });
      if (profile?.schoolName) {
        const apiBaseUrl = 'https://api.academiahelm.com';
        return {
          schoolName: profile.schoolName,
          schoolLogo: profile.logoUrl ? `${apiBaseUrl}/api/tenants/${tenantId}/logo` : null,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
          schoolSlogan: profile.slogan,
        };
      }
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      return { schoolName: tenant?.name || 'Établissement' };
    } catch {
      return { schoolName: 'Établissement' };
    }
  }

  // ─── Helper : identité du niveau SECONDAIRE (écoles combinées) ───────────
  //    ⭐ 2026-11-13 — Identité secondaire : le secondaire d'une école
  //    combinée peut porter un nom/logo/contacts DIFFÉRENTS
  //    (tenant_level_identity_profiles). Overlay via le helper commun
  //    (cache 60 s) mappé vers les noms school* lus par le template ;
  //    PV maternelle/primaire ou sans identité secondaire configurée ⇒
  //    branding global inchangé (champ par champ si override partiel).
  private async applySecondaryIdentity(tenantId: string, branding: any, isSecondary: boolean) {
    if (!isSecondary) return branding;
    const overlay = await resolveLevelIdentityOverlay(this.prisma, tenantId, { isSecondary: true });
    if (!overlay) return branding;
    const merged: any = applyLevelIdentityOverlay(branding, overlay);
    return {
      ...merged,
      schoolLogo: overlay.logoUrl || merged.schoolLogo || null,
      schoolAddress: overlay.address || merged.schoolAddress || null,
      schoolPhone: overlay.phonePrimary || merged.schoolPhone || null,
      schoolEmail: overlay.email || merged.schoolEmail || null,
      schoolSlogan: overlay.slogan || merged.schoolSlogan || null,
    };
  }

  /**
   * POST /api/institutional-exams/pv-stats-promotion/proces-verbal
   * Body: ProcVerbalPdfData (sans branding — résolu côté backend)
   */
  @Post('proces-verbal')
  @Permissions('exams.read')
  async generateProcVerbalPdf(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    let branding: any = await this.getTenantBranding(resolvedTenantId);
    const isSecondary = this.resolveIsSecondary(body.scopeLevel);
    // ⭐ 2026-11-13 — Identité secondaire : overlay du secondaire (écoles
    //    combinées) appliqué au branding — isSecondary posé comme avant.
    branding = await this.applySecondaryIdentity(resolvedTenantId, branding, isSecondary);
    branding.isSecondary = isSecondary;
    const buffer = await this.pdfService.generateProcVerbalPdf({ ...body, branding, isSecondary });
    const safeClass = (body.className || 'classe').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const safePeriod = (body.periodName || 'periode').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const modePrefix = body.pvMode === 'annuel' ? 'pv_annuel' : body.pvMode === 'trimestriel' ? 'pv_trimestriel' : 'pv_evaluation';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${modePrefix}_${safeClass}_${safePeriod}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * POST /api/institutional-exams/pv-stats-promotion/statistiques
   * Body: StatsPdfData (sans branding — résolu côté backend)
   */
  @Post('statistiques')
  @Permissions('exams.read')
  async generateStatsPdf(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    let branding: any = await this.getTenantBranding(resolvedTenantId);
    const isSecondary = this.resolveIsSecondary(body.scopeLevel);
    // ⭐ 2026-11-13 — Identité secondaire : overlay du secondaire (écoles
    //    combinées) appliqué au branding — isSecondary posé comme avant.
    branding = await this.applySecondaryIdentity(resolvedTenantId, branding, isSecondary);
    branding.isSecondary = isSecondary;
    const buffer = await this.pdfService.generateStatsPdf({ ...body, branding, isSecondary });
    const safeClass = (body.className || 'classe').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const safeSubtab = body.subTab || 'stats';
    const modePrefix = body.statMode === 'annuel' ? 'stats_annuel' : body.statMode === 'trimestriel' ? 'stats_trimestriel' : 'stats_evaluation';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${modePrefix}_${safeSubtab}_${safeClass}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * POST /api/institutional-exams/pv-stats-promotion/promotion
   * Body: PromotionPdfData (sans branding — résolu côté backend)
   */
  @Post('promotion')
  @Permissions('exams.read')
  async generatePromotionPdf(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    let branding: any = await this.getTenantBranding(resolvedTenantId);
    const isSecondary = this.resolveIsSecondary(body.scopeLevel);
    // ⭐ 2026-11-13 — Identité secondaire : overlay du secondaire (écoles
    //    combinées) appliqué au branding — isSecondary posé comme avant.
    branding = await this.applySecondaryIdentity(resolvedTenantId, branding, isSecondary);
    branding.isSecondary = isSecondary;
    const buffer = await this.pdfService.generatePromotionPdf({ ...body, branding, isSecondary });
    const safeClass = (body.className || 'classe').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="promotion_${safeClass}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
