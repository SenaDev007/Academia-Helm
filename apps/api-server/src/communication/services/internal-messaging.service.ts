import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour la messagerie interne entre utilisateurs.
 *
 * Utilise le modèle `message` existant (avec messageType DIRECT/GROUP)
 * car les modèles InternalConversation, InternalMessage etc.
 * n'existent pas encore dans le schéma Prisma.
 */
@Injectable()
export class InternalMessagingService {
  private readonly logger = new Logger(InternalMessagingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une conversation (stockée comme message de type GROUP avec métadonnées)
   */
  async createConversation(tenantId: string, creatorId: string, data: any) {
    const { title, participants, subject } = data;

    // Create a GROUP message to represent the conversation
    const conversation = await this.prisma.message.create({
      data: {
        tenantId,
        senderUserId: creatorId,
        subject: title || subject || 'Nouvelle conversation',
        content: '', // Empty content for conversation header
        messageType: 'GROUP',
        status: 'DRAFT',
        metadata: {
          type: 'CONVERSATION',
          participantIds: (participants || []).map((p: any) => p.userId || p),
        },
        recipients: {
          create: (participants || []).map((p: any) => ({
            tenantId,
            recipientId: p.userId || p,
            recipientType: 'USER',
            status: 'PENDING',
          }))
        }
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true } },
        recipients: {
          include: {
            message: true,
          }
        },
      }
    });

    return conversation;
  }

  /**
   * Envoyer un message dans une conversation
   */
  async sendMessage(tenantId: string, senderId: string, data: any) {
    const { conversationId, body, subject, priority } = data;

    // Verify conversation exists
    const conversation = await this.prisma.message.findFirst({
      where: { id: conversationId, tenantId, messageType: 'GROUP' }
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    // Create the message as a reply (DIRECT type linked to conversation)
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        senderUserId: senderId,
        subject: subject || `Re: ${conversation.subject}`,
        content: body,
        messageType: 'DIRECT',
        status: 'SENT',
        sentAt: new Date(),
        metadata: {
          conversationId,
          priority: priority || 'NORMAL',
        },
        recipients: {
          create: {
            tenantId,
            recipientId: conversation.senderUserId,
            recipientType: 'USER',
            status: 'PENDING',
          }
        }
      },
      include: {
        sender: { select: { firstName: true, lastName: true } },
      }
    });

    return message;
  }

  /**
   * Récupérer les conversations d'un utilisateur
   */
  async getConversations(tenantId: string, userId: string) {
    // Find GROUP messages where user is sender or recipient
    const asSender = await this.prisma.message.findMany({
      where: {
        tenantId,
        senderUserId: userId,
        messageType: 'GROUP',
        metadata: { path: ['type'], equals: 'CONVERSATION' },
      },
      include: {
        sender: { select: { firstName: true, lastName: true } },
        recipients: {
          include: {
            message: true,
          }
        },
      },
      orderBy: { updatedAt: 'desc' }
    });

    const asRecipient = await this.prisma.message.findMany({
      where: {
        tenantId,
        recipients: { some: { recipientId: userId } },
        messageType: 'GROUP',
        metadata: { path: ['type'], equals: 'CONVERSATION' },
      },
      include: {
        sender: { select: { firstName: true, lastName: true } },
        recipients: {
          include: {
            message: true,
          }
        },
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Merge and deduplicate
    const seen = new Set<string>();
    const all = [...asSender, ...asRecipient].filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    return all;
  }

  /**
   * Récupérer les messages d'une conversation
   */
  async getMessages(tenantId: string, userId: string, conversationId: string) {
    // Verify access
    const conversation = await this.prisma.message.findFirst({
      where: {
        id: conversationId,
        tenantId,
        messageType: 'GROUP',
      }
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    // Get the conversation header + all replies
    const replies = await this.prisma.message.findMany({
      where: {
        tenantId,
        metadata: { path: ['conversationId'], equals: conversationId },
      },
      include: {
        sender: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' }
    });

    return [conversation, ...replies];
  }

  /**
   * Marquer une conversation comme lue
   */
  async markAsRead(tenantId: string, userId: string, conversationId: string) {
    // Mark all recipients for this user in the conversation as read
    await this.prisma.messageRecipient.updateMany({
      where: {
        recipientId: userId,
        message: {
          OR: [
            { id: conversationId },
            { metadata: { path: ['conversationId'], equals: conversationId } }
          ]
        },
        readAt: null,
      },
      data: { readAt: new Date() }
    });

    return { success: true };
  }
}
