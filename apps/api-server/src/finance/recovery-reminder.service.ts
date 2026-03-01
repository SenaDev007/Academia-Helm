/**
 * SOUS-MODULE 4 — Recouvrement intelligent (RecoveryReminder)
 * Détection retards, niveaux WARNING (J+3), URGENT (J+7), FINAL_NOTICE (J+15), anti-harcèlement.
 * Blocage automatique si balance > RECOVERY_BLOCK_THRESHOLD (paramètre env).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { Cron } from '@nestjs/schedule';
import { ReminderLevel, ReminderChannel } from '@prisma/client';

@Injectable()
export class RecoveryReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Cron quotidien : détecte les comptes en retard et crée les relances selon le niveau (J+3, J+7, J+15).
   */
  @Cron('0 2 * * *')
  async runNightlyDetection() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });
    for (const t of tenants) {
      try {
        await this.processTenantReminders(t.id);
      } catch (e) {
        console.error(`RecoveryReminder nightly failed for tenant ${t.id}:`, e);
      }
    }
  }

  async processTenantReminders(tenantId: string) {
    const accounts = await this.prisma.studentAccount.findMany({
      where: {
        tenantId,
        balance: { gt: 0 },
        isBlocked: false,
      },
      include: {
        student: true,
        recoveryReminders: { orderBy: { sentAt: 'desc' }, take: 5 },
      },
    });

    const now = new Date();
    const created = [];

    for (const account of accounts) {
      const balance = Number(account.balance);
      if (balance <= 0) continue;

      const reminders = account.recoveryReminders;
      const lastWarning = reminders.find((r) => r.reminderLevel === ReminderLevel.WARNING);
      const lastUrgent = reminders.find((r) => r.reminderLevel === ReminderLevel.URGENT);
      const lastFinal = reminders.find((r) => r.reminderLevel === ReminderLevel.FINAL_NOTICE);

      const academicYear = await this.prisma.academicYear.findFirst({
        where: { id: account.academicYearId },
      });
      const refDate = academicYear?.startDate ? new Date(academicYear.startDate) : account.createdAt;
      const daysSinceStart = Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceStart >= 15 && !lastFinal) {
        await this.createReminder(tenantId, account.id, account.academicYearId, ReminderLevel.FINAL_NOTICE, balance);
        created.push({ accountId: account.id, level: ReminderLevel.FINAL_NOTICE });
      } else if (daysSinceStart >= 7 && !lastUrgent) {
        await this.createReminder(tenantId, account.id, account.academicYearId, ReminderLevel.URGENT, balance);
        created.push({ accountId: account.id, level: ReminderLevel.URGENT });
      } else if (daysSinceStart >= 3 && !lastWarning) {
        await this.createReminder(tenantId, account.id, account.academicYearId, ReminderLevel.WARNING, balance);
        created.push({ accountId: account.id, level: ReminderLevel.WARNING });
      }

      // Blocage automatique si balance > seuil (RECOVERY_BLOCK_THRESHOLD en unités monétaires, ex. 50000)
      const blockThreshold = this.config.get<number>('RECOVERY_BLOCK_THRESHOLD', { infer: true })
        ?? Number(process.env.RECOVERY_BLOCK_THRESHOLD);
      if (typeof blockThreshold === 'number' && blockThreshold > 0 && balance >= blockThreshold) {
        await this.prisma.studentAccount.update({
          where: { id: account.id },
          data: { isBlocked: true, status: 'BLOCKED' as const, updatedAt: new Date() },
        });
      }
    }

    return { processed: accounts.length, created };
  }

  async createReminder(
    tenantId: string,
    studentAccountId: string,
    academicYearId: string,
    reminderLevel: ReminderLevel,
    amountDue: number,
    sentVia: ReminderChannel = ReminderChannel.SMS,
  ) {
    return this.prisma.recoveryReminder.create({
      data: {
        tenantId,
        academicYearId,
        studentAccountId,
        reminderLevel,
        amountDue,
        sentVia,
        sentAt: new Date(),
        createdBySystem: true,
      },
      include: { studentAccount: { include: { student: true } } },
    });
  }

  async sendManualReminder(
    tenantId: string,
    studentAccountId: string,
    level: ReminderLevel | string,
    channel: ReminderChannel | string,
  ) {
    const account = await this.prisma.studentAccount.findFirst({
      where: { id: studentAccountId, tenantId },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');
    const lvl = Object.values(ReminderLevel).includes(level as ReminderLevel) ? (level as ReminderLevel) : ReminderLevel.WARNING;
    const ch = Object.values(ReminderChannel).includes(channel as ReminderChannel) ? (channel as ReminderChannel) : ReminderChannel.SMS;
    return this.createReminder(tenantId, studentAccountId, account.academicYearId, lvl, Number(account.balance), ch);
  }

  async findAll(
    tenantId: string,
    filters: {
      academicYearId?: string;
      studentAccountId?: string;
      reminderLevel?: string;
    },
  ) {
    const where: any = { tenantId };
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.studentAccountId) where.studentAccountId = filters.studentAccountId;
    if (filters.reminderLevel) where.reminderLevel = filters.reminderLevel;

    return this.prisma.recoveryReminder.findMany({
      where,
      include: { studentAccount: { include: { student: true } } },
      orderBy: { sentAt: 'desc' },
    });
  }
}
