import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement, AnnouncementStatus, AnnouncementTarget } from './entities/announcement.entity';
import { Message, MessageStatus } from './entities/message.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class CommunicationRepository {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  // Announcements
  async createAnnouncement(data: CreateAnnouncementDto & { tenantId: string; createdBy: string }): Promise<Announcement> {
    const announcement = this.announcementRepository.create(data);
    return this.announcementRepository.save(announcement);
  }

  async findAllAnnouncements(
    tenantId: string,
    schoolLevelId?: string,
    status?: AnnouncementStatus,
    target?: AnnouncementTarget,
  ): Promise<Announcement[]> {
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
    return this.announcementRepository.find({
      where,
      relations: ['schoolLevel', 'class', 'creator'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneAnnouncement(id: string, tenantId: string): Promise<Announcement | null> {
    return this.announcementRepository.findOne({
      where: { id, tenantId },
      relations: ['schoolLevel', 'class', 'creator'],
    });
  }

  async updateAnnouncement(id: string, tenantId: string, data: Partial<Announcement>): Promise<Announcement> {
    await this.announcementRepository.update({ id, tenantId }, data);
    return this.findOneAnnouncement(id, tenantId);
  }

  async deleteAnnouncement(id: string, tenantId: string): Promise<void> {
    await this.announcementRepository.delete({ id, tenantId });
  }

  // Messages
  async createMessage(data: CreateMessageDto & { tenantId: string; fromUserId: string }): Promise<Message> {
    const message = this.messageRepository.create(data);
    return this.messageRepository.save(message);
  }

  async findAllMessages(
    tenantId: string,
    userId?: string,
    type?: string,
  ): Promise<Message[]> {
    const query = this.messageRepository.createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId })
      .leftJoinAndSelect('message.fromUser', 'fromUser')
      .leftJoinAndSelect('message.toUser', 'toUser');

    if (userId) {
      query.andWhere(
        '(message.fromUserId = :userId OR message.toUserId = :userId)',
        { userId }
      );
    }
    if (type) {
      query.andWhere('message.type = :type', { type });
    }

    return query.orderBy('message.createdAt', 'DESC').getMany();
  }

  async findOneMessage(id: string, tenantId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id, tenantId },
      relations: ['fromUser', 'toUser'],
    });
  }

  async updateMessage(id: string, tenantId: string, data: Partial<Message>): Promise<Message> {
    await this.messageRepository.update({ id, tenantId }, data);
    return this.findOneMessage(id, tenantId);
  }

  async markAsRead(id: string, tenantId: string): Promise<Message> {
    return this.updateMessage(id, tenantId, {
      status: MessageStatus.READ,
      readAt: new Date(),
    });
  }
}

