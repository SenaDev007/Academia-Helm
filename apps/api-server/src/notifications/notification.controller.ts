/**
 * ============================================================================
 * NOTIFICATIONS CONTROLLER — Cloche header (in-app notifications)
 * ============================================================================
 *
 * Endpoints REST pour le frontend :
 *   GET    /notifications                — liste (filtre ?unread=true, pagination)
 *   GET    /notifications/unread-count   — compteur non lues
 *   PATCH  /notifications/:id/read       — marquer comme lue
 *   PATCH  /notifications/read-all       — tout marquer comme lu
 *   DELETE /notifications/:id            — supprimer
 *
 * Auth : JwtAuthGuard + tenant scope (le recipientId = userId courant).
 * ============================================================================
 */

import {
  Controller, Get, Patch, Delete, Post, Param, Query, Body, UseGuards, BadRequestException, Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushService: PushService,
  ) {}

  /**
   * GET /notifications?unread=true&limit=20&offset=0
   * Liste les notifications de l'utilisateur courant.
   */
  @Get()
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    return this.notificationService.listForUser(tenantId, user.id, {
      onlyUnread: unread === 'true',
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * GET /notifications/unread-count → { count: number }
   */
  @Get('unread-count')
  async unreadCount(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    const count = await this.notificationService.unreadCount(tenantId, user.id);
    return { count };
  }

  /**
   * GET /notifications/vapid-public-key → { publicKey: string | null }
   * Retourne la clé publique VAPID pour le frontend (pushManager.subscribe).
   * null si Web Push n'est pas configuré.
   */
  @Get('vapid-public-key')
  async getVapidPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  /**
   * POST /notifications/subscribe
   * Body: { endpoint, keys: { p256dh, auth }, expirationTime? }
   * Enregistre un abonnement push pour l'utilisateur courant.
   */
  @Post('subscribe')
  async subscribe(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: any,
    @Req() req: Request,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      throw new BadRequestException('endpoint, keys.p256dh et keys.auth sont requis');
    }
    const userAgent = req.headers['user-agent'] || undefined;
    return this.pushService.subscribe(
      user.id,
      tenantId,
      {
        endpoint: body.endpoint,
        keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
        expirationTime: body.expirationTime,
      },
      userAgent,
    );
  }

  /**
   * DELETE /notifications/subscribe
   * Body: { endpoint }
   * Supprime un abonnement push.
   */
  @Delete('subscribe')
  async unsubscribe(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    if (!body?.endpoint) {
      throw new BadRequestException('endpoint est requis');
    }
    await this.pushService.unsubscribe(user.id, body.endpoint);
    return { success: true };
  }

  /**
   * PATCH /notifications/:id/read — marquer comme lue
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    await this.notificationService.markAsRead(id, user.id);
    return { success: true };
  }

  /**
   * PATCH /notifications/read-all — tout marquer comme lu
   */
  @Patch('read-all')
  async markAllAsRead(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    await this.notificationService.markAllAsRead(tenantId, user.id);
    return { success: true };
  }

  /**
   * DELETE /notifications/:id — supprimer
   */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.id) throw new BadRequestException('Utilisateur non identifié');
    await this.notificationService.delete(id, user.id);
    return { success: true };
  }
}
