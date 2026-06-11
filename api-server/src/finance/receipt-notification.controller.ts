/**
 * ============================================================================
 * RECEIPT NOTIFICATION CONTROLLER
 * ============================================================================
 * 
 * API endpoints pour gérer les notifications de reçus
 * 
 * ============================================================================
 */

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReceiptNotificationService } from './receipt-notification.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('receipts/notifications')
@UseGuards(JwtAuthGuard)
export class ReceiptNotificationController {
  constructor(
    private readonly notificationService: ReceiptNotificationService,
  ) {}

  /**
   * Récupère l'historique des notifications pour un paiement
   */
  @Get('payment/:paymentId')
  async getNotificationHistory(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: User,
  ) {
    return this.notificationService.getNotificationHistory(paymentId);
  }

  /**
   * Récupère les statistiques des notifications
   */
  @Get('stats')
  async getNotificationStats(
    @CurrentUser() user: User,
  ) {
    // TODO: Récupérer tenantId et academicYearId depuis le user
    return this.notificationService.getNotificationStats(
      user.tenantId || '',
      undefined,
    );
  }
}

