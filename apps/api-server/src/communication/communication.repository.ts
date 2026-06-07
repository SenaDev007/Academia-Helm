import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AnnouncementStatus, AnnouncementTarget } from './entities/announcement.entity';
import { MessageStatus } from './entities/message.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class CommunicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Announcements
  async createAnnouncement(data: CreateAnnouncementDto & { tenantId: string; createdBy: string }): Promise<any> {
    return this.prisma.announcement.create({ data });
  }

  async findAllAnnouncements(
    tenantId: string,
    schoolLevelId?: string,
    status?: AnnouncementStatus,
    target?: AnnouncementTarget,
  ): Promise<any[]> {
    const where: any = { tenantId };
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }
    if (status) {
      where.status = status;
    }
    if (target) {
      where.target = target;
    }
    return this.prisma.announcement.findMany({
      where,
      include: { schoolLevel: true, class: true, creator: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneAnnouncement(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.announcement.findFirst({
      where: { id, tenantId },
      include: { schoolLevel: true, class: true, creator: true },
    });
  }

  async updateAnnouncement(id: string, tenantId: string, data: any): Promise<any> {
    await this.prisma.announcement.update({
      where: { id },
      data,
    });
    return this.findOneAnnouncement(id, tenantId);
  }

  async deleteAnnouncement(id: string, tenantId: string): Promise<void> {
    await this.prisma.announcement.delete({ where: { id } });
  }

  // Messages
  async createMessage(data: CreateMessageDto & { tenantId: string; fromUserId: string }): Promise<any> {
    return this.prisma.message.create({ data });
  }

  async findAllMessages(
    tenantId: string,
    userId?: string,
    type?: string,
  ): Promise<any[]> {
    const where: any = { tenantId };
    if (userId) {
      where.OR = [
        { fromUserId: userId },
        { toUserId: userId },
      ];
    }
    if (type) {
      where.type = type;
    }
    return this.prisma.message.findMany({
      where,
      include: { fromUser: true, toUser: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneMessage(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.message.findFirst({
      where: { id, tenantId },
      include: { fromUser: true, toUser: true },
    });
  }

  async updateMessage(id: string, tenantId: string, data: any): Promise<any> {
    await this.prisma.message.update({
      where: { id },
      data,
    });
    return this.findOneMessage(id, tenantId);
  }

  async markAsRead(id: string, tenantId: string): Promise<any> {
    return this.updateMessage(id, tenantId, {
      status: MessageStatus.READ,
      readAt: new Date(),
    });
  }
}
