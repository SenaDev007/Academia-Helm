/**
 * Admin Devices Controller
 * 
 * Contrôleur pour la gestion des appareils par le Super Admin
 * - Liste tous les appareils (tous utilisateurs/tenants)
 * - Détails d'un appareil
 * - Révoquer un appareil
 * - Statistiques des appareils
 */

import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('admin/devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminDevicesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /admin/devices
   * 
   * Liste tous les appareils (tous utilisateurs/tenants)
   */
  @Get()
  async listAllDevices(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('isTrusted') isTrusted?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const where: any = {
      revokedAt: null,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (isTrusted !== undefined) {
      where.isTrusted = isTrusted === 'true';
    }

    const devices = await this.prisma.userDevice.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            deviceSessions: true,
            otpCodes: true,
          },
        },
      },
      orderBy: { lastUsedAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
      skip: offset ? parseInt(offset, 10) : 0,
    });

    const total = await this.prisma.userDevice.count({ where });

    return {
      success: true,
      devices,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
      },
    };
  }

  /**
   * GET /admin/devices/:deviceId
   * 
   * Détails d'un appareil
   */
  @Get(':deviceId')
  async getDeviceDetails(@Param('deviceId') deviceId: string) {
    const device = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        deviceSessions: {
          where: { isActive: true },
          orderBy: { lastActivityAt: 'desc' },
          take: 5,
          select: {
            id: true,
            academicYearId: true,
            lastActivityAt: true,
            expiresAt: true,
            ipAddress: true,
          },
        },
        otpCodes: {
          where: {
            isUsed: false,
            isExpired: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            purpose: true,
            phoneNumber: true,
            createdAt: true,
            expiresAt: true,
          },
        },
        authAuditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            status: true,
            reason: true,
            createdAt: true,
            ipAddress: true,
          },
        },
      },
    });

    if (!device) {
      return {
        success: false,
        error: 'Appareil non trouvé',
      };
    }

    return {
      success: true,
      device,
    };
  }

  /**
   * DELETE /admin/devices/:deviceId
   * 
   * Révoque un appareil (Super Admin uniquement)
   */
  @Delete(':deviceId')
  @HttpCode(HttpStatus.OK)
  async revokeDevice(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: any
  ) {
    const device = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return {
        success: false,
        error: 'Appareil non trouvé',
      };
    }

    // Révoquer l'appareil
    await this.prisma.userDevice.update({
      where: { id: deviceId },
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

    // Logger l'audit
    await this.prisma.authAuditLog.create({
      data: {
        userId: device.userId,
        tenantId: device.tenantId,
        deviceId,
        action: 'DEVICE_REVOKED',
        status: 'SUCCESS',
        reason: `Appareil révoqué par Super Admin: ${user.email}`,
        metadata: {
          revokedBy: user.id,
          revokedByEmail: user.email,
        },
      },
    });

    return {
      success: true,
      message: 'Appareil révoqué avec succès',
    };
  }

  /**
   * GET /admin/devices/stats/overview
   * 
   * Statistiques des appareils
   */
  @Get('stats/overview')
  async getDeviceStats() {
    const [
      totalDevices,
      trustedDevices,
      revokedDevices,
      activeSessions,
      pendingOtp,
    ] = await Promise.all([
      this.prisma.userDevice.count({ where: { revokedAt: null } }),
      this.prisma.userDevice.count({ where: { isTrusted: true, revokedAt: null } }),
      this.prisma.userDevice.count({ where: { revokedAt: { not: null } } }),
      this.prisma.deviceSession.count({ where: { isActive: true } }),
      this.prisma.otpCode.count({
        where: {
          isUsed: false,
          isExpired: false,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      success: true,
      stats: {
        totalDevices,
        trustedDevices,
        revokedDevices,
        activeSessions,
        pendingOtp,
      },
    };
  }
}
