/**
 * SOUS-MODULE 4 — Recouvrement — API (liste rappels, rappel manuel, notification multi-canal).
 * La levée de blocage reste sur POST api/finance/accounts/:id/unblock.
 */
import { Controller, Get, Post, Delete, Body, Query, UseGuards, Param } from '@nestjs/common';
import { RecoveryReminderService } from './recovery-reminder.service';
import { RecoveryNotificationFinanceService } from './recovery-notification-finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('finance/recovery-reminders')
@UseGuards(JwtAuthGuard)
export class RecoveryReminderController {
  constructor(
    private readonly service: RecoveryReminderService,
    private readonly recoveryNotificationService: RecoveryNotificationFinanceService,
  ) {}

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('studentAccountId') studentAccountId?: string,
    @Query('reminderLevel') reminderLevel?: string,
  ) {
    return this.service.findAll(tenantId, {
      academicYearId,
      studentAccountId,
      reminderLevel,
    });
  }

  @Post('manual')
  async sendManual(
    @TenantId() tenantId: string,
    @Body() body: { studentAccountId: string; level: string; channel?: string },
  ) {
    return this.service.sendManualReminder(
      tenantId,
      body.studentAccountId,
      body.level ?? 'WARNING',
      body.channel ?? 'SMS',
    );
  }

  @Post('run-nightly')
  async runNightly(@TenantId() tenantId: string) {
    return this.service.processTenantReminders(tenantId);
  }

  /**
   * DELETE /finance/recovery-reminders/:id
   * Supprime une relance (pour correction d'erreurs de saisie).
   */
  @Delete(':id')
  async deleteReminder(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.deleteReminder(tenantId, id);
  }

  /**
   * POST /finance/recovery-reminders/:arrearId/notify
   *
   * Envoie une relance multi-canal (email + WhatsApp + SMS) au parent de
   * l'élève ayant un arriéré. Reproduit le pattern des notifications de reçu.
   *
   * Body: {
   *   channels: ('email' | 'whatsapp' | 'sms')[],   // défaut: ['email', 'whatsapp', 'sms']
   *   level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE',  // défaut: PREMIERE_RELANCE
   * }
   *
   * Response: {
   *   arrearId, level, channels: {
   *     email:    { status, to?, error? },
   *     whatsapp: { status, to?, error? },
   *     sms:      { status, to?, error? },
   *   }
   * }
   */
  @Post(':arrearId/notify')
  async sendNotification(
    @TenantId() tenantId: string,
    @Param('arrearId') arrearId: string,
    @Body() body: { channels?: string[]; level?: string },
  ) {
    const channels = (body?.channels ?? ['email', 'whatsapp', 'sms']) as (
      'email' | 'whatsapp' | 'sms'
    )[];
    const level = (body?.level ?? 'PREMIERE_RELANCE') as
      | 'PREMIERE_RELANCE'
      | 'DEUXIEME_RELANCE'
      | 'MISE_EN_DEMEURE';

    const results = await this.recoveryNotificationService.sendRecoveryNotifications(
      arrearId,
      tenantId,
      channels,
      level,
    );

    return {
      success: true,
      arrearId,
      level,
      channels: results,
    };
  }
}
