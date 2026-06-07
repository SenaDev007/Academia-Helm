import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FederisConnectService {
  private readonly logger = new Logger(FederisConnectService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le fil d'actualité (Posts de groupes et communautés)
   */
  async getFeed(userId: string, tenantId: string) {
    // 1. Trouver les groupes et communautés dont l'utilisateur est membre
    const [groupMemberships, communityMemberships] = await Promise.all([
      this.prisma.federisGroupMember.findMany({ where: { userId }, select: { groupId: true } }),
      this.prisma.federisCommunityMember.findMany({ where: { userId, status: 'ACTIVE' }, select: { communityId: true } }),
    ]);

    const groupIds = groupMemberships.map(m => m.groupId);
    const communityIds = communityMemberships.map(m => m.communityId);

    // 2. Récupérer les posts
    const [groupPosts, communityPosts] = await Promise.all([
      this.prisma.federisGroupPost.findMany({
        where: { groupId: { in: groupIds } },
        include: { user: true, group: true, reactions: true, _count: { select: { comments: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.federisCommunityPost.findMany({
        where: { communityId: { in: communityIds } },
        include: { user: true, community: true, reactions: true, _count: { select: { comments: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // 3. Fusionner et trier
    return [...groupPosts.map(p => ({ ...p, type: 'GROUP' })), ...communityPosts.map(p => ({ ...p, type: 'COMMUNITY' }))]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Création d'un post
   */
  async createPost(userId: string, data: { content: string, groupId?: string, communityId?: string, type?: string }) {
    if (data.groupId) {
      return this.prisma.federisGroupPost.create({
        data: { content: data.content, groupId: data.groupId, userId }
      });
    }
    if (data.communityId) {
      return this.prisma.federisCommunityPost.create({
        data: { content: data.content, communityId: data.communityId, userId, postType: data.type || 'TEXT' }
      });
    }
    throw new Error('GroupId or CommunityId required');
  }

  /**
   * Récupère les groupes
   */
  async getGroups(tenantId: string, userId: string) {
    return this.prisma.federisGroup.findMany({
      where: { 
        tenantId,
        members: { some: { userId } }
      },
      include: { _count: { select: { members: true, posts: true } } }
    });
  }

  /**
   * Récupère les communautés
   */
  async getCommunities(userId: string) {
    return this.prisma.federisCommunity.findMany({
      where: { 
        members: { some: { userId, status: 'ACTIVE' } }
      },
      include: { _count: { select: { members: true, posts: true } } }
    });
  }

  /**
   * Gère les accusés de réception des communiqués
   */
  async acknowledgeNotice(userId: string, noticeId: string) {
    return this.prisma.federisNoticeRecipient.updateMany({
      where: { noticeId, userId },
      data: { isRead: true, readAt: new Date(), acknowledgedAt: new Date() }
    });
  }

  /**
   * Récupère les conversations (Direct Messages)
   */
  async getConversations(userId: string) {
    return this.prisma.federisConversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: { firstName: true, lastName: true, role: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  /**
   * Récupère les messages d'une conversation
   */
  async getMessages(conversationId: string) {
    return this.prisma.federisMessage.findMany({
      where: { conversationId },
      include: { sender: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Récupère les communiqués officiels
   */
  async getOfficialNotices(tenantId: string) {
    return this.prisma.federisOfficialNotice.findMany({
      where: { 
        OR: [
          { tenantId },
          { recipients: { some: { schoolTenantId: tenantId } } },
          { recipients: { some: { userId: tenantId } } } // Simplifié pour démo
        ],
        status: 'SENT'
      },
      include: { patronat: true },
      orderBy: { sentAt: 'desc' },
    });
  }

  /**
   * Envoie un message dans une conversation
   */
  async sendMessage(userId: string, tenantId: string, conversationId: string, content: string) {
    const message = await this.prisma.federisMessage.create({
      data: {
        tenantId,
        conversationId,
        senderUserId: userId,
        senderEntityType: 'USER',
        content,
      }
    });

    await this.prisma.federisConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    });

    return message;
  }

  /**
   * Récupère les événements
   */
  async getEvents(tenantId: string) {
    return this.prisma.federisConnectEvent.findMany({
      where: { tenantId },
      include: { _count: { select: { participants: true } } },
      orderBy: { startDate: 'asc' },
    });
  }
}
