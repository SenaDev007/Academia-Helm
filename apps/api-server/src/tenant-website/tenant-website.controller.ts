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
import { OpenRouterService } from '../common/services/openrouter.service';
import { SkipThrottle } from '@nestjs/throttler';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Helper pour résoudre le tenantId depuis @GetTenant() ou @TenantId() fallback.
 */
function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

@Controller('tenant-website')
@Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PROMOTER', 'admin')
export class TenantWebsiteController {
  private readonly logger = new Logger(TenantWebsiteController.name);

  constructor(
    private readonly websiteService: TenantWebsiteService,
    private readonly prisma: PrismaService,
    private readonly openRouter: OpenRouterService,
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

  /**
   * POST /api/tenant-website/public/:tenantSlug/chat
   * Chatbot IA public — répond aux questions des visiteurs en se basant sur
   * les données publiques du site (FAQ, présentation, admissions, etc.).
   *
   * Body: { message: string, history?: Array<{role: 'user'|'assistant', content: string}> }
   * Response: { reply: string, sources?: string[] }
   */
  @Public()
  @SkipThrottle()
  @Post('public/:tenantSlug/chat')
  async publicChat(
    @Param('tenantSlug') tenantSlug: string,
    @Body() body: { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> },
  ) {
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      throw new BadRequestException('Le message est requis');
    }
    if (body.message.length > 1000) {
      throw new BadRequestException('Le message est trop long (max 1000 caractères)');
    }

    // Résoudre le tenant
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { subdomain: tenantSlug }],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new BadRequestException('Établissement introuvable');
    }

    // Charger les données publiques (FAQ + config) pour le contexte IA
    const publicData = await this.websiteService.getPublicWebsiteData(tenant.id);
    if (!publicData) {
      throw new BadRequestException('Site institutionnel non configuré');
    }

    const { website, faqItems } = publicData;

    // Construire le contexte pour l'IA
    const faqContext = faqItems && faqItems.length > 0
      ? faqItems.map((f: any) => `Q: ${f.question}\nR: ${f.answer}`).join('\n\n')
      : 'Aucune FAQ disponible.';

    const schoolInfo = [
      `Établissement: ${tenant.name}`,
      website?.heroTitle ? `Slogan: ${website.heroTitle}` : null,
      website?.heroSubtitle ? `Description: ${website.heroSubtitle}` : null,
      website?.presentationContent ? `Présentation: ${website.presentationContent}` : null,
      website?.admissionsContent ? `Admissions: ${website.admissionsContent}` : null,
      website?.schoolLifeContent ? `Vie scolaire: ${website.schoolLifeContent}` : null,
      website?.contactEmail ? `Email: ${website.contactEmail}` : null,
      website?.contactPhone ? `Téléphone: ${website.contactPhone}` : null,
      website?.contactAddress ? `Adresse: ${website.contactAddress}` : null,
    ].filter(Boolean).join('\n');

    const systemPrompt = `Tu es l'assistant virtuel du site institutionnel de l'établissement "${tenant.name}".
Ton rôle est d'aider les visiteurs (parents, élèves, candidats) en répondant à leurs questions sur l'établissement.

INFORMATIONS SUR L'ÉTABLISSEMENT:
${schoolInfo}

FAQ (Questions fréquentes):
${faqContext}

RÈGLES:
1. Réponds uniquement en français.
2. Sois courtois, précis et concis (max 3-4 phrases).
3. Si la question porte sur des informations disponibles dans le contexte ci-dessus, utilise-les.
4. Si tu ne connais pas la réponse, invite le visiteur à contacter l'établissement par email ou téléphone.
5. N'invente JAMAIS d'informations (frais, dates, programmes) qui ne sont pas dans le contexte.
6. Redirige vers la pré-inscription si la question concerne l'admission ou l'inscription.

Message de bienvenue par défaut: ${website?.aiWelcomeMessage || 'Bonjour ! Comment puis-je vous aider ?'}`;

    // Construire l'historique des messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (Array.isArray(body.history)) {
      for (const m of body.history.slice(-6)) { // Garde seulement les 6 derniers échanges
        if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }

    messages.push({ role: 'user', content: body.message });

    try {
      const response = await this.openRouter.chat({
        messages,
        temperature: 0.7,
        maxTokens: 500,
      });

      return {
        reply: response.content || 'Désolé, je n\'ai pas pu traiter votre demande. N\'hésitez pas à nous contacter directement.',
        sources: [],
      };
    } catch (err: any) {
      this.logger.error(`Chat IA failed: ${err.message}`);
      // Fallback : si l'IA échoue, on tente un matching FAQ simple
      const msg = body.message.toLowerCase();
      const faqMatch = faqItems?.find((f: any) => {
        const q = (f.question || '').toLowerCase();
        return q.split(' ').some((word: string) => word.length > 3 && msg.includes(word));
      });

      if (faqMatch) {
        return { reply: faqMatch.answer, sources: ['FAQ'] };
      }

      return {
        reply: 'Désolé, je rencontre un problème technique. Pour toute question, n\'hésitez pas à nous contacter directement par email ou téléphone.',
        sources: [],
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CONFIGURATION GLOBALE (auth requise)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get()
  async getWebsiteConfig(@GetTenant() tenant: any, @TenantId() tidFallback?: string) {
    const tid = resolveTid(tenant, tidFallback);
    return this.websiteService.getWebsiteConfig(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('news/:id')
  async updateNewsArticle(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateNewsArticle(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('events')
  async getEvents(
    @GetTenant() tenant: any,
    @Query('status') status?: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.getEvents(tid, { status });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('events/:id')
  async updateEvent(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateEvent(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('gallery')
  async getGalleryItems(@GetTenant() tenant: any) {
    const tid = resolveTid(tenant);
    return this.websiteService.getGalleryItems(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Post('gallery')
  async createGalleryItem(
    @GetTenant() tenant: any,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    if (!body.imageUrl) throw new BadRequestException('URL de l\'image est requise');
    return this.websiteService.createGalleryItem(tid, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('gallery/:id')
  async updateGalleryItem(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateGalleryItem(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('testimonials')
  async getTestimonials(@GetTenant() tenant: any) {
    const tid = resolveTid(tenant);
    return this.websiteService.getTestimonials(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('testimonials/:id')
  async updateTestimonial(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateTestimonial(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('faq')
  async getFaqItems(@GetTenant() tenant: any) {
    const tid = resolveTid(tenant);
    return this.websiteService.getFaqItems(tid);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('faq/:id')
  async updateFaqItem(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateFaqItem(tid, id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('contact')
  async getContactMessages(
    @GetTenant() tenant: any,
    @Query('status') status?: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.getContactMessages(tid, { status });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('contact/:id')
  async updateContactMessageStatus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.updateContactMessageStatus(tid, id, body.status);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Delete('contact/:id')
  async deleteContactMessage(
    @GetTenant() tenant: any,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant);
    return this.websiteService.deleteContactMessage(tid, id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SECTIONS PAR NIVEAU SCOLAIRE (multi-niveaux)
  // ═══════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('level-sections')
  async getLevelSections(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    // S'assurer que la config website existe
    await this.websiteService.getWebsiteConfig(tid);
    const sections = await this.prisma.tenantWebsiteLevelSection.findMany({
      where: { tenantId: tid },
      include: { schoolLevel: { select: { id: true, code: true, name: true, label: true } } },
    });
    return sections;
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put('level-sections/:schoolLevelId')
  async upsertLevelSection(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('schoolLevelId') schoolLevelId: string,
    @Body() body: any,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    // S'assurer que la config website existe
    const website = await this.websiteService.getWebsiteConfig(tid);

    // Vérifier que le schoolLevel appartient au tenant
    const level = await this.prisma.schoolLevel.findFirst({
      where: { id: schoolLevelId, tenantId: tid },
    });
    if (!level) throw new BadRequestException('Niveau scolaire introuvable');

    // Upsert
    const existing = await this.prisma.tenantWebsiteLevelSection.findFirst({
      where: { tenantId: tid, schoolLevelId },
    });

    const allowedFields = [
      'directorWord', 'directorName', 'directorPhotoUrl', 'directorIsActive',
      'presentationTitle', 'presentationContent', 'presentationIsActive',
      'admissionsTitle', 'admissionsContent', 'admissionsIsActive',
      'schoolLifeTitle', 'schoolLifeContent', 'schoolLifeIsActive',
    ];
    const data: any = {};
    for (const f of allowedFields) {
      if (body[f] !== undefined) data[f] = body[f];
    }

    if (existing) {
      return this.prisma.tenantWebsiteLevelSection.update({
        where: { id: existing.id },
        data,
        include: { schoolLevel: { select: { id: true, code: true, name: true, label: true } } },
      });
    } else {
      return this.prisma.tenantWebsiteLevelSection.create({
        data: {
          tenantId: tid,
          websiteId: website.id,
          schoolLevelId,
          ...data,
        },
        include: { schoolLevel: { select: { id: true, code: true, name: true, label: true } } },
      });
    }
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Delete('level-sections/:schoolLevelId')
  async deleteLevelSection(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('schoolLevelId') schoolLevelId: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    await this.prisma.tenantWebsiteLevelSection.deleteMany({
      where: { tenantId: tid, schoolLevelId },
    });
    return { success: true };
  }
}
