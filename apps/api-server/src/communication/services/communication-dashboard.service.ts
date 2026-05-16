import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationDashboardQueryDto } from '../dto/dashboard-query.dto';
import { CommunicationOrionService } from './communication-orion.service';

@Injectable()
export class CommunicationDashboardService {
  private readonly logger = new Logger(CommunicationDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orionService: CommunicationOrionService,
  ) {}

  async getDashboardStats(tenantId: string, query: CommunicationDashboardQueryDto) {
    try {
      const { startDate, endDate, academicYearId } = query;
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);

      const where: any = { tenantId };
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

      // 1. Overview KPIs
      const totalMessages = await this.prisma.communicationMessage.count({ where });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sentToday = await this.prisma.communicationMessage.count({
        where: { tenantId, sentAt: { gte: today } }
      });

      const failedMessages = await this.prisma.communicationRecipient.count({
        where: { tenantId, deliveryStatus: 'FAILED', createdAt: dateFilter }
      });
      const totalRecipients = await this.prisma.communicationRecipient.count({
        where: { tenantId, createdAt: dateFilter }
      });
      const failureRate = totalRecipients > 0 ? (failedMessages / totalRecipients) * 100 : 0;

      const readMessages = await this.prisma.communicationRecipient.count({
        where: { tenantId, readAt: { not: null }, createdAt: dateFilter }
      });
      const readRate = totalRecipients > 0 ? (readMessages / totalRecipients) * 100 : 0;

      // 2. Channel Health
      const channelStats = await this.getChannelStats(tenantId, dateFilter);

      // 3. Critical Alerts (ORION integration)
      const criticalAlerts = await this.getCriticalAlerts(tenantId);

      // 4. Recent Activity
      const recentActivity = await this.getRecentActivity(tenantId);

      return {
        overview: [
          { title: 'Messages Envoyés', value: totalMessages, subtitle: 'Période sélectionnée', icon: 'send' },
          { title: 'Aujourd\'hui', value: sentToday, subtitle: 'Envois du jour', icon: 'today' },
          { title: 'Taux d\'Échec', value: `${failureRate.toFixed(1)}%`, subtitle: 'Alertes techniques', icon: 'error', color: failureRate > 5 ? 'red' : 'green' },
          { title: 'Taux d\'Ouverture', value: `${readRate.toFixed(1)}%`, subtitle: 'Engagement moyen', icon: 'visibility', color: 'blue' },
        ],
        channelHealth: channelStats,
        criticalAlerts,
        recentActivity,
      };
    } catch (error) {
      this.logger.error(`Error fetching communication dashboard stats: ${error.message}`);
      throw error;
    }
  }

  private async getChannelStats(tenantId: string, dateFilter: any) {
    const channels = ['PORTAL', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'WEBHOOK'];
    const stats = await Promise.all(channels.map(async (channel) => {
      const total = await this.prisma.communicationRecipient.count({
        where: { tenantId, channel: channel as any, createdAt: dateFilter }
      });
      const failed = await this.prisma.communicationRecipient.count({
        where: { tenantId, channel: channel as any, deliveryStatus: 'FAILED', createdAt: dateFilter }
      });
      const successRate = total > 0 ? ((total - failed) / total) * 100 : 100;
      
      return {
        channel,
        total,
        successRate: `${successRate.toFixed(1)}%`,
        status: successRate > 95 ? 'HEALTHY' : successRate > 80 ? 'WARNING' : 'CRITICAL'
      };
    }));
    return stats;
  }

  private async getCriticalAlerts(tenantId: string) {
    const orionAlerts = await this.orionService.generateAlerts(tenantId);
    
    // Fallback if ORION finds nothing, show failed campaigns
    if (orionAlerts.length === 0) {
      const failedCampaigns = await this.prisma.communicationCampaign.findMany({
        where: { tenantId, status: 'FAILED' },
        take: 5,
        orderBy: { updatedAt: 'desc' }
      });

      return failedCampaigns.map(c => ({
        id: c.id,
        type: 'CAMPAIGN_FAILURE',
        title: `Échec de campagne : ${c.name}`,
        message: `La campagne "${c.name}" a échoué.`,
        severity: 'HIGH',
        timestamp: c.updatedAt
      }));
    }

    return orionAlerts.map(a => ({
      id: a.category,
      type: a.category,
      title: a.title,
      message: a.description,
      severity: a.severity,
      timestamp: a.timestamp
    }));
  }

  private async getRecentActivity(tenantId: string) {
    const recentMessages = await this.prisma.communicationMessage.findMany({
      where: { tenantId },
      include: { sender: { select: { firstName: true, lastName: true } } },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    return recentMessages.map(m => ({
      id: m.id,
      title: m.subject || 'Sans sujet',
      body: m.body.substring(0, 50) + '...',
      sender: m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : 'Système',
      type: m.type,
      status: m.status,
      timestamp: m.createdAt
    }));
  }
}
