/**
 * ============================================================================
 * CMS CONTROLLER — SITE PUBLIC ADMINISTRATION (Raw SQL version)
 * ============================================================================
 *
 * Utilise prisma.$queryRaw et prisma.$executeRaw au lieu des modèles Prisma
 * pour contourner le problème de "prisma generate" non exécuté après l'ajout
 * des modèles CMS au schéma.
 *
 * Les tables sont créées via /api/billing/admin/apply-migrations (CREATE TABLE
 * IF NOT EXISTS).
 * ============================================================================
 */

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Headers,
  BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller('platform')
@Public()
export class CmsController {
  private readonly logger = new Logger(CmsController.name);

  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(adminEmail?: string): void {
    if (!adminEmail) {
      throw new ForbiddenException('Accès réservé aux administrateurs plateforme.');
    }
    this.logger.log(`CMS API access by admin: ${adminEmail}`);
  }

  // ─── BLOG ARTICLES ──────────────────────────────────────────────────

  @Get('blog')
  async listBlog(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(adminEmail);
    const p = Math.max(1, parseInt(page || '1', 10));
    const l = Math.min(100, parseInt(limit || '20', 10));
    const offset = (p - 1) * l;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'ALL') {
      where += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    if (search) {
      where += ` AND (title ILIKE $${params.length + 1} OR excerpt ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    const articles = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM blog_articles ${where} ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      ...params, l, offset,
    );

    const countResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM blog_articles ${where}`,
      ...params,
    );

    return {
      articles,
      total: (countResult as any[])?.[0]?.total || 0,
      page: p,
      limit: l,
    };
  }

  @Post('blog')
  async createBlog(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Body() body: any,
  ) {
    this.assertAdmin(adminEmail);
    if (!body?.title) throw new BadRequestException('title est requis');
    const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const now = new Date();
    const result = await this.prisma.$queryRawUnsafe(
      `INSERT INTO blog_articles (id, title, slug, excerpt, content, "coverImageUrl", category, tags, "seoTitle", "seoDescription", status, "publishedAt", "authorId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) RETURNING *`,
      body.title, slug, body.excerpt || null, body.content || null, body.coverImageUrl || null,
      body.category || null, body.tags || null, body.seoTitle || null, body.seoDescription || null,
      body.status || 'DRAFT',
      body.status === 'PUBLISHED' ? now : null,
      adminEmail,
    );
    return (result as any[])[0];
  }

  @Patch('blog/:id')
  async updateBlog(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdmin(adminEmail);
    const fields = ['title', 'slug', 'excerpt', 'content', 'coverImageUrl', 'category', 'tags', 'seoTitle', 'seoDescription', 'status'];
    const sets: string[] = [];
    const params: any[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) {
        params.push(body[f]);
        sets.push(`"${f}" = $${params.length}`);
      }
    }
    if (body.status === 'PUBLISHED') {
      sets.push(`"publishedAt" = COALESCE("publishedAt", NOW())`);
    }
    if (sets.length === 0) throw new BadRequestException('Aucun champ à mettre à jour');
    sets.push(`"updatedAt" = NOW()`);
    params.push(id);
    const result = await this.prisma.$queryRawUnsafe(
      `UPDATE blog_articles SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      ...params,
    );
    return (result as any[])[0] || { error: 'Article non trouvé' };
  }

  @Delete('blog/:id')
  async deleteBlog(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
  ) {
    this.assertAdmin(adminEmail);
    await this.prisma.$executeRawUnsafe(`DELETE FROM blog_articles WHERE id = $1`, id);
    return { ok: true, id };
  }

  // ─── CMS PAGES ──────────────────────────────────────────────────────

  @Get('cms-pages')
  async listCmsPages(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdmin(adminEmail);
    return await this.prisma.$queryRawUnsafe(`SELECT * FROM cms_pages ORDER BY "createdAt" DESC`);
  }

  @Post('cms-pages')
  async createCmsPage(@Headers('x-platform-admin-email') adminEmail: string, @Body() body: any) {
    this.assertAdmin(adminEmail);
    if (!body?.slug || !body?.title) throw new BadRequestException('slug et title sont requis');
    const result = await this.prisma.$queryRawUnsafe(
      `INSERT INTO cms_pages (id, slug, title, content, "seoTitle", "seoDescription", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
      body.slug, body.title, body.content ? JSON.stringify(body.content) : null,
      body.seoTitle || null, body.seoDescription || null, body.isActive !== false,
    );
    return (result as any[])[0];
  }

