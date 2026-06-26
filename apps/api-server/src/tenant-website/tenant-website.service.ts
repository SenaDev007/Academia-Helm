/**
 * ============================================================================
 * TENANT WEBSITE SERVICE — CMS pour le site institutionnel des écoles
 * ============================================================================
 *
 * Gère toute la configuration du site institutionnel d'un tenant :
 *   - Configuration globale (hero, chiffres clés, mots, présentation, footer, SEO)
 *   - Actualités (CRUD)
 *   - Événements / Agenda (CRUD)
 *   - Galerie photos (CRUD)
 *   - Témoignages (CRUD)
 *   - FAQ (CRUD)
 *   - Messages de contact (CRUD)
 *
 * Toutes les méthodes sont scoped par tenantId (isolation multi-tenant).
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class TenantWebsiteService {
  private readonly logger = new Logger(TenantWebsiteService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  CONFIGURATION GLOBALE (TenantWebsite)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Récupère la configuration du site d'un tenant.
   * Crée une config par défaut si elle n'existe pas encore.
   */
  async getWebsiteConfig(tenantId: string) {
    let website = await this.prisma.tenantWebsite.findUnique({
      where: { tenantId },
    });

    if (!website) {
      // Créer une config par défaut
      website = await this.prisma.tenantWebsite.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
        },
      });
      this.logger.log(`Created default TenantWebsite config for tenant ${tenantId}`);
    }

    return website;
  }

  /**
   * Met à jour la configuration du site.
   */
  async updateWebsiteConfig(tenantId: string, data: any) {
    // S'assurer que la config existe
    await this.getWebsiteConfig(tenantId);

    // Filtrer les champs autorisés
    const allowedFields = [
      'heroTitle', 'heroSubtitle', 'heroImageUrl', 'heroCtaText', 'heroCtaUrl', 'heroIsActive',
      'keyFigures',
      'promoterWord', 'promoterName', 'promoterPhotoUrl', 'promoterIsActive',
      'directorWord', 'directorName', 'directorPhotoUrl', 'directorIsActive',
      'presentationTitle', 'presentationContent', 'presentationImageUrl', 'presentationIsActive',
      'admissionsTitle', 'admissionsContent', 'admissionsIsActive',
      'schoolLifeTitle', 'schoolLifeContent', 'schoolLifeIsActive',
      'footerAboutText', 'footerCopyrightText', 'footerIsActive',
      'socialLinks',
      'seoMetaTitle', 'seoMetaDescription', 'seoKeywords', 'seoOgImageUrl',
      'contactEmail', 'contactPhone', 'contactAddress', 'contactMapUrl',
      'customColors',
      'isActive', 'aiEnabled', 'aiWelcomeMessage',
    ];

    const updateData: any = { ...prismaUpdateDefaults() };
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    return this.prisma.tenantWebsite.update({
      where: { tenantId },
      data: updateData,
    });
  }

  /**
   * Récupère toutes les données publiques du site (pour affichage public).
   * Inclut : config, actualités publiées, événements à venir, galerie active,
   * témoignages actifs, FAQ active.
   */
  async getPublicWebsiteData(tenantId: string) {
    // ⚠️ Ne PAS appeler getWebsiteConfig() ici : cette méthode est appelée
    // par l'endpoint public GET /public/:slug (sans auth). Si on appelait
    // getWebsiteConfig(), qui crée une ligne si elle n'existe pas, un simple
    // visiteur non authentifié déclencherait un INSERT en base à chaque
    // requête sur un slug inconnu → vecteur d'abus + charge DB.
    // On lit sans créer, et on retourne null si la config n'existe pas.
    const website = await this.prisma.tenantWebsite.findUnique({
      where: { tenantId },
    });

    // Si le site n'est pas configuré ou désactivé, on retourne null
    // (le frontend affichera un état "site non configuré")
    if (!website || !website.isActive) {
      return null;
    }

    const [newsArticles, events, galleryItems, testimonials, faqItems] = await Promise.all([
      // Actualités publiées, triées par date de publication décroissante
      this.prisma.tenantNewsArticle.findMany({
        where: { tenantId, status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 6,
      }),
      // Événements à venir ou en cours
      this.prisma.tenantEvent.findMany({
        where: {
          tenantId,
          status: { in: ['UPCOMING', 'ONGOING'] },
          startDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // depuis hier
        },
        orderBy: { startDate: 'asc' },
        take: 6,
      }),
      // Galerie active
      this.prisma.tenantGalleryItem.findMany({
        where: { tenantId, isActive: true },
        orderBy: { displayOrder: 'asc' },
        take: 12,
      }),
      // Témoignages actifs
      this.prisma.tenantTestimonial.findMany({
        where: { tenantId, isActive: true },
        orderBy: { displayOrder: 'asc' },
        take: 10,
      }),
      // FAQ active
      this.prisma.tenantFaqItem.findMany({
        where: { tenantId, isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    return {
      website,
      newsArticles,
      events,
      galleryItems,
      testimonials,
      faqItems,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ACTUALITÉS
  // ═══════════════════════════════════════════════════════════════════════

  async getNewsArticles(tenantId: string, filters?: { status?: string; category?: string; limit?: number }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;

    return this.prisma.tenantNewsArticle.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: filters?.limit || 50,
    });
  }

  async getNewsArticle(tenantId: string, id: string) {
    const article = await this.prisma.tenantNewsArticle.findFirst({
      where: { id, tenantId },
    });
    if (!article) throw new NotFoundException('Article introuvable');
    return article;
  }

  async getNewsArticleBySlug(tenantId: string, slug: string) {
    const article = await this.prisma.tenantNewsArticle.findFirst({
      where: { tenantId, slug, status: 'PUBLISHED' },
    });
    if (!article) throw new NotFoundException('Article introuvable');

    // Incrémenter le compteur de vues
    await this.prisma.tenantNewsArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    return article;
  }

  async createNewsArticle(tenantId: string, data: any) {
    const website = await this.getWebsiteConfig(tenantId);

    // Générer un slug unique si non fourni
    let slug = data.slug || this.slugify(data.title);
    const existing = await this.prisma.tenantNewsArticle.findFirst({
      where: { tenantId, slug },
    });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    return this.prisma.tenantNewsArticle.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        websiteId: website.id,
        title: data.title,
        slug,
        excerpt: data.excerpt || null,
        content: data.content,
        coverImageUrl: data.coverImageUrl || null,
        category: data.category || null,
        tags: data.tags || [],
        status: data.status || 'DRAFT',
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        isFeatured: data.isFeatured || false,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
      },
    });
  }

  async updateNewsArticle(tenantId: string, id: string, data: any) {
    const article = await this.getNewsArticle(tenantId, id);

    const updateData: any = { ...prismaUpdateDefaults() };
    const allowedFields = ['title', 'slug', 'excerpt', 'content', 'coverImageUrl', 'category', 'tags', 'status', 'isFeatured', 'seoTitle', 'seoDescription'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    // Si on publie pour la première fois
    if (data.status === 'PUBLISHED' && !article.publishedAt) {
      updateData.publishedAt = new Date();
    }

    return this.prisma.tenantNewsArticle.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteNewsArticle(tenantId: string, id: string) {
    await this.getNewsArticle(tenantId, id);
    await this.prisma.tenantNewsArticle.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ÉVÉNEMENTS / AGENDA
  // ═══════════════════════════════════════════════════════════════════════

  async getEvents(tenantId: string, filters?: { status?: string; limit?: number }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;

    return this.prisma.tenantEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      take: filters?.limit || 50,
    });
  }

  async createEvent(tenantId: string, data: any) {
    const website = await this.getWebsiteConfig(tenantId);

    return this.prisma.tenantEvent.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        websiteId: website.id,
        title: data.title,
        description: data.description || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        location: data.location || null,
        imageUrl: data.imageUrl || null,
        category: data.category || null,
        status: data.status || 'UPCOMING',
        isFeatured: data.isFeatured || false,
      },
    });
  }

  async updateEvent(tenantId: string, id: string, data: any) {
    const event = await this.prisma.tenantEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundException('Événement introuvable');

    const updateData: any = { ...prismaUpdateDefaults() };
    const allowedFields = ['title', 'description', 'location', 'imageUrl', 'category', 'status', 'isFeatured'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    return this.prisma.tenantEvent.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteEvent(tenantId: string, id: string) {
    const event = await this.prisma.tenantEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundException('Événement introuvable');
    await this.prisma.tenantEvent.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GALERIE
  // ═══════════════════════════════════════════════════════════════════════

  async getGalleryItems(tenantId: string) {
    return this.prisma.tenantGalleryItem.findMany({
      where: { tenantId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createGalleryItem(tenantId: string, data: any) {
    const website = await this.getWebsiteConfig(tenantId);

    return this.prisma.tenantGalleryItem.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        websiteId: website.id,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl || null,
        caption: data.caption || null,
        category: data.category || null,
        displayOrder: data.displayOrder || 0,
        isActive: data.isActive !== false,
      },
    });
  }

  async updateGalleryItem(tenantId: string, id: string, data: any) {
    const item = await this.prisma.tenantGalleryItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Élément de galerie introuvable');

    const updateData: any = { ...prismaUpdateDefaults() };
    const allowedFields = ['imageUrl', 'thumbnailUrl', 'caption', 'category', 'displayOrder', 'isActive'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    return this.prisma.tenantGalleryItem.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteGalleryItem(tenantId: string, id: string) {
    const item = await this.prisma.tenantGalleryItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Élément de galerie introuvable');
    await this.prisma.tenantGalleryItem.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TÉMOIGNAGES
  // ═══════════════════════════════════════════════════════════════════════

  async getTestimonials(tenantId: string) {
    return this.prisma.tenantTestimonial.findMany({
      where: { tenantId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createTestimonial(tenantId: string, data: any) {
    const website = await this.getWebsiteConfig(tenantId);

    return this.prisma.tenantTestimonial.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        websiteId: website.id,
        authorName: data.authorName,
        authorRole: data.authorRole || null,
        authorPhotoUrl: data.authorPhotoUrl || null,
        content: data.content,
        rating: data.rating || null,
        isFeatured: data.isFeatured || false,
        isActive: data.isActive !== false,
        displayOrder: data.displayOrder || 0,
      },
    });
  }

  async updateTestimonial(tenantId: string, id: string, data: any) {
    const item = await this.prisma.tenantTestimonial.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Témoignage introuvable');

    const updateData: any = { ...prismaUpdateDefaults() };
    const allowedFields = ['authorName', 'authorRole', 'authorPhotoUrl', 'content', 'rating', 'isFeatured', 'isActive', 'displayOrder'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    return this.prisma.tenantTestimonial.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteTestimonial(tenantId: string, id: string) {
    const item = await this.prisma.tenantTestimonial.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Témoignage introuvable');
    await this.prisma.tenantTestimonial.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FAQ
  // ═══════════════════════════════════════════════════════════════════════

  async getFaqItems(tenantId: string) {
    return this.prisma.tenantFaqItem.findMany({
      where: { tenantId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createFaqItem(tenantId: string, data: any) {
    const website = await this.getWebsiteConfig(tenantId);

    return this.prisma.tenantFaqItem.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        websiteId: website.id,
        question: data.question,
        answer: data.answer,
        category: data.category || null,
        displayOrder: data.displayOrder || 0,
        isActive: data.isActive !== false,
      },
    });
  }

  async updateFaqItem(tenantId: string, id: string, data: any) {
    const item = await this.prisma.tenantFaqItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Question FAQ introuvable');

    const updateData: any = { ...prismaUpdateDefaults() };
    const allowedFields = ['question', 'answer', 'category', 'displayOrder', 'isActive'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    return this.prisma.tenantFaqItem.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteFaqItem(tenantId: string, id: string) {
    const item = await this.prisma.tenantFaqItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Question FAQ introuvable');
    await this.prisma.tenantFaqItem.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  MESSAGES DE CONTACT
  // ═══════════════════════════════════════════════════════════════════════

  async getContactMessages(tenantId: string, filters?: { status?: string }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;

    return this.prisma.tenantContactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createContactMessage(tenantId: string, data: any) {
    const website = await this.getWebsiteConfig(tenantId);

    return this.prisma.tenantContactMessage.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        websiteId: website.id,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        subject: data.subject || null,
        message: data.message,
      },
    });
  }

  async updateContactMessageStatus(tenantId: string, id: string, status: string) {
    const msg = await this.prisma.tenantContactMessage.findFirst({ where: { id, tenantId } });
    if (!msg) throw new NotFoundException('Message introuvable');

    return this.prisma.tenantContactMessage.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), status },
    });
  }

  async deleteContactMessage(tenantId: string, id: string) {
    const msg = await this.prisma.tenantContactMessage.findFirst({ where: { id, tenantId } });
    if (!msg) throw new NotFoundException('Message introuvable');
    await this.prisma.tenantContactMessage.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private slugify(text: string): string {
    return text
      .toString()
      // 1. Normaliser les accents (NFD) puis supprimer les diacritiques
      //    "École Catholique" → "Ecole Catholique" (pas "cole catholique")
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      // 2. Remplacer les cédilles et autres caractères spéciaux connus
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      // 3. Supprimer les caractères non alphanumériques restants (sauf espaces et tirets)
      .replace(/[^a-z0-9\s-]/g, '')
      // 4. Coller les espaces et underscores en tirets
      .replace(/[\s_-]+/g, '-')
      // 5. Supprimer les tirets en début/fin
      .replace(/^-+|-+$/g, '');
  }
}
