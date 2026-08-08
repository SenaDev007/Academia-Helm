/**
 * Tenant Devices Controller
 *
 * Endpoints pour la gestion des appareils au niveau d'un tenant spécifique :
 *   GET  /auth/devices/connected          — Appareils connectés récents (30j par défaut)
 *   GET  /auth/devices/login-history       — Historique paginé des connexions
 *   POST /auth/devices/:deviceId/approve   — Approuver un nouvel appareil (validation admin)
 *
 * Accès : PLATFORM_OWNER, PLATFORM_ADMIN, SUPER_ADMIN, SCHOOL_OWNER, SCHOOL_ADMIN,
 *         PROMOTER, DIRECTEUR_GENERAL, DIRECTEUR_ETABLISSEMENT
 *
 * Le filtrage par tenantId garantit l'isolation stricte entre établissements.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'PLATFORM_OWNER',
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'PROMOTER',
  'SCHOOL_OWNER',
  'SCHOOL_ADMIN',
  'DIRECTEUR_GENERAL',
  'DIRECTEUR_ETABLISSEMENT',
  'DIRECTEUR',
];

@Controller('auth/devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class TenantDevicesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcule la date de début en fonction de la période demandée.
   */
  private periodToStartDate(period?: string): Date {
    const now = new Date();
    switch (period) {
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case 'quarter':
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case 'year':
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case '30d':
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * GET /auth/devices/connected
   *
   * Liste les appareils ayant eu une activité récente (lastUsedAt ou lastSyncAt
   * dans la période). Période par défaut : 30 derniers jours.
   */
  @Get('connected')
  async getConnectedDevices(
    @TenantId() tenantId: string | undefined,
    @Query('tenant_id') tenant_id?: string,
    @Query('period') period?: string,
  ) {
    const tid = tenant_id || tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const startDate = this.periodToStartDate(period);

    const devices = await this.prisma.userDevice.findMany({
      where: {
        tenantId: tid,
        revokedAt: null,
        OR: [
          { lastUsedAt: { gte: startDate } },
          { lastSyncAt: { gte: startDate } },
        ],
      },
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
        _count: {
          select: {
            deviceSessions: { where: { isActive: true } },
          },
        },
      },
      orderBy: { lastUsedAt: 'desc' },
      take: 200,
    });

    return {
      success: true,
      period: period || '30d',
      count: devices.length,
      devices: devices.map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        userAgent: d.userAgent,
        ipAddress: d.ipAddress,
        isTrusted: d.isTrusted,
        isPendingValidation: !d.isTrusted && !d.revokedAt,
        lastUsedAt: d.lastUsedAt,
        lastSyncAt: d.lastSyncAt,
        trustedAt: d.trustedAt,
        createdAt: d.createdAt,
        user: d.user,
        activeSessionCount: (d._count as any).deviceSessions || 0,
      })),
    };
  }

  /**
   * GET /auth/devices/login-history
   *
   * Historique paginé des connexions (AuthAuditLog).
   * Inclut le nom de l'appareil, type, IP, user-agent, statut.
   */
  @Get('login-history')
  async getLoginHistory(
    @TenantId() tenantId: string | undefined,
    @Query('tenant_id') tenant_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const tid = tenant_id || tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(200, Math.max(10, parseInt(limit || '50', 10)));

    const where: any = { tenantId: tid };
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.authAuditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
          },
          device: {
            select: {
              id: true,
              deviceName: true,
              deviceType: true,
              userAgent: true,
              ipAddress: true,
              isTrusted: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.authAuditLog.count({ where }),
    ]);

    return {
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        reason: log.reason,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        user: log.user,
        device: log.device
          ? {
              id: log.device.id,
              name: log.device.deviceName,
              type: log.device.deviceType,
              ip: log.device.ipAddress,
              isTrusted: log.device.isTrusted,
            }
          : null,
      })),
    };
  }

  /**
   * POST /auth/devices/:deviceId/approve
   *
   * Approuve manuellement un appareil en attente de validation.
   * Marque l'appareil comme trusted et l'ajoute à la liste des appareils connus.
   */
  @Post(':deviceId/approve')
  @HttpCode(HttpStatus.OK)
  async approveDevice(
    @Param('deviceId') deviceId: string,
    @TenantId() tenantId: string | undefined,
    @Query('tenant_id') tenant_id?: string,
  ) {
    const tid = tenant_id || tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');

    const device = await this.prisma.userDevice.findFirst({
      where: { id: deviceId, tenantId: tid },
    });
    if (!device) {
      return { success: false, error: 'Appareil non trouvé dans ce tenant' };
    }
    if (device.isTrusted) {
      return { success: true, message: 'Appareil déjà approuvé', alreadyTrusted: true };
    }

    await this.prisma.userDevice.update({
      where: { id: deviceId },
      data: {
        isTrusted: true,
        trustedAt: new Date(),
      },
    });

    await this.prisma.authAuditLog.create({
      data: {
        userId: device.userId,
        tenantId: tid,
        deviceId,
        action: 'DEVICE_APPROVED',
        status: 'SUCCESS',
        reason: `Appareil approuvé manuellement par un administrateur`,
      },
    });

    return { success: true, message: 'Appareil approuvé avec succès' };
  }
}
