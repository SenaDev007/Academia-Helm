import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour le sous-module 9.8 - EduCast (Version Monetized & Full Features)
 */
@Injectable()
export class EduCastService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // TEACHER CHANNELS
  // ============================================================================

  async getTeacherChannel(teacherId: string, tenantId: string) {
    return this.prisma.eduCastTeacherChannel.findFirst({
      where: { teacherId, tenantId },
      include: {
        _count: { select: { mediaItems: true, subscribers: true } },
      },
    });
  }

  async createTeacherChannel(teacherId: string, tenantId: string, data: any) {
    return this.prisma.eduCastTeacherChannel.create({
      data: {
        tenantId,
        teacherId,
        name: data.name,
        slogan: data.slogan,
        description: data.description,
        avatarUrl: data.avatarUrl,
        bannerUrl: data.bannerUrl,
        subjects: data.subjects || [],
        levels: data.levels || [],
        status: 'PENDING',
      },
    });
  }

  async updateTeacherChannel(id: string, teacherId: string, data: any) {
    return this.prisma.eduCastTeacherChannel.updateMany({
      where: { id, teacherId },
      data: {
        name: data.name,
        slogan: data.slogan,
        description: data.description,
        avatarUrl: data.avatarUrl,
        bannerUrl: data.bannerUrl,
        subjects: data.subjects,
        levels: data.levels,
      },
    });
  }

  async subscribeToChannel(channelId: string, userId: string) {
    const sub = await this.prisma.eduCastChannelSubscriber.create({
      data: { channelId, userId },
    });

    await this.prisma.eduCastTeacherChannel.update({
      where: { id: channelId },
      data: { subscriberCount: { increment: 1 } },
    });

    return sub;
  }

  // ============================================================================
  // MEDIA ITEMS & MONETIZATION
  // ============================================================================

  async findAllMedia(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.monetizationStatus) where.monetizationStatus = filters.monetizationStatus;
    if (filters?.channelId) where.channelId = filters.channelId;

    return this.prisma.eduCastMediaItem.findMany({
      where,
      include: {
        author: { select: { firstName: true, lastName: true } },
        channel: true,
        _count: { select: { engagement: true, favorites: true, purchases: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMedia(tenantId: string, academicYearId: string, data: any, authorId: string) {
    return this.prisma.eduCastMediaItem.create({
      data: {
        tenantId,
        academicYearId,
        title: data.title,
        description: data.description,
        type: data.type,
        fileUrl: data.fileUrl,
        thumbnailUrl: data.thumbnailUrl,
        duration: data.duration,
        authorId,
        channelId: data.channelId,
        categoryId: data.categoryId,
        subjectId: data.subjectId,
        levelId: data.levelId,
        classId: data.classId,
        tags: data.tags || [],
        status: data.status || 'DRAFT',
        visibility: data.visibility || 'INTERNAL',
        // Monetization
        monetizationStatus: data.monetizationStatus || 'GRATUIT',
        price: data.price || 0,
        isDownloadable: data.isDownloadable !== undefined ? data.isDownloadable : true,
        commentsEnabled: data.commentsEnabled !== undefined ? data.commentsEnabled : true,
      },
    });
  }

  async purchaseMedia(userId: string, mediaItemId: string, tenantId: string) {
    const mediaItem = await this.prisma.eduCastMediaItem.findUnique({
      where: { id: mediaItemId },
    });

    if (!mediaItem || mediaItem.monetizationStatus === 'GRATUIT') {
      throw new BadRequestException('Contenu non éligible à l\'achat');
    }

    const commission = mediaItem.price * 0.2;
    const teacherShare = mediaItem.price * 0.8;

    return this.prisma.eduCastPurchase.create({
      data: {
        tenantId,
        userId,
        mediaItemId,
        amount: mediaItem.price,
        commission,
        teacherShare,
        status: 'COMPLETED',
      },
    });
  }

  // ============================================================================
  // CONTENT PACKS
  // ============================================================================

  async findAllPacks(tenantId: string, academicYearId: string) {
    return this.prisma.eduCastContentPack.findMany({
      where: { tenantId, academicYearId },
      include: {
        channel: true,
        items: { include: { mediaItem: true } },
        _count: { select: { purchases: true } },
      },
    });
  }

  async createPack(tenantId: string, academicYearId: string, data: any, channelId: string) {
    const pack = await this.prisma.eduCastContentPack.create({
      data: {
        tenantId,
        academicYearId,
        channelId,
        title: data.title,
        description: data.description,
        price: data.price || 0,
        status: 'ACTIVE',
      },
    });

    if (data.itemIds?.length > 0) {
      await this.prisma.eduCastContentPackItem.createMany({
        data: data.itemIds.map((mediaItemId: string, index: number) => ({
          packId: pack.id,
          mediaItemId,
          order: index + 1,
        })),
      });
    }

    return pack;
  }

  // ============================================================================
  // WEBINARS
  // ============================================================================

  async findAllWebinars(tenantId: string, academicYearId: string) {
    return this.prisma.eduCastWebinar.findMany({
      where: { tenantId, academicYearId },
      include: {
        presenter: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async createWebinar(tenantId: string, academicYearId: string, data: any, presenterId: string) {
    return this.prisma.eduCastWebinar.create({
      data: {
        tenantId,
        academicYearId,
        title: data.title,
        description: data.description,
        presenterId,
        scheduledAt: new Date(data.scheduledAt),
        duration: data.duration,
        streamUrl: data.streamUrl,
        meetingId: data.meetingId,
        status: 'PLANNED',
        isPayant: data.isPayant || false,
        price: data.price || 0,
      },
    });
  }

  // ============================================================================
  // PLAYLISTS
  // ============================================================================

  async findAllPlaylists(tenantId: string, academicYearId: string, ownerId?: string) {
    const where: any = { tenantId, academicYearId };
    if (ownerId) where.ownerId = ownerId;

    return this.prisma.eduCastPlaylist.findMany({
      where,
      include: {
        owner: { select: { firstName: true, lastName: true } },
        items: { include: { mediaItem: true }, orderBy: { order: 'asc' } },
      },
    });
  }

  async createPlaylist(tenantId: string, academicYearId: string, data: any, ownerId: string) {
    const playlist = await this.prisma.eduCastPlaylist.create({
      data: {
        tenantId,
        academicYearId,
        title: data.title,
        description: data.description,
        ownerId,
        targetType: data.targetType,
        targetId: data.targetId,
        isPremium: data.isPremium || false,
        price: data.price || 0,
      },
    });

    if (data.itemIds?.length > 0) {
      await this.prisma.eduCastPlaylistItem.createMany({
        data: data.itemIds.map((mediaItemId: string, index: number) => ({
          playlistId: playlist.id,
          mediaItemId,
          order: index + 1,
        })),
      });
    }

    return playlist;
  }

  // ============================================================================
  // ANNOUNCEMENTS
  // ============================================================================

  async findAllAnnouncements(tenantId: string, academicYearId: string) {
    return this.prisma.eduCastAnnouncement.findMany({
      where: { tenantId, academicYearId, status: 'PUBLISHED' },
      include: {
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async createAnnouncement(tenantId: string, academicYearId: string, data: any, authorId: string) {
    return this.prisma.eduCastAnnouncement.create({
      data: {
        tenantId,
        academicYearId,
        title: data.title,
        content: data.content,
        mediaItemId: data.mediaItemId,
        authorId,
        targetAudience: data.targetAudience,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
  }

  // ============================================================================
  // FINANCIALS & PAYOUTS
  // ============================================================================

  async getTeacherEarnings(teacherId: string, tenantId: string) {
    const purchases = await this.prisma.eduCastPurchase.findMany({
      where: {
        tenantId,
        mediaItem: { authorId: teacherId },
        status: 'COMPLETED',
      },
    });

    const totalEarned = purchases.reduce((acc, p) => acc + p.teacherShare, 0);
    const totalCommission = purchases.reduce((acc, p) => acc + p.commission, 0);

    const payouts = await this.prisma.eduCastPayoutRequest.findMany({
      where: { teacherId, tenantId },
    });

    const alreadyPaid = payouts
      .filter(p => p.status === 'PAID')
      .reduce((acc, p) => acc + p.amount, 0);

    return {
      totalEarned,
      totalCommission,
      balance: totalEarned - alreadyPaid,
      payouts,
    };
  }

  async requestPayout(teacherId: string, tenantId: string, amount: number) {
    const earnings = await this.getTeacherEarnings(teacherId, tenantId);
    if (earnings.balance < amount) throw new BadRequestException('Solde insuffisant');
    return this.prisma.eduCastPayoutRequest.create({
      data: { tenantId, teacherId, amount, status: 'PENDING' },
    });
  }

  /**
   * Liste toutes les demandes de paiement des enseignants.
   * ⭐ Implémentation ajoutée juillet 2026 — le controller exposait déjà la route
   * GET /educast/payout-requests mais la méthode service était absente (runtime 500).
   */
  async findAllPayoutRequests(
    tenantId: string,
    filters?: { status?: string; teacherId?: string },
  ) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.teacherId) where.teacherId = filters.teacherId;

    return this.prisma.eduCastPayoutRequest.findMany({
      where,
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Liste tous les contenus EduCast (médias + webinaires + annonces) fusionnés.
   * ⭐ Implémentation ajoutée juillet 2026 — le controller exposait déjà la route
   * GET /educast/contents mais la méthode service était absente (runtime 500).
   * On délègue vers findAllMedia en retournant un format unifié pour le frontend
   * (EduCastLibrary, EduCastModeration, EduCastResources attendent une liste).
   */
  async findAllContents(tenantId: string, academicYearId: string, filters?: any) {
    // Retourne les médias (qui sont le type de contenu principal).
    // Pour une vraie fusion avec webinaires/annonces, on pourrait faire un Promise.all
    // mais pour rester cohérent avec le contrat existant, on délègue vers findAllMedia.
    const media = await this.findAllMedia(tenantId, academicYearId, filters);
    // Enrichir avec un champ "contentType" pour que le frontend puisse distinguer
    return (media as any[]).map((m) => ({
      ...m,
      contentType: m.mediaType || 'MEDIA',
    }));
  }

  // ============================================================================
  // SETTINGS & REPORTS & STATS
  // ============================================================================

  async getSettings(tenantId: string) {
    return this.prisma.eduCastSetting.findMany({ where: { tenantId } });
  }

  async updateSetting(tenantId: string, key: string, value: any) {
    return this.prisma.eduCastSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { value },
      create: { tenantId, key, value },
    });
  }

  async createReport(tenantId: string, academicYearId: string, data: any, userId: string) {
    return this.prisma.eduCastReport.create({
      data: {
        tenantId,
        academicYearId,
        reportType: data.reportType,
        title: data.title,
        periodStart: data.periodStart ? new Date(data.periodStart) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
        content: data.content || {},
        generatedBy: userId,
      },
    });
  }

  async trackEngagement(mediaItemId: string, userId: string, type: string, durationSeen?: number) {
    if (type === 'VIEW') {
      await this.prisma.eduCastMediaItem.update({
        where: { id: mediaItemId },
        data: { viewCount: { increment: 1 } },
      });
    }
    return this.prisma.eduCastEngagement.create({ data: { mediaItemId, userId, type, durationSeen } });
  }

  async getEduCastStats(tenantId: string, academicYearId: string) {
    const [mediaCount, channelCount, webinarCount, totalViews, totalPurchases] = await Promise.all([
      this.prisma.eduCastMediaItem.count({ where: { tenantId, academicYearId } }),
      this.prisma.eduCastTeacherChannel.count({ where: { tenantId } }),
      this.prisma.eduCastWebinar.count({ where: { tenantId, academicYearId } }),
      this.prisma.eduCastMediaItem.aggregate({
        where: { tenantId, academicYearId },
        _sum: { viewCount: true },
      }),
      this.prisma.eduCastPurchase.count({ where: { tenantId } }),
    ]);

    return {
      totalContents: mediaCount,
      totalChannels: channelCount,
      totalWebinars: webinarCount,
      totalViews: totalViews._sum.viewCount || 0,
      totalPurchases,
      lastUpdate: new Date(),
    };
  }

  // ============================================================================
  // ⭐ CRUD COMPLÉMENTAIRE (Task 8-b) — DELETE + UPDATE manquants
  // ============================================================================
  // Patterns :
  //  - findFirst({ where: { id, tenantId } }) pour l'isolation tenant
  //  - NotFoundException si l'entité n'existe pas
  //  - Soft-delete (status = 'ARCHIVED' | 'INACTIVE') si enfants existent,
  //    hard delete sinon
  // ============================================================================

  /**
   * DELETE /educast/media/:id
   * Soft-delete (status = 'ARCHIVED') si purchases existent, hard delete sinon.
   * EduCastMediaItem a un champ `status` (default "DRAFT").
   */
  async deleteMedia(id: string, tenantId: string): Promise<{ success: boolean }> {
    const media = await this.prisma.eduCastMediaItem.findFirst({ where: { id, tenantId } });
    if (!media) throw new NotFoundException(`Contenu EduCast introuvable (id=${id}).`);

    const [purchasesCount, packItemsCount, playlistItemsCount] = await Promise.all([
      this.prisma.eduCastPurchase.count({ where: { mediaItemId: id } }),
      this.prisma.eduCastContentPackItem.count({ where: { mediaItemId: id } }),
      this.prisma.eduCastPlaylistItem.count({ where: { mediaItemId: id } }),
    ]);

    if (purchasesCount > 0) {
      // On conserve l'historique des achats — on archive seulement.
      await this.prisma.eduCastMediaItem.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return { success: true };
    }

    // Pas d'achats — on peut supprimer. Les packItems/playlistItems/engagement/
    // favorites/resources sont en onDelete: Cascade sur mediaItemId.
    // Mais si le média est référencé dans un pack/playlist sans achat, on archive
    // plutôt que de casser le pack.
    if (packItemsCount + playlistItemsCount > 0) {
      await this.prisma.eduCastMediaItem.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return { success: true };
    }

    await this.prisma.eduCastMediaItem.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /educast/media/:id — mise à jour générique d'un média EduCast.
   */
  async updateMedia(id: string, tenantId: string, data: any) {
    const media = await this.prisma.eduCastMediaItem.findFirst({ where: { id, tenantId } });
    if (!media) throw new NotFoundException(`Contenu EduCast introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.price !== undefined && data.price !== null) updateData.price = parseFloat(data.price);
    if (data.expiresAt) updateData.expiresAt = new Date(data.expiresAt);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.eduCastMediaItem.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /educast/packs/:id
   * Vérifier purchases avant delete. Si purchases → soft-delete (status = 'ARCHIVED').
   * Sinon hard delete (items en cascade).
   */
  async deletePack(id: string, tenantId: string): Promise<{ success: boolean }> {
    const pack = await this.prisma.eduCastContentPack.findFirst({ where: { id, tenantId } });
    if (!pack) throw new NotFoundException(`Pack EduCast introuvable (id=${id}).`);

    const purchasesCount = await this.prisma.eduCastPurchase.count({
      where: { packId: id },
    });

    if (purchasesCount > 0) {
      // On conserve l'historique des achats liés au pack.
      await this.prisma.eduCastContentPack.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return { success: true };
    }

    // Hard delete — les items sont supprimés en cascade (onDelete: Cascade sur packId)
    await this.prisma.eduCastContentPack.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /educast/packs/:id — mise à jour générique d'un pack.
   */
  async updatePack(id: string, tenantId: string, data: any) {
    const pack = await this.prisma.eduCastContentPack.findFirst({ where: { id, tenantId } });
    if (!pack) throw new NotFoundException(`Pack EduCast introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.price !== undefined && data.price !== null) updateData.price = parseFloat(data.price);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.eduCastContentPack.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /educast/webinars/:id — hard delete (pas d'enfants).
   */
  async deleteWebinar(id: string, tenantId: string): Promise<{ success: boolean }> {
    const webinar = await this.prisma.eduCastWebinar.findFirst({ where: { id, tenantId } });
    if (!webinar) throw new NotFoundException(`Webinaire introuvable (id=${id}).`);

    await this.prisma.eduCastWebinar.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /educast/webinars/:id — mise à jour générique d'un webinaire.
   */
  async updateWebinar(id: string, tenantId: string, data: any) {
    const webinar = await this.prisma.eduCastWebinar.findFirst({ where: { id, tenantId } });
    if (!webinar) throw new NotFoundException(`Webinaire introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);
    if (data.price !== undefined && data.price !== null) updateData.price = parseFloat(data.price);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.eduCastWebinar.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /educast/playlists/:id — hard delete (cascade items).
   * Les EduCastPlaylistItem sont supprimés en cascade (onDelete: Cascade sur playlistId).
   */
  async deletePlaylist(id: string, tenantId: string): Promise<{ success: boolean }> {
    const playlist = await this.prisma.eduCastPlaylist.findFirst({ where: { id, tenantId } });
    if (!playlist) throw new NotFoundException(`Playlist introuvable (id=${id}).`);

    await this.prisma.eduCastPlaylist.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /educast/playlists/:id — mise à jour générique d'une playlist.
   */
  async updatePlaylist(id: string, tenantId: string, data: any) {
    const playlist = await this.prisma.eduCastPlaylist.findFirst({ where: { id, tenantId } });
    if (!playlist) throw new NotFoundException(`Playlist introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.price !== undefined && data.price !== null) updateData.price = parseFloat(data.price);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.eduCastPlaylist.update({ where: { id }, data: updateData });
  }

  /**
   * DELETE /educast/announcements/:id — hard delete (pas d'enfants).
   */
  async deleteAnnouncement(id: string, tenantId: string): Promise<{ success: boolean }> {
    const announcement = await this.prisma.eduCastAnnouncement.findFirst({ where: { id, tenantId } });
    if (!announcement) throw new NotFoundException(`Annonce introuvable (id=${id}).`);

    await this.prisma.eduCastAnnouncement.delete({ where: { id } });
    return { success: true };
  }

  /**
   * PUT /educast/announcements/:id — mise à jour générique d'une annonce.
   */
  async updateAnnouncement(id: string, tenantId: string, data: any) {
    const announcement = await this.prisma.eduCastAnnouncement.findFirst({ where: { id, tenantId } });
    if (!announcement) throw new NotFoundException(`Annonce introuvable (id=${id}).`);

    const updateData: any = { ...data };
    if (data.expiresAt) updateData.expiresAt = new Date(data.expiresAt);
    delete updateData.id;
    delete updateData.tenantId;

    return this.prisma.eduCastAnnouncement.update({ where: { id }, data: updateData });
  }

  // ═════════════════════════════════════════════════════════════════
  //  PHASE 1: LIKES / FAVORITES + COMMENTS + PLAYLIST ITEMS + MODERATION
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ TOGGLE FAVORITE (like/unlike) — POST /educast/media/:id/favorite
   */
  async toggleFavorite(mediaItemId: string, userId: string) {
    const existing = await this.prisma.eduCastFavorite.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
    });
    if (existing) {
      await this.prisma.eduCastFavorite.delete({ where: { id: existing.id } });
      // Decrement likeCount on media item
      await this.prisma.eduCastMediaItem.update({
        where: { id: mediaItemId },
        data: { likeCount: { decrement: 1 } },
      }).catch(() => {});
      return { liked: false };
    }
    await this.prisma.eduCastFavorite.create({ data: { userId, mediaItemId } });
    await this.prisma.eduCastMediaItem.update({
      where: { id: mediaItemId },
      data: { likeCount: { increment: 1 } },
    }).catch(() => {});
    return { liked: true };
  }

  /**
   * ⭐ CHECK IF LIKED — GET /educast/media/:id/favorite-status?userId=X
   */
  async isFavorited(mediaItemId: string, userId: string) {
    const fav = await this.prisma.eduCastFavorite.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
    });
    return { liked: !!fav };
  }

  /**
   * ⭐ GET USER FAVORITES — GET /educast/favorites?userId=X
   */
  async getUserFavorites(userId: string, tenantId: string) {
    return this.prisma.eduCastFavorite.findMany({
      where: { userId, mediaItem: { tenantId } },
      include: { mediaItem: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ⭐ CREATE COMMENT — POST /educast/media/:id/comments
   *    Uses EduCastEngagement with type='COMMENT' and content field.
   */
  async createComment(mediaItemId: string, userId: string, content: string) {
    const comment = await this.prisma.eduCastEngagement.create({
      data: { mediaItemId, userId, type: 'COMMENT', content },
    });
    // Increment commentCount on media item
    await this.prisma.eduCastMediaItem.update({
      where: { id: mediaItemId },
      data: { commentCount: { increment: 1 } },
    }).catch(() => {});
    // Return with user info
    const result = await this.prisma.eduCastEngagement.findUnique({
      where: { id: comment.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
    return result;
  }

  /**
   * ⭐ GET COMMENTS — GET /educast/media/:id/comments
   */
  async getComments(mediaItemId: string) {
    return this.prisma.eduCastEngagement.findMany({
      where: { mediaItemId, type: 'COMMENT' },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * ⭐ DELETE COMMENT — DELETE /educast/comments/:id
   */
  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.eduCastEngagement.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    if (comment.userId !== userId) throw new ForbiddenException('Vous ne pouvez supprimer que vos propres commentaires');
    await this.prisma.eduCastEngagement.delete({ where: { id: commentId } });
    // Decrement commentCount
    await this.prisma.eduCastMediaItem.update({
      where: { id: comment.mediaItemId },
      data: { commentCount: { decrement: 1 } },
    }).catch(() => {});
    return { success: true };
  }

  /**
   * ⭐ ADD PLAYLIST ITEM — POST /educast/playlists/:id/items
   */
  async addPlaylistItem(playlistId: string, mediaItemId: string) {
    const count = await this.prisma.eduCastPlaylistItem.count({ where: { playlistId } });
    return this.prisma.eduCastPlaylistItem.create({
      data: { playlistId, mediaItemId, order: count },
    }).catch(() => {
      // If unique constraint violation (already in playlist), ignore
      return { success: true, alreadyExists: true };
    });
  }

  /**
   * ⭐ REMOVE PLAYLIST ITEM — DELETE /educast/playlists/:id/items/:mediaId
   */
  async removePlaylistItem(playlistId: string, mediaItemId: string) {
    await this.prisma.eduCastPlaylistItem.deleteMany({ where: { playlistId, mediaItemId } });
    return { success: true };
  }

  /**
   * ⭐ GET PLAYLIST ITEMS — GET /educast/playlists/:id/items
   */
  async getPlaylistItems(playlistId: string) {
    return this.prisma.eduCastPlaylistItem.findMany({
      where: { playlistId },
      include: { mediaItem: true },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * ⭐ MODERATE CONTENT — PATCH /educast/media/:id/moderate
   *    status: 'PUBLISHED' (approve) | 'REJECTED' (reject)
   */
  async moderateContent(mediaItemId: string, tenantId: string, status: string, reason?: string) {
    const item = await this.prisma.eduCastMediaItem.findFirst({ where: { id: mediaItemId, tenantId } });
    if (!item) throw new NotFoundException('Contenu introuvable');
    const updateData: any = { status };
    if (reason) updateData.moderationNote = reason;
    return this.prisma.eduCastMediaItem.update({ where: { id: mediaItemId }, data: updateData });
  }

  /**
   * ⭐ GET STATS — extended to return all fields the frontend expects
   */
  async getEduCastStatsExtended(tenantId: string, academicYearId: string) {
    const base = await this.getEduCastStats(tenantId, academicYearId);
    // Add extended stats
    const [recentContents, topChannels, totalSubscribers, totalLikes, totalComments] = await Promise.all([
      this.prisma.eduCastMediaItem.findMany({
        where: { tenantId, academicYearId, status: 'PUBLISHED' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, type: true, thumbnailUrl: true, viewCount: true, createdAt: true, teacherChannel: { select: { id: true, channelName: true } } },
      }),
      this.prisma.eduCastTeacherChannel.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { subscriberCount: 'desc' },
        select: { id: true, channelName: true, subscriberCount: true, avatarUrl: true },
      }),
      this.prisma.eduCastChannelSubscriber.count({ where: { tenantId } }),
      this.prisma.eduCastMediaItem.aggregate({ where: { tenantId, academicYearId }, _sum: { likeCount: true } }),
      this.prisma.eduCastMediaItem.aggregate({ where: { tenantId, academicYearId }, _sum: { commentCount: true } }),
    ]);
    return {
      ...base,
      recentContents,
      topChannels,
      totalSubscribers,
      totalLikes: totalLikes._sum.likeCount || 0,
      totalComments: totalComments._sum.commentCount || 0,
      activeChannels: base.totalChannels,
    };
  }
}
