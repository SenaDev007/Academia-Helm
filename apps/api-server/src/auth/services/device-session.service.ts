/**
 * Device Session Service
 * 
 * Service pour gérer les sessions liées aux appareils
 * - Liaison stricte tenant_id + academic_year_id + device_id
 * - Invalidation automatique si contexte change
 * - Gestion de l'expiration
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface CreateSessionRequest {
  userId: string;
  tenantId: string;
  academicYearId: string;
  deviceId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionResult {
  sessionId: string;
  sessionToken: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class DeviceSessionService {
  private readonly logger = new Logger(DeviceSessionService.name);
  private readonly sessionExpirationHours = 24;
  private readonly refreshTokenExpirationDays = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Génère un token de session sécurisé
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Génère un refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Crée une nouvelle session device
   */
  async createSession(request: CreateSessionRequest): Promise<SessionResult> {
    // Invalider les sessions actives pour ce contexte si l'appareil change
    // ou si l'année académique change
    await this.invalidateContextSessions(
      request.userId,
      request.tenantId,
      request.academicYearId,
      request.deviceId
    );

    const sessionToken = this.generateSessionToken();
    const refreshToken = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.sessionExpirationHours * 60 * 60 * 1000);

    const session = await this.prisma.deviceSession.create({
      data: {
        userId: request.userId,
        tenantId: request.tenantId,
        academicYearId: request.academicYearId,
        deviceId: request.deviceId,
        sessionToken,
        refreshToken,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        expiresAt,
        lastActivityAt: new Date(),
      },
    });

    // Logger l'audit
    await this.logAudit({
      userId: request.userId,
      tenantId: request.tenantId,
      deviceId: request.deviceId,
      sessionId: session.id,
      action: 'LOGIN',
      status: 'SUCCESS',
      metadata: { academicYearId: request.academicYearId },
    });

    return {
      sessionId: session.id,
      sessionToken,
      refreshToken,
      expiresAt,
    };
  }

  /**
   * Valide une session
   */
  async validateSession(sessionToken: string): Promise<{
    valid: boolean;
    sessionId?: string;
    userId?: string;
    tenantId?: string;
    academicYearId?: string;
    deviceId?: string;
  }> {
    const session = await this.prisma.deviceSession.findUnique({
      where: { sessionToken },
      include: {
        device: {
          select: { isTrusted: true, revokedAt: true },
        },
      },
    });

    if (!session) {
      return { valid: false };
    }

    // Vérifier que la session est active
    if (!session.isActive) {
      await this.logAudit({
        userId: session.userId,
        tenantId: session.tenantId,
        deviceId: session.deviceId,
        sessionId: session.id,
        action: 'SESSION_EXPIRED',
        status: 'FAILED',
        reason: 'Session inactive',
      });

      return { valid: false };
    }

    // Vérifier l'expiration
    if (new Date() > session.expiresAt) {
      await this.prisma.deviceSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });

      await this.logAudit({
        userId: session.userId,
        tenantId: session.tenantId,
        deviceId: session.deviceId,
        sessionId: session.id,
        action: 'SESSION_EXPIRED',
        status: 'FAILED',
        reason: 'Session expirée',
      });

      return { valid: false };
    }

    // Vérifier que l'appareil n'est pas révoqué
    if (session.device.revokedAt || !session.device.isTrusted) {
      await this.prisma.deviceSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });

      await this.logAudit({
        userId: session.userId,
        tenantId: session.tenantId,
        deviceId: session.deviceId,
        sessionId: session.id,
        action: 'DEVICE_REVOKED',
        status: 'FAILED',
        reason: 'Appareil révoqué',
      });

      return { valid: false };
    }

    // Mettre à jour la dernière activité
    await this.prisma.deviceSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    return {
      valid: true,
      sessionId: session.id,
      userId: session.userId,
      tenantId: session.tenantId,
      academicYearId: session.academicYearId,
      deviceId: session.deviceId,
    };
  }

  /**
   * Invalide les sessions pour un contexte donné
   */
  private async invalidateContextSessions(
    userId: string,
    tenantId: string,
    academicYearId: string,
    currentDeviceId: string
  ): Promise<void> {
    // Invalider toutes les sessions actives pour cet utilisateur/tenant/année
    // sauf celles du device actuel
    const invalidated = await this.prisma.deviceSession.updateMany({
      where: {
        userId,
        tenantId,
        academicYearId,
        deviceId: { not: currentDeviceId },
        isActive: true,
      },
      data: { isActive: false },
    });

    if (invalidated.count > 0) {
      await this.logAudit({
        userId,
        tenantId,
        action: 'CONTEXT_CHANGED',
        status: 'SUCCESS',
        reason: `Invalidated ${invalidated.count} sessions for context change`,
        metadata: { academicYearId, currentDeviceId },
      });
    }
  }

  /**
   * Invalide une session (logout)
   */
  async invalidateSession(sessionToken: string, userId: string): Promise<void> {
    const session = await this.prisma.deviceSession.findUnique({
      where: { sessionToken },
    });

    if (!session || session.userId !== userId) {
      return;
    }

    await this.prisma.deviceSession.update({
      where: { id: session.id },
      data: { isActive: false },
    });

    await this.logAudit({
      userId,
      tenantId: session.tenantId,
      deviceId: session.deviceId,
      sessionId: session.id,
      action: 'LOGOUT',
      status: 'SUCCESS',
    });
  }

  /**
   * Invalide toutes les sessions d'un utilisateur
   */
  async invalidateAllUserSessions(userId: string, tenantId: string): Promise<void> {
    await this.prisma.deviceSession.updateMany({
      where: {
        userId,
        tenantId,
        isActive: true,
      },
      data: { isActive: false },
    });

    await this.logAudit({
      userId,
      tenantId,
      action: 'LOGOUT',
      status: 'SUCCESS',
      reason: 'All sessions invalidated',
    });
  }

  /**
   * Nettoie les sessions expirées
   */
  async cleanupExpiredSessions(): Promise<void> {
    const result = await this.prisma.deviceSession.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
      data: { isActive: false },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
  }

  /**
   * Logger un audit
   */
  private async logAudit(data: {
    userId?: string;
    tenantId?: string;
    deviceId?: string;
    sessionId?: string;
    action: string;
    status: string;
    reason?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.prisma.authAuditLog.create({
        data: {
          userId: data.userId,
          tenantId: data.tenantId,
          deviceId: data.deviceId,
          sessionId: data.sessionId,
          action: data.action,
          status: data.status,
          reason: data.reason,
          metadata: data.metadata || {},
        },
      });
    } catch (error) {
      this.logger.error('Failed to log audit:', error);
    }
  }
}
