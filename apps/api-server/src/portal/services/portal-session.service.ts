/**
 * ============================================================================
 * PORTAL SESSION SERVICE - GESTION DES SESSIONS DE PORTAIL
 * ============================================================================
 * 
 * Service pour gérer les sessions de portail (contexte d'accès sécurisé)
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PortalSessionService {
  private readonly logger = new Logger(PortalSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une session de portail
   */
  async createSession(
    tenantId: string,
    portalType: 'SCHOOL' | 'TEACHER' | 'PARENT',
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24h d'expiration

    return this.prisma.portalSession.create({
      data: {
        tenantId,
        portalType,
        userId: userId || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
      },
    });
  }

  /**
   * Récupère une session active
   */
  async getActiveSession(sessionId: string) {
    return this.prisma.portalSession.findFirst({
      where: {
        id: sessionId,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            subdomain: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Supprime une session (logout)
   */
  async deleteSession(sessionId: string) {
    return this.prisma.portalSession.delete({
      where: { id: sessionId },
    });
  }
}

