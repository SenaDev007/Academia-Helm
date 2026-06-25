/**
 * ============================================================================
 * TENANT WEBSITE CONTROLLER — API pour le CMS du site institutionnel
 * ============================================================================
 *
 * Endpoints:
 *   PUBLIC (pas d'auth):
 *     GET  /api/tenant-website/public/:tenantSlug     — toutes les données publiques
 *     GET  /api/tenant-website/public/:tenantSlug/news/:slug — article par slug
 *     POST /api/tenant-website/public/:tenantSlug/contact — envoyer un message
 *
 *   AUTH (JwtAuthGuard + TenantGuard):
 *     GET    /api/tenant-website                — config du tenant courant
 *     PUT    /api/tenant-website                — mettre à jour la config
 *     GET    /api/tenant-website/news           — liste des actualités
 *     POST   /api/tenant-website/news           — créer une actualité
 *     PUT    /api/tenant-website/news/:id       — modifier une actualité
 *     DELETE /api/tenant-website/news/:id       — supprimer une actualité
 *     (même pattern pour events, gallery, testimonials, faq, contact)
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { TenantWebsiteService } from './tenant-website.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

/**
 * Helper pour résoudre le tenantId depuis @GetTenant() ou @TenantId() fallback.
 */
function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

@Controller('tenant-website')
export class TenantWebsiteController {
  private readonly logger = new Logger(TenantWebsiteController.name);

  constructor(
    private readonly websiteService: TenantWebsiteService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  ENDPOINTS PUBLICS (pas d'auth — pour le site public)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * GET /api/tenant-website/public/:tenantSlug
   * Récupère toutes les données publiques du site institutionnel.
   */
  @Public()
  @Get('public/:tenantSlug')
  async getPublicData(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { subdomain: tenantSlug },
        ],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new BadRequestException('Établissement introuvable');
    }

    return this.websiteService.getPublicWebsiteData(tenant.id);
  }

  /**
   * GET /api/tenant-website/public/:tenantSlug/news/:slug
   * Récupère un article publié par son slug.
   */
  @Public()
  @Get('public/:tenantSlug/news/:slug')
  async getPublicNewsArticle(
    @Param('tenantSlug') tenantSlug: string,
    @Param('slug') slug: string,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { subdomain: tenantSlug }],
      },
      select: { id: true },
    });

    if (!tenant) {
      throw new BadRequestException('Établissement introuvable');
    }

    return this.websiteService.getNewsArticleBySlug(tenant.id, slug);
  }

  /**
   * POST /api/tenant-website/public/:tenantSlug/contact
   * Envoie un message de contact depuis le site public.
   */
  @Public()
  @Post('public/:tenantSlug/contact')
  async sendContactMessage(
    @Param('tenantSlug') tenantSlug: string,
    @Body() body: { name: string; email: string; phone?: string; subject?: string; message: string },
  ) {
    if (!body.name || !body.email || !body.message) {
      throw new BadRequestException('Nom, email et message sont requis');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { subdomain: tenantSlug }],
      },
      select: { id: true },
    });

    if (!tenant) {
      throw new BadRequestException('Établissement introuvable');
    }

    return this.websiteService.createContactMessage(tenant.id, body);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CONFIGURATION GLOBALE (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get()
  async getWebsiteConfig(@GetTenant() tenant: any, @TenantId() tidFallback?: string) {
    const tid = resolveTid(tenant, tidFallback);
    return this.websiteService.getWebsiteConfig(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put()
  async updateWebsiteConfig(
    @GetTenant() tenant: any,
    @TenantId() tidFallback: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant, tidFallback);
    return this.websiteService.updateWebsiteConfig(tid, body);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ACTUALITÉS (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('news')
  async getNewsArticles(
    @GetTenant() tenant: any,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.getNewsArticles(tid, {
      status,
      category,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('news')
  async createNewsArticle(
    @GetTenant() tenant: any,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    if (!body.title || !body.content) {
      throw new BadRequestException('Titre et contenu sont requis');
    }
    return this.websiteService.createNewsArticle(tid, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put('news/:id')
  async updateNewsArticle(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateNewsArticle(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete('news/:id')
  async deleteNewsArticle(
    @GetTenant() tenant: any,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.deleteNewsArticle(tid, id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ÉVÉNEMENTS (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('events')
  async getEvents(
    @GetTenant() tenant: any,
    @Query('status') status?: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.getEvents(tid, { status });
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('events')
  async createEvent(
    @GetTenant() tenant: any,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    if (!body.title || !body.startDate) {
      throw new BadRequestException('Titre et date de début sont requis');
    }
    return this.websiteService.createEvent(tid, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put('events/:id')
  async updateEvent(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateEvent(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete('events/:id')
  async deleteEvent(
    @GetTenant() tenant: any,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.deleteEvent(tid, id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GALERIE (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('gallery')
  async getGalleryItems(@GetTenant() tenant: any) {
    const tid = resolveTid(tenant);
    return this.websiteService.getGalleryItems(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('gallery')
  async createGalleryItem(
    @GetTenant() tenant: any,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    if (!body.imageUrl) throw new BadRequestException('URL de l\'image est requise');
    return this.websiteService.createGalleryItem(tid, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put('gallery/:id')
  async updateGalleryItem(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateGalleryItem(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete('gallery/:id')
  async deleteGalleryItem(
    @GetTenant() tenant: any,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.deleteGalleryItem(tid, id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TÉMOIGNAGES (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('testimonials')
  async getTestimonials(@GetTenant() tenant: any) {
    const tid = resolveTid(tenant);
    return this.websiteService.getTestimonials(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('testimonials')
  async createTestimonial(
    @GetTenant() tenant: any,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    if (!body.authorName || !body.content) {
      throw new BadRequestException('Nom de l\'auteur et contenu sont requis');
    }
    return this.websiteService.createTestimonial(tid, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put('testimonials/:id')
  async updateTestimonial(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateTestimonial(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete('testimonials/:id')
  async deleteTestimonial(
    @GetTenant() tenant: any,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.deleteTestimonial(tid, id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FAQ (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('faq')
  async getFaqItems(@GetTenant() tenant: any) {
    const tid = resolveTid(tenant);
    return this.websiteService.getFaqItems(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('faq')
  async createFaqItem(
    @GetTenant() tenant: any,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    if (!body.question || !body.answer) {
      throw new BadRequestException('Question et réponse sont requises');
    }
    return this.websiteService.createFaqItem(tid, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put('faq/:id')
  async updateFaqItem(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateFaqItem(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete('faq/:id')
  async deleteFaqItem(
    @GetTenant() tenant: any,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.deleteFaqItem(tid, id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  MESSAGES DE CONTACT (auth requise — pour la gestion)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('contact')
  async getContactMessages(
    @GetTenant() tenant: any,
    @Query('status') status?: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.getContactMessages(tid, { status });
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Put('contact/:id')
  async updateContactMessageStatus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateContactMessageStatus(tid, id, body.status);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete('contact/:id')
  async deleteContactMessage(
    @GetTenant() tenant: any,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.deleteContactMessage(tid, id);
  }
}
