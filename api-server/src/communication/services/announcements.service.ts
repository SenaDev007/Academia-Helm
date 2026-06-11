import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnnouncementsServiceV2 {
  private readonly logger = new Logger(AnnouncementsServiceV2.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, creatorId: string, data: any) {
    // Announcement model stores attachments as Json?, not a separate relation
    return this.prisma.announcement.create({
      data: {
        tenantId,
        title: data.title,
        content: data.content,
        type: data.type || 'GENERAL',
        target: data.target || 'ALL',
        schoolLevelId: data.schoolLevelId,
        classId: data.classId || null,
        isPinned: data.isPinned || false,
        requiresAcknowledgment: data.requiresAcknowledgment || false,
        attachments: data.attachments || null,
        metadata: data.metadata || null,
        status: data.status || 'DRAFT',
        createdBy: creatorId,
      }
    });
  }

  async update(tenantId: string, id: string, updaterId: string, data: any) {
    // Verify announcement belongs to tenant
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, tenantId }
    });
    if (!announcement) throw new NotFoundException('Announcement not found');

    return this.prisma.announcement.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        type: data.type,
        target: data.target,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
        isPinned: data.isPinned,
        requiresAcknowledgment: data.requiresAcknowledgment,
        attachments: data.attachments,
        metadata: data.metadata,
        status: data.status,
      }
    });
  }

  async findAll(tenantId: string, filters: any) {
    const { category, status, priority, isPublished, type, target } = filters;
    const where: any = { tenantId };

    if (type) where.type = type;
    if (category) where.type = category; // category maps to type
    if (status) where.status = status;
    if (target) where.target = target;
    if (priority) where.type = priority; // priority maps to type for now
    if (isPublished) where.status = 'PUBLISHED';

    return this.prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        creator: { select: { firstName: true, lastName: true } },
        schoolLevel: { select: { code: true, label: true } },
        class: { select: { name: true } },
      }
    });

    if (!announcement || announcement.tenantId !== tenantId) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  async publish(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, tenantId }
    });
    if (!announcement) throw new NotFoundException('Announcement not found');

    return this.prisma.announcement.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date()
      }
    });
  }

  async acknowledge(tenantId: string, id: string, userId: string) {
    // No AnnouncementReadReceipt model exists; update metadata as acknowledgment tracker
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, tenantId }
    });
    if (!announcement) throw new NotFoundException('Announcement not found');

    const metadata = (announcement.metadata as any) || {};
    const acknowledgments = metadata.acknowledgments || [];
    if (!acknowledgments.find((a: any) => a.userId === userId)) {
      acknowledgments.push({ userId, acknowledgedAt: new Date().toISOString() });
    }
    metadata.acknowledgments = acknowledgments;

    return this.prisma.announcement.update({
      where: { id },
      data: { metadata }
    });
  }
}