  @Patch('cms-pages/:id')
  async updateCmsPage(@Headers('x-platform-admin-email') adminEmail: string, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(adminEmail);
    const fields = ['slug', 'title', 'seoTitle', 'seoDescription'];
    const sets: string[] = [];
    const params: any[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { params.push(body[f]); sets.push(`"${f}" = $${params.length}`); }
    }
    if (body.content !== undefined) { params.push(JSON.stringify(body.content)); sets.push(`content = $${params.length}`); }
    if (body.isActive !== undefined) { params.push(body.isActive); sets.push(`"isActive" = $${params.length}`); }
    if (sets.length === 0) throw new BadRequestException('Aucun champ à mettre à jour');
    sets.push(`"updatedAt" = NOW()`);
    params.push(id);
    const result = await this.prisma.$queryRawUnsafe(
      `UPDATE cms_pages SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, ...params,
    );
    return (result as any[])[0] || { error: 'Page non trouvée' };
  }

  @Delete('cms-pages/:id')
  async deleteCmsPage(@Headers('x-platform-admin-email') adminEmail: string, @Param('id') id: string) {
    this.assertAdmin(adminEmail);
    await this.prisma.$executeRawUnsafe(`DELETE FROM cms_pages WHERE id = $1`, id);
    return { ok: true, id };
  }

  // ─── LEGAL PAGES ────────────────────────────────────────────────────

  @Get('legal-pages')
  async listLegalPages(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdmin(adminEmail);
    return await this.prisma.$queryRawUnsafe(`SELECT * FROM legal_pages ORDER BY code ASC`);
  }

  @Post('legal-pages')
  async createLegalPage(@Headers('x-platform-admin-email') adminEmail: string, @Body() body: any) {
    this.assertAdmin(adminEmail);
    if (!body?.code || !body?.title) throw new BadRequestException('code et title sont requis');
    const result = await this.prisma.$queryRawUnsafe(
      `INSERT INTO legal_pages (id, code, title, content, version, "isActive", "effectiveDate", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, NOW(), NOW(), NOW()) RETURNING *`,
      body.code, body.title, body.content || null, body.isActive !== false,
    );
    return (result as any[])[0];
  }

  @Patch('legal-pages/:id')
  async updateLegalPage(@Headers('x-platform-admin-email') adminEmail: string, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(adminEmail);
    const sets: string[] = [];
    const params: any[] = [];
    if (body.title !== undefined) { params.push(body.title); sets.push(`title = $${params.length}`); }
    if (body.content !== undefined) { params.push(body.content); sets.push(`content = $${params.length}`); sets.push(`version = version + 1`); sets.push(`"effectiveDate" = NOW()`); }
    if (body.isActive !== undefined) { params.push(body.isActive); sets.push(`"isActive" = $${params.length}`); }
    if (sets.length === 0) throw new BadRequestException('Aucun champ à mettre à jour');
    sets.push(`"updatedAt" = NOW()`);
    params.push(id);
    const result = await this.prisma.$queryRawUnsafe(
      `UPDATE legal_pages SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, ...params,
    );
    return (result as any[])[0] || { error: 'Page non trouvée' };
  }

  @Delete('legal-pages/:id')
  async deleteLegalPage(@Headers('x-platform-admin-email') adminEmail: string, @Param('id') id: string) {
    this.assertAdmin(adminEmail);
    await this.prisma.$executeRawUnsafe(`DELETE FROM legal_pages WHERE id = $1`, id);
    return { ok: true, id };
  }

  // ─── SEO META ───────────────────────────────────────────────────────

  @Get('seo')
  async listSeoMeta(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdmin(adminEmail);
    return { metas: await this.prisma.$queryRawUnsafe(`SELECT * FROM seo_meta ORDER BY "pagePath" ASC`) };
  }

