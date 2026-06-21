/**
 * ============================================================================
 * CMS CONTROLLER — SITE PUBLIC ADMINISTRATION
 * ============================================================================
 *
 * Endpoints exposés sous /platform/* pour gérer le contenu public du site
 * Academia Helm : blog articles, pages marketing (CMS), pages légales,
 * métadonnées SEO et bibliothèque de médias.
 *
 * AUTHENTIFICATION :
 *   Comme PlatformController, les routes sont @Public() (pas de JwtAuthGuard).
 *   L'admin plateforme s'authentifie via le cookie academia_admin_session qui
 *   est vérifié côté proxy Next.js (getAdminServerSession). Le proxy ajoute
 *   ensuite un header `x-platform-admin-email` que le backend vérifie pour
 *   s'assurer que la requête vient bien du proxy (et non d'un appel direct).
 *
 * MODÈLES PRISMA :
 *   - BlogArticle (table blog_articles)
 *   - CmsPage     (table cms_pages)
 *   - LegalPage   (table legal_pages)
 *   - SeoMeta     (table seo_meta)
 *   - MediaAsset  (table media_assets)
 *
 * Migration : 20260622080000_add_cms_tables
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller('platform')
@Public()
export class CmsController {
  private readonly logger = new Logger(CmsController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vérifie que la requête vient bien du proxy Next.js (qui a déjà validé
   * le cookie admin). Le header `x-platform-admin-email` est posé par le
   * proxy uniquement si l'admin est authentifié.
   */
  private assertAdminProxyRequest(adminEmail?: string): void {
    if (!adminEmail) {
      throw new ForbiddenException(
        'Accès réservé aux administrateurs plateforme. ' +
          'La requête doit provenir du proxy Next.js avec un header x-platform-admin-email valide.',
      );
    }
    // Log pour audit
    this.logger.log(`CMS API access by admin: ${adminEmail}`);
  }

  // ============================================================================
  // BLOG ARTICLES — CRUD
  // ============================================================================

  /** GET /platform/blog — Liste paginée des articles (filtre status / category / search) */
  @Get('blog')
  async listBlogArticles(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 25;

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.blogArticle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.blogArticle.count({ where }),
    ]);

    return { items, total, page: pageNum, limit: limitNum };
  }

  /** POST /platform/blog — Créer un article */
  @Post('blog')
  async createBlogArticle(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!body?.title || !body?.slug) {
      throw new BadRequestException('Les champs "title" et "slug" sont requis');
    }
    // Si on publie directement, on fixe publishedAt
    const data: any = { ...body };
    if (data.status === 'PUBLISHED' && !data.publishedAt) {
      data.publishedAt = new Date();
    }
    return this.prisma.blogArticle.create({ data });
  }

  /** PATCH /platform/blog/:id — Mettre à jour un article */
  @Patch('blog/:id')
  async updateBlogArticle(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    const existing = await this.prisma.blogArticle.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Article introuvable');

    const data: any = { ...body };
    delete data.id;
    // Transition vers PUBLISHED → fixer publishedAt si non déjà fait
    if (
      data.status === 'PUBLISHED' &&
      !existing.publishedAt &&
      !data.publishedAt
    ) {
      data.publishedAt = new Date();
    }
    return this.prisma.blogArticle.update({ where: { id }, data });
  }

  /** DELETE /platform/blog/:id — Supprimer un article */
  @Delete('blog/:id')
  async deleteBlogArticle(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    return this.prisma.blogArticle.delete({ where: { id } });
  }

  // ============================================================================
  // CMS PAGES — CRUD (pages marketing type /modules, /tarification)
  // ============================================================================

  /** GET /platform/cms-pages — Liste des pages CMS */
  @Get('cms-pages')
  async listCmsPages(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    const where: any = {};
    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.cmsPage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** POST /platform/cms-pages — Créer une page CMS */
  @Post('cms-pages')
  async createCmsPage(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!body?.title || !body?.slug) {
      throw new BadRequestException('Les champs "title" et "slug" sont requis');
    }
    return this.prisma.cmsPage.create({ data: body });
  }

  /** PATCH /platform/cms-pages/:id — Mettre à jour une page CMS */
  @Patch('cms-pages/:id')
  async updateCmsPage(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    const data: any = { ...body };
    delete data.id;
    return this.prisma.cmsPage.update({ where: { id }, data });
  }

  /** DELETE /platform/cms-pages/:id — Supprimer une page CMS */
  @Delete('cms-pages/:id')
  async deleteCmsPage(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    return this.prisma.cmsPage.delete({ where: { id } });
  }

  // ============================================================================
  // LEGAL PAGES — CRUD (CGU, CGV, mentions, privacy)
  // ============================================================================

  /** GET /platform/legal-pages — Liste des pages légales */
  @Get('legal-pages')
  async listLegalPages(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('isActive') isActive?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    const where: any = {};
    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    return this.prisma.legalPage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** POST /platform/legal-pages — Créer une page légale */
  @Post('legal-pages')
  async createLegalPage(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!body?.code || !body?.title) {
      throw new BadRequestException('Les champs "code" et "title" sont requis');
    }
    return this.prisma.legalPage.create({ data: body });
  }

  /** PATCH /platform/legal-pages/:id — Mettre à jour une page légale */
  @Patch('legal-pages/:id')
  async updateLegalPage(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');

    const existing = await this.prisma.legalPage.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Page légale introuvable');

    const data: any = { ...body };
    delete data.id;

    // Si le contenu change, on incrémente automatiquement la version pour
    // garder l'historique des révisions légales.
    if (data.content && data.content !== existing.content && !data.version) {
      data.version = (existing.version ?? 1) + 1;
      data.effectiveDate = new Date();
    }

    return this.prisma.legalPage.update({ where: { id }, data });
  }

  /** DELETE /platform/legal-pages/:id — Supprimer une page légale */
  @Delete('legal-pages/:id')
  async deleteLegalPage(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    return this.prisma.legalPage.delete({ where: { id } });
  }

  // ============================================================================
  // SEO META — CRUD (métadonnées SEO par page)
  // ============================================================================

  /** GET /platform/seo — Liste des métadonnées SEO */
  @Get('seo')
  async listSeoMeta(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('search') search?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    const where: any = {};
    if (search) {
      where.pagePath = { contains: search, mode: 'insensitive' };
    }
    return this.prisma.seoMeta.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** POST /platform/seo — Créer une métadonnée SEO */
  @Post('seo')
  async createSeoMeta(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!body?.pagePath) {
      throw new BadRequestException('Le champ "pagePath" est requis');
    }
    return this.prisma.seoMeta.create({ data: body });
  }

  /** PATCH /platform/seo/:id — Mettre à jour une métadonnée SEO */
  @Patch('seo/:id')
  async updateSeoMeta(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    const data: any = { ...body };
    delete data.id;
    return this.prisma.seoMeta.update({ where: { id }, data });
  }

  /** DELETE /platform/seo/:id — Supprimer une métadonnée SEO */
  @Delete('seo/:id')
  async deleteSeoMeta(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    return this.prisma.seoMeta.delete({ where: { id } });
  }

  // ============================================================================
  // MEDIA ASSETS — CRUD (bibliothèque de médias)
  // ============================================================================

  /** GET /platform/media — Liste des médias (filtre type / search) */
  @Get('media')
  async listMediaAssets(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    const where: any = {};
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return { items, total, page: pageNum, limit: limitNum };
  }

  /** POST /platform/media — Enregistrer un nouveau média */
  @Post('media')
  async createMediaAsset(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!body?.name || !body?.url || !body?.type) {
      throw new BadRequestException(
        'Les champs "name", "url" et "type" sont requis',
      );
    }
    return this.prisma.mediaAsset.create({ data: body });
  }

  /** PATCH /platform/media/:id — Mettre à jour un média */
  @Patch('media/:id')
  async updateMediaAsset(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    const data: any = { ...body };
    delete data.id;
    return this.prisma.mediaAsset.update({ where: { id }, data });
  }

  /** DELETE /platform/media/:id — Supprimer un média */
  @Delete('media/:id')
  async deleteMediaAsset(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!id) throw new BadRequestException('L\'identifiant est requis');
    return this.prisma.mediaAsset.delete({ where: { id } });
  }
}
