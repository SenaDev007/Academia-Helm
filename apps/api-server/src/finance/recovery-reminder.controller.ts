/**
 * SOUS-MODULE 4 — Recouvrement — API (liste rappels, rappel manuel).
 * La levée de blocage reste sur POST api/finance/accounts/:id/unblock.
 */
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { RecoveryReminderService } from './recovery-reminder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('api/finance/recovery-reminders')
@UseGuards(JwtAuthGuard)
export class RecoveryReminderController {
  constructor(private readonly service: RecoveryReminderService) {}

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
}