  @Post('seo')
  async createSeoMeta(@Headers('x-platform-admin-email') adminEmail: string, @Body() body: any) {
    this.assertAdmin(adminEmail);
    if (!body?.pagePath) throw new BadRequestException('pagePath est requis');
    const result = await this.prisma.$queryRawUnsafe(
      `INSERT INTO seo_meta (id, "pagePath", title, description, "ogTitle", "ogDescription", "ogImageUrl", keywords, "canonicalUrl", "noIndex", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      body.pagePath, body.title || null, body.description || null,
      body.ogTitle || null, body.ogDescription || null, body.ogImageUrl || null,
      body.keywords || null, body.canonicalUrl || null, body.noIndex || false,
    );
    return (result as any[])[0];
  }

  @Patch('seo/:id')
  async updateSeoMeta(@Headers('x-platform-admin-email') adminEmail: string, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(adminEmail);
    const fields = ['pagePath', 'title', 'description', 'ogTitle', 'ogDescription', 'ogImageUrl', 'keywords', 'canonicalUrl'];
    const sets: string[] = [];
    const params: any[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { params.push(body[f]); sets.push(`"${f}" = $${params.length}`); }
    }
    if (body.noIndex !== undefined) { params.push(body.noIndex); sets.push(`"noIndex" = $${params.length}`); }
    if (sets.length === 0) throw new BadRequestException('Aucun champ à mettre à jour');
    sets.push(`"updatedAt" = NOW()`);
    params.push(id);
    const result = await this.prisma.$queryRawUnsafe(
      `UPDATE seo_meta SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, ...params,
    );
    return (result as any[])[0] || { error: 'SEO meta non trouvé' };
  }

  @Delete('seo/:id')
  async deleteSeoMeta(@Headers('x-platform-admin-email') adminEmail: string, @Param('id') id: string) {
    this.assertAdmin(adminEmail);
    await this.prisma.$executeRawUnsafe(`DELETE FROM seo_meta WHERE id = $1`, id);
    return { ok: true, id };
  }

  // ─── MEDIA ASSETS ───────────────────────────────────────────────────

  @Get('media')
  async listMedia(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(adminEmail);
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (type && type !== 'ALL') {
      where += ` AND type = $${params.length + 1}`;
      params.push(type);
    }
    if (search) {
      where += ` AND name ILIKE $${params.length + 1}`;
      params.push(`%${search}%`);
    }
    const assets = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM media_assets ${where} ORDER BY "createdAt" DESC LIMIT 200`,
      ...params,
    );
    return { assets };
  }

  @Post('media')
  async createMedia(@Headers('x-platform-admin-email') adminEmail: string, @Body() body: any) {
    this.assertAdmin(adminEmail);
    if (!body?.name || !body?.url) throw new BadRequestException('name et url sont requis');
    const result = await this.prisma.$queryRawUnsafe(
      `INSERT INTO media_assets (id, name, url, type, size, alt, tags, "uploadedBy", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      body.name, body.url, body.type || 'image', body.size || null,
      body.alt || null, body.tags || null, adminEmail,
    );
    return (result as any[])[0];
  }

  @Patch('media/:id')
  async updateMedia(@Headers('x-platform-admin-email') adminEmail: string, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(adminEmail);
    const fields = ['name', 'url', 'type', 'size', 'alt', 'tags'];
    const sets: string[] = [];
    const params: any[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { params.push(body[f]); sets.push(`"${f}" = $${params.length}`); }
    }
    if (sets.length === 0) throw new BadRequestException('Aucun champ à mettre à jour');
    sets.push(`"updatedAt" = NOW()`);
    params.push(id);
    const result = await this.prisma.$queryRawUnsafe(
      `UPDATE media_assets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, ...params,
    );
    return (result as any[])[0] || { error: 'Média non trouvé' };
  }

  @Delete('media/:id')
  async deleteMedia(@Headers('x-platform-admin-email') adminEmail: string, @Param('id') id: string) {
    this.assertAdmin(adminEmail);
    await this.prisma.$executeRawUnsafe(`DELETE FROM media_assets WHERE id = $1`, id);
    return { ok: true, id };
  }
}
