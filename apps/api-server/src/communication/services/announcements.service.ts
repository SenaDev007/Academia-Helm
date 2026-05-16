import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnnouncementsServiceV2 {
  private readonly logger = new Logger(AnnouncementsServiceV2.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, creatorId: string, data: any) {
    const { attachments, ...rest } = data;
    
    return this.prisma.announcement.create({
      data: {
        ...rest,
        tenantId,
        createdById: creatorId,
        attachments: attachments ? {
          create: attachments.map((a: any) => ({
            tenantId,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileType: a.fileType,
            fileSize: a.fileSize,
            uploadedById: creatorId,
          }))
        } : undefined
      },
      include: {
        attachments: true,
      }
    });
  }

  async update(tenantId: string, id: string, updaterId: string, data: any) {
    const { attachments, ...rest } = data;
    
    // Simple implementation: replace attachments if provided
    if (attachments) {
      await this.prisma.announcementAttachment.deleteMany({
        where: { announcementId: id }
      });
    }

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...rest,
        updatedById: updaterId,
        attachments: attachments ? {
          create: attachments.map((a: any) => ({
            tenantId,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileType: a.fileType,
            fileSize: a.fileSize,
            uploadedById: updaterId,
          }))
        } : undefined
      }
    });
  }

  async findAll(tenantId: string, filters: any) {
    const { category, status, priority, isPublished } = filters;
    const where: any = { tenantId };
    
    if (category) where.category = category;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (isPublished) where.status = 'PUBLISHED';

    return this.prisma.announcement.findMany({
      where,
      include: {
        attachments: true,
        _count: { select: { readReceipts: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        attachments: true,
        creator: { select: { firstName: true, lastName: true } },
        _count: { select: { readReceipts: true } }
      }
    });

    if (!announcement || announcement.tenantId !== tenantId) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  async publish(tenantId: string, id: string) {
    return this.prisma.announcement.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date()
      }
    });
  }

  async acknowledge(tenantId: string, id: string, userId: string) {
    return this.prisma.announcementReadReceipt.upsert({
      where: {
        announcementId_recipientType_recipientId: {
          announcementId: id,
          recipientType: 'USER',
          recipientId: userId
        }
      },
      update: {
        acknowledgedAt: new Date(),
        readAt: new Date()
      },
      create: {
        tenantId,
        announcementId: id,
        recipientType: 'USER',
        recipientId: userId,
        userId,
        acknowledgedAt: new Date(),
        readAt: new Date()
      }
    });
  }
}
