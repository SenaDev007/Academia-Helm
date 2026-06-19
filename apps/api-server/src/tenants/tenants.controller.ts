import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Logger, Res } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { DomainManagementService } from '../common/services/domain-management.service';
import { PrismaService } from '../database/prisma.service';

@Controller('tenants')
export class TenantsController {
  private readonly logger = new Logger(TenantsController.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly domainManagementService: DomainManagementService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================================
  // STATIC ROUTES (must be before dynamic :id routes)
  // ============================================================================

  @Public()
  @Post()
  create(@Body() createTenantDto: Partial<any>) {
    return this.tenantsService.create(createTenantDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  // ============================================================================
  // DOMAIN MANAGEMENT ENDPOINTS (static paths, before :id)
  // ============================================================================

  /**
   * Seed les sous-domaines pour tous les tenants existants
   * POST /api/tenants/domains/seed?dryRun=true&slug=ecole-x
   *
   * Crée les CNAME Cloudflare + domaines Vercel + TenantDomain en DB
   * pour tous les tenants actifs ayant un sous-domaine.
   */
  @UseGuards(JwtAuthGuard)
  @Post('domains/seed')
  async seedDomains(
    @Query('dryRun') dryRun?: string,
    @Query('slug') slug?: string,
  ) {
    const isDryRun = dryRun === 'true';

    if (!this.domainManagementService.isConfigured()) {
      return {
        success: false,
        error: 'Domain management not configured. Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, VERCEL_API_TOKEN, VERCEL_PROJECT_ID',
      };
    }

    this.logger.log(`🔗 Domain seed started (dryRun=${isDryRun}, slug=${slug || 'all'})`);

    // Récupérer tous les tenants actifs avec sous-domaine
    const tenants: { id: string; name: string; slug: string; subdomain: string | null; status: string }[] =
      await this.prisma.$queryRaw`
        SELECT id, name, slug, subdomain, status
        FROM tenants
        WHERE subdomain IS NOT NULL
          AND status = 'active'
        ORDER BY name ASC
      `;

    // Filtrer par slug si demandé
    const filtered = slug
      ? tenants.filter(t => t.slug === slug || t.subdomain === slug)
      : tenants;

    if (filtered.length === 0) {
      return {
        success: true,
        message: 'Aucun tenant à traiter',
        total: 0,
        results: [],
      };
    }

    if (isDryRun) {
      return {
        success: true,
        message: `DRY RUN — ${filtered.length} tenant(s) seraient traités`,
        total: filtered.length,
        tenants: filtered.map(t => ({
          name: t.name,
          subdomain: t.subdomain,
          domain: `${t.subdomain}.${process.env.APP_BASE_DOMAIN || 'academiahelm.com'}`,
        })),
      };
    }

    // Traiter chaque tenant
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const tenant of filtered) {
      try {
        const result = await this.domainManagementService.createSchoolSubdomain(
          tenant.subdomain!,
          tenant.id,
        );
        results.push({
          tenantId: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          domain: result.domain,
          success: result.success,
          cloudflare: result.cloudflareCreated,
          vercel: result.vercelAdded,
          vercelVerified: result.vercelVerified,
          dbTracked: result.dbTracked,
          error: result.error,
        });

        if (result.success) successCount++;
        else failCount++;

        // Pause de 1s entre chaque pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          tenantId: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          domain: `${tenant.subdomain}.${process.env.APP_BASE_DOMAIN || 'academiahelm.com'}`,
          success: false,
          error: error.message,
        });
        failCount++;
      }
    }

    this.logger.log(`✅ Domain seed completed: ${successCount} success, ${failCount} failed`);

    return {
      success: failCount === 0,
      message: `${filtered.length} tenant(s) traité(s) — ${successCount} succès, ${failCount} échec(s)`,
      total: filtered.length,
      successCount,
      failCount,
      results,
    };
  }

  /**
   * Vérifie le statut des domaines pour tous les tenants (ou un seul)
   * GET /api/tenants/domains/status?slug=ecole-x
   */
  @UseGuards(JwtAuthGuard)
  @Get('domains/status')
  async getDomainsStatus(@Query('slug') slug?: string) {
    const tenants: { id: string; name: string; slug: string; subdomain: string | null; status: string }[] =
      await this.prisma.$queryRaw`
        SELECT id, name, slug, subdomain, status
        FROM tenants
        WHERE subdomain IS NOT NULL
        ORDER BY name ASC
      `;

    const filtered = slug
      ? tenants.filter(t => t.slug === slug || t.subdomain === slug)
      : tenants;

    const baseDomain = process.env.APP_BASE_DOMAIN || 'academiahelm.com';
    const isConfigured = this.domainManagementService.isConfigured();

    const statuses = await Promise.all(
      filtered.map(async (tenant) => {
        const fullDomain = `${tenant.subdomain}.${baseDomain}`;
        const domainStatus = await this.domainManagementService.checkDomainStatus(fullDomain);
        return {
          tenantId: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          domain: fullDomain,
          ...domainStatus,
        };
      }),
    );

    return {
      isConfigured,
      baseDomain,
      total: statuses.length,
      domains: statuses,
    };
  }

  /**
   * Retente la vérification Vercel pour un sous-domaine spécifique
   * POST /api/tenants/domains/retry-verification?slug=ecole-x
   */
  @UseGuards(JwtAuthGuard)
  @Post('domains/retry-verification')
  async retryVerification(@Query('slug') slug: string) {
    if (!slug) {
      return { success: false, error: 'slug parameter is required' };
    }

    // Trouver le tenant
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { slug },
          { subdomain: slug },
        ],
        subdomain: { not: null },
      },
    });

    if (!tenant || !tenant.subdomain) {
      return { success: false, error: `No active tenant found with slug/subdomain: ${slug}` };
    }

    const result = await this.domainManagementService.retryVerification(tenant.subdomain, tenant.id);
    return result;
  }

  // ============================================================================
  // DYNAMIC ROUTES (after static paths)
  // ============================================================================

  @UseGuards(JwtAuthGuard)
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  @Public()
  @Get('by-subdomain/:subdomain')
  findBySubdomain(@Param('subdomain') subdomain: string) {
    return this.tenantsService.findBySubdomain(subdomain);
  }

  /**
   * Sert le logo d'un tenant directement en tant qu'image.
   * Endpoint public (pas d'auth requis) utilisé par les emails pour
   * afficher le logo de l'école via une URL au lieu d'un base64.
   *
   * URL: GET /api/tenants/:tenantId/logo
   * Retourne: image/jpeg ou image/png (redirection 302 si URL externe)
   */
  @Public()
  @Get(':tenantId/logo')
  async getTenantLogo(@Param('tenantId') tenantId: string, @Res() res: any) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { logoUrl: true },
      });

      if (!profile?.logoUrl) {
        // Pas de logo → retourner 404
        return res.status(404).send('No logo');
      }

      // Si c'est une URL http(s) → rediriger
      if (profile.logoUrl.startsWith('http')) {
        return res.redirect(302, profile.logoUrl);
      }

      // Si c'est du base64 (data:image/...) → extraire et servir directement
      const matches = profile.logoUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        res.set('Content-Type', mimeType);
        res.set('Cache-Control', 'public, max-age=86400'); // Cache 24h
        return res.send(buffer);
      }

      return res.status(404).send('Invalid logo format');
    } catch (err: any) {
      this.logger.error(`getTenantLogo failed: ${err.message}`);
      return res.status(404).send('Logo error');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTenantDto: Partial<any>) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}
