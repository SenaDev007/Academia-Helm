/**
 * ============================================================================
 * MESSAGES PRISMA SERVICE
 * ============================================================================
 * Gestion des messages et campagnes
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MessagesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un message
   */
  async createMessage(tenantId: string, data: {
    academicYearId?: string;
    schoolLevelId?: string;
    channelId?: string;
    senderUserId: string;
    subject?: string;
    content: string;
    contentFr?: string;
    contentEn?: string;
    messageType: string;
    isScheduled?: boolean;
    scheduledAt?: Date;
    targets?: Array<{ targetType: string; targetId: string }>;
  }) {
    const { targets, ...messageData } = data;

    return this.prisma.message.create({
      data: {
        tenantId,
        ...messageData,
        status: data.isScheduled ? 'PENDING' : 'DRAFT',
        targets: targets ? {
          create: targets.map(t => ({
            targetType: t.targetType,
            targetId: t.targetId,
          })),
        } : undefined,
        scheduled: data.isScheduled && data.scheduledAt ? {
          create: {
            scheduledAt: data.scheduledAt,
            status: 'PENDING',
          },
        } : undefined,
      },
      include: {
        channel: true,
        sender: { select: { id: true, firstName: true, lastName: true } },
        targets: true,
        recipients: true,
        scheduled: true,
      },
    });
  }

  /**
   * Récupérer tous les messages d'un tenant
   */
  async findAllMessages(tenantId: string, filters?: {
    academicYearId?: string;
    schoolLevelId?: string;
    messageType?: string;
    status?: string;
    channelId?: string;
  }) {
    return this.prisma.message.findMany({
      where: {
        tenantId,
        ...filters,
      },
      include: {
        channel: true,
        sender: { select: { id: true, firstName: true, lastName: true } },
        targets: true,
        recipients: true,
        scheduled: true,
        _count: {
          select: {
            recipients: true,
            logs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupérer un message par ID
   */
  async findMessageById(tenantId: string, id: string) {
    return this.prisma.message.findFirst({
      where: { id, tenantId },
      include: {
        channel: true,
        sender: { select: { id: true, firstName: true, lastName: true } },
        targets: true,
        recipients: {
          include: {
            message: true,
          },
        },
        scheduled: true,
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        _count: {
          select: {
            recipients: true,
            logs: true,
          },
        },
      },
    });
  }

  /**
   * Mettre à jour un message
   */
  async updateMessage(tenantId: string, id: string, data: {
    subject?: string;
    content?: string;
    contentFr?: string;
    contentEn?: string;
    status?: string;
  }) {
    return this.prisma.message.update({
      where: { id },
      data,
    });
  }

  /**
   * Envoyer un message (changer le statut)
   */
  async sendMessage(tenantId: string, id: string) {
    return this.prisma.message.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  /**
   * Ajouter des destinataires à un message
   */
  async addRecipients(tenantId: string, messageId: string, recipients: Array<{
    recipientId: string;
    recipientType: string;
  }>) {
    // Vérifier que le message appartient au tenant
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId },
    });

    if (!message) {
      throw new Error('Message not found or does not belong to tenant');
    }

    return this.prisma.messageRecipient.createMany({
      data: recipients.map(r => ({
        messageId,
        recipientId: r.recipientId,
        recipientType: r.recipientType,
        tenantId,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Ajouter des cibles à un message
   */
  async addTargets(messageId: string, targets: Array<{
    targetType: string;
    targetId: string;
  }>) {
    return this.prisma.messageTarget.createMany({
      data: targets.map(t => ({
        messageId,
        targetType: t.targetType,
        targetId: t.targetId,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Archiver un message
   */
  async archiveMessage(tenantId: string, id: string) {
    return this.prisma.message.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  /**
   * Supprimer un message (seulement en brouillon)
   */
  async deleteMessage(tenantId: string, id: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, tenantId },
    });

    if (message && message.status !== 'DRAFT') {
      throw new Error('Cannot delete a message that has been sent');
    }

    return this.prisma.message.delete({
      where: { id },
    });
  }
}

