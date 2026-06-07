import { Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationRepository } from './communication.repository';
import { Announcement, AnnouncementStatus } from './entities/announcement.entity';
import { Message } from './entities/message.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class CommunicationService {
  constructor(
    private readonly repository: CommunicationRepository,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // Announcements
  async createAnnouncement(
    createDto: CreateAnnouncementDto,
    tenantId: string,
    userId: string,
  ): Promise<Announcement> {
    const announcement = await this.repository.createAnnouncement({
      ...createDto,
      tenantId,
      createdBy: userId,
    });

    await this.auditLogsService.create(
      {
        action: 'ANNOUNCEMENT_CREATED',
        resource: 'announcement',
        resourceId: announcement.id,
        changes: { title: createDto.title, type: createDto.type },
      },
      tenantId,
      userId,
    );

    return announcement;
  }

  async publishAnnouncement(id: string, tenantId: string, userId: string): Promise<Announcement> {
    const announcement = await this.repository.findOneAnnouncement(id, tenantId);
    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    const updated = await this.repository.updateAnnouncement(id, tenantId, {
      status: AnnouncementStatus.PUBLISHED,
      publishedAt: new Date(),
    });

    await this.auditLogsService.create(
      {
        action: 'ANNOUNCEMENT_PUBLISHED',
        resource: 'announcement',
        resourceId: id,
        changes: { status: AnnouncementStatus.PUBLISHED },
      },
      tenantId,
      userId,
    );

    return updated;
  }

  async findAllAnnouncements(
    tenantId: string,
    schoolLevelId?: string,
    status?: AnnouncementStatus,
  ): Promise<Announcement[]> {
    return this.repository.findAllAnnouncements(tenantId, schoolLevelId, status);
  }

  async findOneAnnouncement(id: string, tenantId: string): Promise<Announcement> {
    const announcement = await this.repository.findOneAnnouncement(id, tenantId);
    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }
    return announcement;
  }

  // Messages
  async createMessage(
    createDto: CreateMessageDto,
    tenantId: string,
    fromUserId: string,
  ): Promise<Message> {
    const message = await this.repository.createMessage({
      ...createDto,
      tenantId,
      fromUserId,
    });

    await this.auditLogsService.create(
      {
        action: 'MESSAGE_SENT',
        resource: 'message',
        resourceId: message.id,
        changes: { toUserId: createDto.toUserId },
      },
      tenantId,
      fromUserId,
    );

    return message;
  }

  async findAllMessages(tenantId: string, userId?: string): Promise<Message[]> {
    return this.repository.findAllMessages(tenantId, userId);
  }

  async markMessageAsRead(id: string, tenantId: string, userId: string): Promise<Message> {
    const message = await this.repository.findOneMessage(id, tenantId);
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    if (message.toUserId !== userId) {
      throw new NotFoundException('Message not found');
    }

    return this.repository.markAsRead(id, tenantId);
  }
}

