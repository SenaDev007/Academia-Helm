/**
 * ============================================================================
 * TEMPLATES PRISMA SERVICE
 * ============================================================================
 * Gestion des templates de messages
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TemplatesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un template
   */
  async createTemplate(tenantId: string, data: {
    name: string;
    type: string;
    channelId?: string;
    subject?: string;
    content: string;
    contentFr?: string;
    contentEn?: string;
    variables?: any;
    isActive?: boolean;
  }) {
    return this.prisma.messageTemplate.create({
      data: {
        tenantId,
        ...data,
      },
      include: {
        channel: true,
      },
    });
  }

  /**
   * Récupérer tous les templates d'un tenant
   */
  async findAllTemplates(tenantId: string, filters?: {
    type?: string;
    channelId?: string;
    isActive?: boolean;
  }) {
    return this.prisma.messageTemplate.findMany({
      where: {
        tenantId,
        ...filters,
      },
      include: {
        channel: true,
        _count: {
          select: {
            triggers: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Récupérer un template par ID
   */
  async findTemplateById(tenantId: string, id: string) {
    return this.prisma.messageTemplate.findFirst({
      where: { id, tenantId },
      include: {
        channel: true,
        triggers: true,
      },
    });
  }

  /**
   * Récupérer les templates par type
   */
  async findTemplatesByType(tenantId: string, type: string) {
    return this.prisma.messageTemplate.findMany({
      where: {
        tenantId,
        type,
        isActive: true,
      },
      include: {
        channel: true,
      },
    });
  }

  /**
   * Mettre à jour un template
   */
  async updateTemplate(tenantId: string, id: string, data: {
    name?: string;
    subject?: string;
    content?: string;
    contentFr?: string;
    contentEn?: string;
    variables?: any;
    isActive?: boolean;
  }) {
    return this.prisma.messageTemplate.update({
      where: { id },
      data,
    });
  }

  /**
   * Activer/Désactiver un template
   */
  async toggleTemplate(tenantId: string, id: string, isActive: boolean) {
    return this.prisma.messageTemplate.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Supprimer un template
   */
  async deleteTemplate(tenantId: string, id: string) {
    return this.prisma.messageTemplate.delete({
      where: { id },
    });
  }
}

