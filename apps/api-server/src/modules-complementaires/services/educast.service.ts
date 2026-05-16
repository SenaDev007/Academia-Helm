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
}
