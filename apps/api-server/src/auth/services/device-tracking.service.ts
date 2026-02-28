/**
 * Device Tracking Service
 * 
 * Service pour gérer le tracking des appareils utilisateurs
 * - Génération device_hash sécurisé
 * - Gestion des appareils trusted
 * - Révocation d'appareil
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

export interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
}

export interface CreateDeviceResult {
  deviceId: string;
  deviceHash: string;
  isNew: boolean;
}

@Injectable()
export class DeviceTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un device_hash sécurisé à partir des informations de l'appareil
   */
  generateDeviceHash(
    userId: string,
    tenantId: string,
    userAgent?: string,
    ipAddress?: string
  ): string {
    // Créer une chaîne unique basée sur l'utilisateur et les caractéristiques de l'appareil
    const deviceFingerprint = `${userId}:${tenantId}:${userAgent || 'unknown'}:${ipAddress || 'unknown'}`;
    
    // Générer un hash SHA-256
    const hash = crypto
      .createHash('sha256')
      .update(deviceFingerprint)
      .digest('hex');

    return hash;
  }

  /**
   * Crée ou récupère un appareil
   */
  async createOrGetDevice(
    userId: string,
    tenantId: string,
    deviceInfo: DeviceInfo
  ): Promise<CreateDeviceResult> {
    const deviceHash = this.generateDeviceHash(
      userId,
      tenantId,
      deviceInfo.userAgent,
      deviceInfo.ipAddress
    );

    // Chercher un appareil existant
    const existingDevice = await this.prisma.userDevice.findUnique({
      where: { deviceHash },
    });

    if (existingDevice) {
      // Mettre à jour lastUsedAt
      const updated = await this.prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: {
          lastUsedAt: new Date(),
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
        },
      });

      return {
        deviceId: updated.id,
        deviceHash: updated.deviceHash,
        isNew: false,
      };
    }

    // Créer un nouvel appareil
    const newDevice = await this.prisma.userDevice.create({
      data: {
        userId,
        tenantId,
        deviceHash,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ipAddress,
        isTrusted: false,
        lastUsedAt: new Date(),
      },
    });

    return {
      deviceId: newDevice.id,
      deviceHash: newDevice.deviceHash,
      isNew: true,
    };
  }

  /**
   * Vérifie si un appareil est trusted
   */
  async isDeviceTrusted(deviceId: string): Promise<boolean> {
    const device = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
      select: { isTrusted: true, revokedAt: true },
    });

    if (!device) {
      return false;
    }

    if (device.revokedAt) {
      return false;
    }

    return device.isTrusted;
  }

  /**
   * Marque un appareil comme trusted
   */
  async trustDevice(deviceId: string): Promise<void> {
    await this.prisma.userDevice.update({
      where: { id: deviceId },
      data: {
        isTrusted: true,
        trustedAt: new Date(),
      },
    });
  }

  /**
   * Révoque un appareil
   */
  async revokeDevice(deviceId: string, userId: string): Promise<void> {
    await this.prisma.userDevice.update({
      where: { id: deviceId, userId },
      data: {
        isTrusted: false,
        revokedAt: new Date(),
      },
    });

    // Invalider toutes les sessions de cet appareil
    await this.prisma.deviceSession.updateMany({
      where: { deviceId, isActive: true },
      data: { isActive: false },
    });
  }

  /**
   * Liste les appareils d'un utilisateur
   */
  async getUserDevices(userId: string, tenantId: string) {
    return this.prisma.userDevice.findMany({
      where: {
        userId,
        tenantId,
        revokedAt: null,
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        isTrusted: true,
        lastUsedAt: true,
        trustedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Vérifie si un appareil nécessite une vérification OTP
   */
  async requiresOtpVerification(
    deviceId: string,
    userId: string,
    tenantId: string,
    academicYearId: string
  ): Promise<boolean> {
    const device = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
      select: { isTrusted: true, revokedAt: true },
    });

    if (!device || device.revokedAt || !device.isTrusted) {
      return true; // Nouvel appareil ou appareil non trusted
    }

    // Vérifier s'il existe une session active pour ce contexte
    const activeSession = await this.prisma.deviceSession.findFirst({
      where: {
        userId,
        tenantId,
        academicYearId,
        deviceId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!activeSession) {
      return true; // Pas de session active pour ce contexte
    }

    return false; // Appareil trusted avec session active
  }

  /**
   * Liste tous les appareils du tenant (admin sync / tableau appareils)
   * Utilisé par GET /sync/devices pour Promoteur / PLATFORM_OWNER
   */
  async getTenantDevices(tenantId: string) {
    return this.prisma.userDevice.findMany({
      where: { tenantId, revokedAt: null },
      orderBy: [{ lastSyncAt: 'desc' }, { lastUsedAt: 'desc' }],
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        userAgent: true,
        ipAddress: true,
        isTrusted: true,
        lastUsedAt: true,
        lastSyncAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
