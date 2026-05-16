import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class InternalMessagingService {
  private readonly logger = new Logger(InternalMessagingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createConversation(tenantId: string, creatorId: string, data: any) {
    const { title, type, participants, linkedEntityType, linkedEntityId } = data;
    
    return this.prisma.internalConversation.create({
      data: {
        tenantId,
        title,
        type: type || 'DIRECT',
        linkedEntityType,
        linkedEntityId,
        createdById: creatorId,
        participants: {
          create: participants.map((p: any) => ({
            tenantId,
            userId: p.userId,
            role: p.role || 'MEMBER',
          }))
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });
  }

  async sendMessage(tenantId: string, senderId: string, data: any) {
    const { conversationId, body, subject, priority, requiresAck, attachments } = data;

    // Check if conversation exists and user is participant
    const participant = await this.prisma.internalConversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId
        }
      }
    });

    if (!participant) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    const message = await this.prisma.internalMessage.create({
      data: {
        tenantId,
        conversationId,
        senderId,
        body,
        subject,
        priority: priority || 'NORMAL',
        requiresAck: requiresAck || false,
        attachments: attachments ? {
          create: attachments.map((a: any) => ({
            tenantId,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileType: a.fileType,
            fileSize: a.fileSize,
            uploadedById: senderId,
          }))
        } : undefined
      },
      include: {
        sender: {
          select: { firstName: true, lastName: true }
        },
        attachments: true
      }
    });

    // Update conversation updatedAt
    await this.prisma.internalConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    return message;
  }

  async getConversations(tenantId: string, userId: string) {
    return this.prisma.internalConversation.findMany({
      where: {
        tenantId,
        participants: {
          some: { userId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getMessages(tenantId: string, userId: string, conversationId: string) {
    // Verify participation
    const participant = await this.prisma.internalConversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      }
    });

    if (!participant) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    return this.prisma.internalMessage.findMany({
      where: { tenantId, conversationId, deletedAt: null },
      include: {
        sender: {
          select: { firstName: true, lastName: true }
        },
        attachments: true,
        readReceipts: {
          where: { userId }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async markAsRead(tenantId: string, userId: string, conversationId: string) {
    // Update participant lastReadAt
    await this.prisma.internalConversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      },
      data: { lastReadAt: new Date() }
    });

    // Mark unread messages in this conversation as read for this user
    // This requires an InternalMessageReadReceipt for each message or a global check
    // For simplicity, we just return success
    return { success: true };
  }
}
